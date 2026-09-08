import { useMemo, useState } from 'react';
import { ArrowRight, Award, BookOpen, CalendarDays, CheckCircle2, Cpu, GraduationCap, Megaphone, School as SchoolIcon, Search, Trophy, Users, WalletCards } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PortalShell from '../components/PortalShell';
import KpiCard from '../components/ui/KpiCard';
import EmptyState from '../components/ui/EmptyState';
import RefreshButton from '../components/ui/RefreshButton';
import ErrorState from '../components/ui/ErrorState';
import { filterNotificationsForUser } from '../utils/notifications';

const lower = value => String(value ?? '').trim().toLowerCase();
const text = value => String(value ?? '').trim();
const normalize = value => text(value).toUpperCase();

function parseAssignments(value) {
  if (Array.isArray(value)) return value.map(item => text(item)).filter(Boolean);
  const raw = text(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(item => text(item)).filter(Boolean);
  } catch {}
  return raw.split(/[\s,;|]+/).map(item => item.trim()).filter(Boolean);
}

function matchesSchool(row, school) {
  const keys = [school?.id, school?.school_id, school?.school_code, school?.code].filter(Boolean).map(normalize);
  const values = [row?.school_id, row?.school_code, row?.school].filter(Boolean).map(normalize);
  return values.some(value => keys.includes(value));
}

function dateKey(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? text(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

export default function SchoolPortal() {
  const { user } = useAuth();
  const { schools = [], classes = [], students = [], trainers = [], sessions = [], attendance = [], curriculum = [], notifications = [], refreshAll, loading } = useData();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'overview';
  const [search, setSearch] = useState('');

  const activeSchool = useMemo(() => {
    const requested = text(user?.school_id);
    if (!requested) return null;
    return schools.find(s => [s.id, s.school_id, s.school_code, s.code].filter(Boolean).map(normalize).includes(normalize(requested))) || null;
  }, [schools, user?.school_id]);

  const scoped = useMemo(() => {
    if (!activeSchool) return { classes: [], students: [], trainers: [], sessions: [], attendance: [], curriculum: [], notifications: [] };
    const schoolClasses = classes.filter(item => matchesSchool(item, activeSchool));
    const classIds = new Set(schoolClasses.map(item => String(item.id)));
    const schoolStudents = students.filter(item => matchesSchool(item, activeSchool) || classIds.has(String(item.class_id)));
    const schoolSessions = sessions.filter(item => matchesSchool(item, activeSchool) || classIds.has(String(item.class_id)));
    const sessionIds = new Set(schoolSessions.map(item => String(item.id)));
    const schoolAttendance = attendance.filter(item => sessionIds.has(String(item.session_id)) || matchesSchool(item, activeSchool));
    const schoolTrainers = trainers.filter(item => parseAssignments(item.assigned_schools).some(value => [activeSchool.id, activeSchool.school_id, activeSchool.school_code, activeSchool.code].filter(Boolean).map(normalize).includes(normalize(value))));
    const schoolCurriculum = curriculum.filter(item => matchesSchool(item, activeSchool) || classIds.has(String(item.class_id)));
    return { classes: schoolClasses, students: schoolStudents, trainers: schoolTrainers, sessions: schoolSessions, attendance: schoolAttendance, curriculum: schoolCurriculum, notifications: filterNotificationsForUser(notifications, user) };
  }, [activeSchool, classes, students, trainers, sessions, attendance, curriculum, notifications, user]);

  const today = dateKey(new Date());
  const todaySessions = useMemo(() => scoped.sessions.filter(item => dateKey(item.date || item.start_time || item.created_at) === today), [scoped.sessions, today]);
  const todayAttendance = useMemo(() => scoped.attendance.filter(item => dateKey(item.date || item.timestamp || item.created_at) === today), [scoped.attendance, today]);
  const attendanceRate = todayAttendance.length ? Math.round((todayAttendance.filter(item => ['present', 'late'].includes(lower(item.status))).length / todayAttendance.length) * 100) : null;
  const activeClasses = scoped.classes.filter(item => !['inactive', 'archived', 'cancelled'].includes(lower(item.status)));
  const activeTrainers = scoped.trainers.filter(item => !['inactive', 'terminated'].includes(lower(item.status)));
  const activeStudents = scoped.students.filter(item => !['inactive', 'graduated', 'withdrawn'].includes(lower(item.status)));
  const upcoming = useMemo(() => [...scoped.sessions].filter(item => !['completed', 'cancelled'].includes(lower(item.status))).sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)) || text(a.time).localeCompare(text(b.time))).slice(0, 5), [scoped.sessions]);
  const unread = scoped.notifications.filter(item => item.is_read === false || item.read === false).length;

  const setTab = tab => setParams({ tab });

  if (!activeSchool) {
    return <PortalShell role="school" title="School Overview" subtitle="Your school workspace is scoped by the authenticated school account."><ErrorState title="School workspace is not linked" description="This account does not have a valid school scope. No other school's data is shown." onRetry={refreshAll} /></PortalShell>;
  }

  const renderOverview = () => (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 text-white p-5 sm:p-7 shadow-xl overflow-hidden relative">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-blue-200">School Operations</p><h2 className="text-2xl sm:text-3xl font-black mt-1">{activeSchool.name}</h2><p className="text-sm text-blue-100/80 mt-2 max-w-2xl">Live view of your classes, students, trainers, sessions and learning progress.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setTab('students')} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white text-blue-900 text-xs font-black"><Users size={14}/> View students</button><Link to="/school-ranking" className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-black">Leaderboard <ArrowRight size={14}/></Link></div>
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard icon={<Users size={20}/>} label="Students" value={activeStudents.length} color="blue" />
        <KpiCard icon={<SchoolIcon size={20}/>} label="Active Classes" value={activeClasses.length} color="violet" />
        <KpiCard icon={<GraduationCap size={20}/>} label="Trainers" value={activeTrainers.length} color="amber" />
        <KpiCard icon={<CalendarDays size={20}/>} label="Today's Sessions" value={todaySessions.length} color="emerald" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">Today's academic pulse</h3><p className="text-xs text-slate-400 mt-0.5">Only records belonging to this school</p></div><RefreshButton onRefresh={refreshAll} loading={loading}/></div><div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3"><div className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><p className="text-[9px] uppercase tracking-wider text-slate-400 font-black">Attendance</p><p className="text-2xl font-black mt-1">{attendanceRate == null ? '—' : `${attendanceRate}%`}</p><p className="text-[10px] text-slate-400 mt-1">{attendanceRate == null ? 'No attendance data available yet.' : 'Present + late today'}</p></div><div className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><p className="text-[9px] uppercase tracking-wider text-slate-400 font-black">Class groups</p><p className="text-2xl font-black mt-1">{activeClasses.length}</p></div><div className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><p className="text-[9px] uppercase tracking-wider text-slate-400 font-black">Curriculum records</p><p className="text-2xl font-black mt-1">{scoped.curriculum.length}</p></div><div className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><p className="text-[9px] uppercase tracking-wider text-slate-400 font-black">Unread alerts</p><p className="text-2xl font-black mt-1">{unread}</p></div></div></div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100"><h3 className="font-black text-slate-900">Upcoming sessions</h3><p className="text-xs text-slate-400 mt-0.5">Next scheduled sessions in your school</p></div><div className="divide-y divide-slate-100">{upcoming.map(session => <button key={session.id} type="button" onClick={() => setTab('sessions')} className="w-full text-left px-5 py-3.5 hover:bg-slate-50"><p className="text-sm font-bold text-slate-800 truncate">{session.topic || 'Scheduled class'}</p><p className="text-[10px] text-slate-400 mt-1">{session.date || 'No date'} {session.time ? `· ${session.time}` : ''}</p></button>)}{!upcoming.length && <EmptyState compact title="No upcoming sessions" description="Scheduled sessions for this school will appear here." />}</div></div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3"><button type="button" onClick={() => setTab('classes')} className="group p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-left hover:-translate-y-0.5 transition-all"><div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><SchoolIcon size={18}/></div><p className="font-black mt-3">Manage Classes</p><p className="text-xs text-slate-400 mt-1">See class groups and session activity.</p><ArrowRight size={15} className="mt-3 text-slate-300 group-hover:text-blue-600"/></button><Link to="/school-ranking" className="group p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:-translate-y-0.5 transition-all"><div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Trophy size={18}/></div><p className="font-black mt-3">Class Performance</p><p className="text-xs text-slate-400 mt-1">View live leaderboard performance.</p><ArrowRight size={15} className="mt-3 text-slate-300 group-hover:text-amber-600"/></Link><Link to="/simulation" className="group p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:-translate-y-0.5 transition-all"><div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><Cpu size={18}/></div><p className="font-black mt-3">Virtual Arduino Lab</p><p className="text-xs text-slate-400 mt-1">Open the interactive classroom simulator.</p><ArrowRight size={15} className="mt-3 text-slate-300 group-hover:text-violet-600"/></Link></section>
    </div>
  );

  const renderList = (kind) => {
    const config = {
      classes: { title: 'My Classes', icon: <SchoolIcon size={18}/>, rows: activeClasses, search: false },
      students: { title: 'Students', icon: <Users size={18}/>, rows: activeStudents.filter(item => !search || lower(item.name).includes(lower(search)) || lower(item.student_id).includes(lower(search))), search: true },
      trainers: { title: 'Trainers', icon: <GraduationCap size={18}/>, rows: activeTrainers, search: false },
      sessions: { title: 'Sessions', icon: <CalendarDays size={18}/>, rows: scoped.sessions.slice().sort((a,b) => dateKey(a.date).localeCompare(dateKey(b.date))).slice(0, 30), search: false },
      curriculum: { title: 'Curriculum', icon: <BookOpen size={18}/>, rows: scoped.curriculum, search: false },
      announcements: { title: 'Announcements', icon: <Megaphone size={18}/>, rows: scoped.notifications, search: false },
      progress: { title: 'Progress', icon: <WalletCards size={18}/>, rows: activeStudents, search: false },
      hardware: { title: 'Hardware & Kits', icon: <Cpu size={18}/>, rows: [], search: false },
      attendance: { title: 'Attendance', icon: <CheckCircle2 size={18}/>, rows: scoped.attendance.slice(0, 50), search: false },
    }[kind];

    if (!config) return null;
    return <section className="space-y-4"><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.16em] text-blue-600 font-black">School data</p><h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 mt-1">{config.icon}{config.title}</h2></div>{config.search && <label className="relative w-full sm:w-72"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/></label>}</div><div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-100">
      {config.rows.map(row => {
        if (kind === 'students') return <div key={row.id || row.student_id} className="p-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-xs">{text(row.name).slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="font-bold text-sm text-slate-800 truncate">{row.name}</p><p className="font-mono text-[10px] text-slate-400">{row.student_id || 'No student ID'}</p></div><span className="text-[10px] font-black uppercase text-slate-400">{row.class_id || 'Unassigned'}</span></div>;
        if (kind === 'progress') return <div key={row.id || row.student_id} className="p-4 flex items-center justify-between gap-3"><div><p className="font-bold text-sm text-slate-800">{row.name}</p><p className="text-[10px] text-slate-400 mt-1">{row.student_id}</p></div><Link to="/school-ranking" className="text-xs font-black text-blue-600 hover:text-blue-800">View ranking <ArrowRight size={13} className="inline"/></Link></div>;
        if (kind === 'hardware') return null;
        return <div key={row.id || row.name} className="p-4 flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{row.display_name || row.name || row.topic || row.title || 'Record'}</p><p className="text-[10px] text-slate-400 mt-1">{row.grade && `Grade ${row.grade}${row.section ? `-${row.section}` : ''}`} {row.date && `· ${row.date}`} {row.status && `· ${row.status}`}</p></div>{kind === 'classes' && <Link to="/school-ranking" className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black text-blue-600">Ranking <ArrowRight size={12}/></Link>}</div>;
      })}
      {!config.rows.length && <EmptyState title={kind === 'hardware' ? 'No hardware records available yet' : `No ${config.title.toLowerCase()} available yet`} description="This view is intentionally limited to records scoped to your school." />}
      </div></section>;
  };

  return <PortalShell role="school" title={activeTab === 'overview' ? 'School Overview' : activeTab.replace(/(^|_)/g, ' ')} subtitle={`${activeSchool.name} · ${activeSchool.school_code || ''}`}>
    <div className="space-y-5 pb-10">
      {activeTab === 'overview' ? renderOverview() : activeTab === 'notifications' ? <section><EmptyState icon={<Megaphone size={20}/>} title="Notifications" description="Your school-specific notifications will appear here as the communications module is used." /></section> : activeTab === 'attendance' ? renderList('attendance') : renderList(activeTab)}
    </div>
  </PortalShell>;
}
