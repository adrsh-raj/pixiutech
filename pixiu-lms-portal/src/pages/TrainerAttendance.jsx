import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, Save, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const norm = value => String(value ?? '').trim().toLowerCase();

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || payload.message || `Request failed (${response.status})`);
  return payload;
}

export default function TrainerAttendance() {
  const { user } = useAuth();
  const { sessions = [], students = [], attendance = [], refreshAll, loading, endpointErrors = {} } = useData();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(() => searchParams.get('session') || '');
  const [marks, setMarks] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const todaySessions = useMemo(() => sessions.filter(session => String(session.date || '').slice(0, 10) === today() && !['completed', 'cancelled'].includes(norm(session.status))), [sessions]);
  const requestedSessionId = searchParams.get('session') || '';
  const selectedSession = sessions.find(session => String(session.id) === String(selectedId)) || null;
  const classId = selectedSession?.school_class || selectedSession?.class_id || '';
  const roster = useMemo(() => students.filter(student => String(student.class_id || student.school_class) === String(classId) && norm(student.status || 'active') === 'active'), [students, classId]);
  const dataError = endpointErrors['/sessions'] || endpointErrors['/students'] || '';

  useEffect(() => {
    if (!requestedSessionId) return;
    const match = sessions.find(session => String(session.id) === String(requestedSessionId));
    if (match) setSelectedId(match.id);
  }, [requestedSessionId, sessions]);

  useEffect(() => {
    if (!selectedSession) return;
    const existing = {};
    attendance.filter(row => String(row.session || row.session_id) === String(selectedSession.id)).forEach(row => {
      existing[String(row.student || row.student_id)] = norm(row.status);
    });
    setMarks(existing);
  }, [selectedSession?.id, attendance]);

  const selectSession = session => {
    setSelectedId(session.id);
    setError('');
  };

  const start = async () => {
    if (!selectedSession) return;
    setBusy(true); setError('');
    try { await request(`/sessions/${encodeURIComponent(selectedSession.id)}/start`, 'POST', {}); await refreshAll(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const save = async complete => {
    if (!selectedSession) return;
    if (!roster.length) { setError('This class has no active students in the database.'); return; }
    setBusy(true); setError('');
    try {
      const entries = roster.map(student => ({ student: student.id, status: norm(marks[String(student.id)] || marks[String(student.student_id)] || 'absent') }));
      await request('/attendance/bulk', 'POST', { session: selectedSession.id, entries });
      if (complete) await request(`/sessions/${encodeURIComponent(selectedSession.id)}/complete`, 'POST', {});
      await refreshAll();
      if (complete) setSelectedId('');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (user?.role !== 'trainer') return null;

  return <div className="space-y-6 pb-10">
    <PageHeader eyebrow="Trainer" title="Attendance" description="Each scheduled class occurrence has its own attendance register. The selected curriculum topic is only used to group occurrences in progress." actions={<RefreshButton onRefresh={refreshAll} loading={loading || busy} />} />
    {dataError && <ErrorState title="Attendance data could not be fully loaded" description={dataError} onRetry={refreshAll} />}
    {error && <ErrorState title="Attendance action failed" description={error} onRetry={() => setError('')} />}
    {!selectedSession ? <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">Today's sessions</h2><p className="text-xs text-slate-400 mt-1">{todaySessions.length} active session{todaySessions.length === 1 ? '' : 's'}</p></div><Link to="/sessions" className="text-xs font-black text-blue-600">Open schedule →</Link></div>{todaySessions.length === 0 ? <div className="p-12"><EmptyState icon={<CalendarDays size={20}/>} title="No sessions scheduled today" description="A session returned by the server for this trainer will appear here."/><div className="flex justify-center mt-5"><Link to="/sessions" className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">Go to Sessions</Link></div></div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">{todaySessions.map(session => <button key={session.id} type="button" onClick={() => selectSession(session)} className="text-left p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-blue-600 uppercase">{session.class_name || session.class_id || 'Class'}</p><h3 className="font-black text-slate-900 mt-1">{session.topic || 'Class session'}</h3></div><Clock3 size={17} className="text-slate-400"/></div><p className="text-xs text-slate-500 mt-3">{session.start_time || 'Time not set'} · {session.status}</p></button>)}</div>}</section> : <>
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-blue-600">Session</p><h2 className="text-2xl font-black text-slate-900 mt-1">{selectedSession.topic || 'Class session'}</h2><p className="text-sm text-slate-500 mt-1">{selectedSession.class_name || selectedSession.class_id || 'Class'} · {selectedSession.date} · {selectedSession.start_time || 'Time not set'}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || norm(selectedSession.status) !== 'planned'} onClick={start} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-40">Start class</button><button type="button" disabled={busy || norm(selectedSession.status) !== 'in_progress' || !roster.length} onClick={() => save(false)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-40"><Save size={14}/> Save attendance</button></div></section>
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100"><div className="flex items-center gap-2"><Users size={17} className="text-blue-600"/><h2 className="font-black text-slate-900">Student roster</h2></div><p className="text-xs text-slate-400 mt-1">{roster.length} active students · one record per student for this exact class occurrence.</p></div>{roster.length === 0 ? <div className="p-12"><EmptyState icon={<Users size={20}/>} title="No active students" description="The selected session class has no active student records."/></div> : <div className="divide-y divide-slate-100">{roster.map(student => { const current = norm(marks[String(student.id)] || marks[String(student.student_id)] || ''); return <div key={student.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="font-bold text-slate-900">{student.name}</p><p className="text-[10px] font-mono text-slate-400">{student.student_id} · Roll {student.roll_number}</p></div><div className="flex flex-wrap gap-1.5">{['present','late','absent','excused'].map(option => <button key={option} type="button" disabled={busy || norm(selectedSession.status) !== 'in_progress'} onClick={() => setMarks(previous => ({ ...previous, [String(student.id)]: option }))} className={`px-3 py-1.5 rounded-lg text-[11px] font-black capitalize ${current === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-40`}>{option}</button>)}</div></div>; })}</div>}</section>
      {norm(selectedSession.status) === 'in_progress' && <button type="button" disabled={busy || !roster.length} onClick={() => save(true)} className="w-full py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-black disabled:opacity-40"><Check size={16} className="inline mr-2"/>Save attendance & complete session</button>}
      <button type="button" onClick={() => setSelectedId('')} className="text-xs font-black text-slate-500 hover:text-slate-900">← Back to today’s sessions</button>
    </>}
  </div>;
}
