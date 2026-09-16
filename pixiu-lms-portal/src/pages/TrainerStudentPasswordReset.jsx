import { useEffect, useState } from 'react';
import { Copy, KeyRound, Search, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/ui/PageHeader';

export default function TrainerStudentPasswordReset() {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState('');
  const [issued, setIssued] = useState(null);

  const load = async () => {
    setLoading(true);
    const response = await apiFetch('/students?limit=100');
    const data = await response.json().catch(() => []);
    setStudents(Array.isArray(data) ? data : data.results || []);
    setLoading(false);
    if (!response.ok) toast.error(data.detail || 'Unable to load students.');
  };
  useEffect(() => { void load(); }, []);

  const reset = async student => {
    setResetting(student.id);
    const response = await apiFetch(`/students/${student.id}/reset-password`, { method: 'POST', body: JSON.stringify({}) });
    const data = await response.json().catch(() => ({}));
    setResetting('');
    if (!response.ok) return toast.error(data.detail || 'Unable to reset this student password.');
    setIssued(data); toast.success('Temporary PIN generated. Give it directly to the student.');
  };

  const visible = students.filter(s => !search || `${s.name} ${s.student_id} ${s.class_name}`.toLowerCase().includes(search.toLowerCase()));
  const copy = async value => { try { await navigator.clipboard.writeText(value); toast.success('PIN copied.'); } catch { toast.error('Copy failed.'); } };

  return <div className="space-y-5 pb-10"><PageHeader eyebrow="Student Accounts" title="Student Password Reset" description="Generate a new temporary 8-digit PIN for a student who forgot their password." />
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 flex gap-3"><ShieldCheck size={18} className="shrink-0"/><span>Only students assigned to your active schools are listed. Permanent passwords are never visible to trainers.</span></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full min-h-11 rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-500" placeholder="Search student or ID…"/></div></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{loading ? <div className="p-8 text-sm text-slate-500">Loading students…</div> : visible.map(student=><div key={student.id} className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0"><div className="min-w-0 flex-1"><p className="font-black text-sm text-slate-800 truncate">{student.name}</p><p className="mt-1 text-[11px] font-mono text-slate-400">{student.student_id} · {student.class_name || 'Class'}</p></div><button type="button" disabled={resetting===student.id} onClick={()=>reset(student)} className="min-h-10 rounded-xl bg-blue-600 px-4 text-xs font-black text-white flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"><KeyRound size={14}/>{resetting===student.id?'Generating…':'Reset password'}</button></div>)}{!loading&&!visible.length&&<div className="p-10 text-center text-sm text-slate-500">No matching students.</div>}</section>
    {issued&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Temporary credential</p><h2 className="mt-1 text-xl font-black text-slate-900">{issued.student_id}</h2><p className="mt-1 text-xs text-slate-500">Give this PIN to the student physically. It remains valid until the student changes it or you reset it again.</p><div className="mt-5 rounded-2xl bg-slate-950 p-5 text-center"><p className="text-3xl font-black tracking-[0.25em] text-white font-mono">{issued.temporary_pin}</p><button type="button" onClick={()=>copy(issued.temporary_pin)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-[11px] font-black text-slate-200"><Copy size={13}/> Copy PIN</button></div><button type="button" onClick={()=>setIssued(null)} className="mt-5 w-full min-h-11 rounded-xl bg-blue-600 text-white text-xs font-black">Done</button></div></div>}
  </div>;
}
