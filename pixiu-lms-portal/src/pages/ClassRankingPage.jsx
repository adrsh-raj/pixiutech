import { useEffect, useMemo, useState } from 'react';
import { Award, BarChart3, ChevronDown, ChevronUp, Medal, RefreshCw, Trophy, Users, Cpu } from 'lucide-react';
import { useAuth, apiFetch } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PortalShell from '../components/PortalShell';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

const metricDefs = [
  ['Quiz', 'quiz', 'quiz'],
  ['Projects', 'project', 'project'],
  ['Trainer assessment', 'review', 'trainer_assessment'],
  ['Attendance', 'attendance', 'attendance'],
];
const normalize = value => String(value ?? '').trim().toUpperCase();

function parseIds(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
  } catch {}
  return raw.split(/[,;|\s]+/).map(item => item.trim()).filter(Boolean);
}

function classSchoolKeys(item) {
  return [item?.school_id, item?.school_code, item?.school, item?.schoolId].filter(Boolean).map(normalize);
}

function StatCard({ label, value, hint, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  };
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
      <span className={`inline-flex w-9 h-9 rounded-xl ring-1 items-center justify-center ${tones[tone] || tones.blue}`}>
        <span className="text-sm font-black">{label.slice(0, 1)}</span>
      </span>
      <p className="mt-3 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">{value ?? '—'}</p>
      {hint && <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{hint}</p>}
    </div>
  );
}

export default function ClassRankingPage() {
  const { user, role } = useAuth();
  const { classes = [], schools = [], trainers = [], refreshAll, loading } = useData();
  const [ranking, setRanking] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [error, setError] = useState('');
  const [loadingRanking, setLoadingRanking] = useState(false);

  const isStudent = role === 'student';
  const isSchool = role === 'school';
  const isTrainer = role === 'trainer';
  const shellRole = isStudent ? 'student' : isSchool ? 'school' : 'trainer';

  const schoolScope = useMemo(() => {
    if (!isSchool) return null;
    const key = normalize(user?.school_id);
    if (!key) return null;
    return schools.find(item => [item.id, item.school_id, item.school_code, item.code].filter(Boolean).map(normalize).includes(key)) || null;
  }, [isSchool, user?.school_id, schools]);

  const trainerRecord = useMemo(() => {
    if (!isTrainer) return null;
    const key = String(user?.related_id || user?.username || user?.id || '').trim();
    return trainers.find(item => [item.id, item.trainer_id, item.account_username].some(value => String(value || '') === key)) || null;
  }, [isTrainer, trainers, user]);

  const trainerSchoolIds = useMemo(() => parseIds(trainerRecord?.assigned_schools || user?.school_id).map(normalize), [trainerRecord, user]);

  const accessibleClasses = useMemo(() => {
    const active = classes.filter(item => String(item.status || '').toLowerCase() === 'active');
    if (isStudent) return [];
    if (isSchool) {
      const schoolKeys = [schoolScope?.id, schoolScope?.school_id, schoolScope?.school_code, schoolScope?.code].filter(Boolean).map(normalize);
      return active.filter(item => classSchoolKeys(item).some(key => schoolKeys.includes(key)));
    }
    if (isTrainer) return active.filter(item => classSchoolKeys(item).some(key => trainerSchoolIds.includes(key)));
    return active;
  }, [classes, isStudent, isSchool, isTrainer, schoolScope, trainerSchoolIds]);

  const effectiveClassId = isStudent ? '' : selectedClassId;

  useEffect(() => {
    if (isStudent) return;
    if (!accessibleClasses.some(item => String(item.id) === String(selectedClassId))) {
      setSelectedClassId(accessibleClasses[0] ? String(accessibleClasses[0].id) : '');
    }
  }, [accessibleClasses, selectedClassId, isStudent]);

  const loadRanking = async () => {
    setLoadingRanking(true);
    setError('');
    try {
      const query = !isStudent && effectiveClassId ? `?class_id=${encodeURIComponent(effectiveClassId)}` : '';
      const response = await apiFetch(`/class-ranking${query}`, { cache: 'no-store' });
      const type = response.headers.get('content-type') || '';
      const payload = type.includes('application/json') ? await response.json().catch(() => ({})) : {};
      if (!response.ok) throw new Error(payload.detail || payload.error || `Request failed (${response.status})`);
      setRanking(payload);
      setSelectedStudentId('');
    } catch (requestError) {
      setRanking(null);
      setError(requestError.message || 'Unable to load class ranking.');
    } finally {
      setLoadingRanking(false);
    }
  };

  useEffect(() => { loadRanking(); }, [isStudent, effectiveClassId]);

  const rows = useMemo(() => Array.isArray(ranking?.ranking) ? ranking.ranking : [], [ranking]);
  const summary = ranking?.summary || {};
  const currentStudentId = ranking?.student?.student_id || user?.related_id || user?.username;
  const selectedStudent = rows.find(row => String(row.student_id) === String(selectedStudentId)) || null;

  const pageTitle = isStudent ? 'Class Ranking' : isSchool ? 'Student Rankings' : 'Class Performance';
  const pageSubtitle = ranking?.class
    ? `${ranking.class.name} · ${ranking.class.school_name}`
    : isSchool
      ? 'Performance for classes belonging to your school.'
      : isTrainer
        ? 'Performance for classes in your active trainer assignments.'
        : 'Live performance from the Django/PostgreSQL records.';

  const handleRefresh = async () => { await Promise.all([refreshAll(), loadRanking()]); };

  return (
    <PortalShell role={shellRole} title={pageTitle} subtitle={pageSubtitle}>
      <div className="space-y-5 pb-10">
        {!isStudent && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Live scope</p><p className="mt-1 text-sm font-bold text-slate-800">{isSchool ? 'Select a class from your school.' : 'Select a class you are authorised to teach.'}</p></div>
              <select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} disabled={!accessibleClasses.length} className="min-h-11 w-full lg:w-auto lg:min-w-64 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" aria-label="Select class">
                {accessibleClasses.length ? accessibleClasses.map(item => <option key={item.id} value={item.id}>{item.display_name || `${item.grade}${item.section || ''}`} · {item.school_code || item.school_id || 'Class'}</option>) : <option value="">No accessible classes</option>}
              </select>
              <button type="button" onClick={handleRefresh} disabled={loading || loadingRanking} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-700 hover:bg-white disabled:opacity-50"><RefreshCw size={14} className={loadingRanking ? 'animate-spin' : ''} /> Refresh</button>
            </div>
          </section>
        )}

        {isStudent && <div className="flex justify-end"><button type="button" onClick={loadRanking} disabled={loadingRanking} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loadingRanking ? 'animate-spin' : ''} /> Refresh ranking</button></div>}

        {error ? <ErrorState title="Ranking unavailable" description={error} onRetry={loadRanking} /> : loadingRanking && !ranking ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse"><div className="h-8 w-56 rounded-xl bg-slate-100"/><div className="mt-3 h-4 w-80 max-w-full rounded-lg bg-slate-100"/><div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="h-24 rounded-2xl bg-slate-100"/><div className="h-24 rounded-2xl bg-slate-100"/><div className="h-24 rounded-2xl bg-slate-100"/><div className="h-24 rounded-2xl bg-slate-100"/></div></section>
        ) : !ranking ? (
          <EmptyState title={isStudent ? 'Your class ranking is not available yet' : 'No ranking scope available'} description={isStudent ? 'Your class ranking will appear once your account is linked to an active class.' : 'There are no active classes available to this account yet.'} />
        ) : (
          <>
            {isStudent && ranking.student && <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#07101f] via-[#12335c] to-[#0d65e8] p-6 text-white shadow-xl sm:p-8"><div className="relative flex flex-col gap-7 md:flex-row md:items-end md:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-100">Your class standing</p><p className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">#{ranking.student.rank}</p><p className="mt-1 text-sm text-blue-100/80">You are #{ranking.student.rank} of {ranking.total_students} active students</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Trophy size={23} /></div><div><p className="text-lg font-black">{ranking.student.score}%</p><p className="text-[9px] uppercase tracking-wider text-blue-100/70">Composite score</p></div></div></div></section>}

            {(isSchool || isTrainer) && <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl sm:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-300">{isSchool ? 'School performance' : 'Trainer class performance'}</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{ranking.class?.name || 'Class performance'}</h2><p className="mt-1 text-sm text-slate-300">{ranking.class?.school_name || 'Current class scope'} · {summary.students ?? ranking.total_students} active students</p></div><div className="flex items-center gap-2 text-xs font-bold text-slate-300"><Users size={15} /> Live class leaderboard</div></div></section>}

            {(isSchool || isTrainer) && <section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><StatCard label="Students" value={summary.students ?? ranking.total_students} hint="Active in this class" tone="blue" /><StatCard label="Attendance" value={summary.attendance == null ? '—' : `${summary.attendance}%`} hint="Average attendance" tone="emerald" /><StatCard label="Avg Quiz" value={summary.quiz == null ? '—' : `${summary.quiz}%`} hint="Completed quiz performance" tone="violet" /><StatCard label="Avg Project" value={summary.project == null ? '—' : `${summary.project}%`} hint="Scored projects" tone="amber" /></section>}

            {isStudent && <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metricDefs.map(([label, key]) => <StatCard key={key} label={label} value={ranking.student?.[key] == null ? '—' : `${ranking.student[key]}%`} hint={`Weight ${ranking.formula?.[key === 'review' ? 'trainer_assessment' : key] ?? 0}%`} tone={key === 'attendance' ? 'emerald' : key === 'project' ? 'amber' : key === 'review' ? 'violet' : 'blue'} />)}</section>}

            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Leaderboard</p><h2 className="mt-1 text-base font-black text-slate-900 sm:text-lg">{ranking.class?.name || 'Class ranking'}</h2></div><p className="text-[10px] font-bold text-slate-400">Quiz 40% · Projects 25% · Trainer assessment 15% · Attendance 20%</p></div></div>
              <div className="hidden md:grid grid-cols-[56px_minmax(220px,1fr)_90px_100px_100px_100px_100px] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400"><span>#</span><span>Student</span><span className="text-right">Score</span><span className="text-right">Attendance</span><span className="text-right">Quiz</span><span className="text-right">Project</span><span className="text-right">Review</span></div>
              <div className="divide-y divide-slate-100">
                {rows.map(row => {
                  const current = String(row.student_id) === String(currentStudentId);
                  const expanded = isTrainer && String(selectedStudentId) === String(row.student_id);
                  return <div key={row.student_id}>
                    <button type="button" onClick={() => isTrainer && setSelectedStudentId(expanded ? '' : row.student_id)} className={`w-full min-h-16 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5 ${current ? 'bg-blue-50/70' : ''} ${isTrainer ? 'cursor-pointer' : 'cursor-default'}`} aria-expanded={isTrainer ? expanded : undefined}>
                      <div className="grid grid-cols-[38px_minmax(0,1fr)_66px] items-center gap-3 md:grid-cols-[56px_minmax(220px,1fr)_90px_100px_100px_100px_100px]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600">{row.rank <= 3 ? <Medal size={17} /> : row.rank}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-800">{row.name} {current && <span className="text-blue-600">· You</span>}</span><span className="block truncate text-[10px] font-mono text-slate-400">Roll {String(row.roll_number).padStart(2, '0')} · {row.student_id}</span></span><span className="text-right"><span className="block font-black text-slate-900">{row.score}%</span><span className="text-[9px] text-slate-400">score</span></span><span className="hidden text-right text-xs font-bold text-slate-600 md:block">{row.attendance}%</span><span className="hidden text-right text-xs font-bold text-slate-600 md:block">{row.quiz}%</span><span className="hidden text-right text-xs font-bold text-slate-600 md:block">{row.project}%</span><span className="hidden items-center justify-end gap-2 text-right text-xs font-bold text-slate-600 md:flex">{row.review}% {isTrainer && (expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</span></div>
                    </button>
                    {expanded && <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5"><div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]"><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-600">Student profile</p><h3 className="mt-1 text-lg font-black text-slate-900">{row.name}</h3><p className="mt-1 text-[10px] font-mono text-slate-400">{row.student_id}</p></div><span className="rounded-xl bg-blue-50 px-2.5 py-1.5 text-[10px] font-black text-blue-700">#{row.rank}</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{metricDefs.map(([label, key]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{row[key]}%</p></div>)}</div><div className="mt-3 rounded-xl border border-slate-200 bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Learning level</p><p className="mt-1 text-sm font-black text-slate-800">{row.learning_level || 'Not assessed'}</p></div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-600">Current ranking details</p><div className="mt-3 space-y-2 text-xs text-slate-600"><div className="flex justify-between gap-3"><span>Composite score</span><strong>{row.score}%</strong></div><div className="flex justify-between gap-3"><span>Attendance</span><strong>{row.attendance}%</strong></div><div className="flex justify-between gap-3"><span>Quiz average</span><strong>{row.quiz}%</strong></div><div className="flex justify-between gap-3"><span>Project average</span><strong>{row.project}%</strong></div><div className="flex justify-between gap-3"><span>Trainer assessment</span><strong>{row.review}%</strong></div></div><p className="mt-4 text-[10px] leading-relaxed text-slate-400">Ranking history is intentionally not inferred from current scores. It needs backend snapshots before it can be shown.</p></div></div></div>}
                  </div>;
                })}
                {!rows.length && <EmptyState title="No active students in this class" description="Add active students and record assessment data to populate the leaderboard." compact />}
              </div>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><Cpu size={18} className="mt-0.5 text-blue-600"/><div><h3 className="font-black text-blue-950">Virtual Arduino Lab</h3><p className="mt-1 text-xs leading-relaxed text-blue-900/70">Practice or prepare the next robotics exercise in the browser.</p></div></div><a href="/simulation" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 text-xs font-black text-blue-700 hover:bg-blue-50">Open Virtual Lab</a></div></section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><div className="flex items-start gap-3"><Award size={18} className="mt-0.5 text-blue-600"/><div><p className="text-sm font-black text-slate-800">How the score works</p><p className="mt-1 text-xs leading-relaxed text-slate-500">The server calculates the composite from real completed quizzes, scored projects, published trainer assessments, and attendance. The portal does not generate or invent scores.</p></div></div></section>
          </>
        )}
      </div>
    </PortalShell>
  );
}
