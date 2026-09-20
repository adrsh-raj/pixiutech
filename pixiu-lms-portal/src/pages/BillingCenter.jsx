import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';
import { generateInvoicePDF } from '../utils/invoiceGenerator';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rows = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const normalize = value => String(value ?? '').trim().toUpperCase();
const fieldClass = 'w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#236F69] focus:ring-2 focus:ring-[#236F69]/10';

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

function Status({ status, pending = false }) {
  if (pending) return <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-amber-700">Payment under review</span>;
  const map = {
    draft: ['Draft', 'bg-slate-100 text-slate-600'],
    issued: ['Awaiting payment', 'bg-[#F0F7F5] text-[#215F55]'],
    partially_paid: ['Partially paid', 'bg-amber-50 text-amber-700'],
    overdue: ['Overdue', 'bg-rose-50 text-rose-700'],
    paid: ['Paid', 'bg-emerald-50 text-emerald-700'],
    void: ['Voided', 'bg-slate-100 text-slate-500'],
  };
  const [label, classes] = map[status] || ['Unknown', 'bg-slate-100 text-slate-600'];
  return <span className={`inline-flex rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${classes}`}>{label}</span>;
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div className="border-b border-slate-100 px-5 py-4">
      {eyebrow && <p className="text-[9px] font-black uppercase tracking-[.16em] text-[#236F69]">{eyebrow}</p>}
      <h2 className="mt-1 text-base font-black text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}
    </div>
  );
}

export default function BillingCenter() {
  const { user, loading: authLoading } = useAuth();
  const { schools = [], refreshAll, loading: dataLoading } = useData();
  const navigate = useNavigate();
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  const [selectedSchool, setSelectedSchool] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [billingProfile, setBillingProfile] = useState(null);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showBillForm, setShowBillForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);

  const [billForm, setBillForm] = useState({
    description: '',
    amount: '',
    tax_amount: '',
    due_date: today(),
    notes: '',
    contract: '',
  });
  const [contractForm, setContractForm] = useState({
    contract_number: '',
    start_date: today(),
    end_date: '',
    total_value: '',
    notes: '',
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'bank_transfer',
    payment_date: today(),
    transaction_reference: '',
    notes: '',
  });

  const school = useMemo(() => {
    if (isAdmin) return schools.find(item => String(item.id) === String(selectedSchool)) || null;
    const key = normalize(user?.school_id || user?.school_code);
    return schools.find(item => [item.id, item.school_id, item.school_code, item.code].filter(Boolean).map(normalize).includes(key)) || null;
  }, [isAdmin, selectedSchool, schools, user?.school_id, user?.school_code]);

  const scope = school ? `?school=${encodeURIComponent(school.id)}` : '';

  const load = async () => {
    if (authLoading || (isAdmin && !school)) {
      setInvoices([]);
      setPayments([]);
      setContracts([]);
      setSummary(null);
      return;
    }
    setError('');
    try {
      const [invoicePayload, paymentPayload, summaryPayload, profilePayload, contractPayload] = await Promise.all([
        request(`/invoices${scope}`),
        request(`/payments${scope}`),
        request(`/billing-summary${scope}`),
        request('/billing-profile'),
        request(`/contracts${scope}`),
      ]);
      setInvoices(rows(invoicePayload));
      setPayments(rows(paymentPayload));
      setSummary(summaryPayload || null);
      setBillingProfile(profilePayload || null);
      setContracts(rows(contractPayload));
      setSessionExpired(false);
    } catch (err) {
      if (err.status === 401) {
        setSessionExpired(true);
        setError('Your portal session has expired. Sign in again.');
      } else {
        setError(err.message || 'Unable to load billing data.');
      }
    }
  };

  useEffect(() => { void load(); }, [scope, authLoading, isAdmin, school?.id]);

  const runAction = async action => {
    try {
      await action();
    } catch (err) {
      if (err.status === 401) setSessionExpired(true);
      setError(err.message || 'Billing action failed.');
    }
  };

  const paymentByInvoice = useMemo(() => {
    const map = new Map();
    payments.forEach(payment => {
      if (payment.status === 'pending') map.set(String(payment.invoice), payment);
    });
    return map;
  }, [payments]);

  const pendingPayments = payments.filter(payment => payment.status === 'pending');
  const verifiedPayments = payments.filter(payment => payment.status === 'success').slice(0, 8);

  const resetBill = () => setBillForm({
    description: '',
    amount: '',
    tax_amount: '',
    due_date: today(),
    notes: '',
    contract: '',
  });

  const createBill = async event => {
    event.preventDefault();
    if (!school) return setError('Select a school first.');
    const amount = Number(billForm.amount);
    const tax = Number(billForm.tax_amount || 0);
    if (!billForm.description.trim()) return setError('Bill description is required.');
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a valid bill amount.');
    if (!Number.isFinite(tax) || tax < 0) return setError('Enter a valid tax amount.');

    setBusy(true);
    await runAction(async () => {
      await request('/invoices/create-with-lines', 'POST', {
        school: school.id,
        contract: billForm.contract || null,
        issue_date: today(),
        due_date: billForm.due_date,
        tax_amount: tax,
        notes: billForm.notes.trim(),
        lines: [{ description: billForm.description.trim(), quantity: 1, unit_price: amount }],
      });
      resetBill();
      setShowBillForm(false);
      await Promise.all([load(), refreshAll()]);
    });
    setBusy(false);
  };

  const createContract = async event => {
    event.preventDefault();
    if (!school) return;
    if (!contractForm.contract_number.trim() || !contractForm.end_date) return setError('Contract number and end date are required.');
    const value = Number(contractForm.total_value);
    if (!Number.isFinite(value) || value < 0) return setError('Enter a valid contract value.');
    setBusy(true);
    await runAction(async () => {
      await request('/contracts', 'POST', {
        ...contractForm,
        school: school.id,
        contract_number: contractForm.contract_number.trim(),
        total_value: value,
      });
      setContractForm({ contract_number: '', start_date: today(), end_date: '', total_value: '', notes: '' });
      setShowContractForm(false);
      await Promise.all([load(), refreshAll()]);
    });
    setBusy(false);
  };

  const openPayment = invoice => {
    const outstanding = Math.max(Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0), 0);
    setPaymentInvoice(invoice);
    setPaymentForm({
      amount: outstanding ? String(outstanding) : '',
      method: 'bank_transfer',
      payment_date: today(),
      transaction_reference: '',
      notes: '',
    });
    setError('');
  };

  const submitPayment = async event => {
    event.preventDefault();
    if (!paymentInvoice) return;
    const amount = Number(paymentForm.amount);
    const outstanding = Math.max(Number(paymentInvoice.total_amount || 0) - Number(paymentInvoice.amount_paid || 0), 0);
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) {
      return setError(`Payment must be greater than 0 and no more than ${money(outstanding)}.`);
    }
    if (!paymentForm.transaction_reference.trim()) {
      return setError('Enter the UTR / transaction reference so Pixiu Tech can verify the payment.');
    }

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
      await Promise.all([load(), refreshAll()]);
    });
    setBusy(false);
  };

  const verifyPayment = async (id, action) => {
    setBusy(true);
    await runAction(async () => {
      await request(`/payments/${encodeURIComponent(id)}/${action}`, 'POST', {});
      await Promise.all([load(), refreshAll()]);
    });
    setBusy(false);
  };

  if (authLoading) {
    return <div className="space-y-5"><PageHeader eyebrow="Finance" title="Billing" description="Loading your secure financial session…" /><div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">Authenticating…</div></div>;
  }

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        eyebrow={isAdmin ? 'Pixiu Tech Finance' : 'School Finance'}
        title="Billing"
        description={isAdmin ? 'Bill a school, track payment, and verify the money received. The school is notified automatically.' : 'View bills from Pixiu Tech, see where to pay, and mark a payment for verification.'}
        actions={<RefreshButton onRefresh={async () => { await Promise.all([refreshAll(), load()]); }} loading={dataLoading || busy} />}
      />

      {sessionExpired && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-black text-amber-950">Session expired</h2>
          <p className="mt-1 text-sm text-amber-800">Sign in again to load financial records securely.</p>
          <button type="button" onClick={() => navigate('/login')} className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white">Sign in again</button>
        </section>
      )}

      {error && !sessionExpired && <ErrorState title="Billing action failed" description={error} onRetry={load} />}

      {isAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <label htmlFor="billing-school" className="mb-1.5 block text-[9px] font-black uppercase tracking-[.14em] text-slate-400">Bill a school</label>
          <select id="billing-school" value={selectedSchool} onChange={event => setSelectedSchool(event.target.value)} className={fieldClass}>
            <option value="">Select partner school</option>
            {schools.map(item => <option key={item.id} value={item.id}>{item.name} ({item.school_code})</option>)}
          </select>
          <p className="mt-2 text-[11px] text-slate-500">Every bill is tied to the selected school. Once issued, the school gets an automatic portal notification.</p>
        </section>
      )}

      {!school && isAdmin && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-black text-slate-700">Select a partner school to manage its billing</p>
          <p className="mt-1 text-xs text-slate-500">The same screen will show its bills, payment status, and verification history.</p>
        </section>
      )}

      {school && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Total billed', summary?.invoiced],
              ['Paid', summary?.collected],
              ['Outstanding', summary?.pending],
              ['Invoices', summary?.invoice_count],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[9px] font-black uppercase tracking-[.12em] text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-black text-slate-900">{label === 'Invoices' ? Number(value || 0) : money(value)}</p>
              </div>
            ))}
          </section>

          {!isAdmin && billingProfile && (
            <section className="rounded-2xl border border-slate-200 bg-white">
              <SectionTitle eyebrow="Payment details" title="Pay Pixiu Tech" description="Use these details when paying a Pixiu Tech bill. Keep the transaction reference for verification." />
              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Account name" value={billingProfile.account_name} />
                <Detail label="Bank" value={billingProfile.bank_name} />
                <Detail label="Account number" value={billingProfile.account_number} mono />
                <Detail label="IFSC" value={billingProfile.ifsc} mono />
                <Detail label="UPI" value={billingProfile.upi} mono />
              </div>
              {!billingProfile.configured && <div className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-800">Payment details are not configured on the server yet. Ask Pixiu Tech before making a transfer.</div>}
            </section>
          )}

          {isAdmin && (
            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.16em] text-[#236F69]">Selected school</p>
                  <h2 className="mt-1 text-base font-black text-slate-900">{school.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{school.school_code} · {school.email || 'No billing email on profile'}</p>
                </div>
                <button type="button" onClick={() => setShowBillForm(value => !value)} className="rounded-xl bg-[#236F69] px-4 py-2.5 text-xs font-black text-white">{showBillForm ? 'Close bill form' : 'Create new bill'}</button>
              </div>
              {!billingProfile?.configured && (
                <div className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-800">
                  Pixiu Tech payment details are not configured on the server. Bank details will not appear on new invoices until they are configured.
                </div>
              )}
              {showBillForm && (
                <form onSubmit={createBill} className="grid gap-3 p-5 lg:grid-cols-2">
                  <label className="block lg:col-span-2"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">What are you billing for?</span><input className={fieldClass} value={billForm.description} onChange={e => setBillForm(v => ({ ...v, description: e.target.value }))} placeholder="e.g. Robotics programme, July–September" required /></label>
                  <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">Amount</span><input className={fieldClass} type="number" min="0.01" step="0.01" value={billForm.amount} onChange={e => setBillForm(v => ({ ...v, amount: e.target.value }))} placeholder="0.00" required /></label>
                  <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">Due date</span><input className={fieldClass} type="date" value={billForm.due_date} onChange={e => setBillForm(v => ({ ...v, due_date: e.target.value }))} required /></label>
                  <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">Tax (optional)</span><input className={fieldClass} type="number" min="0" step="0.01" value={billForm.tax_amount} onChange={e => setBillForm(v => ({ ...v, tax_amount: e.target.value }))} placeholder="0.00" /></label>
                  <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">Contract (optional)</span><select className={fieldClass} value={billForm.contract} onChange={e => setBillForm(v => ({ ...v, contract: e.target.value }))}><option value="">No contract linked</option>{contracts.map(contract => <option key={contract.id} value={contract.id}>{contract.contract_number}</option>)}</select></label>
                  <label className="block lg:col-span-2"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">Notes (optional)</span><textarea className={`${fieldClass} min-h-20 py-3`} value={billForm.notes} onChange={e => setBillForm(v => ({ ...v, notes: e.target.value }))} placeholder="Payment or billing note for the school" /></label>
                  <div className="lg:col-span-2 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] text-slate-500">This creates the invoice and issues it immediately. The school is notified automatically.</p><button disabled={busy} className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create & send bill'}</button></div>
                </form>
              )}
              <div className="border-t border-slate-100 px-5 py-3">
                <button type="button" onClick={() => setShowContractForm(value => !value)} className="text-xs font-black text-[#236F69]">{showContractForm ? 'Hide contract setup' : 'Contract setup'}</button>
              </div>
              {showContractForm && (
                <form onSubmit={createContract} className="grid gap-3 border-t border-slate-100 bg-slate-50 p-5 lg:grid-cols-4">
                  <input className={fieldClass} placeholder="Contract number" value={contractForm.contract_number} onChange={e => setContractForm(v => ({ ...v, contract_number: e.target.value }))} required />
                  <input className={fieldClass} type="date" value={contractForm.start_date} onChange={e => setContractForm(v => ({ ...v, start_date: e.target.value }))} required />
                  <input className={fieldClass} type="date" value={contractForm.end_date} onChange={e => setContractForm(v => ({ ...v, end_date: e.target.value }))} required />
                  <input className={fieldClass} type="number" min="0" step="0.01" placeholder="Contract value" value={contractForm.total_value} onChange={e => setContractForm(v => ({ ...v, total_value: e.target.value }))} required />
                  <textarea className={`${fieldClass} min-h-16 py-3 lg:col-span-3`} placeholder="Notes" value={contractForm.notes} onChange={e => setContractForm(v => ({ ...v, notes: e.target.value }))} />
                  <button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save contract'}</button>
                </form>
              )}
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <SectionTitle eyebrow="Bills" title={isAdmin ? `Bills for ${school.name}` : 'Bills from Pixiu Tech'} description={isAdmin ? 'Create and issue bills here. Payment verification stays separate below.' : 'Only bills issued to your school appear here.'} />
            {!invoices.length ? (
              <div className="p-8"><EmptyState title="No bills yet" description={isAdmin ? 'Create the first bill for this school.' : 'Pixiu Tech has not issued a bill to your school yet.'} /></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.map(invoice => {
                  const outstanding = Math.max(Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0), 0);
                  const pending = paymentByInvoice.get(String(invoice.id));
                  const canPay = !isAdmin && !pending && outstanding > 0 && ['issued', 'partially_paid', 'overdue'].includes(invoice.status);
                  return (
                    <article key={invoice.id} className="p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-slate-900">{invoice.invoice_number}</p>
                            <Status status={invoice.status} pending={Boolean(pending)} />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{invoice.issue_date} · Due {invoice.due_date}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">{invoice.lines?.map(line => `${line.description} × ${line.quantity}`).join(' · ') || 'Invoice details available in PDF.'}</p>
                        </div>
                        <div className="xl:text-right">
                          <p className="text-lg font-black text-slate-900">{money(invoice.total_amount)}</p>
                          <p className="mt-1 text-[10px] text-slate-500">Paid {money(invoice.amount_paid)} · Due {money(outstanding)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canPay && <button type="button" onClick={() => openPayment(invoice)} disabled={busy} className="rounded-xl bg-[#236F69] px-3.5 py-2 text-[10px] font-black text-white disabled:opacity-50">I've paid</button>}
                          {pending && !isAdmin && <span className="rounded-xl bg-amber-50 px-3.5 py-2 text-[10px] font-black text-amber-700">Awaiting bank verification</span>}
                          {isAdmin && invoice.status !== 'paid' && invoice.status !== 'void' && <button type="button" onClick={() => runAction(async () => { await request(`/invoices/${encodeURIComponent(invoice.id)}/void`, 'POST', {}); await load(); await refreshAll(); })} disabled={busy} className="rounded-xl border border-rose-200 px-3.5 py-2 text-[10px] font-black text-rose-600">Void</button>}
                          <button type="button" onClick={() => generateInvoicePDF(invoice, school)} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black text-slate-700">View invoice</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {isAdmin && (
            <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white">
              <SectionTitle eyebrow="Action required" title={pendingPayments.length ? `${pendingPayments.length} payment waiting for verification` : 'No payment waiting for verification'} description={pendingPayments.length ? 'Check the bank statement / UTR first, then complete or reject the payment here.' : 'When a school marks a bill as paid, it will appear here automatically.'} />
              {pendingPayments.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {pendingPayments.map(payment => (
                    <div key={payment.id} className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-900">{payment.invoice_number || payment.invoice}</p>
                        <p className="mt-1 text-xs text-slate-500">{school.name} · {money(payment.amount)} · {payment.method}</p>
                        <p className="mt-1 text-xs text-slate-500">UTR / reference: <span className="font-mono font-bold">{payment.transaction_reference || 'Not provided'}</span></p>
                        <p className="mt-1 text-[10px] text-slate-400">Payment date: {payment.payment_date ? String(payment.payment_date).slice(0, 10) : 'Not provided'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => verifyPayment(payment.id, 'verify')} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-black text-white disabled:opacity-50">Verify & complete payment</button>
                        <button type="button" onClick={() => verifyPayment(payment.id, 'reject')} disabled={busy} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-[10px] font-black text-rose-600 disabled:opacity-50">Reject payment</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <SectionTitle eyebrow="Receipts" title="Payment history" description="Successful payments automatically create a receipt. Nothing needs to be created manually." />
            {!verifiedPayments.length ? (
              <div className="p-7"><EmptyState compact title="No successful payments yet" description="Verified payments will appear here with their receipt number." /></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {verifiedPayments.map(payment => (
                  <div key={payment.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-800">{payment.invoice_number || payment.invoice}</p>
                      <p className="mt-1 text-xs text-slate-500">{payment.payment_date ? String(payment.payment_date).slice(0, 10) : '—'} · {payment.method} · {payment.transaction_reference || 'No reference'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black">{money(payment.amount)}</p>
                      {payment.receipt_number && <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-700">{payment.receipt_number}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {paymentInvoice && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-3 sm:items-center sm:p-5">
          <form onSubmit={submitPayment} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-[#236F69]">Payment confirmation</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{paymentInvoice.invoice_number}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">After you submit this, the bill will show <b>Payment under review</b> until Pixiu Tech checks the bank transaction.</p>
              </div>
              <button type="button" onClick={() => setPaymentInvoice(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Close payment form"><X size={16} /></button>
            </div>
            <div className="mt-5 space-y-3">
              <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">Amount paid</span><input className={fieldClass} type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(v => ({ ...v, amount: e.target.value }))} required /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">Method</span><select className={fieldClass} value={paymentForm.method} onChange={e => setPaymentForm(v => ({ ...v, method: e.target.value }))}><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="card">Card</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
                <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">Payment date</span><input className={fieldClass} type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(v => ({ ...v, payment_date: e.target.value }))} required /></label>
              </div>
              <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">UTR / transaction reference</span><input className={fieldClass} value={paymentForm.transaction_reference} onChange={e => setPaymentForm(v => ({ ...v, transaction_reference: e.target.value }))} placeholder="Required for bank verification" required /></label>
              <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-slate-400">Note (optional)</span><textarea className={`${fieldClass} min-h-20 py-3`} value={paymentForm.notes} onChange={e => setPaymentForm(v => ({ ...v, notes: e.target.value }))} /></label>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setPaymentInvoice(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600">Cancel</button>
                <button disabled={busy} className="rounded-xl bg-[#236F69] px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Mark payment for verification'}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono = false }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[9px] font-black uppercase tracking-[.1em] text-slate-400">{label}</p>
      <p className={`mt-1 break-all text-xs font-black text-slate-800 ${mono ? 'font-mono' : ''}`}>{value || 'Not configured'}</p>
    </div>
  );
}
