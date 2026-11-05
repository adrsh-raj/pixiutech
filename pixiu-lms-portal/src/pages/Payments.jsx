import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Download, ReceiptText, Search, XCircle } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import RefreshButton from '../components/ui/RefreshButton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

const collect = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lower = value => String(value ?? '').toLowerCase();

async function fetchJson(path, options) {
  const response = await apiFetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || payload.message || `Request failed (${response.status})`);
  return payload;
}

export default function Payments() {
  const { refreshAll, loading } = useData();
  const [payments, setPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [error, setError] = useState('');
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setError(''); setLoadingPayments(true);
    try {
      const [paymentPayload, receiptPayload] = await Promise.all([fetchJson('/payments'), fetchJson('/receipts')]);
      setPayments(collect(paymentPayload));
      setReceipts(collect(receiptPayload));
    } catch (err) {
      setError(err.message);
      setPayments([]);
      setReceipts([]);
    } finally { setLoadingPayments(false); }
  };

  useEffect(() => { load(); }, []);

  const receiptByPayment = useMemo(() => new Map(receipts.map(receipt => [String(receipt.payment), receipt])), [receipts]);
  const filtered = useMemo(() => payments.filter(payment => {
    const receipt = receiptByPayment.get(String(payment.id));
    const haystack = [payment.id, payment.invoice, payment.contract, payment.contract_number, payment.receipt_number, receipt?.receipt_number, payment.transaction_reference, payment.method, payment.invoice_number, payment.school_code, payment.school_name]
      .filter(Boolean).join(' ').toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    const normalizedStatus = lower(payment.status);
    const matchesStatus = status === 'all' || normalizedStatus === status;
    return matchesQuery && matchesStatus;
  }), [payments, receiptByPayment, query, status]);

  const totals = useMemo(() => payments.reduce((acc, payment) => {
    const amount = Number(payment.amount || 0);
    const paymentStatus = lower(payment.status);
    acc.total += amount;
    if (paymentStatus === 'success') acc.collected += amount;
    else if (paymentStatus === 'pending') acc.pending += amount;
    else acc.failed += amount;
    return acc;
  }, { total: 0, collected: 0, pending: 0, failed: 0 }), [payments]);

  const verifyPayment = async (paymentId, action) => {
    setBusyId(String(paymentId)); setError('');
    try {
      await fetchJson(`/payments/${encodeURIComponent(paymentId)}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      await Promise.all([load(), refreshAll()]);
    } catch (err) {
      setError(err.message || 'Payment action failed.');
    } finally { setBusyId(''); }
  };

  const printReceipt = payment => {
    const receipt = receiptByPayment.get(String(payment.id));
    const popup = window.open('', '_blank', 'width=820,height=900');
    if (!popup) {
      setError('Receipt PDF could not open. Allow pop-ups for this portal and try again.');
      return;
    }
    const safe = value => String(value ?? '—').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const contractNumber = receipt?.contract_number_snapshot || payment.contract_number || '';
    const invoiceNumber = receipt?.invoice_number_snapshot || payment.invoice_number || '';
    const isContract = Boolean(contractNumber);
    const valueLabel = isContract ? 'Contract Value' : 'Invoice Value';
    const totalSnapshot = Number(receipt?.total_amount_snapshot ?? 0);
    const paidSnapshot = Number(receipt?.amount_paid_snapshot ?? 0);
    const balanceSnapshot = Number(receipt?.balance_due_snapshot ?? 0);
    const hasSnapshot = receipt?.total_amount_snapshot != null
      && receipt?.amount_paid_snapshot != null
      && receipt?.balance_due_snapshot != null;
    const paymentState = balanceSnapshot <= 0
      ? 'PAID IN FULL'
      : paidSnapshot > 0
        ? 'PARTIALLY PAID'
        : 'UNPAID';
    const reversed = ['void', 'refunded'].includes(lower(payment.status));
    const reversalLabel = payment.status === 'refunded' ? 'REFUNDED — NOT VALID FOR COLLECTION' : 'VOID — NOT VALID FOR COLLECTION';
    const reversalBanner = reversed
      ? `<div class="reversal-banner"><strong>${reversalLabel}</strong><div>${safe(payment.reversal_reason || 'Payment entry reversed')}</div><small>Reversed on ${safe(payment.reversed_at || 'date not available')} · Original receipt retained for audit.</small></div>`
      : '';
    const snapshotRows = hasSnapshot
      ? `<div class="summary">
          <div class="summary-title">${isContract ? 'Contract' : 'Invoice'} Payment Summary</div>
          <div class="row"><b>${valueLabel}</b><strong>${money(totalSnapshot)}</strong></div>
          <div class="row"><b>Total Paid (including this receipt)</b><strong>${money(paidSnapshot)}</strong></div>
          <div class="row outstanding"><b>Unpaid / Outstanding Balance</b><strong>${money(balanceSnapshot)}</strong></div>
          <div class="row"><b>Payment Status</b><strong>${paymentState}</strong></div>
        </div>`
      : `<div class="summary">
          <div class="summary-title">${isContract ? 'Contract' : 'Invoice'} Payment Summary</div>
          <div class="row"><b>${valueLabel}</b><strong>Not recorded</strong></div>
          <div class="row"><b>Total Paid (including this receipt)</b><strong>Not recorded</strong></div>
          <div class="row"><b>Unpaid / Outstanding Balance</b><strong>Not recorded</strong></div>
          <p class="muted">This is a historical receipt created before balance snapshots were stored. The original paid and unpaid amounts cannot be reconstructed reliably, so no figures have been estimated.</p>
        </div>`;
    const contractRow = contractNumber ? `<div class="row"><b>Contract Number</b><span>${safe(contractNumber)}</span></div>` : '';
    const invoiceRow = invoiceNumber ? `<div class="row"><b>Invoice Number</b><span>${safe(invoiceNumber)}</span></div>` : '';
    const receiptNumber = receipt?.receipt_number || payment.receipt_number || payment.id;

    popup.document.write(`<!doctype html>
      <html><head><meta charset="utf-8"><title>Receipt-${safe(receiptNumber)}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Arial,sans-serif;padding:32px;max-width:780px;margin:0 auto;color:#172033;background:#fff}
        h1{font-size:25px;letter-spacing:.04em;margin:0 0 5px}
        .muted{color:#64748b;font-size:12px;line-height:1.55}
        .top{display:flex;justify-content:space-between;align-items:center;gap:20px;padding-bottom:18px;border-bottom:2px solid #172033}
        .brand{display:flex;align-items:center;gap:14px}
        .brand-logo{display:block;width:145px;height:auto;max-height:74px;object-fit:contain}
        .receipt-label{text-align:right;font-size:12px;color:#64748b}
        .reversal-banner{border:2px solid #b91c1c;color:#991b1b;background:#fff7f7;border-radius:8px;padding:14px;margin:18px 0}
        .reversal-banner strong{display:block;font-size:16px;letter-spacing:.06em}
        .reversal-banner div{margin-top:5px;font-size:13px}
        .reversal-banner small{display:block;margin-top:5px;color:#7f1d1d}
        .receipt-label strong{display:block;color:#172033;font-size:17px;margin-top:5px}
        .box{border:1px solid #dbe3ed;border-radius:10px;padding:18px;margin:20px 0}
        .section-title,.summary-title{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#475569;margin:0 0 8px}
        .row{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:10px 0;border-bottom:1px solid #edf1f5;font-size:13px}
        .row:last-child{border-bottom:0}
        .row strong{font-weight:800;text-align:right}
        .summary{border:1px solid #cbd5e1;border-radius:10px;padding:16px;margin-top:18px;background:#f8fafc}
        .summary .row{font-size:14px}
        .summary .outstanding{font-size:16px;color:#9a3412;border-top:1px solid #cbd5e1;margin-top:4px;padding-top:14px}
        .payment-total{font-size:19px;font-weight:800;border-top:2px solid #172033;margin-top:14px;padding-top:14px}
        .footer{margin-top:22px;padding-top:14px;border-top:1px solid #e2e8f0}
        .toolbar{display:flex;justify-content:flex-end;gap:8px;margin:0 0 18px}
        button{border:0;border-radius:7px;background:#172033;color:#fff;padding:10px 15px;font-weight:700;cursor:pointer}
        @page{size:A4;margin:16mm}
        @media print{body{padding:0;max-width:none}.toolbar{display:none!important}.box,.summary{break-inside:avoid}}
      </style></head><body>
      <div class="toolbar"><button onclick="window.print()">Download / Save as PDF</button></div>
      <div class="top"><div class="brand"><img class="brand-logo" src="${window.location.origin}/pixiu-tech-logo.svg" alt="Pixiu Tech logo"><div><h1>PIXIU TECH LLP</h1><div class="muted">Robotics • AI • IoT • STEM Education</div><div class="muted" style="margin-top:8px">Official payment receipt</div></div></div>
        <div class="receipt-label">RECEIPT<strong>${safe(receiptNumber)}</strong><div style="margin-top:7px">${safe(receipt?.issued_at || payment.payment_date)}</div></div>
      </div>
      ${reversalBanner}
      <div class="box">
        <div class="section-title">Receipt Details</div>
        <div class="row"><b>School</b><span>${safe(receipt?.school_name_snapshot || payment.school_name)}</span></div>
        ${contractRow}${invoiceRow}
        <div class="row"><b>Payment ID</b><span>${safe(payment.id)}</span></div>
        <div class="row"><b>Payment Date</b><span>${safe(payment.payment_date)}</span></div>
        <div class="row"><b>Payment Method</b><span>${safe(payment.method)}</span></div>
        <div class="row"><b>Transaction Reference</b><span>${safe(payment.transaction_reference)}</span></div>
        ${snapshotRows}
        <div class="row payment-total"><b>Amount Received on This Receipt</b><strong>${money(payment.amount)}</strong></div>
      </div>
      <div class="footer muted">${reversed ? 'This receipt has been marked invalid because the payment was reversed. Its original snapshot is preserved for audit; the current balance has been recalculated separately.' : 'This receipt confirms one verified payment. The paid and unpaid figures above are the immutable contract/invoice ledger balances immediately after this receipt was recorded. Pending submissions are not treated as received.'}</div>
      <p class="muted">To download, choose “Save as PDF” in the browser print dialog.</p>
      </body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => {
      if (!popup.closed) popup.print();
    }, 900);
  };

  return <div className="space-y-6 pb-12">
    <PageHeader eyebrow="Finance" title="Payments & Receipts" description="Canonical payment and receipt records from Django/PostgreSQL." actions={<RefreshButton onRefresh={async () => { await Promise.all([refreshAll(), load()]); }} loading={loading || loadingPayments || !!busyId} />} />
    {error && <ErrorState title="Payments action failed" description={error} onRetry={load} />}
    <section className="grid grid-cols-1 sm:grid-cols-4 gap-4"><Metric icon={CheckCircle2} label="Collected" value={money(totals.collected)} meta="verified payment records"/><Metric icon={Clock3} label="Pending" value={money(totals.pending)} meta="awaiting admin verification"/><Metric icon={ReceiptText} label="Payments" value={payments.length} meta={`${receipts.length} receipts issued`}/><Metric icon={XCircle} label="Failed" value={money(totals.failed)} meta="rejected or failed submissions"/></section>
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 justify-between"><div className="relative flex-1 max-w-xl"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search payment, invoice, receipt or transaction" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400"/></div><select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"><option value="all">All statuses</option><option value="success">Success</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="void">Voided</option><option value="refunded">Refunded</option></select></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{['Payment','Contract / Invoice','Receipt','Method','Date','Amount','Status','Action'].map(head => <th key={head} className="p-4 text-left text-[10px] uppercase tracking-wider text-slate-500 font-black">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(payment => { const receipt = receiptByPayment.get(String(payment.id)); const paymentStatus = lower(payment.status); const printable = !!receipt; const busy = busyId === String(payment.id); return <tr key={payment.id}><td className="p-4"><p className="font-mono text-xs font-bold text-slate-800">{payment.school_name || 'School payment'} · {payment.id}</p><p className="text-[10px] text-slate-400 mt-1">{payment.transaction_reference || 'No transaction reference'}</p>{payment.reversal_reason && <p className="text-[10px] text-rose-700 mt-1">Reversal reason: {payment.reversal_reason}</p>}</td><td className="p-4 font-mono text-xs">{payment.contract_number || payment.invoice_number || payment.contract || payment.invoice || '—'}</td><td className="p-4 font-mono text-xs">{receipt?.receipt_number || payment.receipt_number || '—'}</td><td className="p-4 capitalize">{payment.method || '—'}</td><td className="p-4 text-slate-500">{payment.payment_date ? String(payment.payment_date).slice(0,10) : '—'}</td><td className="p-4 font-black">{money(payment.amount)}</td><td className="p-4"><span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase ${paymentStatus === 'success' ? 'bg-emerald-50 text-emerald-700' : paymentStatus === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{payment.status || 'unknown'}</span></td><td className="p-4"><div className="flex flex-wrap gap-2">{paymentStatus === 'pending' && <><button type="button" disabled={busy} onClick={() => verifyPayment(payment.id, 'verify')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"><CheckCircle2 size={13}/>{busy ? 'Working…' : 'Verify & mark paid'}</button><button type="button" disabled={busy} onClick={() => verifyPayment(payment.id, 'reject')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-200 bg-white text-rose-600 text-xs font-bold disabled:opacity-50"><XCircle size={13}/>Reject</button></>}{printable && <button type="button" title="Open the receipt and save it as a PDF" onClick={() => printReceipt(payment)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"><Download size={13}/> Download PDF</button>}</div></td></tr>; })}</tbody></table></div>{!filtered.length && <EmptyState title="No payment records" description={loadingPayments ? 'Loading payment records…' : 'No canonical payment records match your filters.'}/>}</section>
  </div>;
}

function Metric({ icon: Icon, label, value, meta }) { return <div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center"><Icon size={20}/></div><div><p className="text-xs text-slate-400 font-black uppercase">{label}</p><p className="text-xl font-black text-slate-900 mt-1">{value}</p><p className="text-[10px] text-slate-400 mt-1">{meta}</p></div></div></div>; }
