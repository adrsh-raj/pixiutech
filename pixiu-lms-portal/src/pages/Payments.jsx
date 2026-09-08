import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Download, ReceiptText, Search } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import RefreshButton from '../components/ui/RefreshButton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

const collect = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lower = value => String(value ?? '').toLowerCase();

async function fetchJson(path) {
  const response = await apiFetch(path);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || `Request failed (${response.status})`);
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
    const haystack = [payment.id, payment.invoice, payment.receipt_number, receipt?.receipt_number, payment.transaction_reference, payment.method, payment.invoice_number, payment.school_code]
      .filter(Boolean).join(' ').toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    const normalizedStatus = lower(payment.status);
    const matchesStatus = status === 'all' || normalizedStatus === status;
    return matchesQuery && matchesStatus;
  }), [payments, receiptByPayment, query, status]);

  const totals = useMemo(() => payments.reduce((acc, payment) => {
    const amount = Number(payment.amount || 0);
    acc.total += amount;
    if (lower(payment.status) === 'confirmed' || lower(payment.status) === 'received' || lower(payment.status) === 'completed') acc.collected += amount;
    else acc.pending += amount;
    return acc;
  }, { total: 0, collected: 0, pending: 0 }), [payments]);

  const printReceipt = payment => {
    const receipt = receiptByPayment.get(String(payment.id));
    const popup = window.open('', '_blank', 'width=820,height=700');
    if (!popup) return;
    const safe = value => String(value ?? '—').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    popup.document.write(`<!doctype html><html><head><title>Receipt ${safe(receipt?.receipt_number || payment.id)}</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:760px;margin:auto;color:#172033}.muted{color:#64748b;font-size:13px}.box{border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9}.total{font-size:22px;font-weight:800;border:0}@media print{button{display:none}}</style></head><body><h1>PIXIU TECH</h1><div class="muted">Payment Receipt</div><div class="box"><div class="row"><b>Receipt No.</b><span>${safe(receipt?.receipt_number)}</span></div><div class="row"><b>Payment ID</b><span>${safe(payment.id)}</span></div><div class="row"><b>Invoice</b><span>${safe(payment.invoice)}</span></div><div class="row"><b>Payment Date</b><span>${safe(payment.payment_date)}</span></div><div class="row"><b>Method</b><span>${safe(payment.method)}</span></div><div class="row"><b>Transaction Reference</b><span>${safe(payment.transaction_reference)}</span></div><div class="row total"><b>Amount Paid</b><span>${money(payment.amount)}</span></div></div><p class="muted">Generated from the PIXIU Tech financial ledger.</p><button onclick="window.print()">Print / Save PDF</button></body></html>`);
    popup.document.close();
  };

  return <div className="space-y-6 pb-12">
    <PageHeader eyebrow="Finance" title="Payments & Receipts" description="Canonical payment and receipt records from Django/PostgreSQL." actions={<RefreshButton onRefresh={() => { refreshAll(); load(); }} loading={loading || loadingPayments} />} />
    {error && <ErrorState title="Payments could not be loaded" description={error} />}
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Metric icon={CheckCircle2} label="Collected" value={money(totals.collected)} meta="confirmed payment records"/><Metric icon={Clock3} label="Pending" value={money(totals.pending)} meta="non-completed payment records"/><Metric icon={ReceiptText} label="Payments" value={payments.length} meta={`${receipts.length} receipts issued`}/></section>
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 justify-between"><div className="relative flex-1 max-w-xl"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search payment, invoice, receipt or transaction" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400"/></div><select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="received">Received</option><option value="pending">Pending</option><option value="completed">Completed</option></select></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{['Payment','Invoice','Receipt','Method','Date','Amount','Action'].map(head => <th key={head} className="p-4 text-left text-[10px] uppercase tracking-wider text-slate-500 font-black">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(payment => { const receipt = receiptByPayment.get(String(payment.id)); const printable = !!receipt; return <tr key={payment.id}><td className="p-4"><p className="font-mono text-xs font-bold text-slate-800">{payment.id}</p><p className="text-[10px] text-slate-400 mt-1">{payment.transaction_reference || 'No transaction reference'}</p></td><td className="p-4 font-mono text-xs">{payment.invoice || '—'}</td><td className="p-4 font-mono text-xs">{receipt?.receipt_number || payment.receipt_number || '—'}</td><td className="p-4 capitalize">{payment.method || '—'}</td><td className="p-4 text-slate-500">{payment.payment_date ? String(payment.payment_date).slice(0,10) : '—'}</td><td className="p-4 font-black">{money(payment.amount)}</td><td className="p-4">{printable && <button type="button" onClick={() => printReceipt(payment)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"><Download size={13}/> Receipt</button>}</td></tr>; })}</tbody></table></div>{!filtered.length && <EmptyState title="No payment records" description={loadingPayments ? 'Loading payment records…' : 'No canonical payment records match your filters.'}/>}</section>
  </div>;
}

function Metric({ icon: Icon, label, value, meta }) { return <div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center"><Icon size={20}/></div><div><p className="text-xs text-slate-400 font-black uppercase">{label}</p><p className="text-xl font-black text-slate-900 mt-1">{value}</p><p className="text-[10px] text-slate-400 mt-1">{meta}</p></div></div></div>; }
