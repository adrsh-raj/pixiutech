import { useMemo, useState } from 'react';
import { Bell, Megaphone, Plus, Send, Trash2, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function Notifications() {
  const { notifications = [], schools = [], sendBroadcastNotification, deleteNotification } = useData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('ALL');
  const [form, setForm] = useState({ title: '', message: '', severity: 'info' });

  const active = useMemo(() => [...notifications].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))), [notifications]);

  const submit = async e => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    const result = await sendBroadcastNotification({ target_type: 'School', target_school_id: target, title: form.title.trim(), message: form.message.trim(), severity: form.severity, type: 'announcement' });
    if (result?.success === false) { toast.error(result.error || 'Could not publish notification.'); return; }
    toast.success('Notification published.', 'Announcement Sent');
    setOpen(false);
    setForm({ title: '', message: '', severity: 'info' });
  };

  return <div className="space-y-6 pb-12">
    <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center"><div><h1 className="text-2xl font-black text-slate-800">Notifications</h1><p className="text-sm text-slate-500 mt-1">Publish school-aware announcements and keep delivery history in one place.</p></div><button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 bg-pixiu-blue text-white px-4 py-2.5 rounded-xl font-bold text-sm"><Plus size={17}/> New Notification</button></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-xs uppercase font-bold text-slate-400">Published</p><p className="text-2xl font-black mt-1">{notifications.length}</p></div><div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-xs uppercase font-bold text-slate-400">Schools</p><p className="text-2xl font-black mt-1">{schools.length}</p></div><div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-xs uppercase font-bold text-slate-400">Channel</p><p className="text-2xl font-black mt-1">Portal</p></div></div>
    <div className="space-y-3">{active.map(item => <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Bell size={19}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-800">{item.title}</h3><span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-500">{item.target_school_id === 'ALL' ? 'All schools' : item.target_school_id || 'School'}</span></div><p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.message}</p><p className="text-[11px] text-slate-400 mt-3">{item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : 'Published'}</p></div><button onClick={() => deleteNotification(item.id)} title="Delete" className="text-slate-300 hover:text-red-500 h-fit"><Trash2 size={16}/></button></div>)}{active.length === 0 && <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-sm text-slate-400"><Megaphone className="mx-auto mb-3" size={24}/>No notifications published yet.</div>}</div>
    {open && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl"><div className="p-5 border-b border-slate-200 flex justify-between items-center"><div><h2 className="font-black text-slate-800">New Notification</h2><p className="text-xs text-slate-400 mt-1">Target the whole network or one partner school.</p></div><button onClick={() => setOpen(false)}><X size={19}/></button></div><form onSubmit={submit} className="p-5 space-y-4"><div><label className="text-xs font-bold text-slate-500">Audience</label><select value={target} onChange={e => setTarget(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"><option value="ALL">All Partner Schools</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className="text-xs font-bold text-slate-500">Title</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="e.g. Academic holiday update"/></div><div><label className="text-xs font-bold text-slate-500">Message</label><textarea required rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="Write the announcement..."/></div><div><label className="text-xs font-bold text-slate-500">Priority</label><select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"><option value="info">Normal</option><option value="warning">Important</option><option value="urgent">Urgent</option></select></div><button type="submit" className="w-full bg-slate-900 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2"><Send size={16}/> Publish Notification</button></form></div></div>}
  </div>;
}
