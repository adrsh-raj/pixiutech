import { useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Check, Clock3, GraduationCap, Play, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

function parseIds(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  const raw = String(value || '').trim();
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean); } catch {}
  return raw.split(/[\s,;|]+/).map(v => v.trim()).filter(Boolean);
}

function schoolKeys(school) {
  return [school?.id, school?.school_code, school?.code, school?.school_id].filter(Boolean).map(v => String(v).toUpperCase());
}

export default function TrainerWorkspace() {
  const { user } = useAuth();
  const { trainers = [], schools = [], classes = [], students = [], sessions = [], attendance = [], markAttendance, completeSession } = useData();
  const toast = useToast();
  const [activeSessionId, setActiveSessionId] = useState(null);

  const trainerId = user?.related_id || user?.username || user?.id;
  const trainer = useMemo(() => trainers.find(t => [t.id, t.trainer_id, t.account_username].some(value => String(value || '') === String(trainerId || ''))), [trainers, trainerId]);
  const assignedSchoolIds = useMemo(() => parseIds(trainer?.assigned_schools || user?.school_id), [trainer, user]);

  const visibleStudents = useMemo(() => students.filter(student => {
    const studentSchool = String(student.school_id || student.school_code || '').toUpperCase();
    return assignedSchoolIds.length === 0 || assignedSchoolIds.some(id => schoolKeys({ id }).includes(studentSchool) || studentSchool === String(id).toUpperCase());
  }), [students, assignedSchoolIds]);

  const visibleSessions = useMemo(() => sessions.filter(session => {
    const sessionTrainer = String(session.trainer_id || session.trainer || '').toUpperCase();
    const sessionSchool = String(session.school_id || session.school_code || '').toUpperCase();
    return sessionTrainer === String(trainerId || '').toUpperCase() || assignedSchoolIds.some(id => sessionSchool === String(id).toUpperCase());
  }), [sessions, trainerId, assignedSchoolIds]);

  const upcomingSessions = visibleSessions.filter(s => !['Completed', 'completed', 'Cancelled', 'cancelled'].includes(s.status)).slice(0, 8);
  const activeSession = visibleSessions.find(s => String(s.id) === String(activeSessionId)) || null;
  const sessionClass = activeSession ? classes.find(c => String(c.id) === String(activeSession.class_id) || (String(c.class_id || '').toUpperCase() === String(activeSession.class_id || '').toUpperCase())) : null;
  const sessionRoster = activeSession ? visibleStudents.filter(s => String(s.class_id || '').toUpperCase() === String(activeSession.class_id || '').toUpperCase() || String(s.school_class || '') === String(activeSession.class_id || '')) : [];

  const getStatus = studentId => attendance.find(a => String(a.session_id) === String(activeSessionId) && String(a.student_id).toUpperCase().replace(/\s+/g, '') === String(studentId).toUpperCase().replace(/\s+/g, ''))?.status;
  const mark = async (studentId, status) => {
    const result = await markAttendance(activeSessionId, studentId, status);
    if (result?.success === false) toast.error(result.error || 'Attendance could not be saved.');
  };

  if (activeSession) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-slate-900 text-white rounded-2xl p-5"><button onClick={() => setActiveSessionId(null)} className="text-xs text-slate-300 hover:text-white mb-3">← Back to Trainer Workspace</button><p className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">Live Classroom</p><h1 className="text-xl font-bold mt-1">{sessionClass ? `Class ${sessionClass.grade}${sessionClass.section || ''}` : activeSession.class_id}</h1><p className="text-sm text-slate-300 mt-1">{activeSession.topic || 'Scheduled class'}</p><div className="flex gap-3 mt-3 text-xs text-slate-400"><span>{activeSession.date || 'No date'}</span><span>•</span><span>{activeSession.time || 'No time'}</span><span>•</span><span>{sessionRoster.length} students</span></div></div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between"><div><p className="font-bold text-slate-800 text-sm">Attendance</p><p className="text-xs text-slate-500">Mark the current classroom roster.</p></div><button onClick={async () => { for (const student of sessionRoster) await mark(student.student_id, 'Present'); toast.success('All students marked present.'); }} className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-1.5"><Check size={14}/> Mark All Present</button></div>
        <div className="space-y-2">{sessionRoster.map(student => { const status = getStatus(student.student_id); return <div key={student.student_id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between"><div><p className="font-bold text-slate-800 text-sm">{student.name}</p><p className="font-mono text-[10px] text-slate-400">{student.student_id}</p></div><div className="flex gap-2"><button onClick={() => mark(student.student_id, 'Present')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${status === 'Present' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>Present</button><button onClick={() => mark(student.student_id, 'Absent')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${status === 'Absent' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'}`}>Absent</button></div></div>; })}</div>
        <button onClick={async () => { const result = await completeSession(activeSession.id); if (result?.success !== false) { toast.success('Session completed and attendance locked.'); setActiveSessionId(null); } else toast.error(result.error || 'Could not complete session.'); }} className="w-full py-3 rounded-xl bg-pixiu-blue text-white font-bold text-sm">Complete & Lock Session</button>
      </div>
    );
  }

  const assignedSchools = schools.filter(school => assignedSchoolIds.some(id => schoolKeys(school).includes(String(id).toUpperCase())));

  return (
    <div className="pb-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-widest text-pixiu-blue font-bold">Trainer Workspace</p><h1 className="text-2xl font-bold text-slate-900 mt-1">Welcome, {trainer?.name || user?.name || 'Trainer'}</h1><p className="text-sm text-slate-500 mt-1">Your schools, students and sessions are loaded from current database assignments.</p></div><div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl"><GraduationCap size={15}/> {assignedSchoolIds.length} assigned school{assignedSchoolIds.length === 1 ? '' : 's'}</div></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div className="bg-white border border-slate-200 rounded-2xl p-5"><Users size={18} className="text-blue-600"/><p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-3">My Students</p><p className="text-2xl font-extrabold mt-1">{visibleStudents.length}</p></div><div className="bg-white border border-slate-200 rounded-2xl p-5"><CalendarDays size={18} className="text-emerald-600"/><p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-3">Assigned Classes</p><p className="text-2xl font-extrabold mt-1">{new Set(visibleStudents.map(s => s.class_id)).size}</p></div><div className="bg-white border border-slate-200 rounded-2xl p-5"><Clock3 size={18} className="text-violet-600"/><p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-3">Open Sessions</p><p className="text-2xl font-extrabold mt-1">{upcomingSessions.length}</p></div></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-200"><h2 className="font-bold text-slate-800 flex items-center gap-2"><CalendarDays size={17} className="text-pixiu-blue"/> Upcoming Sessions</h2></div><div className="divide-y divide-slate-100">{upcomingSessions.length === 0 ? <div className="p-8 text-center text-xs text-slate-400">No upcoming sessions assigned.</div> : upcomingSessions.map(session => <div key={session.id} className="p-4 flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{session.topic || 'Scheduled class'}</p><p className="text-[11px] text-slate-500 mt-1">{session.date || 'No date'} • {session.time || 'No time'}</p><p className="text-[10px] font-mono text-slate-400 mt-1">{session.class_id || 'No class'} • {session.school_id || 'No school'}</p></div><button onClick={() => setActiveSessionId(session.id)} className="shrink-0 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold flex items-center gap-1.5"><Play size={13}/> Open</button></div>)}</div></div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-200"><h2 className="font-bold text-slate-800 flex items-center gap-2"><Users size={17} className="text-pixiu-blue"/> Assigned Schools</h2></div><div className="p-4 grid grid-cols-1 gap-2">{assignedSchools.length === 0 ? <p className="p-4 text-xs text-slate-400">No school assignment is configured for this trainer account.</p> : assignedSchools.map(school => <div key={school.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200"><p className="font-bold text-sm text-slate-800">{school.name}</p><p className="text-[10px] font-mono text-slate-400 mt-1">{school.school_code || school.code}</p></div>)}</div></div></div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h3 className="font-bold text-blue-950 flex items-center gap-2"><BookOpen size={17}/> Teaching Materials</h3><p className="text-xs text-blue-800/70 mt-1">Admin-sent lesson PDFs and trainer guides are available in Trainer Teaching Materials.</p></div><a href="/trainer-materials" className="px-3 py-2 rounded-lg bg-white text-blue-700 border border-blue-200 text-xs font-bold">Open Materials</a></div>
    </div>
  );
}
