import { useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, Filter, Save, Users } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import RefreshButton from '../components/ui/RefreshButton';

const today = () => new Date().toISOString().slice(0, 10);
const normalizeStatus = value => String(value || '').toLowerCase();
const presentLike = value => ['present', 'late'].includes(normalizeStatus(value));

async function postJson(path, body) {
  const response = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || 'Request failed.');
  return data;
}

export default function AttendanceCenter() {
  const { user } = useAuth();
  const { schools = [], classes = [], trainers = [], students = [], sessions = [], attendance = [], refreshAll, loading } = useData();
  const role = user?.role;
  const [sessionId, setSessionId] = useState('');
  const [statuses, setStatuses] = useState({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [date, setDate] = useState(today());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const myTrainer = useMemo(() => trainers.find(t => String(t.account_username || t.trainer_id || t.id).toUpperCase() === String(user?.related_id || user?.username || user?.id).toUpperCase()), [trainers, user]);
  const trainerSessions = useMemo(() => {
    const idSet = new Set([myTrainer?.id, myTrainer?.trainer_id, user?.related_id, user?.username, user?.id].filter(Boolean).map(v => String(v).toUpperCase()));
    return sessions.filter(s => idSet.has(String(s.trainer_id || s.trainer || '').toUpperCase()));
  }, [sessions, myTrainer, user]);
  const todaySessions = useMemo(() => trainerSessions.filter(s => String(s.date || '').slice(0, 10) === date && !['completed', 'cancelled'].includes(normalizeStatus(s.status))), [trainerSessions, date]);
  const selectedSession = sessions.find(s => String(s.id) === String(sessionId)) || null;
  const selectedSessionStudents = useMemo(() => selectedSession ? students.filter(st => String(st.class_id || '') === String(selectedSession.school_class || selectedSession.class_id || '')) : [], [students, selectedSession]);

  const filteredRecords = useMemo(() => attendance.filter(record => {
    if (selectedSchool && String(record.school_code || '').toUpperCase() !== selectedSchool.toUpperCase()) return false;
    if (selectedClass && String(record.class_id || '') !== String(selectedClass)) return false;
    if (selectedTrainer && String(record.trainer_id || '').toUpperCase() !== selectedTrainer.toUpperCase()) return false;
    const d = String(record.date || '').slice(0, 10);
    if (role === 'school' && date && d !== date) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    if (studentFilter && !String(record.student_name || record.student_id || '').toLowerCase().includes(studentFilter.toLowerCase())) return false;
    return true;
  }), [attendance, selectedSchool, selectedClass, selectedTrainer, role, date, dateFrom, dateTo, studentFilter]);

  const classesForSchool = useMemo(() => selectedSchool ? classes.filter(c => String(c.school_code || c.school_id || '').toUpperCase() === selectedSchool.toUpperCase()) : classes, [classes, selectedSchool]);
  const trainersForSchool = useMemo(() => selectedSchool ? trainers.filter(t => (t.assigned_schools || []).map(String).some(x => x.toUpperCase() === selectedSchool.toUpperCase())) : trainers, [trainers, selectedSchool]);

  const selectSession = session => {
    setSessionId(session.id);
    const existing = attendance.filter(a => String(a.session) === String(session.id));
    const map = {};
    existing.forEach(a => { map[String(a.student)] = normalizeStatus(a.status); map[String(a.student_id)] = normalizeStatus(a.status); });
    setStatuses(map);
    setError('');
  };

  const startSelectedSession = async () => {
    if (!selectedSession) return;
    setSaving(true); setError('');
    try {
      await postJson(`/sessions/${selectedSession.id}/start`, {});
      await refreshAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const saveAttendance = async () => {
    if (!selectedSession) return;
    setSaving(true); setError('');
    try {
      const roster = students.filter(st => String(st.class_id || '') === String(selectedSession.school_class || selectedSession.class_id || ''));
      if (!roster.length) throw new Error('No active students are available for this session class.');
      const entries = roster.map(st => ({ student: st.id, status: statuses[String(st.id)] || statuses[String(st.student_id)] || 'absent' }));
      await postJson('/attendance/bulk', { session: selectedSession.id, entries });
      await refreshAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (role === 'trainer') {
    return <div className="space-y-5 pb-10">
      <PageHeader eyebrow="Trainer" title="Attendance" description="Start today’s class, mark the complete roster, then save one authoritative attendance record per student." actions={<RefreshButton onRefresh={refreshAll} loading={loading} />} />
      <section className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100"><p className="font-black text-slate-900">Today’s classes</p><p className="text-xs text-slate-400 mt-1">{todaySessions.length} session(s)</p></div>
          <div className="divide-y divide-slate-100">
            {todaySessions.map(s => <button key={s.id} type="button" onClick={() => selectSession(s)} className={`w-full text-left p-4 hover:bg-slate-50 ${String(sessionId) === String(s.id) ? 'bg-blue-50' : ''}`}><p className="text-sm font-black text-slate-800">{s.topic || 'Scheduled class'}</p><p className="text-xs text-slate-500 mt-1">{s.class_name || s.class_id} · {s.start_time || s.time}</p><span className="inline-flex mt-2 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{s.status}</span></button>)}
            {!todaySessions.length && <EmptyState icon={<CalendarDays size={19}/>} title="No classes today" description="Scheduled sessions assigned to you will appear here."/>}
          </div>
        </div>
        <div className="space-y-4">
          {error && <ErrorState title="Attendance action failed" description={error} />}
          {!selectedSession && <EmptyState icon={<Users size={20}/>} title="Select a class" description="Choose a class from today’s schedule to manage attendance."/>}
          {selectedSession && <>
            <section className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.16em] text-blue-600 font-black">Session</p><h2 className="text-xl font-black mt-1">{selectedSession.topic || 'Class session'}</h2><p className="text-xs text-slate-500 mt-1">{selectedSession.class_name} · {selectedSession.date} · {selectedSession.start_time}</p></div><div className="flex gap-2">{normalizeStatus(selectedSession.status) === 'planned' && <button type="button" disabled={saving} onClick={startSelectedSession} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-50">Start class</button>}{normalizeStatus(selectedSession.status) === 'in_progress' && <button type="button" disabled={saving} onClick={saveAttendance} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-50"><Save size={14}/> Save attendance</button>}</div></section>
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 bg-slate-50 border-b border-slate-200"><p className="text-xs font-black text-slate-700">Student list</p><p className="text-[11px] text-slate-400 mt-1">Use Present, Late, Absent or Excused. Save submits the full active roster together.</p></div><div className="divide-y divide-slate-100">{students.filter(st => String(st.class_id || '') === String(selectedSession.school_class || selectedSession.class_id || '')).map(st => { const key=String(st.id); const current=statuses[key] || statuses[String(st.student_id)] || ''; return <div key={st.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">{st.name}</p><p className="text-[10px] font-mono text-slate-400">{st.student_id} · Roll {st.roll_number}</p></div><div className="flex flex-wrap gap-1.5">{['present','late','absent','excused'].map(option => <button key={option} type="button" disabled={saving || normalizeStatus(selectedSession.status) !== 'in_progress'} onClick={() => setStatuses(prev => ({...prev,[key]:option}))} className={`px-3 py-1.5 rounded-lg text-[11px] font-black capitalize ${current===option ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-50`}>{option}</button>)}</div></div>; })}</div></section>
            {normalizeStatus(selectedSession.status) === 'in_progress' && <button type="button" disabled={saving} onClick={async()=>{ await saveAttendance(); try { await postJson(`/sessions/${selectedSession.id}/complete`,{}); await refreshAll(); setSessionId(''); } catch(e){ setError(e.message);} }} className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-black disabled:opacity-50">Complete & lock session</button>}
          </>}
        </div>
      </section>
    </div>;
  }

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow={role === 'admin' ? 'Network' : 'School'} title="Attendance Overview" description={role === 'admin' ? 'Review attendance across schools, classes, trainers and a date range.' : 'Review attendance for your school by class, date and student.'} actions={<RefreshButton onRefresh={refreshAll} loading={loading} />} />
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5"><div className="flex items-center gap-2 mb-4"><Filter size={16} className="text-slate-400"/><p className="text-xs font-black uppercase tracking-wide text-slate-500">Filters</p></div><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
      {role === 'admin' && <select value={selectedSchool} onChange={e=>{setSelectedSchool(e.target.value);setSelectedClass('')}} className="field"><option value="">All schools</option>{schools.map(s=><option key={s.id} value={s.school_code || s.code}>{s.name} ({s.school_code || s.code})</option>)}</select>}
      <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} className="field"><option value="">All classes</option>{classesForSchool.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select>
      {role === 'admin' && <select value={selectedTrainer} onChange={e=>setSelectedTrainer(e.target.value)} className="field"><option value="">All trainers</option>{trainersForSchool.map(t=><option key={t.id} value={t.trainer_id}>{t.name} ({t.trainer_id})</option>)}</select>}
      <input type="date" value={role === 'school' ? date : dateFrom} onChange={e=>role === 'school' ? setDate(e.target.value) : setDateFrom(e.target.value)} className="field"/>
      {role === 'admin' && <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="field"/>}
      <input value={studentFilter} onChange={e=>setStudentFilter(e.target.value)} placeholder="Search student" className="field"/>
    </div></section>
    <section className="grid grid-cols-2 sm:grid-cols-4 gap-3"><div className="metric"><p>Records</p><strong>{filteredRecords.length}</strong></div><div className="metric"><p>Present / Late</p><strong>{filteredRecords.filter(r=>presentLike(r.status)).length}</strong></div><div className="metric"><p>Absent</p><strong>{filteredRecords.filter(r=>normalizeStatus(r.status)==='absent').length}</strong></div><div className="metric"><p>Excused</p><strong>{filteredRecords.filter(r=>normalizeStatus(r.status)==='excused').length}</strong></div></section>
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Date','School','Class','Student','Trainer','Status','Marked at'].map(h=><th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400 font-black">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredRecords.map(r=><tr key={r.id}><td className="px-4 py-3 whitespace-nowrap">{String(r.date || '').slice(0,10)}</td><td className="px-4 py-3">{r.school_code || '—'}</td><td className="px-4 py-3">{r.class_name || '—'}</td><td className="px-4 py-3"><p className="font-bold">{r.student_name || r.student_id}</p><p className="text-[10px] text-slate-400">#{r.roll_number || '—'}</p></td><td className="px-4 py-3">{r.trainer_id || '—'}</td><td className="px-4 py-3"><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{normalizeStatus(r.status)}</span></td><td className="px-4 py-3 text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 size={12}/>{r.marked_at ? new Date(r.marked_at).toLocaleString() : '—'}</span></td></tr>)}{!filteredRecords.length && <tr><td colSpan={7}><EmptyState icon={<Check size={19}/>} title="No attendance records" description="No database records match the selected filters."/></td></tr>}</tbody></table></div></section>
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}.metric{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:14px}.metric p{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:800}.metric strong{display:block;margin-top:5px;font-size:24px;color:#0f172a}`}</style>
  </div>;
}
