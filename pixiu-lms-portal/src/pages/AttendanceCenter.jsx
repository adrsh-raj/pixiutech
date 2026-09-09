import { useMemo, useState } from 'react';
import { CalendarDays, Check, Filter, Save, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import RefreshButton from '../components/ui/RefreshButton';

const today = () => new Date().toISOString().slice(0, 10);
const norm = value => String(value ?? '').trim().toLowerCase();
const same = (a, b) => String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();
const statusList = ['present', 'late', 'absent', 'excused'];

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

  const visibleSessions = useMemo(() => sessions.filter(s => !['completed', 'cancelled'].includes(norm(s.status))), [sessions]);
  const trainerSessions = useMemo(() => visibleSessions.filter(s => String(s.date || '').slice(0, 10) === date), [visibleSessions, date]);
  const selectedSession = sessions.find(s => String(s.id) === String(selectedSessionId)) || null;
  const roster = useMemo(() => {
    const classId = String(selectedSession?.school_class || selectedSession?.class_id || '');
    return classId ? students.filter(s => String(s.school_class || s.class_id) === classId && norm(s.status || 'active') !== 'inactive') : [];
  }, [students, selectedSession]);

  const filteredClasses = useMemo(() => schoolFilter
    ? classes.filter(c => same(c.school_id || c.school_code, schoolFilter))
    : classes, [classes, schoolFilter]);
  const filteredTrainers = useMemo(() => trainerFilter ? trainers.filter(t => String(t.id) === String(trainerFilter)) : trainers, [trainers, trainerFilter]);
  const records = useMemo(() => attendance.filter(r => {
    if (schoolFilter && !same(r.school_code || r.school_id, schoolFilter)) return false;
    if (classFilter && !same(r.class_id || r.school_class, classFilter)) return false;
    if (trainerFilter && !same(r.trainer_id || r.trainer, trainerFilter)) return false;
    const d = String(r.date || '').slice(0, 10);
    if (user?.role === 'school' && date && d !== date) return false;
    if (user?.role !== 'school' && from && d < from) return false;
    if (user?.role !== 'school' && to && d > to) return false;
    if (search && !`${r.student_name || ''} ${r.student_id || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [attendance, schoolFilter, classFilter, trainerFilter, user?.role, date, from, to, search]);

  const selectSession = session => {
    setSelectedSessionId(String(session.id));
    const next = {};
    attendance.filter(r => String(r.session || r.session_id) === String(session.id)).forEach(r => { next[String(r.student || r.student_id)] = norm(r.status); });
    setMarks(next); setError('');
  };

  const save = async () => {
    if (!selectedSession) return;
    setSaving(true); setError('');
    try {
      const result = await fetch('/__invalid__').catch(() => null);
      void result;
      const { apiFetch } = await import('../context/AuthContext');
      await apiFetch('/attendance/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        session: selectedSession.id,
        entries: roster.map(s => ({ student: s.id, status: marks[String(s.id)] || 'absent' })),
      }) }).then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || payload.error || 'Unable to save attendance.');
      });
      await refreshAll();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const action = async (path, body = {}) => {
    setSaving(true); setError('');
    try {
      const { apiFetch } = await import('../context/AuthContext');
      const response = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Attendance action failed.');
      await refreshAll();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  if (user?.role === 'trainer') {
    return <div className="space-y-5 pb-10">
      <PageHeader eyebrow="Trainer" title="Attendance" description="The API already scopes sessions to the signed-in trainer; this page does not second-guess that scope." actions={<RefreshButton onRefresh={refreshAll} loading={loading || saving} />} />
      {error && <ErrorState title="Attendance action failed" description={error} onRetry={() => setError('')} />}
      <section className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 border-b border-slate-100"><p className="font-black">Sessions on {date}</p><p className="text-xs text-slate-400 mt-1">{trainerSessions.length} session(s)</p></div><div className="divide-y divide-slate-100">{trainerSessions.map(s => <button key={s.id} type="button" onClick={() => selectSession(s)} className={`w-full text-left p-4 hover:bg-slate-50 ${String(selectedSessionId) === String(s.id) ? 'bg-blue-50' : ''}`}><p className="text-sm font-black">{s.topic || 'Scheduled class'}</p><p className="text-xs text-slate-500 mt-1">{s.class_name || s.class_id || 'Class'} · {s.start_time || '—'}</p><span className="inline-flex mt-2 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{s.status}</span></button>)}{!trainerSessions.length && <EmptyState icon={<CalendarDays size={19}/>} title="No sessions today" description="The backend returned no active session for today."/>}</div></div>
        <div className="space-y-4">{!selectedSession ? <EmptyState icon={<Users size={20}/>} title="Select a session" description="Choose a session to load its canonical class roster."/> : <><section className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:justify-between gap-3"><div><p className="text-[10px] uppercase tracking-widest text-blue-600 font-black">Session</p><h2 className="text-xl font-black mt-1">{selectedSession.topic || 'Class session'}</h2><p className="text-xs text-slate-500 mt-1">{selectedSession.class_name || selectedSession.class_id} · {selectedSession.date} · {selectedSession.start_time}</p></div><div className="flex gap-2">{norm(selectedSession.status) === 'planned' && <button disabled={saving} onClick={() => action(`/sessions/${selectedSession.id}/start`)} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">Start class</button>}{norm(selectedSession.status) === 'in_progress' && <button disabled={saving} onClick={save} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><Save size={14}/> Save attendance</button>}</div></section><section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 bg-slate-50 border-b border-slate-200"><p className="text-xs font-black">Student roster</p><p className="text-[11px] text-slate-400 mt-1">Every roster student is submitted together, preventing partial attendance state.</p></div>{roster.map(student => { const key=String(student.id); const current=marks[key] || 'absent'; return <div key={key} className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between gap-3"><div><p className="text-sm font-bold">{student.name}</p><p className="text-[10px] text-slate-400 font-mono">{student.student_id} · Roll {student.roll_number}</p></div><div className="flex flex-wrap gap-1.5">{statusList.map(status => <button key={status} type="button" disabled={saving || norm(selectedSession.status) !== 'in_progress'} onClick={() => setMarks(v => ({...v, [key]: status}))} className={`px-3 py-1.5 rounded-lg text-[11px] font-black capitalize ${current===status?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'}`}>{status}</button>)}</div></div>)}{!roster.length && <div className="p-8"><EmptyState icon={<Users size={18}/>} title="No roster" description="No active students are assigned to this session's class."/></div>}</section>{norm(selectedSession.status)==='in_progress' && <button disabled={saving} onClick={async()=>{const before=saving; void before; await save(); await action(`/sessions/${selectedSession.id}/complete`); setSelectedSessionId('');}} className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-black">Save & complete session</button>}</>}</div>}
      </section>
    </div>;
  }

  return <div className="space-y-5 pb-10"><PageHeader eyebrow={user?.role === 'admin' ? 'Network' : 'School'} title="Attendance Overview" description="Read-only reporting from canonical AttendanceRecord rows." actions={<RefreshButton onRefresh={refreshAll} loading={loading}/>} />{error && <ErrorState title="Attendance query failed" description={error}/>}<section className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2 mb-4"><Filter size={16} className="text-slate-400"/><p className="text-xs font-black uppercase tracking-wide text-slate-500">Filters</p></div><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">{user?.role==='admin'&&<select className="field" value={schoolFilter} onChange={e=>{setSchoolFilter(e.target.value);setClassFilter('');setTrainerFilter('')}}><option value="">All schools</option>{schools.map(s=><option key={s.id} value={s.school_code || s.id}>{s.name} ({s.school_code})</option>)}</select>}<select className="field" value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option value="">All classes</option>{filteredClasses.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select>{user?.role==='admin'&&<select className="field" value={trainerFilter} onChange={e=>setTrainerFilter(e.target.value)}><option value="">All trainers</option>{filteredTrainers.map(t=><option key={t.id} value={t.id}>{t.name} ({t.trainer_id || t.id})</option>)}</select>}<input type="date" className="field" value={user?.role==='school'?date:from} onChange={e=>user?.role==='school'?setDate(e.target.value):setFrom(e.target.value)}/>{user?.role==='admin'&&<input type="date" className="field" value={to} onChange={e=>setTo(e.target.value)}/>}<input className="field" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student"/></div></section><section className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Metric label="Records" value={records.length}/><Metric label="Present / Late" value={records.filter(r=>['present','late'].includes(norm(r.status))).length}/><Metric label="Absent" value={records.filter(r=>norm(r.status)==='absent').length}/><Metric label="Excused" value={records.filter(r=>norm(r.status)==='excused').length}/></section><section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Date','School','Class','Student','Trainer','Status','Marked at'].map(h=><th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400 font-black">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{records.map(r=><tr key={r.id}><td className="px-4 py-3">{String(r.date||'').slice(0,10)}</td><td className="px-4 py-3">{r.school_code||'—'}</td><td className="px-4 py-3">{r.class_name||'—'}</td><td className="px-4 py-3"><p className="font-bold">{r.student_name||r.student_id||'—'}</p><p className="text-[10px] text-slate-400">#{r.roll_number||'—'}</p></td><td className="px-4 py-3">{r.trainer_id||'—'}</td><td className="px-4 py-3"><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{norm(r.status)}</span></td><td className="px-4 py-3 text-slate-500">{r.marked_at?new Date(r.marked_at).toLocaleString():'—'}</td></tr>)}{!records.length&&<tr><td colSpan={7}><EmptyState icon={<Check size={18}/>} title="No attendance records" description="No canonical attendance rows match the current filters."/></td></tr>}</tbody></table></div></section><style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}`}</style></div>;
}

function Metric({label,value}){return <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-[9px] uppercase tracking-wide text-slate-400 font-black">{label}</p><p className="text-2xl font-black mt-2">{value}</p></div>}
