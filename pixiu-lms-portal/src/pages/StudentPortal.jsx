import { useMemo } from 'react';
import { ArrowRight, Award, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock3, FolderKanban, Play, Sparkles, Star, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useSearchParams } from 'react-router-dom';
import PortalShell from '../components/PortalShell';
import { CLASS_KITS } from '../data/classKits';

function cleanId(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function MetricCard({ icon: Icon, label, value, meta, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  };
  return <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"><div className="flex items-start justify-between gap-3"><span className={`w-9 h-9 rounded-xl ring-1 flex items-center justify-center ${tones[tone] || tones.blue}`}><Icon size={17}/></span><span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span></div><p className="text-2xl font-black tracking-tight mt-4">{value}</p>{meta && <p className="text-[11px] text-slate-500 mt-1">{meta}</p>}</div>;
}

function Card({ title, eyebrow, action, children }) {
  return <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden"><div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3"><div><p className="text-[9px] font-extrabold tracking-[0.15em] uppercase text-blue-600">{eyebrow || 'Pixiu Learning'}</p><h2 className="font-black text-base sm:text-lg text-slate-900 mt-0.5">{title}</h2></div>{action}</div><div className="p-5 sm:p-6">{children}</div></section>;
}

function Empty({ text }) { return <div className="py-8 text-center"><p className="text-sm text-slate-400">{text}</p></div>; }

export default function StudentPortal() {
  const { user } = useAuth();
  const { students = [], schools = [], sessions = [], attendance = [], content = [], quizzes = [], quizSubmissions = [], studentReviews = [], projects = [] } = useData();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const student = useMemo(() => {
    const username = cleanId(user?.username);
    const related = cleanId(user?.related_id);
    return students.find(item => cleanId(item.student_id) === username || cleanId(item.student_id) === related || String(item.id) === String(user?.related_id));
  }, [students, user]);

  if (!student) {
    return <div className="min-h-dvh bg-[#f5f7fb] flex items-center justify-center p-5"><div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm"><div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center"><Award size={22}/></div><h1 className="text-xl font-black text-slate-900 mt-4">Student record unavailable</h1><p className="text-sm text-slate-500 mt-2">No student profile is linked to this account.</p></div></div>;
  }

  const school = schools.find(item => String(item.id) === String(student.school_id) || item.code === student.school_id);
  const classId = student.class_id;
  const studentKey = cleanId(student.student_id).replace(/\s+/g, '');
  const classSessions = sessions.filter(item => String(item.class_id) === String(classId));
  const studentAttendance = attendance.filter(item => cleanId(item.student_id).replace(/\s+/g, '') === studentKey);
  const present = studentAttendance.filter(item => String(item.status).toLowerCase() === 'present').length;
  const attendanceRate = studentAttendance.length ? Math.round((present / studentAttendance.length) * 100) : 0;
  const studentProjects = projects.filter(item => cleanId(item.student_id).replace(/\s+/g, '') === studentKey);
  const studentReviewsForRecord = studentReviews.filter(item => cleanId(item.student_id).replace(/\s+/g, '') === studentKey);
  const studentSubmissions = quizSubmissions.filter(item => cleanId(item.student_id).replace(/\s+/g, '') === studentKey);
  const grade = String(student.grade || student.class_grade || '').replace(/\D/g, '') || String(student.class_id || '').match(/(\d+)/)?.[1] || '';
  const kit = CLASS_KITS[grade];
  const compatibleContent = content.filter(item => !item.class_grade || String(item.class_grade) === grade);

  const displayName = student.name?.split(' ')?.[0] || user?.name?.split(' ')?.[0] || 'Student';
  const upcoming = classSessions.filter(item => item.status !== 'Completed').slice(0, 3);

  const renderContent = () => {
    if (activeTab === 'learning') return <div className="space-y-5"><Card title="Your Learning Library" eyebrow="MY LEARNING"><div className="grid md:grid-cols-2 gap-3">{compatibleContent.slice(0, 20).map(item => <div key={item.id} className="group p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all"><div className="flex items-start justify-between gap-3"><div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><BookOpen size={16}/></div><span className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400">{item.type || item.content_type || 'Material'}</span></div><p className="font-bold text-sm text-slate-800 mt-3">{item.title}</p><p className="text-[11px] text-slate-500 mt-1">{item.level || 'Core robotics & AI learning'}</p></div>)}{!compatibleContent.length && <Empty text="No learning materials are available for your class yet." />}</div></Card></div>;

    if (activeTab === 'attendance') return <Card title="Attendance & Sessions" eyebrow="MY PROGRESS"><div className="space-y-2">{classSessions.map(session => { const record = studentAttendance.find(item => String(item.session_id) === String(session.id)); return <div key={session.id} className="p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{session.topic || 'Lab session'}</p><p className="text-[11px] text-slate-400 mt-1">{session.date || 'Date not set'} · {session.time || ''}</p></div><span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${record?.status === 'Present' ? 'bg-emerald-50 text-emerald-700' : record?.status === 'Absent' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{record?.status || 'Not marked'}</span></div>; })}{!classSessions.length && <Empty text="No sessions recorded for your class." />}</div></Card>;

    if (activeTab === 'quizzes') return <Card title="Quizzes & Attempts" eyebrow="MY ASSESSMENTS"><div className="space-y-2">{quizzes.map(quiz => { const attempt = studentSubmissions.find(item => String(item.quiz_id) === String(quiz.id)); return <div key={quiz.id} className="p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{quiz.title}</p><p className="text-[11px] text-slate-400 mt-1">{quiz.level || 'Assessment'} {quiz.unit_code ? `· ${quiz.unit_code}` : ''}</p></div><span className="shrink-0 text-xs font-black text-slate-700">{attempt ? `${attempt.percentage}%` : 'Not attempted'}</span></div>; })}{!quizzes.length && <Empty text="No quizzes assigned right now." />}</div></Card>;

    if (activeTab === 'projects') return <Card title="Projects & Evidence" eyebrow="BUILD & CREATE"><div className="grid md:grid-cols-2 gap-3">{studentProjects.map(project => <div key={project.id} className="p-4 rounded-2xl border border-slate-100"><div className="flex items-start justify-between gap-3"><p className="font-bold text-sm text-slate-800">{project.title}</p><span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700">{project.status || 'Submitted'}</span></div><p className="text-[11px] text-slate-500 mt-2">Score: <span className="font-bold text-slate-700">{project.score ?? 'Pending'}</span></p><p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{project.evidence_note || project.description || 'Project evidence not added yet.'}</p></div>)}{!studentProjects.length && <Empty text="Your projects will appear here once submitted." />}</div></Card>;

    if (activeTab === 'reviews') return <Card title="Trainer Reviews" eyebrow="MY PROGRESS"><div className="space-y-2">{studentReviewsForRecord.map(review => <div key={review.id} className="p-4 rounded-2xl border border-slate-100"><div className="flex items-start justify-between gap-4"><div><p className="font-bold text-sm text-slate-800">{review.unit_title || review.unit_code || review.level || 'Assessment'}</p><p className="text-[11px] text-slate-500 mt-1">{review.review || review.comment || 'Trainer feedback is available.'}</p></div><span className="shrink-0 w-9 h-9 rounded-xl bg-amber-50 text-amber-600 font-black text-xs flex items-center justify-center">{review.score ?? '—'}</span></div></div>)}{!studentReviewsForRecord.length && <Empty text="No trainer assessment has been recorded yet." />}</div></Card>;

    return <>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#07101f] via-[#0d2342] to-[#0b5dd7] text-white p-6 sm:p-8 shadow-xl shadow-blue-900/10">
        <div className="absolute -right-14 -top-20 w-56 h-56 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute -bottom-28 left-1/2 w-64 h-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-7">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-white/8 border border-white/10 px-3 py-1.5 text-[10px] font-bold text-blue-100"><Sparkles size={13}/> Robotics & AI journey</div><h2 className="text-3xl sm:text-4xl font-black tracking-tight mt-4">Hello, {displayName} 👋</h2><p className="text-sm text-blue-100/80 mt-2 max-w-xl">Keep building, keep experimenting. Your next breakthrough might start with the next lab session.</p><div className="flex flex-wrap gap-2 mt-5"><span className="px-3 py-1.5 rounded-xl bg-white/8 border border-white/10 text-[10px] font-semibold">{school?.name || 'Your school'}</span><span className="px-3 py-1.5 rounded-xl bg-white/8 border border-white/10 text-[10px] font-semibold">Class {student.class_name || student.class_id || '—'}</span></div></div>
          <div className="min-w-[220px] bg-white/8 border border-white/10 rounded-2xl p-4 backdrop-blur-sm"><div className="flex items-center justify-between text-[10px] font-bold text-blue-100 uppercase tracking-wider"><span>Attendance</span><span>{attendanceRate}%</span></div><div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${attendanceRate}%` }} /></div><p className="text-[10px] text-blue-100/70 mt-2">Keep the momentum going.</p></div>
        </div>
      </section>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4"><MetricCard icon={CalendarDays} label="Attendance" value={`${attendanceRate}%`} meta={`${present} present sessions`} tone="emerald"/><MetricCard icon={BookOpen} label="Learning" value={compatibleContent.length} meta="materials for your class" tone="blue"/><MetricCard icon={Trophy} label="Quizzes" value={studentSubmissions.length} meta="attempts recorded" tone="violet"/><MetricCard icon={FolderKanban} label="Projects" value={studentProjects.length} meta="projects in your portfolio" tone="amber"/></div>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
        <Card title="Next Up" eyebrow="YOUR SCHEDULE" action={<span className="text-[10px] font-bold text-slate-400">{upcoming.length ? 'Ready when you are' : 'No sessions'}</span>}>
          <div className="space-y-3">{upcoming.map(session => <div key={session.id} className="group p-4 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-blue-200 hover:bg-white transition-all"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Clock3 size={17}/></div><div className="min-w-0 flex-1"><p className="font-bold text-sm text-slate-800 truncate">{session.topic || 'Robotics Lab Session'}</p><p className="text-[11px] text-slate-500 mt-1">{session.date || 'Date TBD'} · {session.time || 'Time TBD'}</p></div><ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors"/></div></div>)}{!upcoming.length && <Empty text="No upcoming classroom sessions are assigned yet." />}</div>
        </Card>
        <Card title="My Hardware" eyebrow="LAB KIT"><div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white"><div className="flex items-center justify-between"><div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center"><CpuIcon/></div><span className="text-[9px] uppercase tracking-widest font-bold text-slate-400">Assigned kit</span></div><p className="font-black mt-4">{student.assigned_kit_id || kit?.kit_id || 'No kit assigned'}</p><p className="text-[11px] text-slate-400 mt-1">{kit?.name || 'Your classroom hardware kit'}</p></div><div className="mt-4 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Current level</p><p className="text-sm font-black text-slate-800 mt-1">{student.current_level || student.tech_level || 'Not assessed'}</p></div></Card>
      </div>

      <Card title="Quick Learning" eyebrow="JUMP BACK IN">
        <div className="grid sm:grid-cols-3 gap-3"><QuickLink icon={BookOpen} title="My Learning" text={`${compatibleContent.length} materials`} tab="learning"/><QuickLink icon={ClipboardIcon} title="Quizzes" text={`${quizzes.length} available`} tab="quizzes"/><QuickLink icon={FolderKanban} title="Projects" text={`${studentProjects.length} submitted`} tab="projects"/></div>
      </Card>
    </>;
  };

  return <PortalShell role="student" title={activeTab === 'overview' ? 'Student Dashboard' : activeTab === 'learning' ? 'My Learning' : activeTab === 'attendance' ? 'Attendance' : activeTab === 'quizzes' ? 'Quizzes' : activeTab === 'projects' ? 'Projects' : 'Trainer Reviews'} subtitle={`${student.student_id} · ${school?.name || 'Pixiu Tech Learning Portal'}`}>
    {renderContent()}
  </PortalShell>;
}

function QuickLink({ icon: Icon, title, text, tab }) { return <a href={`/student-portal?tab=${tab}`} className="group p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all"><div className="flex items-center gap-3"><span className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center"><Icon size={16}/></span><div className="min-w-0"><p className="font-bold text-sm text-slate-800">{title}</p><p className="text-[10px] text-slate-400 mt-0.5">{text}</p></div><ArrowRight size={15} className="ml-auto text-slate-300 group-hover:text-blue-500"/></div></a>; }
function CpuIcon() { return <Sparkles size={18}/>; }
function ClipboardIcon() { return <CheckCircle2 size={17}/>; }
