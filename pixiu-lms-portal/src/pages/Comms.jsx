import { useMemo, useState } from 'react';
import { AlertCircle, MessageSquare, Plus, RefreshCw, Send, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const clean = value => String(value ?? '').trim();
const collection = value => Array.isArray(value) ? value : [];

export default function Comms() {
  const { user } = useAuth();
  const { students = [], comms = [], sendCommsMessage, refreshAll, loading, endpointErrors = {} } = useData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ student: '', recipient: 'Parent', channel: 'whatsapp', template: '', message: '' });

  const rows = useMemo(() => collection(comms), [comms]);
  const activeStudents = useMemo(() => collection(students).filter(student => clean(student.status).toLowerCase() !== 'inactive'), [students]);
  const loadError = endpointErrors['/comms'] || '';

  const resetForm = () => { setForm({ student: '', recipient: 'Parent', channel: 'whatsapp', template: '', message: '' }); setError(''); };
  const submit = async event => {
    event.preventDefault(); setError('');
    if (!form.student) { setError('Select a real student from the database.'); return; }
    if (!form.message.trim()) { setError('Message is required.'); return; }
    setSending(true);
    try {
      const result = await sendCommsMessage({ student_id: form.student, recipient: form.recipient.trim() || 'Parent', channel: form.channel, template: form.template.trim(), message: form.message.trim(), status: 'Queued' });
      if (result?.success === false) throw new Error(result.error || 'Communication could not be logged.');
      await refreshAll();
      toast.success('Communication logged in the server record.');
      setOpen(false); resetForm();
    } catch (err) {
      const message = err.message || 'Communication could not be logged.';
      setError(message); toast.error(message);
    } finally { setSending(false); }
  };

  return <div className="space-y-6 pb-12">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.16em] font-black text-blue-600">COMMUNICATIONS</p><h1 className="text-2xl font-black text-slate-900 mt-1">Parent Communication Log</h1><p className="text-sm text-slate-500 mt-1">Every message is tied to a real student and stored by the backend.</p></div><div className="flex gap-2"><RefreshButton onRefresh={refreshAll} loading={loading}/><button type="button" onClick={() => { resetForm(); setOpen(true); }} disabled={!activeStudents.length} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-50"><Plus size={16}/> Log communication</button></div></div>
    {user?.role !== 'admin' && user?.role !== 'school' && <ErrorState title="Communication logging is restricted" description="Only administrators and school accounts can create parent communication records." />}
    {loadError ? <ErrorState title="Unable to load communication history" description={loadError} onRetry={refreshAll}/> : loading && !rows.length ? <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500"><RefreshCw className="mx-auto animate-spin text-slate-300" size={24}/><p className="mt-2">Loading communication records…</p></div> : !rows.length ? <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12"><EmptyState title="No communication records yet" description="Once a parent update is logged, it will appear here with its real student and delivery details." /></div> : <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"><div className="divide-y divide-slate-100">{rows.map(row => <div key={row.id} className="p-4 sm:p-5 flex gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><MessageSquare size={18}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-sm text-slate-900">{row.student_id || 'Student record'}</p><span className="text-[10px] uppercase font-black px-2 py-1 rounded-full bg-slate-100 text-slate-500">{row.channel || 'channel not set'}</span><span className="text-[10px] uppercase font-black px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">{row.status || 'logged'}</span></div><p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{row.message || 'No message recorded.'}</p><p className="text-[11px] text-slate-400 mt-2">Recipient: {row.recipient || 'Parent'}{row.sent_at ? ` · ${new Date(row.sent_at).toLocaleString('en-IN')}` : ''}</p></div></div>)}</div></section>}
    {open && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl"><header className="p-5 border-b border-slate-200 flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">Log parent communication</h2><p className="text-xs text-slate-400 mt-1">This records the communication; it does not pretend a WhatsApp delivery occurred.</p></div><button type="button" onClick={() => { setOpen(false); resetForm(); }} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Close"><X size={18}/></button></header><form onSubmit={submit} className="p-5 space-y-4">{error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 flex gap-2"><AlertCircle size={15} className="shrink-0 mt-0.5" />{error}</div>}<div><label className="text-xs font-bold text-slate-500">Student</label><select value={form.student} onChange={event => setForm(previous => ({ ...previous, student: event.target.value }))} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"><option value="">Select a student…</option>{activeStudents.map(student => <option key={student.id} value={student.id}>{student.name || student.student_id} {student.student_id ? `(${student.student_id})` : ''}</option>)}</select></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="text-xs font-bold text-slate-500">Recipient</label><input value={form.recipient} onChange={event => setForm(previous => ({ ...previous, recipient: event.target.value }))} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" /></div><div><label className="text-xs font-bold text-slate-500">Channel</label><select value={form.channel} onChange={event => setForm(previous => ({ ...previous, channel: event.target.value }))} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option><option value="phone">Phone</option><option value="portal">Portal</option></select></div></div><div><label className="text-xs font-bold text-slate-500">Template name (optional)</label><input value={form.template} onChange={event => setForm(previous => ({ ...previous, template: event.target.value }))} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="e.g. attendance update" /></div><div><label className="text-xs font-bold text-slate-500">Message</label><textarea required rows={5} value={form.message} onChange={event => setForm(previous => ({ ...previous, message: event.target.value }))} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="Write the message that was sent or is being logged…" /></div><button type="submit" disabled={sending || !form.student || !form.message.trim()} className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl py-3 font-bold disabled:bg-slate-300"><Send size={16} />{sending ? 'Saving…' : 'Save communication record'}</button></form></div></div>}
  </div>;
}
