import { useEffect, useState } from 'react';
import { BarChart3, BookOpenCheck, CalendarCheck2, ChevronRight, ClipboardCheck, GraduationCap, Users } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import PortalShell from '../components/PortalShell';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';

const metricIcons = [Users, CalendarCheck2, BookOpenCheck, ClipboardCheck];

export default function PerformanceAnalyticsPage({ role = 'trainer' }) {
  const isSchool = role === 'school';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(isSchool ? '/school-performance' : '/trainer-performance', { cache: 'no-store' });
      const type = response.headers.get('content-type') || '';
      const payload = type.includes('application/json') ? await response.json().catch(() => ({})) : {};
      if (!response.ok) throw new Error(payload.detail || payload.error || `Request failed (${response.status})`);
      setData(payload);
    } catch (err) {
      setData(null);
      setError(err.message || 'Unable to load performance analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isSchool]);

  const metrics = isSchool
    ? [
        ['Students', data?.summary?.students, 'Active learners', metricIcons[0]],
        ['Classes', data?.summary?.classes, 'Active classes', metricIcons[1]],
        ['Attendance', data?.summary?.attendance == null ? '—' : `${data.summary.attendance}%`, 'School average', metricIcons[2]],
        ['Avg Quiz', data?.summary?.avg_quiz == null ? '—' : `${data.summary.avg_quiz}%`, 'Completed quiz attempts', metricIcons[3]],
      ]
    : [
        ['Sessions Delivered', data?.metrics?.sessions_delivered, 'Completed sessions', metricIcons[0]],
        ['Attendance', data?.metrics?.attendance_rate == null ? '—' : `${data.metrics.attendance_rate}%`, 'Across recorded attendance', metricIcons[1]],
        ['Student Improvement', data?.metrics?.student_improvement == null ? '—' : `${data.metrics.student_improvement > 0 ? '+' : ''}${data.metrics.student_improvement} pts`, 'Quiz trajectory', metricIcons[2]],
        ['Reviews Completed', data?.metrics?.reviews_completed, 'Published assessments', metricIcons[3]],
      ];

  return (
    <PortalShell role={isSchool ? 'school' : 'trainer'} title={isSchool ? 'School Performance' : 'Trainer Performance'} subtitle={isSchool ? 'Live academic indicators for your school.' : 'Private operational analytics for teaching quality and delivery.'}>
      <div className="space-y-5 pb-10">
        {error ? <ErrorState title="Performance unavailable" description={error} onRetry={load} /> : loading ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse"><div className="h-8 w-64 rounded-xl bg-slate-100"/><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[1,2,3,4].map(item => <div key={item} className="h-28 rounded-2xl bg-slate-100" />)}</div></section>
        ) : !data ? <EmptyState title="No performance data yet" description="Metrics will appear once the system has recorded academic activity." /> : (
          <>
            <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-300">{isSchool ? 'Academic operations' : 'Internal quality dashboard'}</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{isSchool ? data.school?.name || 'Your school' : data.trainer?.name || 'Trainer'}</h2><p className="mt-1 text-sm text-slate-300">{isSchool ? 'Use these indicators to spot classes that need attention.' : 'These metrics are operational signals, not student-facing competition.'}</p></section>
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map(([label, value, hint, Icon]) => <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={17}/></span><p className="mt-3 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value ?? '—'}</p><p className="mt-1 text-[10px] text-slate-400">{hint}</p></div>)}</section>
            {isSchool ? (
              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Class comparison</p><h3 className="mt-1 text-base font-black text-slate-900">Compare active classes</h3></div><div className="divide-y divide-slate-100">{(data.class_comparison || []).map(row => <div key={row.class_id} className="grid grid-cols-[minmax(0,1fr)_72px_72px_72px] gap-3 px-4 py-4 sm:px-5"><div><p className="text-sm font-bold text-slate-800">{row.name}</p><p className="text-[10px] text-slate-400">{row.students} active students</p></div><div className="text-right"><p className="text-[9px] text-slate-400">Attend.</p><p className="text-xs font-black">{row.attendance == null ? '—' : `${row.attendance}%`}</p></div><div className="text-right"><p className="text-[9px] text-slate-400">Quiz</p><p className="text-xs font-black">{row.quiz == null ? '—' : `${row.quiz}%`}</p></div><div className="text-right"><p className="text-[9px] text-slate-400">Score</p><p className="text-xs font-black">{row.score == null ? '—' : `${row.score}%`}</p></div></div>)}{!(data.class_comparison || []).length && <EmptyState compact title="No active classes" description="Class comparison will appear when active classes have been recorded." />}</div></section>
            ) : (
              <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><BarChart3 size={17} className="text-blue-600"/><h3 className="text-sm font-black text-slate-900">Delivery & completion</h3></div><div className="mt-4 space-y-3"><MetricLine label="Quiz completion" value={data.metrics?.quiz_completion}/><MetricLine label="Project completion" value={data.metrics?.project_completion}/></div></div><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><GraduationCap size={17} className="text-blue-600"/><h3 className="text-sm font-black text-slate-900">What this is for</h3></div><p className="mt-3 text-sm leading-relaxed text-slate-500">Use trends in delivery, attendance and student improvement to guide coaching, support and future review decisions. Keep compensation decisions separate from a single metric.</p></div></section>
            )}
            <div className="flex justify-start"><button type="button" onClick={load} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">Refresh analytics <ChevronRight size={14}/></button></div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

function MetricLine({ label, value }) {
  const numeric = Number(value || 0);
  return <div><div className="flex items-center justify-between gap-3 text-xs"><span className="font-bold text-slate-700">{label}</span><span className="font-black text-slate-900">{Number.isFinite(numeric) ? numeric : 0}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(Math.max(numeric, 0), 100)}%` }} /></div></div>;
}
