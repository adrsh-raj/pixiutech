import { useEffect, useMemo, useState } from 'react';
import { CreditCard, FilePlus2, LogIn, ReceiptText, Wallet, X, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const today = () => new Date().toISOString().slice(0, 10);
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rows = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, {
    method,
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    cache: method === 'GET' ? 'no-store' : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.error || data.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export default function BillingCenter() {
  const { user, loading: authLoading } = useAuth();
  const { schools = [], refreshAll, loading } = useData();
  const navigate = useNavigate();
  const [selectedSchool, setSelectedSchool] = useState('');
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contractForm, setContractForm] = useState({ contract_number: '', start_date: today(), end_date: '', total_value: '', notes: '' });
  const [invoiceForm, setInvoiceForm] = useState({ contract: '', issue_date: today(), due_date: '', notes: '', description: '', quantity: '1', unit_price: '' });
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'bank_transfer', payment_date: today(), transaction_reference: '', notes: '' });

  const school = useMemo(() => {
    if (user?.role === 'school') return schools[0] || null;
    return schools.find(item => String(item.id) === String(selectedSchool)) || null;
  }, [schools, selectedSchool, user?.role]);
  const scope = school ? `?school=${encodeURIComponent(school.id)}` : '';

  const load = async () => {
    if (authLoading) return;
    setError('');
    try {
      const [contractPayload, invoicePayload, summaryPayload] = await Promise.all([
        request(`/contracts${scope}`),
        request(`/invoices${scope}`),
        request(`/billing-summary${scope}`),
      ]);
      setContracts(rows(contractPayload));
      setInvoices(rows(invoicePayload));
      setSummary(summaryPayload || null);
      setSessionExpired(false);
    } catch (err) {
      if (err.status === 401) {
        setSessionExpired(true);
        setError('Your portal session has expired. Sign in again.');
      } else setError(err.message || 'Unable to load billing data.');
    }
  };

  useEffect(() => { load(); }, [scope, authLoading]);

  const runAction = async action => {
    try { await action(); }
    catch (err) {
      if (err.status === 401) setSessionExpired(true);
      setError(err.message || 'Billing action failed.');
    }
  };

  const createContract = async event => {
    event.preventDefault();
    if (!school) return setError('Select a school before creating a contract.');
    setBusy(true);
    await runAction(async () => {
      await request('/contracts', 'POST', { ...contractForm, school: school.id, total_value: Number(contractForm.total_value) });
      setContractForm({ contract_number: '', start_date: today(), end_date: '', total_value: '', notes: '' });
      await load();
      await refreshAll();
    });
    setBusy(false);
  };

  const createInvoice = async event => {
    event.preventDefault();
    if (!school) return setError('Select a school before creating an invoice.');
    if (!invoiceForm.description.trim()) return setError('Invoice line description is required.');
    const quantity = Number(invoiceForm.quantity);
    const unitPrice = Number(invoiceForm.unit_price);
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return setError('Invoice quantity and unit price are invalid.');
    setBusy(true);
    await runAction(async () => {
      await request('/invoices/create-with-lines', 'POST', {
        school: school.id,
        contract: invoiceForm.contract || null,
        issue_date: invoiceForm.issue_date,
        due_date: invoiceForm.due_date,
        notes: invoiceForm.notes,
        lines: [{ description: invoiceForm.description.trim(), quantity, unit_price: unitPrice }],
      });
      setInvoiceForm({ contract: '', issue_date: today(), due_date: '', notes: '', description: '', quantity: '1', unit_price: '' });
      await load();
      await refreshAll();
    });
    setBusy(false);
  };

  const invoiceAction = async (id, action) => {
    setBusy(true);
    await runAction(async () => { await request(`/invoices/${encodeURIComponent(id)}/${action}`, 'POST', {}); await load(); await refreshAll(); });
    setBusy(false);
  };

  const openPayment = invoice => {
    const outstanding = Math.max(Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0), 0);
    setPaymentInvoice(invoice);
    setPaymentForm({ amount: outstanding ? String(outstanding) : '', method: 'bank_transfer', payment_date: today(), transaction_reference: '', notes: '' });
    setError('');
  };

  const recordPayment = async event => {
    event.preventDefault();
    if (!paymentInvoice) return;
    const amount = Number(paymentForm.amount);
    const outstanding = Math.max(Number(paymentInvoice.total_amount || 0) - Number(paymentInvoice.amount_paid || 0), 0);
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) return setError(`Payment must be greater than 0 and no more than ${money(outstanding)}.`);
    setBusy(true);
    await runAction(async () => {
      await request('/payments/record', 'POST', {
        invoice: paymentInvoice.id,
        amount,
        method: paymentForm.method,
        payment_date: paymentForm.payment_date,
        transaction_reference: paymentForm.transaction_reference.trim(),
        notes: paymentForm.notes.trim(),
      });
      setPaymentInvoice(null);
      await load();
      await refreshAll();
    });
    setBusy(false);
  };

  if (authLoading) return <div className="space-y-5"><PageHeader eyebrow="Finance" title="Billing & Contracts" description="Loading your secure financial session…"/><div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">Authenticating…</div></div>;

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow={user?.role === 'admin' ? 'Admin Finance' : 'School Finance'} title="Billing & Contracts" description="Contracts, invoices, line items, payments and balances from the Django financial ledger." actions={<RefreshButton onRefresh={async () => { await Promise.all([refreshAll(), load()]); }} loading={loading || busy}/>} />
    {sessionExpired ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><div className="flex items-start gap-3"><LogIn size={20} className="text-amber-700 mt-0.5"/><div><h2 className="font-black text-amber-900">Session expired</h2><p className="text-sm text-amber-800 mt-1">Sign in again to load financial records securely.</p><button type="button" onClick={() => navigate('/login')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white"><LogIn size={14}/> Sign in again</button></div></div></section> : error ? <ErrorState title="Billing action failed" description={error} onRetry={load}/> : null}
    {user?.role === 'admin' && <div><label className="block text-[10px] uppercase tracking-wide font-black text-slate-400 mb-1">School scope</label><select value={selectedSchool} onChange={event => setSelectedSchool(event.target.value)} className="field"><option value="">All schools</option>{schools.map(item => <option key={item.id} value={item.id}>{item.name} ({item.school_code})</option>)}</select></div>}
    <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[['Contract value', summary?.contract_value], ['Invoiced', summary?.invoiced], ['Collected', summary?.collected], ['Outstanding', summary?.pending], ['Invoices', summary?.invoice_count]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[9px] uppercase tracking-[.12em] font-black text-slate-400">{label}</p><p className="text-xl font-black text-slate-900 mt-2">{label === 'Invoices' ? Number(value || 0) : money(value)}</p></div>)}</section>
    {!sessionExpired && (user?.role === 'admin' || user?.role === 'school') && school && <section className="grid grid-cols-1 xl:grid-cols-2 gap-5"><form onSubmit={createContract} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"><div className="flex items-center gap-2"><Wallet size={17}/><h2 className="font-black">New Contract</h2></div><input className="field" placeholder="Contract number" value={contractForm.contract_number} onChange={e => setContractForm(v => ({...v,contract_number:e.target.value}))} required/><div className="grid grid-cols-2 gap-2"><input type="date" className="field" value={contractForm.start_date} onChange={e => setContractForm(v => ({...v,start_date:e.target.value}))} required/><input type="date" className="field" value={contractForm.end_date} onChange={e => setContractForm(v => ({...v,end_date:e.target.value}))} required/></div><input type="number" min="0" step="0.01" className="field" placeholder="Contract value" value={contractForm.total_value} onChange={e => setContractForm(v => ({...v,total_value:e.target.value}))} required/><textarea className="field min-h-20" placeholder="Notes" value={contractForm.notes} onChange={e => setContractForm(v => ({...v,notes:e.target.value}))}/><button disabled={busy} className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-50"><FilePlus2 size={14} className="inline mr-2"/>Create Contract</button></form><form onSubmit={createInvoice} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"><div className="flex items-center gap-2"><ReceiptText size={17}/><h2 className="font-black">New Draft Invoice</h2></div><select className="field" value={invoiceForm.contract} onChange={e => setInvoiceForm(v => ({...v,contract:e.target.value}))}><option value="">No contract link</option>{contracts.map(item => <option key={item.id} value={item.id}>{item.contract_number}</option>)}</select><div className="grid grid-cols-2 gap-2"><input type="date" className="field" value={invoiceForm.issue_date} onChange={e => setInvoiceForm(v => ({...v,issue_date:e.target.value}))} required/><input type="date" className="field" value={invoiceForm.due_date} onChange={e => setInvoiceForm(v => ({...v,due_date:e.target.value}))} required/></div><input className="field" placeholder="Line description" value={invoiceForm.description} onChange={e => setInvoiceForm(v => ({...v,description:e.target.value}))} required/><div className="grid grid-cols-2 gap-2"><input type="number" min="1" step="1" className="field" placeholder="Quantity" value={invoiceForm.quantity} onChange={e => setInvoiceForm(v => ({...v,quantity:e.target.value}))} required/><input type="number" min="0" step="0.01" className="field" placeholder="Unit price" value={invoiceForm.unit_price} onChange={e => setInvoiceForm(v => ({...v,unit_price:e.target.value}))} required/></div><textarea className="field min-h-20" placeholder="Invoice notes" value={invoiceForm.notes} onChange={e => setInvoiceForm(v => ({...v,notes:e.target.value}))}/><button disabled={busy} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-50">Create Draft</button></form></section>}
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-5 border-b border-slate-100"><h2 className="font-black">Contracts</h2></div><div className="divide-y divide-slate-100">{contracts.map(item => <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1"><p className="font-black text-slate-800">{item.contract_number}</p><p className="text-xs text-slate-400">{item.school_name || item.school_code || '—'} · {item.start_date} → {item.end_date}</p></div><p className="font-black">{money(item.total_value)}</p><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{item.status}</span></div>)}{!contracts.length&&<div className="p-3"><EmptyState title="No contracts" description="No database contracts match this scope."/></div>}</div></section>
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-5 border-b border-slate-100"><h2 className="font-black">Invoices</h2></div><div className="divide-y divide-slate-100">{invoices.map(item => { const outstanding=Math.max(Number(item.total_amount||0)-Number(item.amount_paid||0),0); return <div key={item.id} className="p-4 flex flex-col xl:flex-row xl:items-center gap-3"><div className="flex-1 min-w-0"><p className="font-black text-slate-800">{item.invoice_number}</p><p className="text-xs text-slate-400">{item.school_code || '—'} · Due {item.due_date}</p><p className="text-xs text-slate-500 mt-1">{item.lines?.length ? item.lines.map(line => `${line.description} × ${line.quantity} = ${money(line.line_total)}`).join(' · ') : 'No line items'}</p></div><div className="text-right"><p className="font-black">{money(item.total_amount)}</p><p className="text-[10px] text-slate-400">Paid {money(item.amount_paid)} · Due {money(outstanding)}</p></div><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{item.status}</span><div className="flex gap-2 flex-wrap">{item.status === 'draft' && <button type="button" disabled={busy} onClick={() => invoiceAction(item.id,'issue')} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-black">Issue</button>}{['issued','partially_paid','overdue'].includes(item.status) && outstanding > 0 && <button type="button" disabled={busy} onClick={() => openPayment(item)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black inline-flex items-center gap-1"><CreditCard size={12}/> Record payment</button>}{!['void','paid'].includes(item.status) && <button type="button" disabled={busy} onClick={() => invoiceAction(item.id,'void')} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black"><XCircle size={12}/></button>}</div></div>; })}{!invoices.length&&<div className="p-3"><EmptyState title="No invoices" description="No database invoices match this scope."/></div>}</div></section>
    {paymentInvoice && <div className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><form onSubmit={recordPayment} className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-widest font-black text-emerald-600">Finance</p><h2 className="text-lg font-black">Record payment</h2><p className="text-xs text-slate-400 mt-1">{paymentInvoice.invoice_number} · Outstanding {money(Math.max(Number(paymentInvoice.total_amount||0)-Number(paymentInvoice.amount_paid||0),0))}</p></div><button type="button" onClick={() => setPaymentInvoice(null)} className="p-2 rounded-lg hover:bg-slate-100"><X size={18}/></button></div><div className="p-5 space-y-3"><input className="field" type="number" min="0.01" step="0.01" placeholder="Amount" value={paymentForm.amount} onChange={e => setPaymentForm(v => ({...v,amount:e.target.value}))} required/><select className="field" value={paymentForm.method} onChange={e => setPaymentForm(v => ({...v,method:e.target.value}))}><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="card">Card</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="other">Other</option></select><input type="date" className="field" value={paymentForm.payment_date} onChange={e => setPaymentForm(v => ({...v,payment_date:e.target.value}))} required/><input className="field" placeholder="Transaction reference" value={paymentForm.transaction_reference} onChange={e => setPaymentForm(v => ({...v,transaction_reference:e.target.value}))}/><textarea className="field min-h-20" placeholder="Notes" value={paymentForm.notes} onChange={e => setPaymentForm(v => ({...v,notes:e.target.value}))}/><button disabled={busy} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black">{busy ? 'Recording…' : 'Record payment & issue receipt'}</button></div></form></div>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,92,246,.12)}`}</style>
  </div>;
}
