import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, BarChart3, CheckCircle2, ChevronRight, Flag, RefreshCw, School, ShieldCheck, X, XCircle } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';

const input = 'h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

async function req(path, method = 'GET', body) {
  const response = await apiFetch(path, {
    method,
    cache: 'no-store',
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.detail || data?.error || data?.message || data?.warning || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function statusBadge(state) {
  if (state === 'passed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (state === 'not_passed') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function statusLabel(state) {
  if (state === 'passed') return 'Passed';
  if (state === 'not_passed') return 'Not Passed';
  return 'Evaluation Pending';
}

export default function CourseCompletionV5() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);
  const isTrainer = user?.role === 'trainer';
  const [scope, setScope] = useState({ schools: [], classes: [] });
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadScope = async () => {
    try {
      const data = await req('/course-completion/scope');
      setScope(data || { schools: [], classes: [] });
      const schools = Array.isArray(data?.schools) ? data.schools : [];
      if (!schoolId && schools.length === 1) setSchoolId(String(schools[0].id));
    } catch (e) {
      setError(e.message);
    }
  };

  const load = async (nextSchool = schoolId, nextClass = classId) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (nextSchool) qs.set('school_id', nextSchool);
      if (nextClass) qs.set('class_id', nextClass);
      const data = await req(`/course-completion${qs.toString() ? `?${qs}` : ''}`);
      setStudents(Array.isArray(data) ? data : []);
    } catch (e) {
      setStudents([]);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadEvaluation = async (nextClass = classId) => {
    if (!nextClass) {
      setEvaluation(null);
      return;
    }
    setEvaluationLoading(true);
    try {
      const data = await req(`/course-completion/class/${encodeURIComponent(nextClass)}/evaluation`);
      setEvaluation(data || null);
    } catch (e) {
      setEvaluation(null);
      setError(e.message);
    } finally {
      setEvaluationLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role) {
      void loadScope();
      void load('', '');
    }
  }, [user?.role]);

  useEffect(() => {
    if (!schoolId && scope.schools.length === 1) setSchoolId(String(scope.schools[0].id));
  }, [scope.schools, schoolId]);

  useEffect(() => {
    if (schoolId) {
      const valid = scope.classes.filter(c => String(c.school_id) === String(schoolId));
      if (classId && !valid.some(c => String(c.id) === String(classId))) setClassId('');
    }
  }, [schoolId, scope.classes, classId]);

  useEffect(() => {
    if (user?.role && (schoolId || classId)) {
      void load(schoolId, classId);
      void loadEvaluation(classId);
    }
  }, [schoolId, classId]);

  const visibleClasses = useMemo(
    () => scope.classes.filter(c => !schoolId || String(c.school_id) === String(schoolId)),
    [scope.classes, schoolId],
  );
  const selectedSchool = scope.schools.find(s => String(s.id) === String(schoolId));
  const selectedClass = visibleClasses.find(c => String(c.id) === String(classId));
  const selectedName = selectedSchool?.name || '';

  const refresh = async () => {
    await loadScope();
    await load(schoolId, classId);
    await loadEvaluation(classId);
  };

  const evaluateClass = async () => {
    if (!classId) return;
    setEvaluationLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await req(`/course-completion/class/${encodeURIComponent(classId)}/evaluation`, 'POST', {});
      setEvaluation(data);
      setSuccess(`Class evaluation complete: ${data.passed_count} Passed, ${data.not_passed_count} Not Passed, ${data.pending_count} Pending.`);
      await load(schoolId, classId);
    } catch (e) {
      if (e.status === 409 && e.data?.requires_confirmation) {
        const confirmed = window.confirm(
          `${e.data.warning || 'Not all active students are fully evaluated.'}\n\nContinue with whole-class evaluation/re-evaluation?`,
        );
        if (confirmed) {
          try {
            const data = await req(`/course-completion/class/${encodeURIComponent(classId)}/evaluation`, 'POST', { confirm: true });
            setEvaluation(data);
            setSuccess(`Whole-class evaluation complete: ${data.passed_count} Passed, ${data.not_passed_count} Not Passed, ${data.pending_count} Pending.`);
            await load(schoolId, classId);
          } catch (confirmError) {
            setError(confirmError.message);
          }
        } else {
          setSuccess('Evaluation cancelled. No class-wide evaluation records were changed.');
        }
      } else {
        setError(e.message);
      }
    } finally {
      setEvaluationLoading(false);
    }
  };

  const openStudent = async student => {
    setBusy(`open-${student.student_id}`);
    setError('');
    try {
      setSelected(await req(`/course-completion/${encodeURIComponent(student.student_id)}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const issue = async student => {
    setBusy(`issue-${student.student_id}`);
    setError('');
    setSuccess('');
    try {
      const data = await req(`/course-completion/${encodeURIComponent(student.student_id)}/certificate`, 'POST', {});
      setSuccess(`${student.student_name}: certificate issued after complete class evaluation.`);
      await load(schoolId, classId);
      await loadEvaluation(classId);
      setSelected(await req(`/course-completion/${encodeURIComponent(student.student_id)}`));
      if (data?.verification_url) window.open(data.verification_url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  if (!isAdmin && !isTrainer) return null;
  const showSchoolFilter = isAdmin || scope.schools.length > 1;
  const ranking = Array.isArray(evaluation?.top25_ranking) ? evaluation.top25_ranking : [];
  const classEvaluated = Boolean(evaluation?.all_evaluated);

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Programme Operations</p>
        <h1 className="text-3xl font-black text-slate-950">Course Completion</h1>
        <p className="mt-1 text-sm text-slate-500">Final session → evaluate every active student → Passed / Not Passed → top 25% ranking → certificates.</p>
      </div>
      <button type="button" onClick={refresh} disabled={loading || evaluationLoading || !!busy} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700">
        <RefreshCw size={14} className={loading || evaluationLoading ? 'animate-spin' : ''}/> Refresh
      </button>
    </div>

    {(error || success) && <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || success}</div>}

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50"><School size={18} className="text-blue-600"/></div><div><p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Completion scope</p><h2 className="text-xl font-black text-slate-900">{isTrainer && scope.schools.length === 1 ? `${selectedName} · Assigned school` : 'Select school and class'}</h2></div></div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {showSchoolFilter ? <div><label className="text-[10px] font-black uppercase text-slate-400">School</label><select className={`${input} mt-1 w-full`} value={schoolId} onChange={e => { setSchoolId(e.target.value); setClassId(''); }}><option value="">All schools</option>{scope.schools.map(s => <option key={s.id} value={s.id}>{s.name} · {s.school_code}</option>)}</select></div> : <div><label className="text-[10px] font-black uppercase text-slate-400">School</label><div className="mt-1 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-700">{selectedName || 'Assigned school'}</div></div>}
            <div><label className="text-[10px] font-black uppercase text-slate-400">Class</label><select className={`${input} mt-1 w-full`} value={classId} onChange={e => setClassId(e.target.value)}><option value="">All classes</option>{visibleClasses.map(c => <option key={c.id} value={c.id}>{c.display_name || `${c.grade}${c.section || ''}`}</option>)}</select></div>
          </div>
          {isTrainer && <p className="mt-3 text-xs text-slate-500">Your list is automatically restricted to schools assigned to your trainer account.</p>}
        </div>

        {classId && <button type="button" onClick={evaluateClass} disabled={evaluationLoading || !!busy} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
          <BarChart3 size={15}/>{evaluationLoading ? 'Evaluating entire class…' : classEvaluated ? 'Re-evaluate Entire Class' : 'Evaluate Entire Class'}
        </button>}
      </div>
    </section>

    {classId && evaluation && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-600">Whole-class evaluation</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">{evaluation.school_name} · Class {evaluation.class_name}</h2>
          <p className="mt-1 text-sm text-slate-500">{evaluation.message}</p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${evaluation.final_session?.is_last_session ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {evaluation.final_session?.is_last_session ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>} Final session {evaluation.final_session?.is_last_session ? 'confirmed' : 'not confirmed'}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[9px] font-black uppercase text-slate-400">Active</p><p className="mt-1 text-2xl font-black text-slate-900">{evaluation.class_size}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-4"><p className="text-[9px] font-black uppercase text-emerald-700">Passed</p><p className="mt-1 text-2xl font-black text-emerald-900">{evaluation.passed_count}</p></div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><p className="text-[9px] font-black uppercase text-rose-700">Not Passed</p><p className="mt-1 text-2xl font-black text-rose-900">{evaluation.not_passed_count}</p></div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="text-[9px] font-black uppercase text-amber-800">Pending</p><p className="mt-1 text-2xl font-black text-amber-900">{evaluation.pending_count}</p></div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="text-[9px] font-black uppercase text-blue-700">Top 25%</p><p className="mt-1 text-2xl font-black text-blue-900">{evaluation.rank_slots}</p></div>
      </div>
      {evaluation.pending_count > 0 && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><AlertTriangle size={17} className="mt-0.5 shrink-0"/><div><b>Certificates are locked.</b> Every active student must be fully evaluated first. Missing quizzes, attendance, practical evaluation, trainer review, or project completion keep a student pending.</div></div>}
    </section>}

    {classId && evaluation && evaluation.all_evaluated && <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-700">Ranked passed students</p><h2 className="mt-1 text-2xl font-black text-blue-950">Top {evaluation.rank_slots} of {evaluation.class_size}</h2><p className="mt-1 text-sm text-blue-900/70">Only passed students are ranked. The rank denominator remains the full class size.</p></div>
        <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Ranking rule</p><p className="mt-1 text-lg font-black text-slate-900">ceil({evaluation.class_size} × 25%) = {evaluation.rank_slots}</p></div>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-white">
        <div className="grid grid-cols-[56px_90px_1fr_100px] bg-slate-950 px-4 py-3 text-[9px] font-black uppercase tracking-wider text-white"><span>#</span><span>Rank</span><span>Student</span><span className="text-right">Score</span></div>
        {ranking.map((row, index) => <div key={row.student_id} className="grid grid-cols-[56px_90px_1fr_100px] items-center border-t border-slate-100 px-4 py-3 text-xs"><span className="font-black text-slate-400">{index + 1}</span><span className="font-black text-blue-700">{row.rank_display}</span><span className="font-black text-slate-800">{row.student_name}<span className="ml-2 font-mono text-[9px] font-normal text-slate-400">{row.student_id}</span></span><span className="text-right font-black text-slate-900">{Number(row.overall_score).toFixed(2)}%</span></div>)}
      </div>
    </section>}

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4"><p className="text-[10px] font-black uppercase tracking-wider text-violet-600">Student completion registry</p><h2 className="text-xl font-black">Evaluation state and certificate eligibility</h2></div>
      {loading ? <div className="p-12 text-center text-slate-400">Loading students…</div> : students.length ? <div className="divide-y divide-slate-100">{students.map(s => {
        const evaluationRow = evaluation?.students?.find(row => String(row.student_id) === String(s.student_id));
        const state = evaluationRow?.state || (s.certificate_id ? 'passed' : 'pending');
        const score = evaluationRow?.overall_score ?? s.overall_score;
        return <div key={s.student_id} className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-slate-900">{s.student_name}</b><span className="font-mono text-[10px] text-slate-400">{s.student_id}</span><span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${statusBadge(state)}`}>{statusLabel(state)}</span>{score != null && <span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-700">{Number(score).toFixed(2)}%</span>}</div><p className="mt-1 text-xs text-slate-500">{s.school_name} · {s.class_name}</p><div className="mt-3 flex flex-wrap gap-2">{s.technologies.length ? s.technologies.map(t => <span key={t.code} className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-[9px] font-black text-violet-700">{t.name}</span>) : <span className="text-[10px] text-slate-400">No completed technology sessions yet.</span>}</div>{evaluationRow?.blockers?.length > 0 && <p className="mt-3 text-[10px] font-semibold text-amber-800">{evaluationRow.blockers[0]}</p>}{s.programme_final_session && <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800"><Flag size={12}/> Final session: {s.programme_final_session.technology} · {s.programme_final_session.date} · {s.programme_final_session.topic}</div>}</div>
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => openStudent(s)} disabled={!!busy} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-700">Review <ChevronRight size={13}/></button>{isTrainer && classEvaluated && state === 'passed' && !s.certificate_id && <button type="button" onClick={() => issue(s)} disabled={!!busy} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-black text-white"><Award size={12}/>{busy === `issue-${s.student_id}` ? 'Issuing…' : 'Issue Certificate'}</button>}{s.certificate_id && <a href={`https://pixiutech.com/verify?cert=${encodeURIComponent(s.certificate_id)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-black text-emerald-700"><ShieldCheck size={13}/> Certificate</a>}</div>
        </div>;
      })}</div> : <div className="p-12 text-center text-slate-400">No active students in this scope.</div>}
    </section>

    {selected && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}><section onClick={e => e.stopPropagation()} className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 flex justify-between gap-4 border-b border-slate-100 bg-white p-5"><div><p className="text-[10px] font-black uppercase tracking-wider text-blue-600">Programme review</p><h2 className="text-xl font-black">{selected.student_name}</h2><p className="mt-1 text-xs text-slate-500">{selected.school_name} · {selected.class_name}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl p-2 hover:bg-slate-100"><X size={18}/></button></div><div className="space-y-5 p-5"><div className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-blue-800">Whole-class evaluation</p><p className="mt-1 text-sm text-blue-950">The final session is already the programme end marker. Use <b>Evaluate / Re-evaluate Entire Class</b> to refresh every active student's result; no session re-marking is required.</p></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{(selected.units || []).map(unit => <div key={`${unit.curriculum_unit_id || unit.unit_code}`} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase text-slate-400">{unit.technology || 'Technology'} · {unit.unit_code}</p><p className="mt-1 font-black text-slate-800">{unit.title}</p></div><span className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${unit.status === 'passed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : unit.status === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{unit.status}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-500"><span>Sessions: <b>{unit.completed_sessions}/{unit.sessions_count}</b></span><span>Score: <b>{unit.score.toFixed ? unit.score.toFixed(2) : unit.score}%</b></span></div></div>)}</div><div className="rounded-2xl border border-slate-200 p-4"><p className="text-[9px] font-black uppercase text-slate-400">Certificate state</p><p className="mt-1 font-black text-slate-800">{selected.certificate_id ? `Issued · ${selected.certificate_id}` : selected.can_issue_certificate ? 'Eligible to issue after cohort gate' : selected.overall_score != null && Number(selected.overall_score) < 70 ? 'Not Passed' : 'Evaluation Pending'}</p></div></div></section></div>}
  </div>;
}
