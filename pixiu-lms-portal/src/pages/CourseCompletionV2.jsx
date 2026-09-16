import { useEffect, useMemo, useState } from 'react';
import { Award, ChevronRight, Flag, RefreshCw, School, ShieldCheck, X } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';

const input = 'h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

async function req(path, method = 'GET', body) {
  const response = await apiFetch(path, {
    method,
    cache: 'no-store',
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || data?.error || data?.message || `Request failed (${response.status})`);
  return data;
}

export default function CourseCompletionV2() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);
  const isTrainer = user?.role === 'trainer';
  const [scope, setScope] = useState({ schools: [], classes: [] });
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadScope = async () => {
    try {
      const data = await req('/course-completion/scope');
      setScope(data || { schools: [], classes: [] });
      const schools = Array.isArray(data?.schools) ? data.schools : [];
      if (isTrainer && schools.length === 1) setSchoolId(String(schools[0].id));
    } catch (e) { setError(e.message); }
  };

  const load = async (nextSchool = schoolId, nextClass = classId) => {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams();
      if (nextSchool) qs.set('school_id', nextSchool);
      if (nextClass) qs.set('class_id', nextClass);
      const data = await req(`/course-completion${qs.toString() ? `?${qs}` : ''}`);
      setStudents(Array.isArray(data) ? data : []);
    } catch (e) { setStudents([]); setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!user?.role) return;
    void loadScope();
    void load('', '');
  }, [user?.role]);

  useEffect(() => {
    if (schoolId) {
      const valid = scope.classes.filter(c => String(c.school_id) === String(schoolId));
      if (classId && !valid.some(c => String(c.id) === String(classId))) setClassId('');
    }
  }, [schoolId, scope.classes, classId]);

  useEffect(() => {
    if (user?.role && (schoolId || classId)) void load(schoolId, classId);
  }, [schoolId, classId]);

  const visibleClasses = useMemo(
    () => scope.classes.filter(c => !schoolId || String(c.school_id) === String(schoolId)),
    [scope.classes, schoolId],
  );
  const selectedSchool = scope.schools.find(s => String(s.id) === String(schoolId));
  const showSchoolFilter = isAdmin || scope.schools.length > 1;

  const refresh = async () => {
    await loadScope();
    await load(schoolId, classId);
  };

  const openStudent = async student => {
    setBusy(`open-${student.student_id}`); setError('');
    try { setSelected(await req(`/course-completion/${encodeURIComponent(student.student_id)}`)); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const approve = async student => {
    setBusy(`approve-${student.student_id}`); setError(''); setSuccess('');
    try {
      await req(`/course-completion/${encodeURIComponent(student.student_id)}/request`, 'POST', {});
      setSuccess(`${student.student_name}: final programme session approved at ${Number(student.overall_score || 0).toFixed(2)}%.`);
      await load(schoolId, classId);
      setSelected(await req(`/course-completion/${encodeURIComponent(student.student_id)}`));
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const issue = async student => {
    setBusy(`issue-${student.student_id}`); setError(''); setSuccess('');
    try {
      const data = await req(`/course-completion/${encodeURIComponent(student.student_id)}/certificate`, 'POST', {});
      setSuccess(`${student.student_name}: certificate issued and verification record created.`);
      await load(schoolId, classId);
      setSelected(await req(`/course-completion/${encodeURIComponent(student.student_id)}`));
      if (data?.certificate_id) {
        const pdfUrl = `${API_BASE}/public/certificates/pdf/${encodeURIComponent(data.certificate_id)}`;
        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      }
      if (data?.verification_url) window.open(data.verification_url, '_blank', 'noopener,noreferrer');
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  if (!isAdmin && !isTrainer) return null;

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div><p className="text-[10px] uppercase tracking-[.2em] font-black text-blue-600">Programme Operations</p><h1 className="text-3xl font-black">Course Completion</h1><p className="mt-1 text-sm text-slate-500">Actual taught technologies → final class session → trainer approval → one combined certificate.</p></div>
      <button onClick={refresh} disabled={loading || !!busy} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black inline-flex items-center gap-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh</button>
    </div>
    {(error || success) && <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || success}</div>}
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center"><School size={18} className="text-blue-600"/></div><div><p className="text-[10px] uppercase tracking-wider font-black text-blue-600">Completion scope</p><h2 className="text-xl font-black">{isTrainer && selectedSchool ? `${selectedSchool.name} · Assigned school` : isAdmin ? 'School and class filter' : 'Assigned school scope'}</h2></div></div><div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">{showSchoolFilter ? <div><label className="text-[10px] uppercase font-black text-slate-400">School</label><select className={`${input} mt-1 w-full`} value={schoolId} onChange={e => { setSchoolId(e.target.value); setClassId(''); }}><option value="">All schools</option>{scope.schools.map(s => <option key={s.id} value={s.id}>{s.name} · {s.school_code}</option>)}</select></div> : <div><label className="text-[10px] uppercase font-black text-slate-400">School</label><div className="mt-1 h-11 rounded-xl bg-slate-50 border border-slate-200 px-3.5 flex items-center text-sm font-bold text-slate-700">{selectedSchool?.name || 'Assigned school'}</div></div>}<div><label className="text-[10px] uppercase font-black text-slate-400">Class</label><select className={`${input} mt-1 w-full`} value={classId} onChange={e => setClassId(e.target.value)}><option value="">All classes</option>{visibleClasses.map(c => <option key={c.id} value={c.id}>{c.display_name || `${c.grade}${c.section || ''}`}</option>)}</select></div></div>{isTrainer&&<p className="mt-3 text-xs text-slate-500">Trainer scope is automatically limited to your active school assignment(s).</p>}</section>
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100"><p className="text-[10px] uppercase tracking-wider font-black text-violet-600">Student completion registry</p><h2 className="text-xl font-black">Final-session based programme completion</h2><p className="mt-1 text-xs text-slate-400">AI, Robotics, 3D Printer, etc. are optional. Only technologies actually taught in completed sessions are recorded on the certificate. Minimum overall score for certification: 70%.</p></div>{loading?<div className="p-12 text-center text-slate-400">Loading students…</div>:students.length?<div className="divide-y divide-slate-100">{students.map(s=>{const score=Number(s.overall_score||0);const eligible=Boolean(s.final_session_ready&&score>=70);return <div key={s.student_id} className="p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b>{s.student_name}</b><span className="font-mono text-[10px] text-slate-400">{s.student_id}</span><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black uppercase">{s.status.replace('_',' ')}</span></div><p className="mt-1 text-xs text-slate-500">{s.school_name} · {s.class_name}</p><div className="mt-3 flex flex-wrap gap-2">{s.technologies?.length?s.technologies.map(t=><span key={t.code} className="rounded-lg bg-violet-50 text-violet-700 px-2.5 py-1.5 text-[9px] font-black">{t.name}</span>):<span className="text-[10px] text-slate-400">No completed technology sessions yet.</span>}</div>{s.programme_final_session&&<div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800"><Flag size={12}/> Final session: {s.programme_final_session.technology} · {s.programme_final_session.date} · {s.programme_final_session.topic}</div>}</div><div className="flex flex-wrap gap-2 items-center"><span className={`rounded-lg border px-3 py-2 text-[10px] font-black ${score>=70?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-rose-200 bg-rose-50 text-rose-700'}`}>Overall {score.toFixed(2)}% / 70% min</span><button onClick={()=>openStudent(s)} disabled={!!busy} className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black inline-flex gap-1 items-center">Review <ChevronRight size={13}/></button>{isTrainer&&s.trainer_approval_ready&&eligible&&<button onClick={()=>approve(s)} disabled={!!busy} className="rounded-xl bg-blue-600 text-white px-3 py-2 text-[10px] font-black inline-flex gap-1 items-center">{busy===`approve-${s.student_id}`?'Approving…':'Approve final session'}</button>}{isTrainer&&s.can_issue_certificate&&eligible&&<button onClick={()=>issue(s)} disabled={!!busy} className="rounded-xl bg-slate-900 text-white px-3 py-2 text-[10px] font-black inline-flex gap-1 items-center"><Award size={12}/>{busy===`issue-${s.student_id}`?'Issuing…':'Issue certificate'}</button>}{s.certificate_id&&<a href={`/verify?cert=${encodeURIComponent(s.certificate_id)}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-50 text-emerald-700 px-3 py-2 text-[10px] font-black inline-flex gap-1 items-center"><ShieldCheck size={13}/> Certificate</a>}</div></div>})}</div>:<div className="p-12 text-center text-slate-400">No active students in this scope.</div>}</section>
    {selected&&<div className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center" onClick={()=>setSelected(null)}><section onClick={e=>e.stopPropagation()} className="w-full max-w-5xl max-h-[92vh] overflow-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wider font-black text-blue-600">Programme review</p><h2 className="text-xl font-black">{selected.student_name}</h2><p className="text-xs text-slate-500 mt-1">{selected.school_name} · {selected.class_name} · {selected.technologies?.length?selected.technologies.map(t=>t.name).join(' + '):'No technologies recorded yet'}</p></div><button onClick={()=>setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18}/></button></div><div className="p-5 space-y-4"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="text-[10px] uppercase tracking-wider font-black text-blue-700">Certification gate</p><p className="mt-1 text-sm text-blue-900">The programme closes on the latest completed session marked <b>Last session</b>. A certificate can be issued only when the resulting overall score is <b>70% or higher</b>.</p><div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">{[['Attendance',selected.score_breakdown?.attendance_pct],['Quiz',selected.score_breakdown?.quiz_pct],['Practical',selected.score_breakdown?.practical_pct],['Trainer review',selected.score_breakdown?.trainer_review_pct],['Overall',selected.overall_score]].map(([label,value])=><div key={label} className="rounded-xl bg-white border border-blue-100 p-3"><p className="text-[9px] uppercase font-black text-slate-400">{label}</p><p className="mt-1 font-black">{value==null?'Pending':`${Number(value).toFixed(2)}%`}</p></div>)}</div></div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-[9px] uppercase font-black text-slate-400">Certificate state</p><p className="mt-1 font-black">{selected.certificate_id?`Issued · ${selected.certificate_id}`:selected.can_issue_certificate?'Approved and ready to issue':selected.final_session_ready&&Number(selected.overall_score||0)<70?'Blocked — overall score below 70%':selected.trainer_approval_ready?'Final session ready — awaiting trainer approval':'In progress'}</p></div></div></section></div>}
  </div>;
}
