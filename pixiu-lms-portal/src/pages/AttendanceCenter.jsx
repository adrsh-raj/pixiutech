import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ClipboardCheck, Filter, Save, Users } from 'lucide-react';
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
  const response = await apiFetch(path, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const field = Object.entries(payload || {}).find(([key]) => !['detail', 'error', 'message'].includes(key));
    throw new Error(payload.detail || payload.error || payload.message || (field ? `${field[0]}: ${String(field[1])}` : `Request failed (${response.status})`));
  }
  return payload;
}

export default function AttendanceCenter() {
  const { user } = useAuth();
  const { schools = [], classes = [], trainers = [], students = [], sessions = [], attendance = [], refreshAll, loading } = useData();
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get('session') || '';
  const [selectedSessionId, setSelectedSessionId] = useState(requestedSessionId);
  const [marks, setMarks] = useState({});
  const [date, setDate] = useState(today());
  const [schoolFilter, setSchoolFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [trainerFilter, setTrainerFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const scopedTrainerSessions = useMemo(() => {
    const dateRows = sessions.filter(s => String(s.date || '').slice(0, 10) === date && !['completed', 'cancelled'].includes(norm(s.status)));
    if (!requestedSessionId) return dateRows;
    const requested = sessions.find(s => String(s.id) === String(requestedSessionId));
    return requested && !dateRows.some(s => String(s.id) === String(requested.id)) ? [requested, ...dateRows] : dateRows;
  }, [sessions, date, requestedSessionId]);

  const selectedSession = useMemo(() => sessions.find(s => String(s.id) === String(selectedSessionId)) || null, [sessions, selectedSessionId]);
  const roster = useMemo(() => {
    const classId = String(selectedSession?.school_class || selectedSession?.class_id || '');
    return classId ? students.filter(s => String(s.school_class || s.class_id) === classId && norm(s.status || 'active') !== 'inactive') : [];
  }, [students, selectedSession]);

  const selectSession = session => {
    setSelectedSessionId(String(session.id));
    const next = {};
    attendance.filter(r => String(r.session || r.session_id) === String(session.id)).forEach(r => { next[String(r.student || r.student_id)] = norm(r.status); });
    setMarks(next);
    setError('');
    if (session.date) setDate(String(session.date).slice(0, 10));
  };

  useEffect(() => {
    if (!requestedSessionId) return;
    const session = sessions.find(item => String(item.id) === String(requestedSessionId));
    if (session) selectSession(session);
  }, [requestedSessionId, sessions, attendance]);

  const saveAttendance = async () => {
    if (!selectedSession) return false;
    setSaving(true); setError('');
    try {
      await request('/attendance/bulk', 'POST', { session: selectedSession.id, entries: roster.map(student => ({ student: student.id, status: marks[String(student.id)] || 'absent' })) });
      await refreshAll();
      return true;
    } catch (err) { setError(err.message); return false; } finally { setSaving(false); }
  };

  const sessionAction = async action => {
    if (!selectedSession) return false;
    setSaving(true); setError('');
    try { await request(`/sessions/${selectedSession.id}/${action}`, 'POST', {}); await refreshAll(); return true; }
    catch (err) { setError(err.message); return false; } finally { setSaving(false); }
  };

  if (user?.role === 'trainer') {
    return <div className="space-y-5 pb-10">
      <PageHeader eyebrow="Trainer" title="Attendance" description="Select a scheduled session. Attendance is always stored against that exact session and class." actions={<RefreshButton onRefresh={refreshAll} loading={loading || saving} />} />
      {error && <ErrorState title="Attendance action failed" description={error} onRetry={() => setError('')} />}
      <section className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3"><div><p className="font-black">Scheduled sessions</p><p className="text-xs text-slate-400 mt-1">{scopedTrainerSessions.length} session(s) for {date}</p></div><input type="date" className="field w-auto" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="divide-y divide-slate-100">
            {scopedTrainerSessions.map(session => <button key={session.id} type="button" onClick={() => selectSession(session)} className={`w-full text-left p-4 transition ${String(selectedSessionId) === String(session.id) ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50'}`}><p className="font-black text-sm">{session.topic || 'Scheduled session'}</p><p className="text-xs text-slate-500 mt-1">{session.class_name || session.class_id || 'Class'} · {session.start_time || '—'}</p><span className="inline-flex mt-2 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{session.status}</span></button>)}
            {!scopedTrainerSessions.length && <div className="p-6"><EmptyState icon={<CalendarDays size={19} />} title="No scheduled sessions" description="Create a session from Classes & Sessions first." /></div>}
          </div>
        </div>
        <div className="space-y-4">
          {!selectedSession ? <EmptyState icon={<Users size={20} />} title="Select a session" description="Opening Attendance from a scheduled session will select that exact session automatically." /> : <>
            <div className="bg-white rounded-2xl border border-slate-200 p-5"><div className="flex flex-col sm:flex-row sm:justify-between gap-3"><div><p className="text-[10px] uppercase tracking-widest text-blue-600 font-black">Selected session</p><h2 className="text-xl font-black mt-1">{selectedSession.topic || 'Class session'}</h2><p className="text-xs text-slate-500 mt-1">{selectedSession.class_name || selectedSession.class_id} · {selectedSession.date} · {selectedSession.start_time}</p><p className="text-[10px] text-slate-400 mt-2">Curriculum: {selectedSession.curriculum_unit || '—'}</p></div>{norm(selectedSession.status) === 'planned' && <button disabled={saving} onClick={() => sessionAction('start')} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">Start class</button>}</div></div>
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 bg-slate-50 border-b border-slate-100"><p className="font-black text-sm">Student roster</p><p className="text-[11px] text-slate-400 mt-1">This roster comes from the selected session's class. Every active student must be represented when saving attendance.</p></div>{roster.map(student => { const key = String(student.id); const current = marks[key] || 'absent'; return <div key={key} className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between gap-3"><div><p className="font-bold">{student.name}</p><p className="text-[10px] font-mono text-slate-400">{student.student_id} · Roll {student.roll_number}</p></div><div className="flex gap-1.5 flex-wrap">{statuses.map(status => <button key={status} type="button" disabled={saving || norm(selectedSession.status) !== 'in_progress'} onClick={() => setMarks(v => ({ ...v, [key]: status }))} className={`px-3 py-1.5 rounded-lg text-[11px] font-black ${current === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{status}</button>)}</div></div>)}{!roster.length && <div className="p-8"><EmptyState icon={<Users size={18} />} title="No active students" description="The selected class currently has no active students." /></div>}</section>
            {norm(selectedSession.status) === 'in_progress' && <><button disabled={saving} onClick={saveAttendance} className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-black inline-flex items-center justify-center gap-2"><Save size={15} /> Save attendance</button><button disabled={saving} onClick={async () => { const saved = await saveAttendance(); if (saved) { await sessionAction('complete'); } }} className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-black">Save & complete session</button></>}
          </>}
        </div>
      </section>
    </div>;
  }

  const filteredClasses = useMemo(() => schoolFilter ? classes.filter(c => same(c.school_id || c.school_code, schoolFilter)) : classes, [classes, schoolFilter]);
  const filteredTrainers = useMemo(() => trainerFilter ? trainers.filter(t => String(t.id) === String(trainerFilter)) : trainers, [trainers, trainerFilter]);
  const records = useMemo(() => attendance.filter(r => { if (schoolFilter && !same(r.school_code || r.school_id, schoolFilter)) return false; if (classFilter && !same(r.class_id || r.school_class, classFilter)) return false; if (trainerFilter && !same(r.trainer_id || r.trainer, trainerFilter)) return false; const d = String(r.date || '').slice(0, 10); if (user?.role === 'school' && date && d !== date) return false; if (user?.role !== 'school' && from && d < from) return false; if (user?.role !== 'school' && to && d > to) return false; if (search && !`${r.student_name || ''} ${r.student_id || ''}`.toLowerCase().includes(search.toLowerCase())) return false; return true; }), [attendance, schoolFilter, classFilter, trainerFilter, user?.role, date, from, to, search]);

  return <div className="space-y-5 pb-10"><PageHeader eyebrow={user?.role === 'admin' ? 'Network' : 'School'} title="Attendance Overview" description="Read-only reporting from canonical AttendanceRecord rows." actions={<RefreshButton onRefresh={refreshAll} loading={loading} />} />{error && <ErrorState title="Attendance query failed" description={error} />}<section className="bg-white border border-slate-200 rounded-2xl p-4"><div className="flex items-center gap-2 mb-4"><Filter size={16} className="text-slate-400" /><p className="text-xs font-black uppercase tracking-wide text-slate-500">Filters</p></div><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">{user?.role === 'admin' && <select className="field" value={schoolFilter} onChange={e => { setSchoolFilter(e.target.value); setClassFilter(''); setTrainerFilter(''); }}><option value="">All schools</option>{schools.map(s => <option key={s.id} value={s.school_code || s.id}>{s.name} ({s.school_code})</option>)}</select>}<select className="field" value={classFilter} onChange={e => setClassFilter(e.target.value)}><option value="">All classes</option>{filteredClasses.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}</select>{user?.role === 'admin' && <select className="field" value={trainerFilter} onChange={e => setTrainerFilter(e.target.value)}><option value="">All trainers</option>{filteredTrainers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trainer_id || t.id})</option>)}</select>}<input className="field" type="date" value={user?.role === 'school' ? date : from} onChange={e => user?.role === 'school' ? setDate(e.target.value) : setFrom(e.target.value)} />{user?.role === 'admin' && <input className="field" type="date" value={to} onChange={e => setTo(e.target.value)} />}<input className="field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student" /></div></section><section className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Metric label="Records" value={records.length} /><Metric label="Present / Late" value={records.filter(r => ['present', 'late'].includes(norm(r.status))).length} /><Metric label="Absent" value={records.filter(r => norm(r.status) === 'absent').length} /><Metric label="Excused" value={records.filter(r => norm(r.status) === 'excused').length} /></section><section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Date', 'School', 'Class', 'Student', 'Trainer', 'Status', 'Marked at'].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400 font-black">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{records.map(r => <tr key={r.id}><td className="px-4 py-3">{String(r.date || '').slice(0, 10)}</td><td className="px-4 py-3">{r.school_code || '—'}</td><td className="px-4 py-3">{r.class_name || '—'}</td><td className="px-4 py-3"><p className="font-bold">{r.student_name || r.student_id || '—'}</p><p className="text-[10px] text-slate-400">#{r.roll_number || '—'}</p></td><td className="px-4 py-3">{r.trainer_id || '—'}</td><td className="px-4 py-3"><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{norm(r.status)}</span></td><td className="px-4 py-3 text-slate-500">{r.marked_at ? new Date(r.marked_at).toLocaleString() : '—'}</td></tr>)}{!records.length && <tr><td colSpan={7}><EmptyState icon={<Check size={18} />} title="No attendance records" description="No canonical attendance rows match the current filters." /></td></tr>}</tbody></table></div></section><style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}`}</style></div>;
}
function Metric({ label, value }) { return <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-[9px] uppercase tracking-wide text-slate-400 font-black">{label}</p><p className="text-2xl font-black mt-2">{value}</p></div>; }
