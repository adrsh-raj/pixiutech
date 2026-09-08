import { useEffect, useState } from 'react';
import { Award, BarChart3, CalendarCheck2, CheckCircle2, Cpu, Flame, FolderKanban, LockKeyhole, Play, Target, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../context/AuthContext';
import PortalShell from '../components/PortalShell';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

function Card({ title, eyebrow, children }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">{eyebrow}</p><h2 className="mt-1 text-base font-black text-slate-900 sm:text-lg">{title}</h2></div><div className="p-5 sm:p-6">{children}</div></section>;
}

function Metric({ icon: Icon, label, value, hint, tone = 'blue' }) {
  const tones = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600', amber: 'bg-amber-50 text-amber-600' };
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={17}/></span><p className="mt-3 text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value ?? '—'}</p><p className="mt-1 text-[10px] text-slate-400">{hint}</p></div>;
}

export default function StudentProgressPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await apiFetch('/student-progress', { cache: 'no-store' });
      const type = response.headers.get('content-type') || '';
      const payload = type.includes('application/json') ? await response.json().catch(() => ({})) : {};
      if (!response.ok) throw new Error(payload.detail || payload.error || `Request failed (${response.status})`);
      setData(payload);
    } catch (err) {
      setData(null); setError(err.message || 'Unable to load student progress.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (error) return <PortalShell role="student" title="My Progress" subtitle="Your learning profile and milestones."><ErrorState title="Progress unavailable" description={error} onRetry={load}/></PortalShell>;
  if (loading) return <PortalShell role="student" title="My Progress" subtitle="Your learning profile and milestones."><div className="h-96 animate-pulse rounded-3xl bg-slate-100"/></PortalShell>;
  if (!data) return <PortalShell role="student" title="My Progress"><EmptyState title="No progress data yet" description="Your profile will populate as classroom activity is recorded."/></PortalShell>;

  const p = data.progress || {};
  const r = data.ranking || {};
  const units = Array.isArray(p.unit_timeline) ? p.unit_timeline : [];
  const firstIncomplete = units.findIndex(item => !item.complete);

  return <PortalShell role="student" title="My Progress" subtitle={`${data.student?.class_name || 'Your class'} · learning profile`}>
    <div className="space-y-5 pb-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#07101f] via-[#12335c] to-[#0d65e8] p-6 text-white shadow-xl sm:p-8"><div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-200">Student profile</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{data.student?.name || 'Student'}</h1><p className="mt-2 text-sm text-blue-100/80">{data.student?.class_name || 'Class'} · {data.student?.school_name || 'School'}</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><BarChart3 size={22}/></div><div><p className="text-[9px] uppercase tracking-wider text-blue-100/70">Current level</p><p className="text-lg font-black">{p.level || 'Not assessed'}</p></div></div></div></section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric icon={CalendarCheck2} label="Attendance" value={p.attendance == null ? '—' : `${p.attendance}%`} hint="Present + late" tone="emerald"/><Metric icon={BarChart3} label="Learning Progress" value={p.learning_progress == null ? '—' : `${p.learning_progress}%`} hint="Assigned curriculum units"/><Metric icon={Trophy} label="Quiz Average" value={p.quiz_average == null ? '—' : `${p.quiz_average}%`} hint="Completed attempts" tone="violet"/><Metric icon={FolderKanban} label="Projects" value={`${p.projects_completed ?? 0}/${p.projects_total ?? 0}`} hint="Completed / recorded" tone="amber"/></section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><Card title="Curriculum Timeline" eyebrow="LEARNING JOURNEY"><div className="space-y-2">{units.map((unit, index) => { const current = index === firstIncomplete; return <div key={unit.unit_code} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${unit.complete ? 'border-emerald-200 bg-emerald-50/60' : current ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-slate-50/60'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${unit.complete ? 'bg-emerald-100 text-emerald-700' : current ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{unit.complete ? <CheckCircle2 size={17}/> : current ? <Play size={16}/> : <LockKeyhole size={16}/>}</span><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{unit.unit_code}</p><p className="truncate text-sm font-bold text-slate-800">{unit.title}</p></div><span className="text-[10px] font-black text-slate-500">{unit.complete ? 'Complete' : current ? 'Current' : 'Locked'}</span></div>})}{!units.length && <EmptyState compact title="No curriculum assigned" description="Your class curriculum has not been assigned yet."/>}</div></Card>
        <Card title="Class Standing" eyebrow="MY CLASS"><div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-300">Live rank</p><p className="mt-2 text-4xl font-black">{r.rank ? `#${r.rank}` : '—'}</p><p className="mt-1 text-sm text-slate-300">of {r.total_students || 0} active students</p><p className="mt-4 text-[10px] text-slate-400">Composite score {r.score == null ? '—' : `${r.score}%`}</p></div><Link to="/student-ranking" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50">Open Class Ranking <Trophy size={14}/></Link></Card></section>

      <Card title="Achievements" eyebrow="CONTROLLED GAMIFICATION"><div className="grid gap-3 sm:grid-cols-2">{(p.achievements || []).map(item => <div key={item.key} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">{item.icon === 'flame' ? <Flame size={18}/> : item.icon === 'target' ? <Target size={18}/> : item.icon === 'bot' ? <Cpu size={18}/> : <Trophy size={18}/>}</span><div><p className="text-sm font-black text-slate-800">{item.title}</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">{item.description}</p></div></div></div>)}{!(p.achievements || []).length && <EmptyState icon={Award} title="No achievements earned yet" description="Achievements are unlocked from recorded activity; nothing is pre-seeded."/>}</div></Card>

      <section className="grid gap-5 lg:grid-cols-2"><Card title="Current Learning Streak" eyebrow="CONSISTENCY"><div className="flex items-center gap-4 rounded-2xl bg-orange-50 p-5"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm"><Flame size={24}/></span><div><p className="text-3xl font-black text-slate-900">{p.current_streak || 0} days</p><p className="text-[11px] text-slate-500">Based on consecutive recorded learning activity.</p></div></div></Card><Card title="Personal Milestones" eyebrow="YOUR RECORD"><div className="grid grid-cols-2 gap-3"><Metric icon={Trophy} label="Best Quiz" value={p.best_quiz_score == null ? '—' : `${p.best_quiz_score}%`} hint="Highest attempt"/><Metric icon={BarChart3} label="Most Improved" value={p.most_improved == null ? '—' : `${p.most_improved > 0 ? '+' : ''}${p.most_improved} pts`} hint="Latest vs earliest" tone="violet"/></div></Card></section>

      <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Cpu size={18} className="text-cyan-300"/><p className="text-sm font-black">Practice in the Virtual Arduino Lab</p></div><p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-400">Experiment with circuits and code in simulation. Simulation practice is kept separate from academic ranking.</p></div><Link to="/simulation" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black hover:bg-blue-500">Open Virtual Lab <Play size={14}/></Link></div></section>
    </div>
  </PortalShell>;
}
