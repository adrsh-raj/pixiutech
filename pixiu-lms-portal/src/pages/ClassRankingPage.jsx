import { useEffect, useMemo, useState } from 'react';
import { Award, ChevronDown, ChevronUp, RefreshCw, Trophy, Users } from 'lucide-react';
import { useAuth, apiFetch } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import PageHeader from '../components/ui/PageHeader';

const list = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const keys = (...values) => values.filter(Boolean).map(value => String(value).trim()).filter(Boolean);
const norm = value => String(value ?? '').trim().toUpperCase();

function Stat({ label, value, hint }) {
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p><p className="mt-1 text-2xl font-black tracking-tight text-slate-900">{value ?? '—'}</p>{hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}</div>;
}

export default function ClassRankingPage() {
  const { user, role } = useAuth();
  const { classes = [], refreshAll, loading } = useData();
  const isStudent = role === 'student';
  const isTrainer = role === 'trainer';
  const [assignments, setAssignments] = useState([]);
  const [scopeLoading, setScopeLoading] = useState(isTrainer);
  const [scopeError, setScopeError] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [ranking, setRanking] = useState(null);
  const [error, setError] = useState('');
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState('');

  useEffect(() => {
    if (!isTrainer) return undefined;
    let cancelled = false;
    (async () => {
      setScopeLoading(true); setScopeError('');
      try {
        const response = await apiFetch('/trainer-school-assignments', { cache: 'no-store' });
        const payload = await response.json().catch(() => []);
        if (!response.ok) throw new Error(payload.detail || payload.error || `Unable to load trainer scope (${response.status}).`);
        if (!cancelled) setAssignments(list(payload));
      } catch (err) { if (!cancelled) setScopeError(err.message || 'Unable to load trainer scope.'); }
      finally { if (!cancelled) setScopeLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [isTrainer]);

  const trainerIdentity = useMemo(() => new Set(keys(user?.id, user?.related_id, user?.username)), [user]);
  const trainerSchoolKeys = useMemo(() => new Set(assignments.filter(item => String(item.status || 'active').toLowerCase() === 'active' && keys(item.trainer, item.trainer_id).some(key => trainerIdentity.has(key))).flatMap(item => keys(item.school, item.school_id, item.school_code).map(norm))), [assignments, trainerIdentity]);
  const accessibleClasses = useMemo(() => {
    if (!isTrainer) return [];
    return classes.filter(item => String(item.status || '').toLowerCase() === 'active' && keys(item.school, item.school_id, item.school_code).map(norm).some(key => trainerSchoolKeys.has(key)));
  }, [classes, isTrainer, trainerSchoolKeys]);

  useEffect(() => {
    if (!isTrainer) return;
    if (selectedClassId && accessibleClasses.some(item => String(item.id) === String(selectedClassId))) return;
    setSelectedClassId(accessibleClasses[0]?.id ? String(accessibleClasses[0].id) : '');
  }, [accessibleClasses, isTrainer, selectedClassId]);

  const load = async () => {
    setError('');
    if (!isStudent && !selectedClassId) { setRanking(null); return; }
    setLoadingRanking(true);
    try {
      const query = isStudent ? '' : `?class_id=${encodeURIComponent(selectedClassId)}`;
      const response = await apiFetch(`/class-ranking${query}`, { cache: 'no-store' });
      const type = response.headers.get('content-type') || '';
      const payload = type.includes('application/json') ? await response.json().catch(() => ({})) : {};
      if (!response.ok) throw new Error(payload.detail || payload.error || `Request failed (${response.status}).`);
      setRanking(payload); setExpandedStudent('');
    } catch (err) { setRanking(null); setError(err.message || 'Unable to load class performance.'); }
    finally { setLoadingRanking(false); }
  };

  useEffect(() => { if (!isTrainer || !scopeLoading) load(); }, [isStudent, isTrainer, scopeLoading, selectedClassId]);

  const rows = Array.isArray(ranking?.ranking) ? ranking.ranking : [];
  const summary = ranking?.summary || {};

  return <div className="space-y-5 pb-10">
    <PageHeader
      eyebrow={isStudent ? 'My Class' : 'Trainer Performance'}
      title={isStudent ? 'Class Ranking' : 'Class Performance'}
      description={isStudent ? 'Your standing is calculated from recorded academic activity.' : 'Live performance for classes connected to your active trainer assignments.'}
      actions={<button type="button" onClick={async () => { await refreshAll(); await load(); }} disabled={loading || loadingRanking || scopeLoading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={14} className={loadingRanking ? 'animate-spin' : ''}/> Refresh</button>}
    />

    {isTrainer && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Class scope</label><select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} disabled={scopeLoading || !accessibleClasses.length} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-lg"><option value="">{scopeLoading ? 'Loading authorised classes…' : 'No accessible classes'}</option>{accessibleClasses.map(item => <option key={item.id} value={item.id}>{item.display_name || `${item.grade}${item.section || ''}`} · {item.school_code || item.school_id || 'Class'}</option>)}</select></section>}
    {scopeError && <ErrorState title="Trainer scope unavailable" description={scopeError} onRetry={load}/>} 
    {error && <ErrorState title="Class performance unavailable" description={error} onRetry={load}/>} 
    {!error && !scopeError && loadingRanking && !ranking && <section className="rounded-3xl border border-slate-200 bg-white p-6 animate-pulse"><div className="h-7 w-52 rounded-xl bg-slate-100"/><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="h-24 rounded-2xl bg-slate-100"/><div className="h-24 rounded-2xl bg-slate-100"/><div className="h-24 rounded-2xl bg-slate-100"/><div className="h-24 rounded-2xl bg-slate-100"/></div></section>}
    {!error && !scopeError && !loadingRanking && !ranking && <EmptyState icon={<Users size={20}/>} title={isStudent ? 'Your class ranking is not available yet' : 'No active class available'} description={isStudent ? 'Your class ranking will appear once your account is linked to an active class.' : 'No class is currently connected to this trainer account.'}/>} 

    {ranking && <>
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-300">{isStudent ? 'Your class standing' : 'Class performance'}</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{ranking.class?.name || 'Class'}</h2><p className="mt-1 text-sm text-slate-300">{ranking.class?.school_name || ''} · {summary.students ?? ranking.total_students ?? 0} active students</p></section>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Stat label="Students" value={summary.students ?? ranking.total_students ?? 0} hint="Active students"/><Stat label="Attendance" value={summary.attendance == null ? '—' : `${summary.attendance}%`} hint="Average attendance"/><Stat label="Avg Quiz" value={summary.quiz == null ? '—' : `${summary.quiz}%`} hint="Completed quizzes"/><Stat label="Avg Project" value={summary.project == null ? '—' : `${summary.project}%`} hint="Scored projects"/></section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Leaderboard</p><h3 className="mt-1 text-base font-black text-slate-900">{ranking.class?.name || 'Class ranking'}</h3></div><p className="text-[10px] text-slate-400">Quiz 40% · Projects 25% · Assessment 15% · Attendance 20%</p></div></div><div className="divide-y divide-slate-100">{rows.map(row => { const open = expandedStudent === row.student_id; return <div key={row.student_id}><button type="button" onClick={() => setExpandedStudent(open ? '' : row.student_id)} className="w-full px-4 py-4 text-left hover:bg-slate-50"><div className="grid grid-cols-[42px_minmax(0,1fr)_80px] items-center gap-3 md:grid-cols-[56px_minmax(220px,1fr)_100px_100px_100px_100px]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600">{row.rank <= 3 ? <Trophy size={16}/> : row.rank}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-800">{row.name}</span><span className="block truncate text-[10px] font-mono text-slate-400">Roll {String(row.roll_number).padStart(2, '0')} · {row.student_id}</span></span><span className="text-right"><span className="block font-black text-slate-900">{row.score}%</span><span className="text-[9px] text-slate-400">score</span></span><span className="hidden text-right text-xs font-bold text-slate-600 md:block">{row.attendance}%</span><span className="hidden text-right text-xs font-bold text-slate-600 md:block">{row.quiz}%</span><span className="hidden text-right text-xs font-bold text-slate-600 md:block">{row.project}%</span><span className="hidden items-center justify-end gap-2 text-right text-xs font-bold text-slate-600 md:flex">{row.review}% {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span></div></button>{open && <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-4"><Stat label="Quiz" value={`${row.quiz}%`}/><Stat label="Projects" value={`${row.project}%`}/><Stat label="Assessment" value={`${row.review}%`}/><Stat label="Attendance" value={`${row.attendance}%`}/></div></div>}</div>; })}{!rows.length && <div className="p-10"><EmptyState compact icon={<Award size={20}/>} title="No active students in this class" description="Record academic activity to populate the leaderboard."/></div>}</div></section>
    </>}
  </div>;
}