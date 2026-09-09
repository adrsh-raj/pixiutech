import { useEffect, useMemo, useState } from 'react';
import { ClipboardPenLine, Plus, RefreshCw, Star, X } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const rows = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const text = value => String(value ?? '').trim();

async function request(path, method='GET', body) {
  const response = await apiFetch(path, { method, cache: method === 'GET' ? 'no-store' : undefined, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || payload.message || `Request failed (${response.status})`);
  return payload;
}

export default function TrainerReviews() {
  const { user } = useAuth();
  const { students = [], studentReviews = [], refreshAll, loading } = useData();
  const [reviews, setReviews] = useState(studentReviews);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [form, setForm] = useState({ unit_code: '', level: '', title: '', score: '', rating: '', status: 'published', feedback: '', assessment_date: new Date().toISOString().slice(0,10) });
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setReviews(studentReviews), [studentReviews]);
  const activeStudents = useMemo(() => students.filter(s => text(s.status || 'active').toLowerCase() !== 'inactive'), [students]);

  const save = async event => {
    event.preventDefault();
    if (!selectedStudent || !text(form.title)) { setError('Student and review title are required.'); return; }
    if (form.score !== '' && (Number(form.score) < 0 || Number(form.score) > 100)) { setError('Score must be between 0 and 100.'); return; }
    if (form.rating !== '' && (Number(form.rating) < 1 || Number(form.rating) > 5)) { setError('Rating must be between 1 and 5.'); return; }
    setBusy(true); setError('');
    try {
      await request('/assessments', 'POST', { student: selectedStudent, unit_code: text(form.unit_code), level: text(form.level), title: text(form.title), score: form.score === '' ? null : Number(form.score), rating: form.rating === '' ? null : Number(form.rating), status: form.status, feedback: text(form.feedback), assessment_date: form.assessment_date });
      await refreshAll(); setModal(false); setSelectedStudent(''); setForm({ unit_code:'', level:'', title:'', score:'', rating:'', status:'published', feedback:'', assessment_date:new Date().toISOString().slice(0,10) });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return <div className="space-y-5 pb-10"><PageHeader eyebrow="Trainer" title="Student Reviews" description="Record and review trainer assessments stored in the Django learning ledger." actions={<div className="flex gap-2"><RefreshButton onRefresh={refreshAll} loading={loading || busy}/><button type="button" onClick={()=>{setError('');setModal(true)}} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><Plus size={14}/> New Review</button></div>} />
    {error && <ErrorState title="Review action failed" description={error} onRetry={()=>setError('')} />}
    {reviews.length===0 ? <div className="bg-white border border-slate-200 rounded-2xl p-10"><EmptyState icon={<ClipboardPenLine size={20}/>} title="No reviews yet" description="No trainer assessments are recorded in your authorised scope."/></div> : <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><div className="divide-y divide-slate-100">{reviews.map(review=><article key={review.id} className="p-5"><div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider font-black text-violet-600">{review.unit_code || review.level || 'Assessment'}</p><h2 className="text-sm font-black text-slate-900 mt-1">{review.title || 'Student review'}</h2><p className="text-xs text-slate-500 mt-1">{review.student_id || review.student || 'Student'} · {review.assessment_date || '—'}</p></div><div className="flex items-center gap-3"><span className="font-black text-sm">{review.score ?? '—'}</span>{review.rating != null && <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-black"><Star size={13} fill="currentColor"/>{review.rating}/5</span>}</div></div>{review.feedback && <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{review.feedback}</p>}</article>)}</div></section>}
    {modal && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><form onSubmit={save} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-lg font-black">New Student Review</h2><p className="text-xs text-slate-400 mt-1">The signed-in trainer is stored as the assessor.</p></div><button type="button" onClick={()=>setModal(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={18}/></button></div><div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3"><select className="field md:col-span-2" value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)} required><option value="">Select student</option>{activeStudents.map(s=><option key={s.id} value={s.id}>{s.name} · {s.student_id}</option>)}</select><input className="field" placeholder="Review title" value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} required/><input className="field" placeholder="Unit code" value={form.unit_code} onChange={e=>setForm(v=>({...v,unit_code:e.target.value}))}/><input className="field" placeholder="Level" value={form.level} onChange={e=>setForm(v=>({...v,level:e.target.value}))}/><input className="field" type="number" min="0" max="100" step="0.1" placeholder="Score (0–100)" value={form.score} onChange={e=>setForm(v=>({...v,score:e.target.value}))}/><input className="field" type="number" min="1" max="5" step="0.1" placeholder="Rating (1–5)" value={form.rating} onChange={e=>setForm(v=>({...v,rating:e.target.value}))}/><input className="field" type="date" value={form.assessment_date} onChange={e=>setForm(v=>({...v,assessment_date:e.target.value}))}/><select className="field" value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value}))}><option value="draft">Draft</option><option value="published">Published</option></select><textarea className="field md:col-span-2 min-h-32" placeholder="Feedback" value={form.feedback} onChange={e=>setForm(v=>({...v,feedback:e.target.value}))}/></div><div className="p-5 border-t border-slate-100 flex justify-end gap-2"><button type="button" onClick={()=>setModal(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button disabled={busy} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><RefreshCw size={13}/>{busy?'Saving…':'Save Review'}</button></div></form></div>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}`}</style>
  </div>;
}
