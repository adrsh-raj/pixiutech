import { useMemo, useState } from 'react';
import { Bell, Megaphone, Plus, Send, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

const TARGETS = [
  ['all_schools', 'All Schools'],
  ['specific_school', 'Specific School'],
  ['specific_trainer', 'Specific Trainer'],
  ['specific_class', 'Specific Class'],
  ['all_trainers', 'All Trainers'],
  ['all_students', 'All Students'],
];

const collection = value => Array.isArray(value) ? value : [];

export default function Notifications() {
  const { notifications = [], schools = [], trainers = [], classes = [], sendBroadcastNotification, refreshAll, loading } = useData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState('all_schools');
  const [targetId, setTargetId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', message: '', severity: 'info' });

  const rows = collection(notifications);
  const activeSchools = collection(schools);
  const activeTrainers = collection(trainers);
  const activeClasses = collection(classes);
  const targetOptions = targetType === 'specific_school' ? activeSchools : targetType === 'specific_trainer' ? activeTrainers : activeClasses;
  const needsTarget = ['specific_school', 'specific_trainer', 'specific_class'].includes(targetType);

  const history = useMemo(() => {
    const groups = new Map();
    rows.forEach(item => {
      const key = item.broadcast_key || item.id;
      const current = groups.get(key) || { ...item, recipient_count: 0 };
      current.recipient_count += 1;
      groups.set(key, current);
    });
    return [...groups.values()].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }, [rows]);

  const resetForm = () => {
    setForm({ title: '', message: '', severity: 'info' });
    setTargetType('all_schools');
    setTargetId('');
    setError('');
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (needsTarget && !targetId) {
      setError('Select a real target from the current database records.');
      return;
    }
    setSending(true);
    try {
      const payload = { target_type: targetType, title: form.title.trim(), message: form.message.trim(), severity: form.severity, notification_type: 'info' };
      if (targetType === 'specific_school') payload.target_school_id = targetId;
      if (targetType === 'specific_trainer') payload.target_trainer_id = targetId;
      if (targetType === 'specific_class') payload.target_class_id = targetId;
      const result = await sendBroadcastNotification(payload);
      if (result?.success === false) throw new Error(result.error || 'Could not publish notification.');
      toast.success('Notification delivered to the selected audience.');
      setOpen(false);
      resetForm();
      await refreshAll();
    } catch (err) {
      setError(err.message || 'Notification delivery failed.');
      toast.error(err.message || 'Notification delivery failed.');
    } finally {
      setSending(false);
    }
  };

  const targetLabel = item => {
    if (item.target_type === 'specific_school') return item.target_school_code || 'Specific school';
    if (item.target_type === 'specific_trainer') return item.target_trainer_id || 'Specific trainer';
    if (item.target_type === 'specific_class') return item.target_class_name || 'Specific class';
    if (item.target_type === 'all_schools') return 'All Schools';
    if (item.target_type === 'all_trainers') return 'All Trainers';
    if (item.target_type === 'all_students') return 'All Students';
    return 'Universal';
  };

  return <div className="space-y-6 pb-12">
    <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center"><div><h1 className="text-2xl font-black text-slate-800">Notifications</h1><p className="text-sm text-slate-500 mt-1">Target real schools, trainers and classes. Delivery and read state are stored on the server.</p></div><button onClick={() => { resetForm(); setOpen(true); }} className="inline-flex items-center gap-2 bg-pixiu-blue text-white px-4 py-2.5 rounded-xl font-bold text-sm"><Plus size={17}/> New Notification</button></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-xs uppercase font-bold text-slate-400">Delivered records</p><p className="text-2xl font-black mt-1">{rows.length}</p></div><div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-xs uppercase font-bold text-slate-400">Schools</p><p className="text-2xl font-black mt-1">{activeSchools.length}</p></div><div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-xs uppercase font-bold text-slate-400">Trainers</p><p className="text-2xl font-black mt-1">{activeTrainers.length}</p></div></div>

    {loading && <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">Loading notifications from the server…</div>}
    {!loading && history.length === 0 && <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-sm text-slate-400"><Megaphone className="mx-auto mb-3" size={24}/><p className="font-bold text-slate-600">No notifications have been sent yet.</p><p className="mt-1">Send the first announcement to a real audience.</p></div>}
    <div className="space-y-3">{history.map(item => <div key={item.broadcast_key || item.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Bell size={19}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-800">{item.title}</h3><span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-500">{targetLabel(item)}</span><span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-blue-50 text-blue-600">{item.recipient_count} recipient{item.recipient_count === 1 ? '' : 's'}</span></div><p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.message}</p><p className="text-[11px] text-slate-400 mt-3">{item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : 'Published'}</p></div></div>)}</div>

    {open && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl"><div className="p-5 border-b border-slate-200 flex justify-between items-center"><div><h2 className="font-black text-slate-800">New Notification</h2><p className="text-xs text-slate-400 mt-1">The server resolves the selected audience to actual recipient accounts.</p></div><button onClick={() => { setOpen(false); resetForm(); }} aria-label="Close"><X size={19}/></button></div><form onSubmit={submit} className="p-5 space-y-4">{error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}<div><label className="text-xs font-bold text-slate-500">Audience</label><select value={targetType} onChange={e => { setTargetType(e.target.value); setTargetId(''); }} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm">{TARGETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{needsTarget && <div><label className="text-xs font-bold text-slate-500">Target</label>{targetOptions.length === 0 ? <div className="mt-1 rounded-xl border border-dashed border-slate-300 px-3 py-3 text-xs text-slate-500">No matching records have been created yet.</div> : <select value={targetId} onChange={e => setTargetId(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"><option value="">Select a target…</option>{targetOptions.map(item => <option key={item.id} value={item.id}>{item.name || item.display_name || item.trainer_id || item.display_name}</option>)}</select>}</div>}<div><label className="text-xs font-bold text-slate-500">Title</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="Announcement title"/></div><div><label className="text-xs font-bold text-slate-500">Message</label><textarea required rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="Write the announcement…"/></div><div><label className="text-xs font-bold text-slate-500">Priority</label><select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"><option value="info">Normal</option><option value="warning">Important</option><option value="urgent">Urgent</option><option value="success">Success</option></select></div><button type="submit" disabled={sending || (needsTarget && !targetId) || !form.title.trim() || !form.message.trim()} className="w-full bg-slate-900 disabled:bg-slate-300 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2"><Send size={16}/>{sending ? 'Sending…' : 'Send Notification'}</button></form></div></div>}
  </div>;
}
