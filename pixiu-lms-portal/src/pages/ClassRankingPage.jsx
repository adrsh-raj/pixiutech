import { useEffect, useMemo, useState } from 'react';
import { Award, BarChart3, Medal, RefreshCw, Trophy, Users } from 'lucide-react';
import { useAuth, apiFetch } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PortalShell from '../components/PortalShell';

const metricDefs = [
  ['Quiz', 'quiz'],
  ['Projects', 'project'],
  ['Trainer assessment', 'review'],
  ['Attendance', 'attendance'],
];

export default function ClassRankingPage() {
  const { user, role } = useAuth();
  const { classes = [], refreshAll, loading } = useData();
  const [ranking, setRanking] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [error, setError] = useState('');
  const [loadingRanking, setLoadingRanking] = useState(false);

  const accessibleClasses = useMemo(() => classes.filter(item => String(item.status || '').toLowerCase() === 'active'), [classes]);
  const isStudent = role === 'student';
  const effectiveClassId = isStudent ? '' : selectedClassId;

  useEffect(() => {
    if (!isStudent && !selectedClassId && accessibleClasses.length) setSelectedClassId(String(accessibleClasses[0].id));
  }, [isStudent, selectedClassId, accessibleClasses]);

  const loadRanking = async () => {
    setLoadingRanking(true);
    setError('');
    try {
      const suffix = !isStudent && effectiveClassId ? `?class_id=${encodeURIComponent(effectiveClassId)}` : '';
      const response = await apiFetch(`/class-ranking${suffix}`, { cache: 'no-store' });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
      if (!response.ok) throw new Error(payload.detail || payload.error || `Request failed (${response.status})`);
      setRanking(payload);
    } catch (requestError) {
      setRanking(null);
      setError(requestError.message || 'Unable to load class ranking.');
    } finally {
      setLoadingRanking(false);
    }
  };

  useEffect(() => { loadRanking(); }, [isStudent, effectiveClassId]);

  const currentStudentId = ranking?.student?.student_id || user?.related_id || user?.username;

  return (
    <PortalShell
      role={isStudent ? 'student' : 'trainer'}
      title={isStudent ? 'Class Ranking' : 'Class Performance'}
      subtitle={ranking?.class ? `${ranking.class.name} · ${ranking.class.school_name}` : 'Live performance from the Django/PostgreSQL records.'}
    >
      <div className="space-y-5 pb-10">
        {!isStudent && (
          <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Class scope</p><p className="text-sm font-bold text-slate-800 mt-1">Choose one of the classes available to this account.</p></div>
            <select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} disabled={!accessibleClasses.length} className="w-full sm:w-auto min-w-56 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 disabled:opacity-50">
              {accessibleClasses.length ? accessibleClasses.map(item => <option key={item.id} value={item.id}>{item.display_name || `${item.grade}${item.section || ''}`} · {item.school_code || item.school_id || 'Class'}</option>) : <option>No classes available</option>}
            </select>
            <button type="button" onClick={() => { refreshAll(); loadRanking(); }} disabled={loading || loadingRanking} className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw size={14} className={loadingRanking ? 'animate-spin' : ''}/> Refresh</button>
          </section>
        )}

        {isStudent && (
          <section className="flex justify-end"><button type="button" onClick={loadRanking} disabled={loadingRanking} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw size={14} className={loadingRanking ? 'animate-spin' : ''}/> Refresh ranking</button></section>
        )}

        {error ? (
          <section className="bg-white border border-rose-200 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-11 h-11 mx-auto rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><BarChart3 size={20}/></div>
            <h2 className="font-black text-slate-900 mt-3">Ranking unavailable</h2>
            <p className="text-sm text-slate-500 mt-1">{error}</p>
            <button type="button" onClick={loadRanking} className="mt-4 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold">Try again</button>
          </section>
        ) : loadingRanking && !ranking ? (
          <section className="bg-white border border-slate-200 rounded-2xl p-8 animate-pulse"><div className="h-6 w-48 bg-slate-100 rounded-lg"/><div className="h-4 w-72 bg-slate-100 rounded-lg mt-3"/><div className="grid sm:grid-cols-3 gap-3 mt-6"><div className="h-20 bg-slate-100 rounded-xl"/><div className="h-20 bg-slate-100 rounded-xl"/><div className="h-20 bg-slate-100 rounded-xl"/></div></section>
        ) : ranking ? (
          <>
            {isStudent && ranking.student && (
              <section className="rounded-3xl bg-gradient-to-br from-[#07101f] via-[#102b52] to-[#0d65e8] text-white p-6 sm:p-8 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-blue-100">Your class standing</p><h2 className="text-3xl sm:text-4xl font-black mt-2">#{ranking.student.rank}</h2><p className="text-sm text-blue-100/80 mt-1">out of {ranking.total_students} active students</p></div>
                  <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><Trophy size={23}/></div><div><p className="font-black text-lg">{ranking.student.score}%</p><p className="text-[10px] text-blue-100/70 uppercase tracking-wider">Composite score</p></div></div>
                </div>
              </section>
            )}

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {metricDefs.map(([label, key]) => <div key={key} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{label}</p><p className="text-2xl font-black text-slate-900 mt-2">{ranking.student?.[key] ?? '—'}%</p><p className="text-[10px] text-slate-400 mt-1">Weight {ranking.formula?.[key === 'review' ? 'trainer_assessment' : key] ?? 0}%</p></div>)}
            </section>

            <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-blue-600 font-black">Leaderboard</p><h2 className="font-black text-slate-900 mt-0.5">{ranking.class?.name || 'Class ranking'}</h2></div><span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl"><Users size={13}/> {ranking.total_students} students</span></div>
              <div className="divide-y divide-slate-100">
                {ranking.ranking?.map(row => {
                  const isCurrent = String(row.student_id) === String(currentStudentId);
                  return <div key={row.student_id} className={`px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 ${isCurrent ? 'bg-blue-50/70' : 'hover:bg-slate-50/70'}`}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 bg-slate-100 text-slate-600">{row.rank <= 3 ? <Medal size={17}/> : row.rank}</div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800 truncate">{row.name} {isCurrent && <span className="text-blue-600">· You</span>}</p><p className="text-[10px] font-mono text-slate-400">Roll {String(row.roll_number).padStart(2, '0')} · {row.student_id}</p></div>
                    <div className="hidden sm:grid grid-cols-4 gap-5 text-right">{metricDefs.map(([, key]) => <span key={key} className="text-[10px] font-bold text-slate-500">{row[key]}%</span>)}</div>
                    <div className="w-16 sm:w-20 text-right"><p className="font-black text-slate-900">{row.score}%</p><p className="text-[9px] text-slate-400">score</p></div>
                  </div>;
                })}
                {!ranking.ranking?.length && <div className="px-5 py-12 text-center text-sm text-slate-400">No active students are enrolled in this class yet.</div>}
              </div>
            </section>

            <section className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5"><div className="flex items-start gap-3"><Award size={18} className="text-blue-600 mt-0.5"/><div><p className="text-sm font-black text-slate-800">How the score works</p><p className="text-xs text-slate-500 mt-1">The composite is calculated on the server from completed quizzes, scored projects, published trainer assessments, and attendance. The portal only displays the returned result.</p></div></div></section>
          </>
        ) : null}
      </div>
    </PortalShell>
  );
}
