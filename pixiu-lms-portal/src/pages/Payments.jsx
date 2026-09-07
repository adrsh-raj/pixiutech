import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Download, ReceiptText, Search } from 'lucide-react';
import { useData } from '../context/DataContext';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default function Payments() {
  const { billing = [] } = useData();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');

  const rows = useMemo(() => billing.filter(item => {
    const haystack = `${item.id || ''} ${item.school_name || ''} ${item.school_id || ''} ${item.receipt_no || ''}`.toLowerCase();
    const matchesQuery = haystack.includes(query.toLowerCase().trim());
    const paid = item.status === 'Paid' || Number(item.is_confirmed) === 1;
    const matchesStatus = status === 'All' || (status === 'Paid' ? paid : !paid);
    return matchesQuery && matchesStatus;
  }), [billing, query, status]);

  const paid = billing.filter(item => item.status === 'Paid' || Number(item.is_confirmed) === 1);
  const collected = paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pending = billing.filter(item => !(item.status === 'Paid' || Number(item.is_confirmed) === 1)).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const printReceipt = item => {
    const popup = window.open('', '_blank', 'width=820,height=700');
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>Receipt ${item.receipt_no || item.id}</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:760px;margin:auto;color:#172033}.muted{color:#64748b;font-size:13px}.box{border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9}.total{font-size:22px;font-weight:800;border:0}@media print{button{display:none}}</style></head><body><h1>PIXIU TECH</h1><div class="muted">Payment Receipt</div><div class="box"><div class="row"><b>Receipt No.</b><span>${item.receipt_no || 'Pending'}</span></div><div class="row"><b>Invoice</b><span>${item.id || '-'}</span></div><div class="row"><b>School</b><span>${item.school_name || item.school_id || '-'}</span></div><div class="row"><b>Milestone</b><span>${item.tranche_title || '-'}</span></div><div class="row"><b>Payment Date</b><span>${item.paid_date || '-'}</span></div><div class="row"><b>Method</b><span>${item.payment_method || '-'}</span></div><div class="row total"><b>Amount Paid</b><span>${money(item.amount)}</span></div></div><p class="muted">Generated from the PIXIU Tech finance ledger.</p><button onclick="window.print()">Print / Save PDF</button></body></html>`);
    popup.document.close();
  };

  return <div className="space-y-6 pb-12">
    <div><h1 className="text-2xl font-black text-slate-800">Payments & Receipts</h1><p className="text-sm text-slate-500 mt-1">One ledger for collections with traceable receipts.</p></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 size={20}/></div><div><p className="text-xs text-slate-400 font-bold uppercase">Collected</p><p className="text-xl font-black">{money(collected)}</p></div></div></div>
      <div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Clock3 size={20}/></div><div><p className="text-xs text-slate-400 font-bold uppercase">Pending</p><p className="text-xl font-black">{money(pending)}</p></div></div></div>
      <div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><ReceiptText size={20}/></div><div><p className="text-xs text-slate-400 font-bold uppercase">Receipts</p><p className="text-xl font-black">{paid.length}</p></div></div></div>
    </div>
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 justify-between"><div className="relative flex-1 max-w-xl"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search school, invoice or receipt..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400"/></div><select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"><option>All</option><option>Paid</option><option>Pending</option></select></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="text-left p-4">School</th><th className="text-left p-4">Invoice</th><th className="text-left p-4">Receipt</th><th className="text-left p-4">Method</th><th className="text-right p-4">Amount</th><th className="text-right p-4">Action</th></tr></thead><tbody>{rows.map(item => { const isPaid = item.status === 'Paid' || Number(item.is_confirmed) === 1; return <tr key={item.id} className="border-t border-slate-100"><td className="p-4"><div className="font-bold text-slate-800">{item.school_name || item.school_id}</div><div className="text-xs text-slate-400">{item.paid_date || item.due_date || '-'}</div></td><td className="p-4 font-mono text-xs">{item.id}</td><td className="p-4 font-mono text-xs">{item.receipt_no || '—'}</td><td className="p-4 text-slate-600">{item.payment_method || '—'}</td><td className="p-4 text-right font-black">{money(item.amount)}</td><td className="p-4 text-right">{isPaid && <button onClick={() => printReceipt(item)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-700"><Download size={13}/> Receipt</button>}</td></tr>})}</tbody></table></div>
      {rows.length === 0 && <div className="p-12 text-center text-sm text-slate-400">No payment records match your filters.</div>}
    </div>
  </div>;
}
