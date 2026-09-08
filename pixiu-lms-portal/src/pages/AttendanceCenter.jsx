import { useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, Filter, Save, Users } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import RefreshButton from '../components/ui/RefreshButton';

const today = () => new Date().toISOString().slice(0, 10);
const statusOf = value => String(value || '').toLowerCase();
const presentLike = value => ['present', 'late'].includes(statusOf(value));
const same = (a, b) => String(a ?? '').toUpperCase() === String(b ?? '').toUpperCase();

async function post(path, body) {
  const response = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || `Request failed (${response.status})`);
  return data;
}

export default function AttendanceCenter() {
  const { user } = useAuth();
  const { schools = [], classes = [], trainers = [], students = [], sessions = [], attendance = [], refreshAll, loading } = useData();
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [marks, setMarks] = useState({});
  const [schoolFilter, setSchoolFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [trainerFilter, setTrainerFilter] = useState('');
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const trainerIds = useMemo(() => new Set([user?.id, user?.related_id, user?.username].filter(Boolean).map(String)), [user]);
  const mySessions = useMemo(() => sessions.filter(session => trainerIds.has(String(session.trainer || session.trainer_id))), [sessions, trainerIds]);
  const todaySessions = useMemo(() => mySessions.filter(session => String(session.date || '').slice(0, 10) === date && !['completed', 'cancelled'].includes(statusOf(session.status))), [mySessions, date]);
  const selectedSession = sessions.find(session => String(session.id) === String(selectedSessionId)) || null;
  const sessionClassId = String(selectedSession?.school_class || selectedSession?.class_id || '');
  const roster = useMemo(() => students.filter(student => String(student.school_class || student.class_id || '') === sessionClassId), [students, sessionClassId]);

  const classIdsForSchool = useMemo(() => {
    if (!schoolFilter) return null;
    return new Set(classes.filter(item => same(item.school_code || item.school_id, schoolFilter)).map(item => String(item.id)));
  }, [classes, schoolFilter]);
  const filteredRecords = useMemo(() => attendance.filter(record => {
    if (schoolFilter && !same(record.school_code || record.school_id, schoolFilter)) return false;
    if (classFilter && !same(record.school_class || record.class_id, classFilter)) return false;
    if (trainerFilter && !same(record.trainer_id || record.trainer, trainerFilter)) return false;
    const d = String(record.date || '').slice(0, 10);
    if (user?.role === 'school' && date && d !== date) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (search && !String(record.student_name || record.student_id || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [attendance, schoolFilter, classFilter, trainerFilter, user?.role, date, from, to, search]);
  const filteredClasses = useMemo(() => classIdsForSchool ? classes.filter(item => classIdsForSchool.has(String(item.id))) : classes, [classes, classIdsForSchool]);
  const filteredTrainers = useMemo(() => {
    if (!classIdsForSchool) return trainers;
    const ids = new Set(sessions.filter(session => classIdsForSchool.has(String(session.school_class || session.class_id))).map(session => String(session.trainer || session.trainer_id)));
    return trainers.filter(trainer => ids.has(String(trainer.id)) || ids.has(String(trainer.trainer_id)));
  }, [trainers, sessions, classIdsForSchool]);

  const selectSession = session => {
    setSelectedSessionId(session.id);
    const next = {};
    attendance.filter(record => String(record.session || record.session_id) === String(session.id)).forEach(record => {
      next[String(record.student || record.student_id)] = statusOf(record.status);
    });
    setMarks(next);
    setError('');
  };
  const startSession = async () => {
    if (!selectedSession) return;
    setSaving(true); setError('');
    try { await post(`/sessions/${selectedSession.id}/start`, {}); await refreshAll(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const saveAttendance = async () => {
    if (!selectedSession) return false;
    setSaving(true); setError('');
    try {
      if (!roster.length) throw new Error('No students are assigned to this session class.');
      const entries = roster.map(student => ({ student: student.id, status: statusOf(marks[String(student.id)] || marks[String(student.student_id)] || 'absent') }));
      await post('/attendance/bulk', { session: selectedSession.id, entries });
      await refreshAll();
      return true;
    } catch (err) { setError(err.message); return false; } finally { setSaving(false); }
  };
  const complete = async () => { if (await saveAttendance()) { setSaving(true); try { await post(`/sessions/${selectedSession.id}/complete`, {}); await refreshAll(); setSelectedSessionId(''); } catch (err) { setError(err.message); } finally { setSaving(false); } } };

  if (user?.role === 'trainer') return <div className="space-y-5 pb-10"><PageHeader eyebrow="Trainer" title="Attendance" description="Use the canonical session roster to record attendance, then complete and lock the session." actions={<RefreshButton onRefresh={refreshAll} loading={loading || saving} />} /><section className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5"><div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 border-b border-slate-100"><p className="font-black">Today’s classes</p><p className="text-xs text-slate-400 mt-1">{todaySessions.length} session(s)</p></div><div className="divide-y divide-slate-100">{todaySessions.map(session => <button key={session.id} type="button" onClick={() => selectSession(session)} className={`w-full text-left p-4 hover:bg-slate-50 ${same(selectedSessionId, session.id) ? 'bg-blue-50' : ''}`}><p className="text-sm font-black">{session.topic || 'Scheduled class'}</p><p className="text-xs text-slate-500 mt-1">{session.class_name || session.class_id || 'Class'} · {session.start_time || '—'}</p><span className="inline-flex mt-2 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{session.status}</span></button>)}{!todaySessions.length && <EmptyState icon={<CalendarDays size={19}/>} title="No classes today" description="Assigned sessions will appear here."/>}</div></div><div className="space-y-4">{error && <ErrorState title="Attendance action failed" description={error}/>} {!selectedSession && <EmptyState icon={<Users size={20}/>} title="Select a class" description="Choose a session to manage its canonical student roster."/>}{selectedSession && <><section className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-[10px] uppercase tracking-widest text-blue-600 font-black">Session</p><h2 className="text-xl font-black mt-1">{selectedSession.topic || 'Class session'}</h2><p className="text-xs text-slate-500 mt-1">{selectedSession.class_name || selectedSession.class_id} · {selectedSession.date} · {selectedSession.start_time}</p></div><div className="flex gap-2">{statusOf(selectedSession.status) === 'planned' && <button type="button" disabled={saving} onClick={startSession} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-50">Start class</button>}{statusOf(selectedSession.status) === 'in_progress' && <button type="button" disabled={saving} onClick={saveAttendance} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-50"><Save size={14}/> Save attendance</button>}</div></section><section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 bg-slate-50 border-b border-slate-200"><p className="text-xs font-black">Student roster</p><p className="text-[11px] text-slate-400 mt-1">All active roster members are submitted together.</p></div><div className="divide-y divide-slate-100">{roster.map(student => { const key = String(student.id); const current = statusOf(marks[key] || marks[String(student.student_id)] || ''); return <div key={student.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-sm font-bold">{student.name}</p><p className="text-[10px] font-mono text-slate-400">{student.student_id} · Roll {student.roll_number}</p></div><div className="flex flex-wrap gap-1.5">{['present','late','absent','excused'].map(option => <button key={option} type="button" disabled={saving || statusOf(selectedSession.status) !== 'in_progress'} onClick={() => setMarks(prev => ({ ...prev, [key]: option }))} className={`px-3 py-1.5 rounded-lg text-[11px] font-black capitalize ${current === option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-50`}>{option}</button>)}</div></div>; })}{!roster.length && <EmptyState icon={<Users size={18}/>} title="No roster" description="This session has no students assigned through its class."/>}</div></section>{statusOf(selectedSession.status) === 'in_progress' && <button type="button" disabled={saving} onClick={complete} className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-black disabled:opacity-50">Complete & lock session</button>}</>}</div></section></div>;

  return <div className="space-y-5 pb-10"><PageHeader eyebrow={user?.role === 'admin' ? 'Network' : 'School'} title="Attendance Overview" description="Review canonical AttendanceRecord data by school, class, trainer and date." actions={<RefreshButton onRefresh={refreshAll} loading={loading} />} />{error && <ErrorState title="Attendance query failed" description={error}/>}<section className="bg-white border border-slate-200 rounded-2xl p-4"><div className="flex items-center gap-2 mb-4"><Filter size={16} className="text-slate-400"/><p className="text-xs font-black uppercase tracking-wide text-slate-500">Filters</p></div><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">{user?.role === 'admin' && <select value={schoolFilter} onChange={e => { setSchoolFilter(e.target.value); setClassFilter(''); setTrainerFilter(''); }} className="field"><option value="">All schools</option>{schools.map(s => <option key={s.id} value={s.school_code || s.id}>{s.name} ({s.school_code})</option>)}</select>}<select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="field"><option value="">All classes</option>{filteredClasses.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}</select>{user?.role === 'admin' && <select value={trainerFilter} onChange={e => setTrainerFilter(e.target.value)} className="field"><option value="">All trainers</option>{filteredTrainers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trainer_id || t.id})</option>)}</select>}<input type="date" value={user?.role === 'school' ? date : from} onChange={e => user?.role === 'school' ? setDate(e.target.value) : setFrom(e.target.value)} className="field"/>{user?.role === 'admin' && <input type="date" value={to} onChange={e => setTo(e.target.value)} className="field"/>}<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student" className="field"/></div></section><section className="grid grid-cols-2 sm:grid-cols-4 gap-3"><div className="metric"><p>Records</p><strong>{filteredRecords.length}</strong></div><div className="metric"><p>Present / Late</p><strong>{filteredRecords.filter(r => presentLike(r.status)).length}</strong></div><div className="metric"><p>Absent</p><strong>{filteredRecords.filter(r => statusOf(r.status) === 'absent').length}</strong></div><div className="metric"><p>Excused</p><strong>{filteredRecords.filter(r => statusOf(r.status) === 'excused').length}</strong></div></section><section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Date','School','Class','Student','Trainer','Status','Marked at'].map(head => <th key={head} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400 font-black">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredRecords.map(record => <tr key={record.id}><td className="px-4 py-3">{String(record.date || '').slice(0,10)}</td><td className="px-4 py-3">{record.school_code || '—'}</td><td className="px-4 py-3">{record.class_name || '—'}</td><td className="px-4 py-3"><p className="font-bold">{record.student_name || record.student_id || '—'}</p><p className="text-[10px] text-slate-400">#{record.roll_number || '—'}</p></td><td className="px-4 py-3">{record.trainer_id || '—'}</td><td className="px-4 py-3"><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{statusOf(record.status)}</span></td><td className="px-4 py-3 text-slate-500">{record.marked_at ? new Date(record.marked_at).toLocaleString() : '—'}</td></tr>)}{!filteredRecords.length && <tr><td colSpan={7}><EmptyState icon={<Check size={18}/>} title="No attendance records" description="No canonical records match the current filters."/></td></tr>}</tbody></table></div></section><style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.metric{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:14px}.metric p{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:800}.metric strong{display:block;margin-top:5px;font-size:24px;color:#0f172a}`}</style></div>;
}
