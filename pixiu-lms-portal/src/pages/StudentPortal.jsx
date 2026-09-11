import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CalendarDays, ChevronRight, Cpu, FolderKanban, Sparkles, Trophy } from 'lucide-react';
import { useAuth, apiFetch } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useSearchParams } from 'react-router-dom';
import PortalShell from '../components/PortalShell';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const collection = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
function Card({ title, eyebrow, children }) { return <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100"><p className="text-[9px] font-black tracking-[.15em] uppercase text-blue-600">{eyebrow}</p><h2 className="font-black text-base text-slate-900 mt-1">{title}</h2></div><div className="p-5">{children}</div></section>; }
function Metric({ icon: Icon, label, value, meta }) { return <div className="bg-white border border-slate-200 rounded-2xl p-4"><div className="flex items-center justify-between"><span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Icon size={17}/></span><span className="text-[9px] uppercase tracking-wide font-black text-slate-400">{label}</span></div><p className="text-2xl font-black text-slate-900 mt-4">{value}</p><p className="text-[11px] text-slate-500 mt-1">{meta}</p></div>; }

export default function StudentPortal() {
  const { user } = useAuth();
  const { students = [], schools = [], classes = [], sessions = [], attendance = [], content = [], quizzes = [], quizSubmissions = [], studentReviews: reviewRows = [], projects = [], notifications = [], refreshAll, loading, endpointErrors = {} } = useData();
  const [searchParams] = useSearchParams();
  const [kits, setKits] = useState([]);
  const [kitLoading, setKitLoading] = useState(true);
  const [kitError, setKitError] = useState('');
  const activeTab = searchParams.get('tab') || 'overview';

  const student = useMemo(() => {
    const username = clean(user?.username).toUpperCase();
    const related = clean(user?.related_id).toUpperCase();
    return students.find(item => clean(item.student_id).toUpperCase() === username || clean(item.student_id).toUpperCase() === related || String(item.id) === String(user?.related_id));
  }, [students, user]);

  useEffect(() => {
    let active = true;
    setKitLoading(true); setKitError('');
    apiFetch('/kits').then(async response => { const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.detail || payload.error || `Unable to load kit data (${response.status}).`); return payload; }).then(payload => { if (active) setKits(collection(payload)); }).catch(error => { if (active) { setKits([]); setKitError(error.message || 'Unable to load kit data.'); } }).finally(() => { if (active) setKitLoading(false); });
    return () => { active = false; };
  }, [student?.id]);

  // DataProvider loads the student collection asynchronously on the first render.
  // Never show the "record unavailable" state during that initial hydration window.
  if (loading && !student) return <PortalShell role="student" title="Student Portal" subtitle="Loading your learning workspace"><div className="space-y-5 pb-10"><div className="h-28 animate-pulse rounded-3xl bg-slate-100"/><div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><div className="h-28 animate-pulse rounded-2xl bg-slate-100"/><div className="h-28 animate-pulse rounded-2xl bg-slate-100"/><div className="h-28 animate-pulse rounded-2xl bg-slate-100"/><div className="h-28 animate-pulse rounded-2xl bg-slate-100"/></div><div className="h-64 animate-pulse rounded-2xl bg-slate-100"/></div></PortalShell>;

  if (!student) return <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-6"><div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center"><Award className="mx-auto text-rose-500"/><h1 className="text-xl font-black text-slate-900 mt-4">Student record unavailable</h1><p className="text-sm text-slate-500 mt-2">No student profile is linked to this authenticated account.</p><button type="button" onClick={refreshAll} className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">Try again</button></div></div>;

  const school = schools.find(item => String(item.id) === String(student.school_id) || String(item.school_code) === String(student.school_code));
  const schoolClass = classes.find(item => String(item.id) === String(student.school_class || student.class_id));
  const studentId = String(student.id || '');
  const classId = String(student.school_class || student.class_id || '');
  const classSessions = sessions.filter(item => String(item.school_class || item.class_id) === classId);
  const studentAttendance = attendance.filter(item => String(item.student || item.student_id) === studentId || String(item.student_id) === String(student.student_id));
  const present = studentAttendance.filter(item => ['present', 'late'].includes(lower(item.status))).length;
  const attendanceRate = studentAttendance.length ? Math.round((present / studentAttendance.length) * 100) : 0;
  const studentProjects = projects.filter(item => String(item.student || item.student_id) === studentId || String(item.student_id) === String(student.student_id));
  const reviews = reviewRows.filter(item => String(item.student || item.student_id) === studentId || String(item.student_id) === String(student.student_id));
  const attempts = quizSubmissions.filter(item => String(item.student || item.student_id) === studentId || String(item.student_id) === String(student.student_id));
  const assignedKits = kits.filter(kit => String(kit.student || kit.student_id || '') === studentId || String(kit.school_class || kit.class_id || '') === classId);
  const studentNotifications = notifications;
  const upcoming = classSessions.filter(item => !['completed', 'cancelled'].includes(lower(item.status))).slice(0, 5);
  const contentError = endpointErrors['/content'] || '';
  const quizError = endpointErrors['/quizzes'] || '';
  const projectError = endpointErrors['/projects'] || '';
  let body;

  if (activeTab === 'learning') body = <Card title="My Learning" eyebrow="LEARNING"><div className="grid md:grid-cols-2 gap-3">{content.map(item => <div key={item.id} className="p-4 rounded-xl border border-slate-100"><p className="text-sm font-bold text-slate-800">{item.title}</p><p className="text-[11px] text-slate-500 mt-1">{item.content_type || 'Learning material'} · {item.unit_code || item.level || 'Assigned content'}</p></div>)}{contentError ? <ErrorState title="Learning content could not be loaded" description={contentError} onRetry={refreshAll}/> : !content.length && <EmptyState title="No learning materials" description="No published learning content is currently available to this student."/>}</div></Card>;
  else if (activeTab === 'attendance') body = <Card title="Attendance & Sessions" eyebrow="MY PROGRESS"><div className="space-y-2">{classSessions.map(session => { const record = studentAttendance.find(item => String(item.session || item.session_id) === String(session.id)); return <div key={session.id} className="p-4 rounded-xl border border-slate-100 flex items-center justify-between gap-3"><div><p className="font-bold text-sm text-slate-800">{session.topic || 'Lab session'}</p><p className="text-[11px] text-slate-400 mt-1">{session.date} · {session.start_time || '—'}</p></div><span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black uppercase">{record?.status || 'not marked'}</span></div>; })}{!classSessions.length && <EmptyState title="No sessions" description="No sessions are assigned to your class."/>}</div></Card>;
  else if (activeTab === 'announcements') body = <Card title="Announcements" eyebrow="COMMUNICATION"><div className="space-y-2">{studentNotifications.map(item => <div key={item.id} className="p-4 rounded-xl border border-slate-100"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">{item.title || 'Announcement'}</p><p className="text-[11px] text-slate-500 mt-1 whitespace-pre-wrap">{item.message || ''}</p></div><span className="text-[9px] uppercase font-black text-slate-400">{item.read ? 'Read' : 'New'}</span></div></div>)}{!studentNotifications.length && <EmptyState title="No announcements" description="New class, assignment and achievement notices will appear here."/>}</div></Card>;
  else if (activeTab === 'quizzes') body = <Card title="Quizzes & Attempts" eyebrow="ASSESSMENTS"><div className="space-y-2">{quizzes.map(quiz => { const attempt = attempts.find(item => String(item.quiz || item.quiz_id) === String(quiz.id)); return <div key={quiz.id} className="p-4 rounded-xl border border-slate-100 flex items-center justify-between"><div><p className="font-bold text-sm text-slate-800">{quiz.title}</p><p className="text-[11px] text-slate-400 mt-1">{quiz.level || 'Assessment'} · {quiz.unit_code || '—'}</p></div><span className="font-black text-sm">{attempt ? `${attempt.percentage}%` : 'Not attempted'}</span></div>; })}{quizError ? <ErrorState title="Quiz data could not be loaded" description={quizError} onRetry={refreshAll}/> : !quizzes.length && <EmptyState title="No quizzes" description="No quizzes are currently assigned to this student."/>}</div></Card>;
  else if (activeTab === 'projects') body = <Card title="Projects & Evidence" eyebrow="BUILD"><div className="grid md:grid-cols-2 gap-3">{studentProjects.map(project => <div key={project.id} className="p-4 rounded-xl border border-slate-100"><p className="font-bold text-sm text-slate-800">{project.title}</p><p className="text-[11px] text-slate-500 mt-2">Status: {project.status || '—'}</p><p className="text-[11px] text-slate-500">Score: {project.score ?? 'Pending'}</p></div>)}{projectError ? <ErrorState title="Project data could not be loaded" description={projectError} onRetry={refreshAll}/> : !studentProjects.length && <EmptyState title="No projects" description="No projects are stored for this student yet."/>}</div></Card>;
  else body = <><section className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 text-white p-6 sm:p-8"><div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6"><div><span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-[10px] font-bold"><Sparkles size={13}/> Robotics & AI journey</span><h1 className="text-3xl sm:text-4xl font-black mt-4">Hello, {clean(student.name).split(' ')[0] || 'Student'} 👋</h1><p className="text-sm text-blue-100/80 mt-2">{school?.name || 'Your school'} · {student.class_name || schoolClass?.display_name || 'Your class'}</p></div><div className="min-w-[210px] rounded-2xl bg-white/10 border border-white/10 p-4"><div className="flex justify-between text-[10px] font-black uppercase"><span>Attendance</span><span>{attendanceRate}%</span></div><div className="h-2 bg-white/10 rounded-full mt-3 overflow-hidden"><div className="h-full bg-cyan-300 rounded-full" style={{width:`${attendanceRate}%`}}/></div></div></div></section><div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5"><Metric icon={CalendarDays} label="Attendance" value={`${attendanceRate}%`} meta={`${present} present / late`} /><Metric icon={BookOpen} label="Learning" value={content.length} meta="available materials" /><Metric icon={Trophy} label="Attempts" value={attempts.length} meta="quiz attempts recorded" /><Metric icon={FolderKanban} label="Projects" value={studentProjects.length} meta="projects recorded" /></div><div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 mt-5"><Card title="Next Sessions" eyebrow="SCHEDULE"><div className="space-y-2">{upcoming.map(session => <div key={session.id} className="p-4 rounded-xl border border-slate-100 flex items-center justify-between gap-3"><div><p className="font-bold text-sm text-slate-800">{session.topic || 'Lab session'}</p><p className="text-[11px] text-slate-400 mt-1">{session.date} · {session.start_time || '—'}</p></div><ChevronRight size={16} className="text-slate-300"/></div>)}{!upcoming.length && <EmptyState compact title="No upcoming sessions" description="No upcoming sessions are assigned."/>}</div></Card><Card title="My Hardware" eyebrow="KIT">{kitError ? <ErrorState title="Kit data unavailable" description={kitError} onRetry={refreshAll}/> : <div className="p-4 rounded-2xl bg-slate-900 text-white"><div className="flex items-center justify-between"><span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><Cpu size={18}/></span><span className="text-[9px] uppercase tracking-wider text-slate-400">Database</span></div><p className="font-black mt-4">{kitLoading ? 'Loading…' : assignedKits[0]?.kit_code || assignedKits[0]?.asset_tag || student.assigned_kit_id || 'No kit assigned'}</p><p className="text-[11px] text-slate-400 mt-1">{assignedKits[0]?.name || assignedKits[0]?.kit_type || 'No hardware record assigned'}</p></div>}</Card></div><Card title="Trainer Reviews" eyebrow="FEEDBACK"><div className="space-y-2">{reviews.slice(0, 5).map(review => <div key={review.id} className="p-4 rounded-xl border border-slate-100 flex items-start justify-between gap-4"><div><p className="text-sm font-bold text-slate-800">{review.title || review.unit_code || review.level || 'Assessment'}</p><p className="text-[11px] text-slate-500 mt-1">{review.feedback || 'No written feedback recorded.'}</p></div><span className="font-black text-sm">{review.score ?? '—'}</span></div>)}{!reviews.length && <EmptyState title="No trainer reviews" description="No trainer reviews are stored yet."/>}</div></Card></>;

  const title = activeTab === 'overview' ? 'Student Portal' : activeTab === 'learning' ? 'My Learning' : activeTab === 'attendance' ? 'Attendance' : activeTab === 'quizzes' ? 'Quizzes' : activeTab === 'projects' ? 'Projects' : 'Announcements';
  return <PortalShell role="student" title={title} subtitle={`${student.student_id || student.id} · ${school?.name || 'School workspace'}`}><div className="mb-4 flex justify-end"><RefreshButton onRefresh={refreshAll} loading={loading}/></div>{body}</PortalShell>;
}
