import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Plus, RefreshCw, Users } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const text = value => String(value ?? '').trim();
const lower = value => text(value).toLowerCase();
const field = 'w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-400';

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, {
    method,
    cache: 'no-store',
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fields = data?.fields && typeof data.fields === 'object' ? data.fields : {};
    const detail = data?.detail || data?.error || data?.message;
    const fieldMessage = Object.entries(fields).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' ');
    throw new Error(detail || fieldMessage || `Request failed (${response.status})`);
  }
  return data;
}

export default function SessionSchedulerV2() {
  const { user } = useAuth();
  const { schools = [], classes = [], trainers = [], curriculum = [], sessions = [], refreshAll, loading } = useData();
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);
  const isTrainer = user?.role === 'trainer';
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [curriculumId, setCurriculumId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeSchools = useMemo(() => schools.filter(s => lower(s.status || 'active') !== 'inactive'), [schools]);
  const activeClasses = useMemo(() => classes.filter(c => lower(c.status || 'active') !== 'inactive' && (!schoolId || String(c.school_id || c.school || '') === String(schoolId) || String(c.school_id || '').toUpperCase() === String(activeSchools.find(s => String(s.id) === String(schoolId))?.school_code || '').toUpperCase())), [activeSchools, classes, schoolId]);
  const activeTrainers = useMemo(() => trainers.filter(t => lower(t.status || 'active') !== 'inactive'), [trainers]);
  const myTrainer = isTrainer ? activeTrainers[0] : null;
  const selectedClass = useMemo(() => activeClasses.find(c => String(c.id) === String(classId)) || null, [activeClasses, classId]);
  const classCurriculum = useMemo(() => curriculum.filter(unit => String(unit.grade || unit.class_grade || '') === String(selectedClass?.grade || '')), [curriculum, selectedClass]);
  const visibleSessions = useMemo(() => {
    const classIds = new Set(activeClasses.map(c => String(c.id)));
    return sessions.filter(s => classIds.has(String(s.school_class || s.class_id)) && (!isTrainer || String(s.trainer || s.trainer_id) === String(myTrainer?.id || myTrainer?.trainer_id || user?.trainer_id || user?.id)));
  }, [activeClasses, isTrainer, myTrainer, sessions, user]);

  useEffect(() => {
    if (isTrainer && myTrainer) setTrainerId(String(myTrainer.id));
  }, [isTrainer, myTrainer]);

  useEffect(() => {
    if (!schoolId && activeSchools.length === 1) setSchoolId(String(activeSchools[0].id));
  }, [activeSchools, schoolId]);

  useEffect(() => {
    if (classId && !activeClasses.some(c => String(c.id) === String(classId))) setClassId('');
  }, [activeClasses, classId]);

  useEffect(() => {
    if (curriculumId && !classCurriculum.some(unit => String(unit.id) === String(curriculumId))) setCurriculumId('');
  }, [classCurriculum, curriculumId]);

  const handleSchoolChange = value => {
    setSchoolId(value);
    setClassId('');
    setCurriculumId('');
    if (isAdmin) setTrainerId('');
  };

  const handleClassChange = value => {
    setClassId(value);
    setCurriculumId('');
    const selected = activeClasses.find(c => String(c.id) === String(value));
    if (!isTrainer && selected?.school_id) setSchoolId(prev => prev || String(selected.school_id));
  };

  const createSession = async event => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const effectiveTrainer = isTrainer ? (myTrainer?.id || myTrainer?.trainer_id || user?.trainer_id || user?.id) : trainerId;
    if (!schoolId || !classId || !effectiveTrainer || !curriculumId || !date || !startTime || !text(topic)) {
      setError('School, class, trainer, curriculum unit, date, start time and topic are required.');
      return;
    }
    if (endTime && endTime <= startTime) {
      setError('End time must be later than start time.');
      return;
    }
    setSaving(true);
    try {
      const created = await request('/sessions', 'POST', {
        school_class: classId,
        trainer: effectiveTrainer,
        curriculum_unit: curriculumId,
        date,
        start_time: startTime,
        end_time: endTime || null,
        topic: text(topic),
        notes: text(notes),
      });
      setSuccess(`Session scheduled for ${created?.class_name || selectedClass?.display_name || 'the selected class'}. The same server/database session is now available to Admin and the assigned Trainer.`);
      setClassId('');
      setCurriculumId('');
      setTopic('');
      setNotes('');
      await refreshAll();
    } catch (err) {
      setError(err.message || 'Unable to schedule session.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id, action) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await request(`/sessions/${encodeURIComponent(id)}/${action}`, 'POST', {});
      await refreshAll();
      setSuccess(action === 'start' ? 'Session started.' : 'Session completed and locked.');
    } catch (err) {
      setError(err.message || 'Session action failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[.2em] font-black text-blue-600">Academic Operations</p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">Sessions & Schedule</h1>
          <p className="text-sm text-slate-500 mt-1">{isTrainer ? 'Create sessions for your assigned schools and classes. Admin sees the exact same server record.' : 'Schedule real school → class → trainer → curriculum relationships from one place.'}</p>
        </div>
        <RefreshButton onRefresh={refreshAll} loading={loading || saving} />
      </div>

      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div>}
      {error && <ErrorState title="Session action failed" description={error} onRetry={() => setError('')} />}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-black text-blue-600">Create session</p>
            <h2 className="text-xl font-black text-slate-900 mt-1">{isTrainer ? 'Trainer session scheduling' : 'Schedule a session'}</h2>
            <p className="text-xs text-slate-400 mt-1">Every submitted session is persisted once in the backend database; there is no separate Admin copy.</p>
          </div>
          <CalendarDays size={20} className="text-slate-300" />
        </div>
        <form onSubmit={createSession} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div><label className="label">School *</label><select className={field} value={schoolId} onChange={e => handleSchoolChange(e.target.value)}><option value="">Select school</option>{activeSchools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select></div>
          <div><label className="label">Class *</label><select className={field} value={classId} onChange={e => handleClassChange(e.target.value)} disabled={!schoolId}><option value="">Select class</option>{activeClasses.map(c => <option key={c.id} value={c.id}>{c.display_name || `${c.grade}${c.section || ''}`} · Grade {c.grade}</option>)}</select></div>
          <div><label className="label">Trainer *</label>{isTrainer ? <div className="h-11 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-700">{myTrainer?.name || user?.display_name || user?.username || 'My trainer account'}</div> : <select className={field} value={trainerId} onChange={e => setTrainerId(e.target.value)} disabled={!classId}><option value="">Select trainer</option>{activeTrainers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trainer_id})</option>)}</select>}</div>
          <div><label className="label">Curriculum unit *</label><select className={field} value={curriculumId} onChange={e => setCurriculumId(e.target.value)} disabled={!classId}><option value="">Select curriculum unit</option>{classCurriculum.map(u => <option key={u.id} value={u.id}>{u.unit_code} · {u.title} · {u.level}</option>)}</select></div>
          <div><label className="label">Date *</label><input className={field} type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
          <div><label className="label">Start time *</label><input className={field} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required /></div>
          <div><label className="label">End time</label><input className={field} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
          <div><label className="label">Topic *</label><input className={field} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Session topic" required /></div>
          <div className="sm:col-span-2 xl:col-span-3"><label className="label">Notes</label><input className={field} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional trainer notes" /></div>
          <button disabled={saving} type="submit" className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black inline-flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={15}/>{saving ? 'Scheduling…' : 'Schedule session'}</button>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider font-black text-violet-600">Server-backed register</p><h2 className="text-xl font-black text-slate-900 mt-1">Scheduled sessions</h2></div><Users size={18} className="text-slate-300"/></div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Date / Time','School','Class','Trainer','Curriculum / Topic','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-[9px] uppercase tracking-wider font-black text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
          {visibleSessions.map(session => {
            const st = lower(session.status);
            return <tr key={session.id}><td className="px-4 py-3 whitespace-nowrap font-semibold">{session.date || '—'}<div className="text-[10px] text-slate-400">{session.start_time || '—'}{session.end_time ? ` → ${session.end_time}` : ''}</div></td><td className="px-4 py-3">{session.school_name || session.school_code || '—'}</td><td className="px-4 py-3 font-bold">{session.class_name || session.class_id || '—'}</td><td className="px-4 py-3">{session.trainer_name || session.trainer_id || '—'}</td><td className="px-4 py-3 min-w-[250px]"><p className="font-bold">{session.topic || '—'}</p><p className="text-[10px] text-slate-400">{session.curriculum_unit_name || session.curriculum_unit || 'Curriculum linked'}</p></td><td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-[9px] uppercase font-black">{st === 'completed' ? <CheckCircle2 size={11}/> : <Clock3 size={11}/>} {st || 'unknown'}</span></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{st === 'planned' && <button type="button" disabled={saving} onClick={() => changeStatus(session.id, 'start')} className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[9px] font-black">Start</button>}{st === 'in_progress' && <button type="button" disabled={saving} onClick={() => changeStatus(session.id, 'complete')} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black">Complete</button>}</div></td></tr>;
          })}
          {!visibleSessions.length && <tr><td colSpan={7} className="p-10"><EmptyState icon={<CalendarDays size={19}/>} title="No scheduled sessions" description={isTrainer ? 'No sessions for your currently authorised classes were returned by the server.' : 'Use the scheduler above to create the first session.'}/></td></tr>}
        </tbody></table></div>
      </section>
      <style>{`.label{display:block;margin-bottom:.35rem;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#64748b}`}</style>
    </div>
  );
}
