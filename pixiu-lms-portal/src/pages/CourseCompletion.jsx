import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Clock3, Layers3, RefreshCw, Send, ShieldCheck, X, Plus } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import ErrorState from '../components/ui/ErrorState';

const roles = ['admin', 'superadmin', 'trainer'];
const text = value => String(value ?? '').trim();
const rows = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];
const pill = status => {
  if (status === 'admin_completed') return 'bg-emerald-50 text-emerald-700';
  if (status === 'trainer_requested') return 'bg-blue-50 text-blue-700';
  return 'bg-amber-50 text-amber-700';
};

async function request(path, method='GET', body) {
  const response = await apiFetch(path, { method, cache: method === 'GET' ? 'no-store' : undefined, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || data?.reason || `Request failed (${response.status}).`);
  return data;
}

export default function CourseCompletion() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [techName, setTechName] = useState('');
  const [techBusy, setTechBusy] = useState(false);
  const admin = ['admin', 'superadmin'].includes(user?.role);
  const trainer = user?.role === 'trainer';

  const load = async () => {
    setLoading(true); setError('');
    try { setStudents(rows(await request('/course-completion'))); }
    catch (err) { setError(err.message || 'Could not load course completion.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (roles.includes(user?.role)) load(); }, [user?.role]);

  const filtered = useMemo(() => students, [students]);

  const details = async student => {
    setBusy(`load-${student.student_id}`); setError('');
    try { setSelected(await request(`/course-completion/${encodeURIComponent(student.student_id)}`)); }
    catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const act = async (student, action) => {
    setBusy(`${action}-${student.student_id}`); setError('');
    try {
      await request(`/course-completion/${encodeURIComponent(student.student_id)}/${action}`, 'POST', {});
      await load();
      const fresh = await request(`/course-completion/${encodeURIComponent(student.student_id)}`);
      setSelected(fresh);
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const addTechnology = async e => {
    e.preventDefault();
    if (!admin || !text(techName)) return;
    setTechBusy(true); setError('');
    try { await request('/technologies', 'POST', { name: text(techName) }); setTechName(''); }
    catch (err) { setError(err.message); }
    finally { setTechBusy(false); }
  };

  if (!roles.includes(user?.role)) return null;

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] font-black text-blue-600">Programme Operations</p><h1 className="text-2xl sm:text-3xl font-black text-slate-900">Course Completion</h1><p className="mt-1 text-sm text-slate-500">Last session triggers unit evaluation. Trainer requests course completion. Admin approves. Trainer then issues the certificate.</p></div><button onClick={load} disabled={loading} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black inline-flex items-center gap-2"> <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh</button></div>
    {error && <ErrorState title="Course completion action failed" description={error} onRetry={() => setError('')} />}

    {admin && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Layers3 size={17} className="text-violet-600"/><h2 className="font-black">Technology Catalogue</h2><span className="text-xs text-slate-400">Dropdown values come from the database.</span></div><form onSubmit={addTechnology} className="mt-4 flex gap-2 max-w-xl"><input value={techName} onChange={e=>setTechName(e.target.value)} placeholder="Add technology, e.g. IoT / AR-VR" className="flex-1 h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none"/><button disabled={techBusy || !text(techName)} className="h-11 rounded-xl bg-slate-900 text-white px-4 text-xs font-black inline-flex items-center gap-2"><Plus size={14}/>{techBusy?'Saving…':'Add'}</button></form></section>}

    <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm"><div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-violet-600">Student registry</p><h2 className="text-xl font-black">Programme status</h2></div><ShieldCheck size={18} className="text-slate-300"/></div>{loading ? <div className="p-12 text-center text-slate-400">Loading completion registry…</div> : !filtered.length ? <div className="p-12 text-center text-slate-500">No active students in your scope.</div> : <div className="divide-y divide-slate-100">{filtered.map(student => <div key={student.student_id} className="p-4 sm:p-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{student.student_name}</p><span className="font-mono text-[10px] text-slate-400">{student.student_id}</span><span className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${pill(student.status)}`}>{student.status.replace('_',' ')}</span></div><p className="text-xs text-slate-500 mt-1">{student.school_name} · {student.class_name}</p><div className="mt-3 flex flex-wrap gap-2">{student.technologies.map(t=><span key={t.code} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[9px] font-black text-slate-600">{t.name} · {student.sessions_by_technology.find(s=>s.technology===t.name)?.sessions || 0} sessions</span>)}</div></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 text-[10px] font-black">Units {student.completed_units}/{student.required_units}</span><span className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 text-[10px] font-black">Score {student.overall_score}</span>{student.rank && <span className="rounded-lg bg-violet-50 text-violet-700 px-2.5 py-1.5 text-[10px] font-black">Rank {student.rank}</span>}<button onClick={()=>details(student)} disabled={busy===`load-${student.student_id}`} className="px-3 py-2 rounded-xl border border-slate-200 text-[10px] font-black">{busy===`load-${student.student_id}`?'Loading…':'Review'}</button>{trainer && student.completed_units===student.required_units && student.required_units>0 && student.status==='in_progress' && <button onClick={()=>act(student,'request')} disabled={busy===`request-${student.student_id}`} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black inline-flex items-center gap-1.5"><Send size={12}/>{busy===`request-${student.student_id}`?'Requesting…':'Request completion'}</button>}{admin && student.completed_units===student.required_units && student.required_units>0 && student.status!=='admin_completed' && <button onClick={()=>act(student,'complete')} disabled={busy===`complete-${student.student_id}`} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black inline-flex items-center gap-1.5"><CheckCircle2 size={12}/>{busy===`complete-${student.student_id}`?'Approving…':'Mark completed'}</button>}{trainer && student.status==='admin_completed' && !student.certificate_id && <button onClick={()=>act(student,'certificate')} disabled={busy===`certificate-${student.student_id}`} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black inline-flex items-center gap-1.5"><Award size={12}/>{busy===`certificate-${student.student_id}`?'Issuing…':'Issue certificate'}</button>}{student.certificate_id && <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-[9px] font-black text-emerald-700"><CheckCircle2 size={13}/> {student.certificate_id}</span>}</div></div>)}</div>}</section>

    {selected && <div className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-sm p-4 flex items-center justify-center" onClick={()=>setSelected(null)}><section onClick={e=>e.stopPropagation()} className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 z-10 bg-white border-b border-slate-100 p-5 flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.18em] font-black text-blue-600">Unit-by-unit completion</p><h2 className="text-xl font-black">{selected.student_name}</h2><p className="text-xs text-slate-500 mt-1">{selected.school_name} · {selected.class_name} · Score {selected.overall_score}{selected.rank?` · Portal Rank ${selected.rank}`:''}</p></div><button onClick={()=>setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18}/></button></div><div className="p-5 space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{['Attendance','Quiz','Practical','Trainer review'].map(label=><div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><p className="text-[9px] font-black uppercase text-slate-400">{label} rule</p><p className="mt-1 text-xs font-black">Configured per class policy</p></div>)}</div>{selected.units.map(unit=><article key={unit.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap gap-2 items-center"><span className="rounded-lg bg-blue-50 text-blue-700 px-2 py-1 text-[9px] font-black">{unit.technology?.name || 'Technology pending'}</span><span className="font-mono text-[10px] text-slate-400">{unit.unit_code}</span><span className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${unit.status==='passed'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{unit.status}</span></div><h3 className="mt-2 font-black">{unit.title}</h3><p className="mt-1 text-xs text-slate-500">{unit.sessions} sessions · Last session {unit.last_session?'completed':'not completed'}</p></div><div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">{[['Attendance',unit.attendance_pct],['Quiz',unit.quiz_pct],['Practical',unit.practical_pct],['Review',unit.trainer_review_avg],['Score',unit.score]].map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 px-2 py-2"><p className="text-[8px] uppercase font-black text-slate-400">{label}</p><p className="mt-1 text-xs font-black">{value==null?'Pending':label==='Review'?`${value}/5`:value}</p></div>)}</div></div>{unit.reasons?.length>0 && <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{unit.reasons.join(' · ')}</div>}</article>)}</div></section></div>}
  </div>;
}
