import { useState } from 'react';
import { 
  IndianRupee, FileText, Download, CheckCircle, Clock, Plus, X, Building2, 
  Calendar, CheckSquare, Square, ShieldCheck, Printer, ArrowRight, Percent
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function Billing() {
  const { schools, billing, createInvoice, updateInvoiceStatus, confirmPaymentReceipt } = useData();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');

  // Payment Confirmation Modal State
  const [confirmingTranche, setConfirmingTranche] = useState(null);
  const [paymentConfirmationData, setPaymentConfirmationData] = useState({
    payment_method: 'NEFT Bank Transfer',
    receipt_no: '',
    place_of_supply: 'Hata, Uttar Pradesh',
    paid_date: new Date().toISOString().split('T')[0]
  });

  const [formData, setFormData] = useState({
    school_id: 'ZPS',
    tranche_number: 1,
    tranche_title: 'Tranche 1: Lab Setup & Hardware Kit Dispatch (40%)',
    amount: 40000,
    total_contract_value: 100000,
    date_issued: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    place_of_supply: 'Hata, Uttar Pradesh',
    status: 'Pending'
  });

  // Calculate Aggregates for Zenith Public School Contract (₹100,000 in 3 Tranches: 40k, 30k, 30k)
  const totalContract = 100000;
  const totalInvoiced = billing.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const paidRevenue = billing.filter(b => b.status === 'Paid' || b.is_confirmed === 1).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const pendingRevenue = Math.max(0, totalContract - paidRevenue);
  const collectedPercentage = Math.min(100, Math.round((paidRevenue / totalContract) * 100));

  const filteredBilling = billing.filter(b => statusFilter === 'All' || b.status === statusFilter);

  const handleOpenConfirmModal = (inv) => {
    setConfirmingTranche(inv);
    setPaymentConfirmationData({
      payment_method: inv.payment_method || 'NEFT Bank Transfer',
      receipt_no: inv.receipt_no || `REC-ZPS-2026-0${inv.tranche_number || 1}`,
      place_of_supply: inv.place_of_supply || 'Hata, Uttar Pradesh',
      paid_date: inv.paid_date || new Date().toISOString().split('T')[0]
    });
  };

  const handleConfirmPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!confirmingTranche) return;

    await confirmPaymentReceipt(
      confirmingTranche.id,
      true,
      paymentConfirmationData.payment_method,
      paymentConfirmationData.receipt_no
    );

    toast.success(
      `Payment of ₹${(confirmingTranche.amount || 0).toLocaleString('en-IN')} confirmed for ${confirmingTranche.tranche_title}! Receipt ${paymentConfirmationData.receipt_no} generated.`,
      'Payment Verified & Recorded'
    );
    setConfirmingTranche(null);
  };

  const handleTogglePayment = async (inv) => {
    if (inv.status === 'Paid' || inv.is_confirmed === 1) {
      if (confirm(`Revert payment status for ${inv.tranche_title || inv.id} back to Pending?`)) {
        await updateInvoiceStatus(inv.id, 'Pending');
        toast.info(`Invoice ${inv.id} reverted to Pending.`);
      }
    } else {
      handleOpenConfirmModal(inv);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const schoolName = schools.find(s => s.id === formData.school_id)?.name || 'Zenith Public School';
    await createInvoice({
      ...formData,
      school_name: schoolName,
      amount: Number(formData.amount) || 0
    });
    toast.success(`Tax Invoice created for ${schoolName} (₹${Number(formData.amount).toLocaleString('en-IN')})`, 'Invoice Generated');
    setIsModalOpen(false);
  };

  const handlePrintInvoice = (inv) => {
    const printWindow = window.open('', '_blank');
    const isPaid = inv.status === 'Paid' || inv.is_confirmed === 1;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tax Invoice & Payment Receipt - ${inv.id}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
            body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 40px; color: #0f172a; margin: 0; background: #fff; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0066FF; padding-bottom: 20px; }
            .brand-name { font-size: 26px; font-weight: 800; color: #0A1A33; letter-spacing: 0.5px; }
            .brand-name span { color: #0066FF; }
            .badge-paid { display: inline-block; padding: 6px 16px; background: #ecfdf5; border: 1.5px solid #10b981; color: #047857; font-weight: 800; font-size: 13px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px; }
            .badge-pending { display: inline-block; padding: 6px 16px; background: #fffbeb; border: 1.5px solid #f59e0b; color: #b45309; font-weight: 800; font-size: 13px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px; }
            .meta-grid { margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
            .info-block { background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .info-title { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th { background: #0A1A33; color: #fff; font-size: 12px; text-transform: uppercase; padding: 12px 14px; text-align: left; letter-spacing: 0.5px; }
            td { border-bottom: 1px solid #e2e8f0; padding: 14px; font-size: 13px; color: #334155; }
            .total-row { background: #f1f5f9; font-weight: 800; font-size: 15px; color: #0f172a; }
            .stamp-box { margin-top: 35px; border: 2px dashed ${isPaid ? '#10b981' : '#f59e0b'}; padding: 18px; border-radius: 12px; background: ${isPaid ? '#f0fdf4' : '#fffbeb'}; display: flex; justify-content: space-between; align-items: center; }
            .footer-note { margin-top: 40px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand-name">PIXIU<span>.</span>TECH</div>
              <p style="color: #475569; font-size: 12px; margin: 4px 0 0 0; font-weight: 600;">Official STEM & Robotics Educational Partner</p>
              <p style="font-size: 11px; color: #64748b; margin: 2px 0;">Place of Supply: <strong>${inv.place_of_supply || 'Hata, Uttar Pradesh'}</strong></p>
              <p style="font-size: 11px; color: #64748b; margin: 2px 0;">GSTIN: <strong>07AAAAA0000A1Z5</strong> | PAN: <strong>AAAFP0000A</strong></p>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; color: #0066FF; font-size: 20px;">TAX INVOICE & RECEIPT</h2>
              <p style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: bold; margin: 4px 0;">Invoice ID: ${inv.id}</p>
              <div style="margin-top: 8px;">
                <span class="${isPaid ? 'badge-paid' : 'badge-pending'}">
                  ${isPaid ? '✓ PAID & VERIFIED' : '⏳ PAYMENT DUE'}
                </span>
              </div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="info-block">
              <div class="info-title">Billed To (Partner Institution)</div>
              <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #0f172a;">${inv.school_name || 'Zenith Public School'}</h3>
              <p style="margin: 0; font-size: 12px; color: #475569;">School Code: <strong>ZPS</strong> | Principal: Dr. R.K. Sharma</p>
              <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569;">Campus Address: Main Road, Hata, Uttar Pradesh - 274234</p>
            </div>

            <div class="info-block" style="text-align: right;">
              <div class="info-title">Contract & Schedule Details</div>
              <p style="margin: 0; font-size: 12px; color: #475569;">Total Annual Contract: <strong>₹1,00,000 (3 Tranches)</strong></p>
              <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569;">Invoice Date: <strong>${inv.date_issued}</strong></p>
              <p style="margin: 3px 0 0 0; font-size: 12px; color: #475569;">Due Date: <strong>${inv.due_date}</strong></p>
              ${inv.paid_date ? `<p style="margin: 3px 0 0 0; font-size: 12px; color: #047857; font-weight: bold;">Receipt Date: ${inv.paid_date}</p>` : ''}
              ${inv.receipt_no ? `<p style="margin: 3px 0 0 0; font-size: 12px; font-family: 'JetBrains Mono'; color: #0066FF;">Ref No: ${inv.receipt_no}</p>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Tranche Milestone & Description</th>
                <th>Share</th>
                <th>Place of Supply</th>
                <th>Due Date</th>
                <th style="text-align: right;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>${inv.tranche_title || 'STEM & Robotics Lab Installation & Training Program'}</strong>
                  <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Hardware Kit Allocation (KIT-ZPS-01 to 25) + Classes 6, 7, 8, 9, 11 (5 Levels)</div>
                </td>
                <td><strong>${inv.tranche_number === 1 ? '40%' : '30%'}</strong></td>
                <td>${inv.place_of_supply || 'Hata, UP'}</td>
                <td>${inv.due_date}</td>
                <td style="text-align: right; font-weight: 800; font-family: 'JetBrains Mono';">₹${(inv.amount || 0).toLocaleString('en-IN')}</td>
              </tr>
              <tr class="total-row">
                <td colspan="4" style="text-align: right; font-weight: 800;">Tranche Total Payable:</td>
                <td style="text-align: right; font-weight: 800; color: #0066FF; font-family: 'JetBrains Mono';">₹${(inv.amount || 0).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div class="stamp-box">
            <div>
              <p style="margin: 0; font-size: 12px; font-weight: 700; color: ${isPaid ? '#047857' : '#b45309'};">
                ${isPaid ? 'Payment Status: RECONCILED & RECEIVED' : 'Payment Status: PENDING CONFIRMATION'}
              </p>
              <p style="margin: 3px 0 0 0; font-size: 11px; color: #475569;">
                ${isPaid 
                  ? `Mode: ${inv.payment_method || 'NEFT Bank Transfer'} | Date: ${inv.paid_date || inv.date_issued} | Verified by Admin` 
                  : 'Please remit payment to official Pixiu Tech LLP bank account within due date.'}
              </p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Authorized Signatory</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 800; color: #0A1A33;">Adarsh Raj</p>
              <p style="margin: 0; font-size: 10px; color: #64748b;">Founder & Director, Pixiu Tech</p>
            </div>
          </div>

          <div class="footer-note">
            This is an electronically verified Tax Invoice & Payment Receipt generated by <strong>portal.pixiutech.com</strong>.<br/>
            Pixiu Tech LLP • Contact: billing@pixiutech.com • Phone: +91 9811122233
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Billing, Invoices & Installment Schedule</h1>
          <p className="text-slate-500">Manage Zenith Public School 3-tranche contract (₹1,00,000), tick payment confirmations, and generate tax receipts.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-pixiu-blue text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer text-xs font-bold"
        >
          <Plus size={16} /> Create Custom Tranche / Invoice
        </button>
      </div>

      {/* Contract Progress Banner for Zenith Public School (₹100,000 Contract in 3 Tranches: 40k, 30k, 30k) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 rounded-2xl text-white shadow-xl border border-slate-700/60 mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold px-3 py-1 rounded-full">
              <Building2 size={13} /> Zenith Public School Annual Innovation Contract
            </div>
            <h2 className="text-xl font-bold text-white">Total Agreed Contract: ₹1,00,000 (3 Installments)</h2>
            <p className="text-xs text-slate-300">Structured payment schedule: Tranche 1 (₹40,000 - 40%), Tranche 2 (₹30,000 - 30%), Tranche 3 (₹30,000 - 30%).</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15 min-w-[260px] text-right">
            <div className="flex justify-between items-center text-xs mb-1.5 font-bold">
              <span className="text-slate-300">Payment Collection Progress</span>
              <span className="text-emerald-400 font-mono">{collectedPercentage}%</span>
            </div>
            <div className="w-full bg-slate-700/80 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-emerald-400 to-blue-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${collectedPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-300 mt-2 font-medium">
              <span>Collected: <strong className="text-emerald-400">₹{paidRevenue.toLocaleString('en-IN')}</strong></span>
              <span>Pending: <strong className="text-amber-300">₹{pendingRevenue.toLocaleString('en-IN')}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-pixiu-blue"><IndianRupee size={24} /></div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-0.5">Total Contract Value</p>
            <p className="text-2xl font-bold text-slate-900">₹{totalContract.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><CheckCircle size={24} /></div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-0.5">Received / Reconciled</p>
            <p className="text-2xl font-bold text-emerald-600">₹{paidRevenue.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Clock size={24} /></div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-0.5">Outstanding Balance</p>
            <p className="text-2xl font-bold text-amber-600">₹{pendingRevenue.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* 3-Section Payment Tranches Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Zenith Public School Payment Schedule (3 Sections)</h3>
            <p className="text-xs text-slate-500">Tick checkbox to confirm receipt, record date & place, and generate instant tax invoice.</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-bold">Filter Status:</span>
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs font-bold focus:outline-none focus:border-pixiu-blue cursor-pointer"
            >
              <option value="All">All Tranches</option>
              <option value="Paid">Paid / Confirmed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {filteredBilling.map((inv, idx) => {
            const isPaid = inv.status === 'Paid' || inv.is_confirmed === 1;

            return (
              <div key={inv.id || idx} className="p-5 hover:bg-slate-50 transition-colors flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-start gap-4">
                  {/* Interactive Payment Confirmation Checkbox */}
                  <button
                    onClick={() => handleTogglePayment(inv)}
                    className="mt-1 text-slate-400 hover:text-pixiu-blue cursor-pointer transition-colors"
                    title={isPaid ? "Click to untick / revert" : "Tick to Confirm Payment Received"}
                  >
                    {isPaid ? (
                      <CheckSquare size={22} className="text-emerald-600 fill-emerald-100" />
                    ) : (
                      <Square size={22} className="text-slate-300 hover:text-pixiu-blue" />
                    )}
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                        {inv.id}
                      </span>
                      <span className="text-xs font-bold bg-blue-50 text-pixiu-blue px-2.5 py-0.5 rounded-md">
                        Tranche {inv.tranche_number || idx + 1}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {inv.tranche_title || `Tranche ${inv.tranche_number || idx + 1}: STEM Lab Operations`}
                      </h4>
                      
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle size={11} /> Paid & Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock size={11} /> Pending Receipt
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                      <span>Issued: <strong>{inv.date_issued || inv.invoice_date || '2026-08-25'}</strong></span>
                      <span>Due: <strong className="text-slate-700">{inv.due_date}</strong></span>
                      <span>Place: <strong>{inv.place_of_supply || 'Hata, UP'}</strong></span>
                      {inv.receipt_no && (
                        <span className="font-mono text-pixiu-blue">Ref: <strong>{inv.receipt_no}</strong></span>
                      )}
                      {inv.paid_date && (
                        <span className="text-emerald-700 font-bold">Paid on: <strong>{inv.paid_date}</strong></span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0">
                  <div className="text-left lg:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tranche Amount</p>
                    <p className="text-lg font-black text-slate-900">₹{(inv.amount || 0).toLocaleString('en-IN')}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isPaid && (
                      <button
                        onClick={() => handleOpenConfirmModal(inv)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <CheckSquare size={14} /> Tick to Confirm
                      </button>
                    )}

                    <button 
                      onClick={() => handlePrintInvoice(inv)}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      title="Generate Official Branded Tax Invoice"
                    >
                      <Printer size={14}/> Generate Tax Invoice
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredBilling.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs">
              No tranches found matching selected filter.
            </div>
          )}
        </div>
      </div>

      {/* Payment Confirmation Tick Modal */}
      {confirmingTranche && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">Confirm Payment Receipt</h3>
                  <p className="text-xs text-slate-500">Record transaction details and mark tranche as reconciled</p>
                </div>
              </div>
              <button onClick={() => setConfirmingTranche(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18}/></button>
            </div>

            <form onSubmit={handleConfirmPaymentSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                <p className="text-xs font-bold text-emerald-900">{confirmingTranche.tranche_title || 'Payment Tranche'}</p>
                <p className="text-base font-extrabold text-emerald-700 mt-1">₹{(confirmingTranche.amount || 0).toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-emerald-800">Institution: Zenith Public School (ZPS)</p>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Payment Method *</label>
                <select 
                  value={paymentConfirmationData.payment_method} 
                  onChange={e => setPaymentConfirmationData({ ...paymentConfirmationData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                >
                  <option value="NEFT Bank Transfer">NEFT / RTGS Bank Transfer</option>
                  <option value="Account Payee Cheque">Account Payee Cheque</option>
                  <option value="UPI / QR Payment">UPI / Instant QR Payment</option>
                  <option value="Demand Draft">Demand Draft (DD)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Receipt Date *</label>
                  <input 
                    type="date" 
                    value={paymentConfirmationData.paid_date} 
                    onChange={e => setPaymentConfirmationData({ ...paymentConfirmationData, paid_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Place of Supply *</label>
                  <input 
                    type="text" 
                    value={paymentConfirmationData.place_of_supply} 
                    onChange={e => setPaymentConfirmationData({ ...paymentConfirmationData, place_of_supply: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Receipt / Ref Number *</label>
                <input 
                  type="text" 
                  placeholder="e.g. REC-ZPS-2026-02" 
                  value={paymentConfirmationData.receipt_no} 
                  onChange={e => setPaymentConfirmationData({ ...paymentConfirmationData, receipt_no: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setConfirmingTranche(null)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle size={14}/> Tick & Confirm Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Custom Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Create Custom Tranche Invoice</h2>
                <p className="text-xs text-slate-500">Configure new installment or bill for partner school</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Select School *</label>
                <select 
                  value={formData.school_id} 
                  onChange={e => setFormData({ ...formData, school_id: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                >
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Tranche Title *</label>
                <input 
                  type="text" 
                  value={formData.tranche_title} 
                  onChange={e => setFormData({ ...formData, tranche_title: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Amount (₹) *</label>
                  <input 
                    type="number" 
                    value={formData.amount} 
                    onChange={e => setFormData({ ...formData, amount: e.target.value })} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Place of Supply</label>
                  <input 
                    type="text" 
                    value={formData.place_of_supply} 
                    onChange={e => setFormData({ ...formData, place_of_supply: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Date Issued</label>
                  <input 
                    type="date" 
                    value={formData.date_issued} 
                    onChange={e => setFormData({ ...formData, date_issued: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Due Date</label>
                  <input 
                    type="date" 
                    value={formData.due_date} 
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 font-medium text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Create Tranche Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
