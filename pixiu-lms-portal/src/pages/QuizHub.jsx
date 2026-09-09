import { useMemo, useState } from 'react';
import { ClipboardCheck, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function QuizHub() {
  const { role } = useAuth();
  const { quizzes = [], createQuiz, deleteQuiz } = useData();
  const toast = useToast();
  const canManage = role === 'admin' || role === 'superadmin' || role === 'trainer';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', grade: '', level: '', unit_code: '', duration_minutes: 20, max_attempts: 1, status: 'active' });
  const filtered = useMemo(() => quizzes.filter(item => `${item.title || ''} ${item.grade || ''} ${item.level || ''} ${item.unit_code || ''}`.toLowerCase().includes(query.trim().toLowerCase())), [quizzes, query]);

  const submit = async event => {
    event.preventDefault();
    const result = await createQuiz({ ...form, grade: String(form.grade).trim(), duration_minutes: Number(form.duration_minutes), max_attempts: Number(form.max_attempts) });
    if (!result?.success) return toast.error(result?.error || 'Quiz creation failed.', 'Quiz save failed');
    toast.success('Quiz created from the live database.');
    setOpen(false);
    setForm({ title: '', grade: '', level: '', unit_code: '', duration_minutes: 20, max_attempts: 1, status: 'active' });
  };

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600">Assessment</p><h1 className="text-2xl font-black text-slate-900 mt-1">Quiz Management</h1><p className="text-sm text-slate-500 mt-1">Create and manage database-backed quizzes. Trainers can create quizzes for their authorised academic scope.</p></div>{canManage && <button type="button" onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><Plus size={15}/> New Quiz</button>}</div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Metric label="Total quizzes" value={quizzes.length}/><Metric label="Active" value={quizzes.filter(q => q.status === 'active').length}/><Metric label="Closed" value={quizzes.filter(q => q.status === 'closed').length}/></div>
    <div className="bg-white border border-slate-200 rounded-2xl p-4"><div className="relative max-w-xl"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="field pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search quizzes by title, grade or unit"/></div></div>
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{filtered.map(quiz => <article key={quiz.id} className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex items-center justify-between gap-3"><span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><ClipboardCheck size={17}/></span><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{quiz.status}</span></div><h2 className="font-black text-slate-900 mt-4">{quiz.title}</h2><p className="text-xs text-slate-500 mt-1">Grade {quiz.grade} · {quiz.level || 'No level'} · {quiz.unit_code || 'No unit'}</p><p className="text-[10px] text-slate-400 mt-3">{quiz.duration_minutes} min · {quiz.max_attempts} attempt(s)</p>{canManage && role === 'admin' && <button type="button" onClick={async () => { if (!window.confirm(`Close “${quiz.title}”?`)) return; const result = await deleteQuiz(quiz.id); result?.success ? toast.success('Quiz closed.') : toast.error(result?.error || 'Unable to close quiz.'); }} className="mt-4 p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={15}/></button>}</article>)}{!filtered.length && <div className="col-span-full p-10 text-center border border-dashed border-slate-200 rounded-2xl text-sm text-slate-400">No quizzes match the current search.</div>}</section>
    {open && <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4"><form onSubmit={submit} className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-4"><div><h2 className="font-black text-lg text-slate-900">Create quiz</h2><p className="text-xs text-slate-500 mt-1">Trainer creation is restricted by the backend to authorised learning scope.</p></div><input className="field" placeholder="Quiz title" value={form.title} onChange={e => setForm(v => ({...v,title:e.target.value}))} required/><div className="grid grid-cols-2 gap-3"><input className="field" placeholder="Grade" value={form.grade} onChange={e => setForm(v => ({...v,grade:e.target.value}))} inputMode="numeric" required/><input className="field" placeholder="Level" value={form.level} onChange={e => setForm(v => ({...v,level:e.target.value}))}/></div><div className="grid grid-cols-2 gap-3"><input className="field" placeholder="Unit code" value={form.unit_code} onChange={e => setForm(v => ({...v,unit_code:e.target.value}))}/><select className="field" value={form.status} onChange={e => setForm(v => ({...v,status:e.target.value}))}><option value="active">Active</option><option value="closed">Closed</option></select></div><div className="grid grid-cols-2 gap-3"><input className="field" type="number" min="1" value={form.duration_minutes} onChange={e => setForm(v => ({...v,duration_minutes:e.target.value}))}/><input className="field" type="number" min="1" value={form.max_attempts} onChange={e => setForm(v => ({...v,max_attempts:e.target.value}))}/></div><div className="flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-black">Create Quiz</button></div></form></div>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}`}</style>
  </div>;
}
function Metric({ label, value }) { return <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-[9px] uppercase tracking-wide font-black text-slate-400">{label}</p><p className="text-2xl font-black text-slate-900 mt-2">{value}</p></div>; }
