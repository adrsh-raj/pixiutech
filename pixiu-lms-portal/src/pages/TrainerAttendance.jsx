import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, Save, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const today = () => new Date().toISOString().slice(0, 10);
const norm = value => String(value ?? '').trim().toLowerCase();
const list = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];

async function request(path, body) {
  const response = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || `Request failed (${response.status})`);
  return payload;
}

export default function TrainerAttendance() {
  const { user } = useAuth();
  const { trainers = [], sessions = [], students = [], attendance = [], refreshAll, loading } = useData();
  const [selectedId, setSelectedId] = useState('');
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const trainer = useMemo(() => {
    const keys = [user?.id, user?.related_id, user?.username].filter(Boolean).map(String);
    return trainers.find(item => [item.id, item.trainer_id, item.account_username].filter(Boolean).some(value => keys.includes(String(value)))) || null;
  }, [trainers, user]);

  const trainerKeys = useMemo(() => new Set([trainer?.id, trainer?.trainer_id, user?.id, user?.related_id, user?.username].filter(Boolean).map(String)), [trainer, user]);
  const todaySessions = useMemo(() => sessions.filter(session => trainerKeys.has(String(session.trainer || session.trainer_id)) && String(session.date || '').slice(0, 10) === today() && !['completed', 'cancelled'].includes(norm(session.status))), [sessions, trainerKeys]);
  const selectedSession = sessions.find(session => String(session.id) === String(selectedId)) || null;
  const classId = selectedSession?.school_class || selectedSession?.class_id || '';
  const roster = useMemo(() => students.filter(student => String(student.class_id || student.school_class) === String(classId) && norm(student.status || 'active') === 'active'), [students, classId]);

  const selectSession = session => {
    setSelectedId(session.id); setError('');
    const next = {};
    attendance.filter(row => String(row.session || row.session_id) === String(session.id)).forEach(row => { next[String(row.student || row.student_id)] = norm(row.status); });
    setMarks(next);
  };

  useEffect(() => {
    if (!selectedSession) return;
    attendance.filter(row => String(row.session || row.session_id) === String(selectedSession.id)).forEach(row => setMarks(previous => ({ ...previous, [String(row.student || row.student_id)]: norm(row.status) })));
  }, [selectedSession?.id, attendance]);

  const save = async complete => {
    if (!selectedSession) return;
    if (!roster.length) { setError('This class has no active students in the database.'); return; }
    setBusy(true); setError('');
    try {
      const entries = roster.map(student => ({ student: student.id, status: norm(marks[String(student.id)] || marks[String(student.student_id)] || 'absent') }));
      await request('/attendance/bulk', { session: selectedSession.id, entries });
      if (complete) await request(`/sessions/${selectedSession.id}/complete`, {});
      await refreshAll();
      if (complete) setSelectedId('');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return <div className="space-y-6 pb-10">
    <PageHeader eyebrow="Trainer" title="Attendance" description="Take attendance from the scheduled session roster. Saved records come directly from the database." actions={<RefreshButton onRefresh={refreshAll} loading={loading || busy} />} />
    {error && <ErrorState title="Attendance action failed" description={error} />}
    {!selectedSession ? <>
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">Today's sessions</h2><p className="text-xs text-slate-400 mt-1">{todaySessions.length} scheduled session{todaySessions.length === 1 ? '' : 's'}</p></div><Link to="/sessions" className="text-xs font-black text-blue-600">Open schedule →</Link></div>{todaySessions.length === 0 ? <div className="p-12"><EmptyState icon={<CalendarDays size={20}/>} title="No sessions scheduled today" description="When a session is scheduled for this trainer, it will appear here ready for attendance."/><div className="flex justify-center mt-5"><Link to="/sessions" className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">Go to Sessions</Link></div></div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">{todaySessions.map(session => <button key={session.id} type="button" onClick={() => selectSession(session)} className="text-left p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-blue-600 uppercase">{session.class_name || session.class_id || 'Class'}</p><h3 className="font-black text-slate-900 mt-1">{session.topic || 'Class session'}</h3></div><Clock3 size={17} className="text-slate-400"/></div><p className="text-xs text-slate-500 mt-3">{session.start_time || 'Time not set'} · {session.status}</p></button>)}</div>}</section>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Metric label="Trainer" value={trainer?.trainer_id || '—'}/><Metric label="Assigned classes" value={new Set(sessions.filter(session => trainerKeys.has(String(session.trainer || session.trainer_id))).map(session => String(session.school_class || session.class_id || ''))).size}/><Metric label="Students in scope" value={students.length}/></section>
    </> : <>
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-blue-600">Session</p><h2 className="text-2xl font-black text-slate-900 mt-1">{selectedSession.topic || 'Class session'}</h2><p className="text-sm text-slate-500 mt-1">{selectedSession.class_name || selectedSession.class_id} · {selectedSession.date} · {selectedSession.start_time || 'Time not set'}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || norm(selectedSession.status) !== 'planned'} onClick={async () => { setBusy(true); setError(''); try { await request(`/sessions/${selectedSession.id}/start`, {}); await refreshAll(); } catch (err) { setError(err.message); } finally { setBusy(false); } }} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-40">Start class</button><button type="button" disabled={busy || norm(selectedSession.status) !== 'in_progress' || !roster.length} onClick={() => save(false)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-40"><Save size={14}/> Save attendance</button></div></section>
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100"><div className="flex items-center gap-2"><Users size={17} className="text-blue-600"/><h2 className="font-black text-slate-900">Student roster</h2></div><p className="text-xs text-slate-400 mt-1">{roster.length} active students · choose one attendance status per student.</p></div>{roster.length === 0 ? <div className="p-12"><EmptyState icon={<Users size={20}/>} title="No active students" description="Create or activate students in this class before taking attendance."/></div> : <div className="divide-y divide-slate-100">{roster.map(student => { const current = norm(marks[String(student.id)] || marks[String(student.student_id)] || ''); return <div key={student.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="font-bold text-slate-900">{student.name}</p><p className="text-[10px] font-mono text-slate-400">{student.student_id} · Roll {student.roll_number}</p></div><div className="flex flex-wrap gap-1.5">{['present','late','absent','excused'].map(option => <button key={option} type="button" disabled={busy || norm(selectedSession.status) !== 'in_progress'} onClick={() => setMarks(previous => ({ ...previous, [String(student.id)]: option }))} className={`px-3 py-1.5 rounded-lg text-[11px] font-black capitalize ${current === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-40`}>{option}</button>)}</div></div>; })}</div>}</section>
      {norm(selectedSession.status) === 'in_progress' && <button type="button" disabled={busy || !roster.length} onClick={() => save(true)} className="w-full py-3.5 rounded-xl bg-blue-600 text-white text-sm font-black disabled:opacity-40"><Check size={16} className="inline mr-2"/>Save attendance & complete session</button>}
      <button type="button" onClick={() => setSelectedId('')} className="text-xs font-black text-slate-500 hover:text-slate-900">← Back to today’s sessions</button>
    </>}
  </div>;
}
function Metric({ label, value }) { return <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-[9px] uppercase tracking-wide font-black text-slate-400">{label}</p><p className="text-xl font-black text-slate-900 mt-2 break-words">{value}</p></div>; }
