import { useState, useMemo } from 'react';
import { 
  IndianRupee, FileText, Download, CheckCircle, Clock, Plus, X, Building2, 
  Calendar, CheckSquare, Square, ShieldCheck, Printer, ArrowRight, Percent,
  Edit, Trash2, Check
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';

export default function Billing() {
  const { 
    schools, 
    billing, 
    createInvoice, 
    updateInvoiceStatus, 
    confirmPaymentReceipt,
    updateBillingInvoice,
    deleteBillingInvoice
  } = useData();
  const toast = useToast();

  const [selectedSchool, setSelectedSchool] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Edit Modal State
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editFormData, setEditFormData] = useState({
    tranche_title: '',
    amount: 0,
    due_date: '',
    date_issued: '',
    place_of_supply: '',
    status: 'Pending'
  });

  // Payment Confirmation Modal State
  const [confirmingTranche, setConfirmingTranche] = useState(null);
  const [paymentConfirmationData, setPaymentConfirmationData] = useState({
    payment_method: 'NEFT Bank Transfer',
    receipt_no: '',
    place_of_supply: 'Hata, Uttar Pradesh',
    paid_date: new Date().toISOString().split('T')[0]
  });

  // Create Invoice Form State
  const [formData, setFormData] = useState({
    school_id: 'ZPS',
    tranche_number: 1,
    tranche_title: 'Tranche: Lab Setup & Hardware Kit Dispatch',
    amount: 30000,
    total_contract_value: 100000,
    date_issued: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    place_of_supply: 'Hata, Uttar Pradesh',
    status: 'Pending'
  });

  // Filter Billing by School & Status
  const filteredBilling = useMemo(() => {
    return billing.filter(b => {
      const matchesSchool = selectedSchool === 'All' || b.school_id === selectedSchool || b.school_id === selectedSchool.replace('SCH-', '');
      const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
      return matchesSchool && matchesStatus;
    });
  }, [billing, selectedSchool, statusFilter]);

  // Dynamic Aggregates
  const totalInvoiced = filteredBilling.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const paidRevenue = filteredBilling.filter(b => b.status === 'Paid' || b.is_confirmed === 1).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const pendingRevenue = Math.max(0, totalInvoiced - paidRevenue);
  const collectedPercentage = totalInvoiced > 0 ? Math.min(100, Math.round((paidRevenue / totalInvoiced) * 100)) : 0;

  const handleOpenConfirmModal = (inv) => {
    setConfirmingTranche(inv);
    setPaymentConfirmationData({
      payment_method: inv.payment_method || 'NEFT Bank Transfer',
      receipt_no: inv.receipt_no || `REC-${inv.school_id || 'ZPS'}-2026-0${inv.tranche_number || 1}`,
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

  const handleOpenEdit = (e, inv) => {
    e.stopPropagation();
    setEditingInvoice(inv);
    setEditFormData({
      tranche_title: inv.tranche_title || '',
      amount: inv.amount || 0,
      due_date: inv.due_date || '',
      date_issued: inv.date_issued || inv.invoice_date || '',
      place_of_supply: inv.place_of_supply || 'Hata, Uttar Pradesh',
      status: inv.status || 'Pending'
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingInvoice) return;

    await updateBillingInvoice(editingInvoice.id, {
      tranche_title: editFormData.tranche_title,
      amount: Number(editFormData.amount) || 0,
      due_date: editFormData.due_date,
      date_issued: editFormData.date_issued,
      place_of_supply: editFormData.place_of_supply,
      status: editFormData.status
    });

    toast.success(`Invoice "${editingInvoice.id}" updated successfully!`, 'Invoice Updated');
    setEditingInvoice(null);
  };

  const handleOpenCreateModal = () => {
    const activeSchoolId = selectedSchool !== 'All' ? selectedSchool : (schools[0]?.id || 'ZPS');
    const targetSchool = schools.find(s => s.id === activeSchoolId) || schools[0];
    const existingCount = billing.filter(b => b.school_id === activeSchoolId || b.school_id === targetSchool?.code).length;
    setFormData({
      school_id: activeSchoolId,
      tranche_number: existingCount + 1,
      tranche_title: `Tranche ${existingCount + 1}: STEM Curriculum & Practical Lab Delivery`,
      amount: 35000,
      total_contract_value: targetSchool?.expected_revenue || 100000,
      date_issued: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      place_of_supply: activeSchoolId === 'XYZ' ? 'Gorakhpur, Uttar Pradesh' : 'Hata, Uttar Pradesh',
      status: 'Pending'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const targetSchool = schools.find(s => s.id === formData.school_id || s.code === formData.school_id) || schools[0];
    const schoolName = targetSchool ? targetSchool.name : 'Partner School';
    const invoiceId = `INV-${(formData.school_id || 'SCH').toUpperCase()}-${Date.now().toString().slice(-4)}`;

    await createInvoice({
      ...formData,
      id: invoiceId,
      school_id: targetSchool ? targetSchool.id : formData.school_id,
      school_name: schoolName,
      amount: Number(formData.amount) || 0,
      total_contract_value: Number(formData.total_contract_value) || Number(formData.amount) || 0,
      invoice_date: formData.date_issued || new Date().toISOString().split('T')[0],
      date_issued: formData.date_issued || new Date().toISOString().split('T')[0],
      status: formData.status || 'Pending'
    });

    toast.success(`Tax Invoice ${invoiceId} created for ${schoolName} (₹${Number(formData.amount).toLocaleString('en-IN')})`, 'Invoice Generated');
    setIsModalOpen(false);
  };

  const handlePrintInvoice = (inv) => {
    const printWindow = window.open('', '_blank');
    const isPaid = inv.status === 'Paid' || inv.is_confirmed === 1;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Official Tax Invoice - ${inv.id}</title>
          <base href="${window.location.origin}/" />
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0A1A33; padding-bottom: 20px; margin-bottom: 25px; }
            .brand { font-size: 24px; font-weight: 900; color: #0A1A33; letter-spacing: -0.5px; }
            .brand span { color: #2563EB; }
            .tagline { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 2px; }
            .invoice-title { font-size: 22px; font-weight: 800; color: #0A1A33; text-align: right; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-top: 5px; }
            .badge-paid { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
            .badge-pending { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; font-size: 13px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; }
            th { background: #0A1A33; color: #fff; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
            .total-box { margin-left: auto; width: 280px; font-size: 13px; margin-bottom: 30px; }
            .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
            .total-row.final { border-top: 2px solid #0A1A33; font-size: 16px; font-weight: 900; color: #0A1A33; padding-top: 10px; margin-top: 4px; }
            .footer { border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
            .footer-note { text-align: center; margin-top: 30px; font-size: 10px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                <img src="${window.location.origin}/img/logo.png" alt="Pixiu Tech Logo" style="height: 48px; width: auto; object-fit: contain; display: block;" onerror="this.src='/img/logo.png'" />
                <div>
                  <div class="brand">PIXIU <span>TECH LLP</span></div>
                  <div class="tagline">Educational Robotics & AI Lab Systems</div>
                </div>
              </div>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">
                Plot 42, Knowledge Park III, Gorakhpur / Hata Road, UP<br/>
                GSTIN: <strong>09AAACP1234F1Z5</strong> | CIN: U72900UP2026PTC109823
              </p>
            </div>
            <div>
              <div class="invoice-title">TAX INVOICE & RECEIPT</div>
              <div style="text-align: right;">
                <span class="badge ${isPaid ? 'badge-paid' : 'badge-pending'}">${isPaid ? 'PAID & CONFIRMED' : 'PENDING PAYMENT'}</span>
              </div>
              <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569; text-align: right; font-family: monospace;">
                Invoice No: <strong>${inv.id}</strong><br/>
                Date: <strong>${inv.date_issued || inv.invoice_date || '2026-08-25'}</strong>
              </p>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-title">BILLED TO (CLIENT INSTITUTION)</div>
              <p style="margin: 0; font-weight: 800; font-size: 14px; color: #0A1A33;">${inv.school_name || 'Zenith Public School'}</p>
              <p style="margin: 4px 0 0 0; color: #475569;">
                Institutional Partner Code: <strong>${inv.school_id}</strong><br/>
                Place of Supply: <strong>${inv.place_of_supply || 'Hata, Uttar Pradesh'}</strong>
              </p>
            </div>
            <div class="card">
              <div class="card-title">CONTRACT & PAYMENT DETAILS</div>
              <p style="margin: 0; color: #475569;">
                Milestone: <strong>${inv.tranche_title || 'Institutional Fee Tranche'}</strong><br/>
                Due Date: <strong>${inv.due_date}</strong><br/>
                Payment Ref: <strong>${inv.receipt_no || 'N/A (Pending Reconcile)'}</strong>
              </p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>HSN/SAC</th>
                <th>Qty</th>
                <th style="text-align: right;">Taxable Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>${inv.tranche_title || 'STEM Robotics & Hardware Lab Operations'}</strong><br/>
                  <span style="font-size: 11px; color: #64748b;">Comprehensive robotics kits, trainer deployment, and semester examinations.</span>
                </td>
                <td>999293</td>
                <td>1 Unit</td>
                <td style="text-align: right; font-weight: 700;">₹${(inv.amount || 0).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div class="total-box">
            <div class="total-row">
              <span>Subtotal:</span>
              <strong>₹${(inv.amount || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div class="total-row">
              <span>CGST (0% Educational Exemption):</span>
              <strong>₹0</strong>
            </div>
            <div class="total-row">
              <span>SGST (0% Educational Exemption):</span>
              <strong>₹0</strong>
            </div>
            <div class="total-row final">
              <span>Total Payable:</span>
              <span style="color: #2563EB;">₹${(inv.amount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div class="footer">
            <div>
              <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Bank Account Details for Wire Transfer</p>
              <p style="margin: 4px 0 0 0; color: #475569; line-height: 1.6;">
                Account Name: <strong>PIXIU TECH LLP</strong><br/>
                Account No: <strong>5599971440</strong> (Central Bank of India)<br/>
                IFSC Code: <strong>CBIN0282573</strong> | Branch: Gorakhpur Main
              </p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Authorized Signatory</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 800; color: #0A1A33;">Adarsh Raj Singh</p>
              <p style="margin: 0; font-size: 10px; color: #64748b;">Founder & Director, Pixiu Tech LLP</p>
            </div>
          </div>

          <div class="footer-note">
            This is an electronically verified Tax Invoice & Payment Receipt generated by <strong>portal.pixiutech.com</strong>.<br/>
            Pixiu Tech LLP • Contact: billing@pixiutech.com
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
          <p className="text-slate-500">Manage partner school milestone contracts, reconcile payment receipts, and issue official tax invoices.</p>
        </div>
        
        <button 
          onClick={handleOpenCreateModal}
          className="bg-pixiu-blue text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer text-xs font-bold"
        >
          <Plus size={16} /> Create Custom Tranche / Invoice
        </button>
      </div>

      {/* Scope Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Building2 size={16} className="text-pixiu-blue" />
          <span className="text-xs font-bold text-slate-500 uppercase">Partner School:</span>
          <select 
            value={selectedSchool}
            onChange={e => setSelectedSchool(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-pixiu-blue cursor-pointer"
          >
            <option value="All">All Partner Schools (Network-wide)</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-bold">Status:</span>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-pixiu-blue cursor-pointer"
          >
            <option value="All">All Tranches</option>
            <option value="Paid">Paid / Confirmed</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
            <IndianRupee size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-0.5">Total Invoiced</p>
            <p className="text-2xl font-bold text-slate-900">₹{totalInvoiced.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-0.5">Collected / Reconciled</p>
            <p className="text-2xl font-bold text-emerald-600">₹{paidRevenue.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-0.5">Pending Balance</p>
            <p className="text-2xl font-bold text-amber-600">₹{pendingRevenue.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Invoices Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Contract Payment Tranches & Ledger</h3>
            <p className="text-xs text-slate-500">Tick checkbox to confirm receipt, record transaction date, and generate official tax receipt.</p>
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {filteredBilling.map((inv, idx) => {
            const isPaid = inv.status === 'Paid' || inv.is_confirmed === 1;

            return (
              <div key={inv.id || idx} className="p-5 hover:bg-slate-50 transition-colors flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-start gap-4">
                  {/* Payment Tickbox */}
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
                        {inv.school_name || inv.school_id}
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
                    <p className="text-lg font-bold text-slate-900">₹{(inv.amount || 0).toLocaleString('en-IN')}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isPaid && (
                      <button
                        onClick={() => handleOpenConfirmModal(inv)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <CheckSquare size={13} /> Tick Confirm
                      </button>
                    )}

                    {/* Edit Invoice Button */}
                    <button
                      onClick={(e) => handleOpenEdit(e, inv)}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Invoice Details"
                    >
                      <Edit size={16} />
                    </button>

                    {/* Delete Invoice Button */}
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete invoice ${inv.id}?`)) {
                          await deleteBillingInvoice(inv.id);
                          toast.info(`Invoice ${inv.id} deleted.`, 'Invoice Removed');
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Invoice"
                    >
                      <Trash2 size={16} />
                    </button>

                    <button 
                      onClick={() => handlePrintInvoice(inv)}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      title="Generate Official Branded Tax Invoice"
                    >
                      <Printer size={13}/> Print Invoice
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

      {/* MODAL 1: EDIT INVOICE */}
      <Modal 
        isOpen={!!editingInvoice} 
        onClose={() => setEditingInvoice(null)}
        title={`Edit Invoice (${editingInvoice?.id})`}
        size="sm"
      >
        <p className="text-xs text-slate-500 mb-4">Update tranche description, amount, due date, or status</p>
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Tranche Title *</label>
                <input 
                  type="text" 
                  value={editFormData.tranche_title} 
                  onChange={e => setEditFormData({ ...editFormData, tranche_title: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Amount (₹) *</label>
                  <input 
                    type="number" 
                    value={editFormData.amount} 
                    onChange={e => setEditFormData({ ...editFormData, amount: e.target.value })} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select 
                    value={editFormData.status} 
                    onChange={e => setEditFormData({ ...editFormData, status: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:outline-none focus:border-pixiu-blue"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid / Confirmed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Date Issued</label>
                  <input 
                    type="date" 
                    value={editFormData.date_issued} 
                    onChange={e => setEditFormData({ ...editFormData, date_issued: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Due Date</label>
                  <input 
                    type="date" 
                    value={editFormData.due_date} 
                    onChange={e => setEditFormData({ ...editFormData, due_date: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Place of Supply</label>
                <input 
                  type="text" 
                  value={editFormData.place_of_supply} 
                  onChange={e => setEditFormData({ ...editFormData, place_of_supply: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEditingInvoice(null)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14}/> Save Changes
                </button>
              </div>
            </form>
      </Modal>

      {/* MODAL 2: CONFIRM PAYMENT RECEIPT */}
      <Modal 
        isOpen={!!confirmingTranche} 
        onClose={() => setConfirmingTranche(null)} 
        title="Confirm Payment Receipt" 
        size="sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={20} className="text-emerald-600" />
          <p className="text-xs text-slate-500">Record transaction details and mark tranche as reconciled</p>
        </div>
        <form onSubmit={handleConfirmPaymentSubmit} className="space-y-4 text-xs">
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                <p className="text-xs font-bold text-emerald-900">{confirmingTranche.tranche_title || 'Payment Tranche'}</p>
                <p className="text-base font-bold text-emerald-700 mt-1">₹{(confirmingTranche.amount || 0).toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-emerald-800">Institution: {confirmingTranche.school_name || confirmingTranche.school_id}</p>
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
                <label className="block font-bold text-slate-500 uppercase mb-1">Payment Reference / UTR Number</label>
                <input 
                  type="text" 
                  value={paymentConfirmationData.receipt_no} 
                  onChange={e => setPaymentConfirmationData({ ...paymentConfirmationData, receipt_no: e.target.value })}
                  placeholder="e.g. UTR89123019283 or CHQ-00129"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setConfirmingTranche(null)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckSquare size={14}/> Confirm Reconcile
                </button>
              </div>
            </form>
      </Modal>

      {/* MODAL 3: CREATE CUSTOM TRANCHE INVOICE */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create Custom Tranche Invoice" 
        size="sm"
      >
        <p className="text-xs text-slate-500 mb-4">Configure new installment or bill for partner school</p>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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
                  className="px-6 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Create Tranche Invoice
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
}
