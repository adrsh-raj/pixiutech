import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { CLASS_KITS } from '../data/classKits';

function cleanId(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const { students = [], schools = [], sessions = [], attendance = [], content = [], quizzes = [], quizSubmissions = [], studentReviews = [], projects = [] } = useData();
  const [tab, setTab] = useState('overview');

  const student = useMemo(() => {
    const username = cleanId(user?.username);
    const related = cleanId(user?.related_id);
    return students.find(item => cleanId(item.student_id) === username || cleanId(item.student_id) === related || String(item.id) === String(user?.related_id));
  }, [students, user]);

  if (!student) {
    return <div className="min-h-screen bg-slate-50 p-8"><div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8"><h1 className="text-xl font-black text-slate-900">Student record unavailable</h1><p className="text-sm text-slate-500 mt-2">No student profile is linked to this account. No fallback or demo student is being displayed.</p><button onClick={logout} className="mt-5 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">Logout</button></div></div>;
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

  const tabs = [['overview', 'Overview'], ['attendance', 'Attendance'], ['learning', 'Learning'], ['quizzes', 'Quizzes'], ['projects', 'Projects'], ['reviews', 'Reviews']];

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-20 bg-slate-950 text-white px-5 py-4 flex justify-between items-center">
      <div><div className="font-black tracking-wide">PIXIU TECH</div><div className="text-xs text-slate-400">Student Learning Portal</div></div>
      <button onClick={logout} className="px-3 py-2 rounded-lg border border-slate-700 text-xs font-bold">Logout</button>
    </header>
    <main className="max-w-6xl mx-auto p-5 space-y-5">
      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:justify-between gap-5">
          <div><p className="text-xs text-slate-400 uppercase font-bold">Student</p><h1 className="text-2xl font-black mt-1">{student.name}</h1><p className="text-sm text-slate-500 mt-1">{student.student_id} · {school?.name || 'School record unavailable'}</p><p className="text-sm text-slate-500">Class {student.class_name || student.class_id || '—'}</p></div>
          <div className="grid grid-cols-3 gap-3"><Metric label="Attendance" value={`${attendanceRate}%`} /><Metric label="Projects" value={studentProjects.length} /><Metric label="Quizzes" value={studentSubmissions.length} /></div>
        </div>
      </section>
      <nav className="flex gap-2 overflow-x-auto">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${tab === key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{label}</button>)}</nav>

      {tab === 'overview' && <div className="grid md:grid-cols-2 gap-5"><Card title="Current Learning"><p className="text-sm text-slate-600">Level: <strong>{student.current_level || student.tech_level || 'Not assessed'}</strong></p><p className="text-sm text-slate-600 mt-2">Sessions conducted: <strong>{classSessions.length}</strong></p></Card><Card title="Assigned Hardware"><p className="text-sm text-slate-600">{student.assigned_kit_id || kit?.kit_id || 'No kit assigned'}</p>{kit && <p className="text-xs text-slate-400 mt-2">{kit.name}</p>}</Card></div>}
      {tab === 'attendance' && <Card title="Attendance & Sessions"><div className="space-y-2">{classSessions.map(session => { const record = studentAttendance.find(item => String(item.session_id) === String(session.id)); return <div key={session.id} className="p-3 rounded-xl border border-slate-100 flex justify-between gap-3"><div><p className="text-sm font-bold">{session.topic || 'Lab session'}</p><p className="text-xs text-slate-400">{session.date || 'Date not set'} · {session.time || ''}</p></div><span className="text-xs font-bold">{record?.status || (session.is_locked ? 'Present' : 'Not marked')}</span></div>; })}{!classSessions.length && <Empty text="No sessions recorded for your class." />}</div></Card>}
      {tab === 'learning' && <div className="grid md:grid-cols-2 gap-5"><Card title="Curriculum"><p className="text-sm text-slate-500">Learning content is served from class-scoped assignments. {content.filter(item => !item.class_grade || String(item.class_grade) === grade).length} compatible materials are currently available.</p></Card><Card title="Materials"><div className="space-y-2">{content.filter(item => !item.class_grade || String(item.class_grade) === grade).slice(0, 20).map(item => <div key={item.id} className="p-3 border border-slate-100 rounded-xl"><p className="font-bold text-sm">{item.title}</p><p className="text-xs text-slate-400">{item.type || item.content_type || 'Material'} · {item.level || 'General'}</p></div>)}{!content.length && <Empty text="No learning materials available." />}</div></Card></div>}
      {tab === 'quizzes' && <Card title="Quizzes & Attempts"><div className="space-y-2">{quizzes.map(quiz => <div key={quiz.id} className="p-3 rounded-xl border border-slate-100 flex justify-between"><div><p className="font-bold text-sm">{quiz.title}</p><p className="text-xs text-slate-400">{quiz.level || ''} · {quiz.unit_code || ''}</p></div><span className="text-xs font-bold">{studentSubmissions.find(item => String(item.quiz_id) === String(quiz.id))?.percentage ?? 'Not attempted'}{studentSubmissions.find(item => String(item.quiz_id) === String(quiz.id)) ? '%' : ''}</span></div>)}{!quizzes.length && <Empty text="No quizzes assigned." />}</div></Card>}
      {tab === 'projects' && <Card title="Projects & Evidence"><div className="space-y-2">{studentProjects.map(project => <div key={project.id} className="p-4 rounded-xl border border-slate-100"><div className="flex justify-between"><p className="font-bold text-sm">{project.title}</p><span className="text-xs font-bold">{project.status || 'Submitted'}</span></div><p className="text-xs text-slate-500 mt-1">Score: {project.score ?? 'Pending'}</p><p className="text-xs text-slate-500 mt-1">{project.evidence_note || project.description || ''}</p></div>)}{!studentProjects.length && <Empty text="No projects recorded." />}</div></Card>}
      {tab === 'reviews' && <Card title="Trainer Reviews & Assessment"><div className="space-y-2">{studentReviewsForRecord.map(review => <div key={review.id} className="p-4 rounded-xl border border-slate-100"><div className="flex justify-between"><p className="font-bold text-sm">{review.unit_title || review.unit_code || review.level || 'Assessment'}</p><span className="text-xs font-bold">{review.score ?? '—'}</span></div><p className="text-xs text-slate-500 mt-1">{review.review || review.comment || ''}</p></div>)}{!studentReviewsForRecord.length && <Empty text="No trainer assessment has been recorded yet." />}</div></Card>}
    </main>
  </div>;
}

function Metric({ label, value }) { return <div className="bg-slate-50 rounded-xl px-4 py-3 min-w-20"><p className="text-[10px] uppercase font-bold text-slate-400">{label}</p><p className="text-lg font-black mt-1">{value}</p></div>; }
function Card({ title, children }) { return <section className="bg-white rounded-2xl border border-slate-200 p-5"><h2 className="font-black text-lg mb-4">{title}</h2>{children}</section>; }
function Empty({ text }) { return <p className="text-sm text-slate-400 py-5">{text}</p>; }
