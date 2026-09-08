import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Lock, Play, Plus, Users } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const today = () => new Date().toISOString().slice(0, 10);
const status = value => String(value || '').toLowerCase();

async function request(path, method='GET', body) {
  const response = await apiFetch(path, { method, headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || 'Request failed.');
  return data;
}

export default function SessionManager() {
  const { user } = useAuth();
  const { schools=[], classes=[], trainers=[], sessions=[], students=[], refreshAll, loading } = useData();
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('schedule');

  const schoolObject = useMemo(() => schools.find(s => String(s.id) === String(schoolId) || String(s.school_code || s.code) === String(schoolId)), [schools, schoolId]);
  const classOptions = useMemo(() => schoolId ? classes.filter(c => String(c.school_id || c.school_code || '') === String(schoolId)) : [], [classes, schoolId]);
  const trainerOptions = useMemo(() => schoolId ? trainers.filter(t => (t.assigned_schools || []).map(String).some(id => id.toUpperCase() === String(schoolId).toUpperCase())) : [], [trainers, schoolId]);
  const visibleSessions = useMemo(() => {
    if (user?.role === 'trainer') {
      const keySet = new Set([user?.related_id, user?.username, user?.id].filter(Boolean).map(String));
      return sessions.filter(s => keySet.has(String(s.trainer_id || s.trainer || '')) || keySet.has(String(s.trainer || '')));
    }
    return sessions;
  }, [sessions, user]);
  const upcoming = visibleSessions.filter(s => status(s.status) !== 'cancelled').slice(0, 20);

  const createSession = async e => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      if (!schoolId || !classId || !trainerId || !date || !startTime || !topic.trim()) throw new Error('School, class, trainer, date, start time and topic are required.');
      await request('/sessions', 'POST', { school_class: classId, trainer: trainerId, date, start_time: startTime, end_time: endTime || null, topic: topic.trim(), notes: notes.trim() });
      setTopic(''); setNotes(''); setStartTime(''); setEndTime('');
      await refreshAll();
      setMode('schedule');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const changeStatus = async (id, action) => {
    setSaving(true); setError('');
    try { await request(`/sessions/${id}/${action}`, 'POST', {}); await refreshAll(); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow={user?.role === 'admin' ? 'Admin' : user?.role === 'school' ? 'School' : 'Trainer'} title="Sessions" description="School → class → assigned trainer → schedule → start → attendance → activities → complete → lock. Relationships are resolved from the database." actions={<RefreshButton onRefresh={refreshAll} loading={loading || saving} />} />
    {error && <ErrorState title="Session action failed" description={error} />}
    {user?.role !== 'trainer' && <section className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex items-center justify-between gap-3 mb-4"><div><h2 className="font-black text-slate-900">Schedule a session</h2><p className="text-xs text-slate-400 mt-1">Choose relationships in order; the UI never asks for a typed class ID.</p></div><span className="text-[10px] px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-black">DB driven</span></div><form onSubmit={createSession} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <select value={schoolId} onChange={e=>{setSchoolId(e.target.value);setClassId('');setTrainerId('')}} className="field"><option value="">1. Select school</option>{schools.map(s=><option key={s.id} value={s.school_code || s.id}>{s.name} ({s.school_code || s.code})</option>)}</select>
      <select value={classId} onChange={e=>setClassId(e.target.value)} disabled={!schoolId} className="field"><option value="">2. Select class</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select>
      <select value={trainerId} onChange={e=>setTrainerId(e.target.value)} disabled={!schoolId} className="field"><option value="">3. Select assigned trainer</option>{trainerOptions.map(t=><option key={t.id} value={t.id}>{t.name} ({t.trainer_id})</option>)}</select>
      <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="field"/>
      <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="field"/>
      <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="field"/>
      <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Session topic" className="field"/>
      <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes (optional)" className="field"/>
      <button disabled={saving} className="sm:col-span-2 xl:col-span-4 inline-flex justify-center items-center gap-2 py-3 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-50"><Plus size={15}/> Schedule session</button>
    </form><style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}.field:disabled{background:#f8fafc;color:#94a3b8}`}</style></section>}

    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="font-black text-slate-900">Scheduled sessions</h2><p className="text-xs text-slate-400 mt-1">Trainer workspace actions change the same DB session record.</p></div><CalendarDays size={18} className="text-slate-300"/></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Date','School','Class','Trainer','Topic','Status','Actions'].map(h=><th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400 font-black">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{upcoming.map(s=>{const st=status(s.status); const roster=students.filter(x=>String(x.class_id)===String(s.school_class || s.class_id)).length; return <tr key={s.id}><td className="px-4 py-3 whitespace-nowrap">{s.date}</td><td className="px-4 py-3">{s.school_id || s.school_code || schoolObject?.school_code || '—'}</td><td className="px-4 py-3">{s.class_name || s.class_id}</td><td className="px-4 py-3">{s.trainer_name || s.trainer_id}</td><td className="px-4 py-3"><p className="font-bold">{s.topic || '—'}</p><p className="text-[10px] text-slate-400">{roster} students</p></td><td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{st==='completed'?<CheckCircle2 size={11}/>:st==='in_progress'?<Play size={11}/>:st==='planned'?<CalendarDays size={11}/>:<Lock size={11}/>} {st}</span></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{st==='planned' && user?.role !== 'trainer' && <button disabled={saving} onClick={()=>changeStatus(s.id,'start')} className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-black">Start</button>}{st==='in_progress' && <a href="/trainers" className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black">Open workspace</a>}{st==='in_progress' && user?.role !== 'trainer' && <button disabled={saving} onClick={()=>changeStatus(s.id,'complete')} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black">Complete & lock</button>}</div></td></tr>})}{!upcoming.length && <tr><td colSpan={7}><EmptyState icon={<Users size={19}/>} title="No sessions found" description="Create a scheduled session from the database-driven form above."/></td></tr>}</tbody></table></div></section>
  </div>;
}
