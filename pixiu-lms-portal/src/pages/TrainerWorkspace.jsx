import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Check, Clock3, Cpu, GraduationCap, Megaphone, Play, School, Star, Trophy, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/ui/EmptyState';

const text = value => String(value ?? '').trim();
const lower = value => text(value).toLowerCase();
const normalize = value => text(value).toUpperCase();
const todayKey = () => new Date().toISOString().slice(0, 10);

function parseIds(value) {
  if (Array.isArray(value)) return value.map(v => text(v)).filter(Boolean);
  const raw = text(value);
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.map(v => text(v)).filter(Boolean); } catch {}
  return raw.split(/[\s,;|]+/).map(v => v.trim()).filter(Boolean);
}

function sameId(a, b) { return normalize(a) === normalize(b) && normalize(a) !== ''; }
function schoolKeys(school) { return [school?.id, school?.school_code, school?.code, school?.school_id].filter(Boolean).map(normalize); }
function dateKey(value) { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? text(value).slice(0, 10) : d.toISOString().slice(0, 10); }

export default function TrainerWorkspace() {
  const { user } = useAuth();
  const { trainers = [], schools = [], classes = [], students = [], sessions = [], attendance = [], studentReviews = [], notifications = [], markAttendance, completeSession } = useData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [activeSessionId, setActiveSessionId] = useState(null);

  const trainerId = user?.related_id || user?.username || user?.id;
  const trainer = useMemo(() => trainers.find(t => [t.id, t.trainer_id, t.account_username].some(value => sameId(value, trainerId))), [trainers, trainerId]);
  const assignedSchoolIds = useMemo(() => parseIds(trainer?.assigned_schools || user?.school_id), [trainer, user]);
  const assignedSchools = useMemo(() => schools.filter(school => assignedSchoolIds.some(id => schoolKeys(school).includes(normalize(id)))), [schools, assignedSchoolIds]);
  const visibleStudents = useMemo(() => students.filter(student => assignedSchoolIds.length === 0 || assignedSchoolIds.some(id => sameId(id, student.school_id) || sameId(id, student.school_code))), [students, assignedSchoolIds]);
  const visibleClasses = useMemo(() => {
    const studentClassIds = new Set(visibleStudents.map(s => String(s.class_id || '')).filter(Boolean));
    return classes.filter(item => assignedSchoolIds.length === 0 || assignedSchoolIds.some(id => sameId(id, item.school_id) || sameId(id, item.school_code)) || studentClassIds.has(String(item.id)));
  }, [classes, assignedSchoolIds, visibleStudents]);
  const visibleSessions = useMemo(() => sessions.filter(session => {
    const sessionTrainer = session.trainer_id || session.trainer || session.trainer_code;
    const sessionSchool = session.school_id || session.school_code;
    return sameId(sessionTrainer, trainerId) || assignedSchoolIds.some(id => sameId(id, sessionSchool));
  }), [sessions, trainerId, assignedSchoolIds]);
  const today = todayKey();
  const todaySessions = visibleSessions.filter(s => dateKey(s.date || s.start_time || s.created_at) === today && !['cancelled', 'completed'].includes(lower(s.status)));
  const todayAttendance = attendance.filter(a => dateKey(a.date || a.timestamp || a.created_at) === today);
  const todayAttendanceRate = todayAttendance.length ? Math.round((todayAttendance.filter(a => ['present', 'late'].includes(lower(a.status))).length / todayAttendance.length) * 100) : null;
  const pendingReviews = studentReviews.filter(review => ['pending', 'draft', 'submitted'].includes(lower(review.status))).length;
  const upcomingSessions = useMemo(() => [...visibleSessions].filter(s => !['cancelled', 'completed'].includes(lower(s.status))).sort((a,b) => dateKey(a.date).localeCompare(dateKey(b.date)) || text(a.time).localeCompare(text(b.time))).slice(0, 6), [visibleSessions]);
  const activeSession = visibleSessions.find(s => String(s.id) === String(activeSessionId)) || null;
  const sessionRoster = activeSession ? visibleStudents.filter(s => sameId(s.class_id, activeSession.class_id)) : [];
  const activeTab = params.get('tab') || 'overview';

  const setTab = tab => setParams({ tab });
  const getStatus = studentId => attendance.find(a => sameId(a.session_id, activeSessionId) && sameId(a.student_id, studentId))?.status;
  const mark = async (studentId, status) => { const result = await markAttendance(activeSessionId, studentId, status); if (result?.success === false) toast.error(result.error || 'Attendance could not be saved.'); };

  if (activeSession) return <div className="max-w-3xl mx-auto space-y-4 pb-10"><section className="rounded-3xl bg-slate-950 text-white p-5 sm:p-7 shadow-xl"><button type="button" onClick={() => setActiveSessionId(null)} className="text-xs text-slate-300 hover:text-white mb-3">← Back to workspace</button><p className="text-[10px] uppercase tracking-[0.18em] text-blue-300 font-black">Live classroom</p><h1 className="text-2xl font-black mt-1">{activeSession.topic || 'Scheduled class'}</h1><p className="text-sm text-slate-300 mt-2">{activeSession.date || 'No date'} {activeSession.time ? `· ${activeSession.time}` : ''} · {sessionRoster.length} students</p></section><section className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="font-black text-slate-800">Attendance</p><p className="text-xs text-slate-500 mt-1">Mark the current class roster. Changes are saved to the API.</p></div><button type="button" onClick={async () => { for (const student of sessionRoster) await mark(student.student_id, 'Present'); toast.success('All students marked present.'); }} className="inline-flex justify-center items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black"><Check size={14}/> Mark all present</button></section><section className="space-y-2">{sessionRoster.map(student => { const status = getStatus(student.student_id); return <div key={student.student_id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{student.name}</p><p className="font-mono text-[10px] text-slate-400">{student.student_id}</p></div><div className="flex gap-2 shrink-0"><button type="button" onClick={() => mark(student.student_id, 'Present')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${status === 'Present' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>Present</button><button type="button" onClick={() => mark(student.student_id, 'Absent')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${status === 'Absent' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'}`}>Absent</button></div></div>; })}{!sessionRoster.length && <EmptyState title="No students found for this class" description="This session is not linked to a current student roster."/>}</section><button type="button" onClick={async () => { const result = await completeSession(activeSession.id); if (result?.success !== false) { toast.success('Session completed and attendance locked.'); setActiveSessionId(null); } else toast.error(result.error || 'Could not complete session.'); }} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm">Complete & lock session</button></div>;

  const tabView = activeTab !== 'overview';
  const statCards = [
    { label: "Today's Classes", value: todaySessions.length, icon: CalendarDays, tone: 'blue' },
    { label: 'My Students', value: visibleStudents.length, icon: Users, tone: 'violet' },
    { label: 'Attendance Today', value: todayAttendanceRate == null ? '—' : `${todayAttendanceRate}%`, icon: Check, tone: 'emerald' },
    { label: 'Pending Reviews', value: pendingReviews, icon: Star, tone: 'amber' },
  ];

  return <div className="space-y-5 pb-10">
    {!tabView && <>
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 text-white p-5 sm:p-7 shadow-xl"><div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5"><div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-blue-200">Trainer command center</p><h1 className="text-2xl sm:text-3xl font-black mt-1">Good morning, {trainer?.name || user?.name || 'Trainer'}</h1><p className="text-sm text-blue-100/80 mt-2">Your workspace is scoped to current trainer assignments and live LMS records.</p></div><div className="flex flex-wrap gap-2"><Link to="/trainer-ranking" className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white text-blue-900 text-xs font-black"><Trophy size={14}/> Class ranking</Link><Link to="/simulation" className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-black"><Cpu size={14}/> Virtual Lab</Link></div></div></section>
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">{statCards.map(({label,value,icon:Icon}) => <div key={label} className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm"><div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center"><Icon size={18}/></div><p className="text-[9px] uppercase tracking-wider text-slate-400 font-black mt-3">{label}</p><p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{value}</p></div>)}</section>
      <section className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5"><div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><h2 className="font-black text-slate-900">Today's sessions</h2><p className="text-xs text-slate-400 mt-0.5">Start a live classroom directly from here.</p></div><CalendarDays size={17} className="text-slate-300"/></div><div className="divide-y divide-slate-100">{todaySessions.map(session => <button type="button" key={session.id} onClick={() => setActiveSessionId(session.id)} className="w-full p-4 text-left hover:bg-slate-50 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Play size={15}/></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800 truncate">{session.topic || 'Scheduled class'}</p><p className="text-[10px] text-slate-400 mt-1">{session.time || 'Time not set'} · {session.class_id || 'Class not set'}</p></div><ArrowRight size={15} className="text-slate-300"/></button>)}{!todaySessions.length && <EmptyState title="No classes scheduled today" description="When sessions are assigned to you, they will appear here."/>}</div></div><div className="space-y-5"><div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-5"><p className="text-[10px] uppercase tracking-wider text-blue-600 font-black">Assigned schools</p><div className="mt-3 space-y-2">{assignedSchools.map(school => <div key={school.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="text-sm font-bold text-slate-800">{school.name}</p><p className="text-[10px] font-mono text-slate-400 mt-1">{school.school_code || school.code || school.id}</p></div>)}{!assignedSchools.length && <p className="text-xs text-slate-400">No active school assignments found.</p>}</div></div><div className="bg-blue-50 border border-blue-100 rounded-2xl p-5"><h3 className="font-black text-blue-950 flex items-center gap-2"><BookOpen size={17}/> Ready for the next class?</h3><p className="text-xs text-blue-900/70 mt-1.5">Open teaching materials or launch the interactive Arduino lab.</p><div className="flex flex-wrap gap-2 mt-4"><Link to="/trainer-materials" className="px-3 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-black">Teaching materials</Link><Link to="/simulation" className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-black">Virtual Arduino Lab</Link></div></div></div></section>
    </>}
    {activeTab === 'classes' && <section className="space-y-4"><h2 className="text-2xl font-black text-slate-900">My Classes</h2><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{visibleClasses.map(item => <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5"><div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><School size={18}/></div><p className="font-black mt-3">{item.display_name || `${item.grade || ''}${item.section || ''}`}</p><p className="text-xs text-slate-400 mt-1">{visibleStudents.filter(s => sameId(s.class_id, item.id)).length} students</p><Link to="/trainer-ranking" className="inline-flex items-center gap-1.5 mt-3 text-xs font-black text-blue-600">View performance <ArrowRight size={13}/></Link></div>)}{!visibleClasses.length && <div className="col-span-full"><EmptyState title="No assigned classes yet" description="Classes will appear after your trainer-school assignments are configured."/></div>}</div></section>}
    {activeTab === 'notifications' && <section><EmptyState icon={<Megaphone size={20}/>} title="Notifications" description="Trainer-specific notifications will appear here as communication records are published."/></section>}
    {activeTab === 'announcements' && <section><EmptyState icon={<Megaphone size={20}/>} title="Announcements" description="School and Pixiu announcements will appear here when available."/></section>}
    {activeTab === 'attendance' && <section><div className="bg-white border border-slate-200 rounded-2xl p-5"><h2 className="text-xl font-black">Attendance</h2><p className="text-sm text-slate-500 mt-1">Today: {todayAttendanceRate == null ? 'No attendance data available yet.' : `${todayAttendanceRate}% present/late`}</p></div></section>}
    {activeTab !== 'overview' && activeTab !== 'classes' && activeTab !== 'notifications' && activeTab !== 'announcements' && activeTab !== 'attendance' && <section><EmptyState title={`${activeTab.replace(/^./, c => c.toUpperCase())} workspace`} description="Use the dedicated module from the sidebar. This trainer workspace remains focused on daily teaching operations."/></section>}
  </div>;
}
