import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, FilePlus2, FileText, LogIn, ReceiptText, Wallet, X, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';
import { generateInvoicePDF } from '../utils/invoiceGenerator';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rows = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const normalize = value => String(value ?? '').trim().toUpperCase();
const fieldClass = 'w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), cache: method === 'GET' ? 'no-store' : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.detail || data.error || data.message || `Request failed (${response.status}).`); error.status = response.status; throw error; }
  return data;
}

function Badge({ status, unpaid = false }) {
  const styles = { draft: 'bg-slate-100 text-slate-600', issued: 'bg-blue-50 text-blue-700', overdue: 'bg-rose-50 text-rose-700', partially_paid: 'bg-amber-50 text-amber-700', paid: 'bg-emerald-50 text-emerald-700', void: 'bg-slate-100 text-slate-400', pending: 'bg-amber-50 text-amber-700', success: 'bg-emerald-50 text-emerald-700', failed: 'bg-rose-50 text-rose-700' };
  const label = unpaid ? 'Unpaid' : String(status || '').replace('_', ' ');
  return <span className={`inline-flex rounded-lg px-2 py-1 text-[9px] font-black uppercase ${unpaid ? 'bg-rose-50 text-rose-700' : (styles[status] || styles.draft)}`}>{label}</span>;
}

export default function BillingCenter() {
  const { user, loading: authLoading } = useAuth();
  const { schools = [], refreshAll, loading } = useData();
  const navigate = useNavigate();
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contractForm, setContractForm] = useState({ contract_number: '', start_date: today(), end_date: '', total_value: '', notes: '' });
  const [invoiceForm, setInvoiceForm] = useState({ contract: '', issue_date: today(), due_date: '', notes: '', description: '', quantity: '1', unit_price: '' });
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'bank_transfer', payment_date: today(), transaction_reference: '', notes: '' });

  const school = useMemo(() => {
    if (isAdmin) return schools.find(item => String(item.id) === String(selectedSchool)) || null;
    const key = normalize(user?.school_id || user?.school_code);
    return schools.find(item => [item.id, item.school_id, item.school_code, item.code].filter(Boolean).map(normalize).includes(key)) || null;
  }, [isAdmin, selectedSchool, schools, user?.school_id, user?.school_code]);
  const scope = school ? `?school=${encodeURIComponent(school.id)}` : '';

  const load = async () => {
    if (authLoading) return;
    setError('');
    try {
      const [contractPayload, invoicePayload, paymentPayload, summaryPayload] = await Promise.all([
        request(`/contracts${scope}`), request(`/invoices${scope}`), request(`/payments${scope}`), request(`/billing-summary${scope}`),
      ]);
      setContracts(rows(contractPayload)); setInvoices(rows(invoicePayload)); setPayments(rows(paymentPayload)); setSummary(summaryPayload || null); setSessionExpired(false);
    } catch (err) {
      if (err.status === 401) { setSessionExpired(true); setError('Your portal session has expired. Sign in again.'); }
      else setError(err.message || 'Unable to load billing data.');
    }
  };
  useEffect(() => { load(); }, [scope, authLoading]);

  const runAction = async action => {
    try { await action(); }
    catch (err) { if (err.status === 401) setSessionExpired(true); setError(err.message || 'Billing action failed.'); }
  };

  const createContract = async event => {
    event.preventDefault(); if (!school) return setError('Select a school before creating a contract.'); setBusy(true);
    await runAction(async () => { await request('/contracts', 'POST', { ...contractForm, school: school.id, total_value: Number(contractForm.total_value) }); setContractForm({ contract_number: '', start_date: today(), end_date: '', total_value: '', notes: '' }); await load(); await refreshAll(); }); setBusy(false);
  };

  const createInvoice = async event => {
    event.preventDefault();
    if (!school) return setError('Select a school before creating an invoice.');
    if (!invoiceForm.description.trim()) return setError('Invoice line description is required.');
    const quantity = Number(invoiceForm.quantity); const unitPrice = Number(invoiceForm.unit_price);
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return setError('Invoice quantity and unit price are invalid.');
    setBusy(true);
    await runAction(async () => {
      const created = await request('/invoices/create-with-lines', 'POST', { school: school.id, contract: invoiceForm.contract || null, issue_date: invoiceForm.issue_date, due_date: invoiceForm.due_date, notes: invoiceForm.notes, lines: [{ description: invoiceForm.description.trim(), quantity, unit_price: unitPrice }] });
      const issued = String(created?.status || '').toLowerCase() === 'draft' ? await request(`/invoices/${encodeURIComponent(created.id)}/issue`, 'POST', {}) : created;
      setInvoiceForm({ contract: '', issue_date: today(), due_date: '', notes: '', description: '', quantity: '1', unit_price: '' });
      setInvoices(current => [issued, ...current.filter(item => String(item.id) !== String(issued.id))]);
      await Promise.all([load(), refreshAll()]);
    });
    setBusy(false);
  };

  const invoiceAction = async (id, action) => { setBusy(true); await runAction(async () => { await request(`/invoices/${encodeURIComponent(id)}/${action}`, 'POST', {}); await load(); await refreshAll(); }); setBusy(false); };
  const openPayment = invoice => { const outstanding = Math.max(Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0), 0); setPaymentInvoice(invoice); setPaymentForm({ amount: outstanding ? String(outstanding) : '', method: 'bank_transfer', payment_date: today(), transaction_reference: '', notes: '' }); setError(''); };
  const recordPayment = async event => {
    event.preventDefault(); if (!paymentInvoice) return;
    const amount = Number(paymentForm.amount); const outstanding = Math.max(Number(paymentInvoice.total_amount || 0) - Number(paymentInvoice.amount_paid || 0), 0);
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) return setError(`Payment must be greater than 0 and no more than ${money(outstanding)}.`);
    setBusy(true);
    await runAction(async () => { await request('/payments/record', 'POST', { invoice: paymentInvoice.id, amount, method: paymentForm.method, payment_date: paymentForm.payment_date, transaction_reference: paymentForm.transaction_reference.trim(), notes: paymentForm.notes.trim() }); setPaymentInvoice(null); await load(); await refreshAll(); });
    setBusy(false);
  };
  const verifyPayment = async (id, action) => { setBusy(true); await runAction(async () => { await request(`/payments/${encodeURIComponent(id)}/${action}`, 'POST', {}); await load(); await refreshAll(); }); setBusy(false); };
  const pendingPayments = payments.filter(payment => payment.status === 'pending');

  if (authLoading) return <div className="space-y-5"><PageHeader eyebrow="Finance" title="Billing & Contracts" description="Loading your secure financial session…"/><div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">Authenticating…</div></div>;

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow={isAdmin ? 'Admin Finance' : 'School Finance'} title="Billing & Contracts" description={isAdmin ? 'Generate, issue and manage bills for partner schools and verify received payments.' : 'View Pixiu Tech invoices, submit payments and track verification status.'} actions={<RefreshButton onRefresh={async () => { await Promise.all([refreshAll(), load()]); }} loading={loading || busy}/>} />
    {sessionExpired ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><div className="flex items-start gap-3"><LogIn size={20} className="mt-0.5 text-amber-700"/><div><h2 className="font-black text-amber-900">Session expired</h2><p className="mt-1 text-sm text-amber-800">Sign in again to load financial records securely.</p><button type="button" onClick={() => navigate('/login')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white"><LogIn size={14}/> Sign in again</button></div></div></section> : error ? <ErrorState title="Billing action failed" description={error} onRetry={load}/> : null}
    {isAdmin && <div><label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">School scope</label><select value={selectedSchool} onChange={event => setSelectedSchool(event.target.value)} className={fieldClass}><option value="">Select school to manage billing</option>{schools.map(item => <option key={item.id} value={item.id}>{item.name} ({item.school_code})</option>)}</select></div>}
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[['Contract value', summary?.contract_value], ['Invoiced', summary?.invoiced], ['Collected', summary?.collected], ['Outstanding', summary?.pending], ['Invoices', summary?.invoice_count]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-2 text-xl font-black text-slate-900">{label === 'Invoices' ? Number(value || 0) : money(value)}</p></div>)}</section>

    {isAdmin && school && <section className="grid grid-cols-1 gap-5 xl:grid-cols-2"><form onSubmit={createContract} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Wallet size={17}/><h2 className="font-black">New Contract</h2></div><input className={fieldClass} placeholder="Contract number" value={contractForm.contract_number} onChange={e => setContractForm(v => ({ ...v, contract_number: e.target.value }))} required/><div className="grid grid-cols-2 gap-2"><input type="date" className={fieldClass} value={contractForm.start_date} onChange={e => setContractForm(v => ({ ...v, start_date: e.target.value }))} required/><input type="date" className={fieldClass} value={contractForm.end_date} onChange={e => setContractForm(v => ({ ...v, end_date: e.target.value }))} required/></div><input type="number" min="0" step="0.01" className={fieldClass} placeholder="Contract value" value={contractForm.total_value} onChange={e => setContractForm(v => ({ ...v, total_value: e.target.value }))} required/><textarea className={`${fieldClass} min-h-20`} placeholder="Notes" value={contractForm.notes} onChange={e => setContractForm(v => ({ ...v, notes: e.target.value }))}/><button disabled={busy} className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white disabled:opacity-50"><FilePlus2 size={14} className="mr-2 inline"/>Create Contract</button></form><form onSubmit={createInvoice} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><ReceiptText size={17}/><h2 className="font-black">New Invoice</h2></div><select className={fieldClass} value={invoiceForm.contract} onChange={e => setInvoiceForm(v => ({ ...v, contract: e.target.value }))}><option value="">No contract link</option>{contracts.map(item => <option key={item.id} value={item.id}>{item.contract_number}</option>)}</select><div className="grid grid-cols-2 gap-2"><input type="date" className={fieldClass} value={invoiceForm.issue_date} onChange={e => setInvoiceForm(v => ({ ...v, issue_date: e.target.value }))} required/><input type="date" className={fieldClass} value={invoiceForm.due_date} onChange={e => setInvoiceForm(v => ({ ...v, due_date: e.target.value }))} required/></div><input className={fieldClass} placeholder="Line description" value={invoiceForm.description} onChange={e => setInvoiceForm(v => ({ ...v, description: e.target.value }))} required/><div className="grid grid-cols-2 gap-2"><input type="number" min="1" step="1" className={fieldClass} placeholder="Quantity" value={invoiceForm.quantity} onChange={e => setInvoiceForm(v => ({ ...v, quantity: e.target.value }))} required/><input type="number" min="0" step="0.01" className={fieldClass} placeholder="Unit price" value={invoiceForm.unit_price} onChange={e => setInvoiceForm(v => ({ ...v, unit_price: e.target.value }))} required/></div><textarea className={`${fieldClass} min-h-20`} placeholder="Invoice notes" value={invoiceForm.notes} onChange={e => setInvoiceForm(v => ({ ...v, notes: e.target.value }))}/><button disabled={busy} className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white disabled:opacity-50"><ReceiptText size={14} className="mr-2 inline"/>Create & Issue Invoice</button></form></section>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">Invoices</h2><p className="mt-1 text-xs text-slate-400">{isAdmin ? 'Issued invoices are sent to the selected school and can be voided when appropriate.' : 'Invoices issued by Pixiu Tech to this school.'}</p></div><div className="divide-y divide-slate-100">{invoices.map(item => { const outstanding = Math.max(Number(item.total_amount || 0) - Number(item.amount_paid || 0), 0); const pending = payments.find(payment => String(payment.invoice) === String(item.id) && payment.status === 'pending'); return <div key={item.id} className="p-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-800">{item.invoice_number}</p><Badge status={item.status}/>{!isAdmin && outstanding > 0 && <Badge status={item.status} unpaid/>}{pending && <Badge status="pending"/>}</div><p className="mt-1 text-xs text-slate-400">{item.school_code || school?.school_code || '—'} · Issue {item.issue_date} · Due {item.due_date}</p><p className="mt-1 text-xs text-slate-500">{item.lines?.length ? item.lines.map(line => `${line.description} × ${line.quantity} = ${money(line.line_total)}`).join(' · ') : 'No line items'}</p></div><div className="text-left xl:text-right"><p className="font-black">{money(item.total_amount)}</p><p className="text-[10px] text-slate-400">Paid {money(item.amount_paid)} · Due {money(outstanding)}</p></div><div className="flex flex-wrap gap-2">{isAdmin && item.status === 'draft' && <button type="button" disabled={busy} onClick={() => invoiceAction(item.id, 'issue')} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-black text-white">Issue</button>}{isAdmin && !['void', 'paid'].includes(item.status) && <button type="button" disabled={busy} onClick={() => invoiceAction(item.id, 'void')} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[10px] font-black text-rose-600">Void</button>}{!isAdmin && ['issued', 'partially_paid', 'overdue'].includes(item.status) && outstanding > 0 && !pending && <button type="button" disabled={busy} onClick={() => openPayment(item)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white"><CreditCard size={12}/> Submit payment</button>}{pending && !isAdmin && <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] font-black text-amber-700">Payment pending verification</span>}<button type="button" onClick={() => generateInvoicePDF(item, school)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-700 hover:bg-slate-50"><FileText size={12}/> Invoice PDF</button></div></div></div>; })}{!invoices.length && <div className="p-6"><EmptyState title="No invoices" description={isAdmin && !school ? 'Select a partner school above to manage its billing record.' : isAdmin ? 'No invoice has been created for this school yet.' : 'No Pixiu Tech invoice has been issued to this school yet.'}/></div>}</div></section>

    {isAdmin && <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm"><div className="border-b border-amber-100 p-5"><h2 className="font-black text-amber-950">Payment verification</h2><p className="mt-1 text-xs text-amber-800">School-submitted payments stay pending until Pixiu Tech verifies them.</p></div><div className="divide-y divide-amber-100">{pendingPayments.map(payment => <div key={payment.id} className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-800">{payment.invoice_number || payment.invoice}</p><Badge status={payment.status}/></div><p className="mt-1 text-xs text-slate-500">Amount {money(payment.amount)} · {payment.method} · Ref {payment.transaction_reference || '—'}</p><p className="mt-1 text-[10px] text-slate-400">Submitted {payment.payment_date ? new Date(payment.payment_date).toLocaleString('en-IN') : '—'}</p></div><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => verifyPayment(payment.id, 'verify')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white"><CheckCircle2 size={13}/> Verify & mark paid</button><button type="button" disabled={busy} onClick={() => verifyPayment(payment.id, 'reject')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[10px] font-black text-rose-600"><XCircle size={13}/> Reject</button></div></div>)}{!pendingPayments.length && <div className="p-6"><EmptyState compact title="No pending payments" description="Verified and rejected payment submissions are kept in the payment ledger."/></div>}</div></section>}

    {contracts.length > 0 && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">Contracts</h2></div><div className="divide-y divide-slate-100">{contracts.map(item => <div key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-black text-slate-800">{item.contract_number}</p><p className="text-xs text-slate-400">{item.school_name || item.school_code || school?.school_code || '—'} · {item.start_date} → {item.end_date}</p></div><p className="font-black">{money(item.total_value)}</p><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black uppercase">{item.status}</span></div>)}</div></section>}

    {paymentInvoice && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={recordPayment} className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Payment submission</p><h2 className="mt-1 text-xl font-black text-slate-900">{paymentInvoice.invoice_number}</h2><p className="mt-1 text-xs text-slate-500">Your payment will remain pending until Pixiu Tech verifies the transaction.</p></div><button type="button" onClick={() => setPaymentInvoice(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={16}/></button></div><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Amount</span><input className={fieldClass} type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(v => ({ ...v, amount: e.target.value }))} required/></label><div className="grid grid-cols-2 gap-2"><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Method</span><select className={fieldClass} value={paymentForm.method} onChange={e => setPaymentForm(v => ({ ...v, method: e.target.value }))}><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="card">Card</option><option value="cash">Cash</option><option value="other">Other</option></select></label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Payment date</span><input className={fieldClass} type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(v => ({ ...v, payment_date: e.target.value }))} required/></label></div><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Transaction reference</span><input className={fieldClass} value={paymentForm.transaction_reference} onChange={e => setPaymentForm(v => ({ ...v, transaction_reference: e.target.value }))} placeholder="UTR / UPI ref / bank reference"/></label><label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-slate-400">Notes</span><textarea className={`${fieldClass} min-h-20`} value={paymentForm.notes} onChange={e => setPaymentForm(v => ({ ...v, notes: e.target.value }))}/></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setPaymentInvoice(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600">Cancel</button><button disabled={busy} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">Submit for verification</button></div></form></div>}
  </div>;
}
