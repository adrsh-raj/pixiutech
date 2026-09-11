import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Filter, Save, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import RefreshButton from '../components/ui/RefreshButton';

const today = () => new Date().toISOString().slice(0, 10);
const norm = value => String(value ?? '').trim().toLowerCase();
const same = (a, b) => String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();
const statuses = ['present', 'late', 'absent', 'excused'];

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, {
    method,
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const firstField = Object.entries(payload || {}).find(([key]) => !['detail', 'error', 'message'].includes(key));
    throw new Error(payload.detail || payload.error || payload.message || (firstField ? `${firstField[0]}: ${String(firstField[1])}` : `Request failed (${response.status})`));
  }
  return payload;
}

export default function AttendanceCenter() {
  const { user } = useAuth();
  const { schools = [], classes = [], trainers = [], students = [], sessions = [], attendance = [], refreshAll, loading } = useData();
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get('session') || '';
  const [selectedSessionId, setSelectedSessionId] = useState(requestedSessionId);
  const [trainerSessions, setTrainerSessions] = useState([]);
  const [trainerAttendance, setTrainerAttendance] = useState([]);
  const [date, setDate] = useState('');
  const [marks, setMarks] = useState({});
  const [schoolFilter, setSchoolFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [trainerFilter, setTrainerFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedSession = useMemo(() => {
    const all = [...trainerSessions, ...sessions];
    return all.find(session => String(session.id) === String(selectedSessionId)) || null;
  }, [trainerSessions, sessions, selectedSessionId]);

  const sessionSource = useMemo(() => {
    const merged = new Map();
    [...sessions, ...trainerSessions].forEach(session => {
      if (session?.id) merged.set(String(session.id), session);
    });
    return [...merged.values()];
  }, [sessions, trainerSessions]);

  const visibleTrainerSessions = useMemo(() => {
    const rows = sessionSource
      .filter(session => !['completed', 'cancelled'].includes(norm(session.status)))
      .filter(session => !date || String(session.date || '').slice(0, 10) === date)
      .sort((a, b) => `${a.date || ''}${a.start_time || ''}`.localeCompare(`${b.date || ''}${b.start_time || ''}`));
    if (!requestedSessionId || !selectedSession) return rows;
    if (rows.some(session => String(session.id) === String(selectedSession.id))) return rows;
    return [selectedSession, ...rows];
  }, [sessionSource, date, requestedSessionId, selectedSession]);

  const roster = useMemo(() => {
    const classId = String(selectedSession?.school_class || selectedSession?.class_id || '');
    if (!classId) return [];
    return students.filter(student => String(student.school_class || student.class_id) === classId && norm(student.status || 'active') !== 'inactive');
  }, [students, selectedSession]);

  const selectSession = session => {
    setSelectedSessionId(String(session.id));
    const source = trainerAttendance.length ? trainerAttendance : attendance;
    const nextMarks = {};
    source
      .filter(record => String(record.session || record.session_id) === String(session.id))
      .forEach(record => {
        nextMarks[String(record.student || record.student_id)] = norm(record.status);
      });
    setMarks(nextMarks);
    setError('');
    if (session.date) setDate(String(session.date).slice(0, 10));
  };

  const loadTrainerData = async () => {
    if (user?.role !== 'trainer') return;
    try {
      const [sessionRows, attendanceRows] = await Promise.all([
        request('/sessions'),
        request('/attendance'),
      ]);
      const normalizeRows = value => Array.isArray(value) ? value : Array.isArray(value?.results) ? value.results : Array.isArray(value?.data) ? value.data : [];
      setTrainerSessions(normalizeRows(sessionRows));
      setTrainerAttendance(normalizeRows(attendanceRows));
    } catch (err) {
      setError(err.message || 'Unable to load trainer attendance data.');
    }
  };

  useEffect(() => {
    loadTrainerData();
  }, [user?.role, requestedSessionId]);

  useEffect(() => {
    if (!requestedSessionId) return;
    const all = [...trainerSessions, ...sessions];
    const session = all.find(item => String(item.id) === String(requestedSessionId));
    if (session) selectSession(session);
  }, [requestedSessionId, trainerSessions, sessions, trainerAttendance, attendance]);

  const saveAttendance = async () => {
    if (!selectedSession || !roster.length) return false;
    setSaving(true);
    setError('');
    try {
      await request('/attendance/bulk', 'POST', {
        session: selectedSession.id,
        entries: roster.map(student => ({
          student: student.id,
          status: marks[String(student.id)] || 'absent',
        })),
      });
      await Promise.all([refreshAll(), loadTrainerData()]);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const sessionAction = async action => {
    if (!selectedSession) return false;
    setSaving(true);
    setError('');
    try {
      await request(`/sessions/${selectedSession.id}/${action}`, 'POST', {});
      await Promise.all([refreshAll(), loadTrainerData()]);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (user?.role === 'trainer') {
    return (
      <div className="space-y-5 pb-10">
        <PageHeader
          eyebrow="Trainer"
          title="Attendance"
          description="Open a scheduled session, start it, mark the class roster, then save the attendance record."
          actions={<RefreshButton onRefresh={async () => { await refreshAll(); await loadTrainerData(); }} loading={loading || saving} />}
        />
        {error && <ErrorState title="Attendance action failed" description={error} onRetry={() => setError('')} />}

        <section className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black">Scheduled sessions</p>
                <p className="text-xs text-slate-400 mt-1">{visibleTrainerSessions.length} active session(s)</p>
              </div>
              <div className="flex items-center gap-2">
                {date && <button type="button" onClick={() => setDate('')} className="px-2.5 py-2 rounded-lg bg-slate-100 text-[10px] font-black text-slate-600">All dates</button>}
                <input aria-label="Filter sessions by date" type="date" className="field w-auto" value={date} onChange={event => setDate(event.target.value)} />
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {visibleTrainerSessions.map(session => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => selectSession(session)}
                  className={`w-full text-left p-4 transition ${String(selectedSessionId) === String(session.id) ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50'}`}
                >
                  <p className="font-black text-sm">{session.topic || 'Scheduled session'}</p>
                  <p className="text-xs text-slate-500 mt-1">{session.class_name || session.class_id || 'Class'} · {session.date || '—'} · {session.start_time || '—'}</p>
                  <span className="inline-flex mt-2 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{session.status}</span>
                </button>
              ))}
              {!visibleTrainerSessions.length && (
                <div className="p-6">
                  <EmptyState icon={<CalendarDays size={19} />} title="No scheduled sessions" description="Your authorised scheduled sessions will appear here automatically, including future dates." />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {!selectedSession ? (
              <EmptyState icon={<Users size={20} />} title="Select a session" description="Use the scheduled-session list or open Attendance from Classes & Sessions to select the exact session." />
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-blue-600 font-black">Selected session</p>
                      <h2 className="text-xl font-black mt-1">{selectedSession.topic || 'Class session'}</h2>
                      <p className="text-xs text-slate-500 mt-1">{selectedSession.class_name || selectedSession.class_id} · {selectedSession.date} · {selectedSession.start_time}</p>
                      <p className="text-[10px] text-slate-400 mt-2">Curriculum: {selectedSession.curriculum_unit || '—'}</p>
                    </div>
                    {norm(selectedSession.status) === 'planned' && <button type="button" disabled={saving} onClick={() => sessionAction('start')} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">Start class</button>}
                  </div>
                </div>

                <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <p className="font-black text-sm">Student roster</p>
                    <p className="text-[11px] text-slate-400 mt-1">Only active students belonging to the selected session class are shown.</p>
                  </div>
                  {roster.map(student => {
                    const key = String(student.id);
                    const current = marks[key] || 'absent';
                    return (
                      <div key={key} className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between gap-3">
                        <div><p className="font-bold">{student.name}</p><p className="text-[10px] font-mono text-slate-400">{student.student_id} · Roll {student.roll_number}</p></div>
                        <div className="flex gap-1.5 flex-wrap">
                          {statuses.map(status => <button key={status} type="button" disabled={saving || norm(selectedSession.status) !== 'in_progress'} onClick={() => setMarks(value => ({ ...value, [key]: status }))} className={`px-3 py-1.5 rounded-lg text-[11px] font-black ${current === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{status}</button>)}
                        </div>
                      </div>
                    );
                  })}
                  {!roster.length && <div className="p-8"><EmptyState icon={<Users size={18} />} title="No active students" description="The selected class currently has no active students." /></div>}
                </section>

                {norm(selectedSession.status) === 'in_progress' && (
                  <>
                    <button type="button" disabled={saving} onClick={saveAttendance} className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-black inline-flex items-center justify-center gap-2"><Save size={15} /> Save attendance</button>
                    <button type="button" disabled={saving} onClick={async () => { const saved = await saveAttendance(); if (saved) await sessionAction('complete'); }} className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-black">Save & complete session</button>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    );
  }

  const filteredClasses = useMemo(() => (schoolFilter ? classes.filter(item => same(item.school_id || item.school_code, schoolFilter)) : classes), [classes, schoolFilter]);
  const filteredTrainers = useMemo(() => (trainerFilter ? trainers.filter(item => String(item.id) === String(trainerFilter)) : trainers), [trainers, trainerFilter]);
  const records = useMemo(() => attendance.filter(record => {
    if (schoolFilter && !same(record.school_code || record.school_id, schoolFilter)) return false;
    if (classFilter && !same(record.class_id || record.school_class, classFilter)) return false;
    if (trainerFilter && !same(record.trainer_id || record.trainer, trainerFilter)) return false;
    const recordDate = String(record.date || '').slice(0, 10);
    if (user?.role === 'school' && date && recordDate !== date) return false;
    if (user?.role !== 'school' && from && recordDate < from) return false;
    if (user?.role !== 'school' && to && recordDate > to) return false;
    if (search && !`${record.student_name || ''} ${record.student_id || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [attendance, schoolFilter, classFilter, trainerFilter, user?.role, date, from, to, search]);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader eyebrow={user?.role === 'admin' ? 'Network' : 'School'} title="Attendance Overview" description="Read-only reporting from canonical AttendanceRecord rows." actions={<RefreshButton onRefresh={refreshAll} loading={loading} />} />
      {error && <ErrorState title="Attendance query failed" description={error} />}
      <section className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4"><Filter size={16} className="text-slate-400" /><p className="text-xs font-black uppercase tracking-wide text-slate-500">Filters</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
          {user?.role === 'admin' && <select className="field" value={schoolFilter} onChange={event => { setSchoolFilter(event.target.value); setClassFilter(''); setTrainerFilter(''); }}><option value="">All schools</option>{schools.map(item => <option key={item.id} value={item.school_code || item.id}>{item.name} ({item.school_code})</option>)}</select>}
          <select className="field" value={classFilter} onChange={event => setClassFilter(event.target.value)}><option value="">All classes</option>{filteredClasses.map(item => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select>
          {user?.role === 'admin' && <select className="field" value={trainerFilter} onChange={event => setTrainerFilter(event.target.value)}><option value="">All trainers</option>{filteredTrainers.map(item => <option key={item.id} value={item.id}>{item.name} ({item.trainer_id || item.id})</option>)}</select>}
          <input className="field" type="date" value={user?.role === 'school' ? date : from} onChange={event => user?.role === 'school' ? setDate(event.target.value) : setFrom(event.target.value)} />
          {user?.role === 'admin' && <input className="field" type="date" value={to} onChange={event => setTo(event.target.value)} />}
          <input className="field" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search student" />
        </div>
      </section>
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Metric label="Records" value={records.length} /><Metric label="Present / Late" value={records.filter(record => ['present', 'late'].includes(norm(record.status))).length} /><Metric label="Absent" value={records.filter(record => norm(record.status) === 'absent').length} /><Metric label="Excused" value={records.filter(record => norm(record.status) === 'excused').length} /></section>
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Date', 'School', 'Class', 'Student', 'Trainer', 'Status', 'Marked at'].map(header => <th key={header} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400 font-black">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{records.map(record => <tr key={record.id}><td className="px-4 py-3">{String(record.date || '').slice(0, 10)}</td><td className="px-4 py-3">{record.school_code || '—'}</td><td className="px-4 py-3">{record.class_name || '—'}</td><td className="px-4 py-3"><p className="font-bold">{record.student_name || record.student_id || '—'}</p><p className="text-[10px] text-slate-400">#{record.roll_number || '—'}</p></td><td className="px-4 py-3">{record.trainer_id || '—'}</td><td className="px-4 py-3"><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{norm(record.status)}</span></td><td className="px-4 py-3 text-slate-500">{record.marked_at ? new Date(record.marked_at).toLocaleString() : '—'}</td></tr>)}{!records.length && <tr><td colSpan={7}><EmptyState icon={<Check size={18} />} title="No attendance records" description="No canonical attendance rows match the current filters." /></td></tr>}</tbody></table></div></section>
      <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}`}</style>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-[9px] uppercase tracking-wide text-slate-400 font-black">{label}</p><p className="text-2xl font-black mt-2">{value}</p></div>;
}
