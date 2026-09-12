import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Edit3, Flag, Layers3, Plus, RefreshCw, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const field = 'w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50';
const text = value => String(value ?? '').trim();
const lower = value => text(value).toLowerCase();
const key = value => text(value).toUpperCase();

async function req(path, method = 'GET', body) {
  const response = await apiFetch(path, {
    method,
    cache: 'no-store',
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fieldError = Object.entries(data || {}).find(([name]) => !['detail', 'error', 'message'].includes(name));
    throw new Error(data.detail || data.error || data.message || (fieldError ? `${fieldError[0]}: ${String(fieldError[1])}` : `Request failed (${response.status})`));
  }
  return data;
}

export default function SessionSchedulerV4() {
  const { user } = useAuth();
  const { schools = [], classes = [], trainers = [], students = [], attendance = [], sessions = [], refreshAll, loading } = useData();
  const trainerRole = user?.role === 'trainer';
  const canCreateUnit = trainerRole;

  const [techs, setTechs] = useState([]);
  const [units, setUnits] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [techId, setTechId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [last, setLast] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(null);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitForm, setUnitForm] = useState({ unit_number: '1', title: '', level: 'Level 1', objectives: '' });

  const activeSchools = useMemo(() => schools.filter(school => lower(school.status || 'active') !== 'inactive'), [schools]);
  const selectedSchool = activeSchools.find(school => String(school.id) === String(schoolId));
  const activeClasses = useMemo(() => classes.filter(cls => {
    if (lower(cls.status || 'active') === 'inactive' || !selectedSchool) return false;
    const schoolKeys = [selectedSchool.id, selectedSchool.school_id, selectedSchool.school_code, selectedSchool.code].filter(Boolean).map(key);
    const classKeys = [cls.school, cls.school_id, cls.school_code].filter(Boolean).map(key);
    return classKeys.some(value => schoolKeys.includes(value));
  }), [classes, selectedSchool]);
  const selectedClass = activeClasses.find(cls => String(cls.id) === String(classId));
  const activeTrainers = useMemo(() => trainers.filter(trainer => lower(trainer.status || 'active') !== 'inactive'), [trainers]);
  const myTrainer = trainerRole ? activeTrainers.find(trainer => String(trainer.id) === String(user?.trainer_id) || String(trainer.trainer_id) === String(user?.trainer_id)) || activeTrainers[0] : null;
  const visible = useMemo(() => {
    const ids = new Set(activeClasses.map(cls => String(cls.id)));
    const trainerKey = String(myTrainer?.id || myTrainer?.trainer_id || user?.trainer_id || '');
    return sessions.filter(session => ids.has(String(session.school_class || session.class_id)) && (!trainerRole || String(session.trainer || session.trainer_id) === trainerKey));
  }, [sessions, activeClasses, trainerRole, myTrainer, user]);

  const activeStudentCountByClass = useMemo(() => {
    const counts = {};
    students.forEach(student => {
      if (lower(student.status || 'active') === 'inactive') return;
      const classKey = String(student.class_id || student.school_class || '');
      if (classKey) counts[classKey] = (counts[classKey] || 0) + 1;
    });
    return counts;
  }, [students]);

  const attendanceCountBySession = useMemo(() => {
    const counts = {};
    attendance.forEach(row => {
      const sessionKey = String(row.session || row.session_id || '');
      if (sessionKey) counts[sessionKey] = (counts[sessionKey] || 0) + 1;
    });
    return counts;
  }, [attendance]);

  const unitSummaries = useMemo(() => {
    const map = new Map();
    visible.forEach(session => {
      const unitKey = String(session.curriculum_unit_id || session.curriculum_unit || session.curriculum_unit_name || 'unassigned');
      const existing = map.get(unitKey) || {
        id: unitKey,
        name: session.curriculum_unit_name || `Unit ${session.curriculum_unit || '—'}`,
        technology: session.technology_name || '—',
        sessions: 0,
        completed: 0,
        finalMarked: false,
        marked: 0,
        expected: 0,
      };
      const classKey = String(session.school_class || session.class_id || '');
      const expected = activeStudentCountByClass[classKey] || 0;
      existing.sessions += 1;
      if (lower(session.status) === 'completed') existing.completed += 1;
      if (session.is_last_session_for_unit) existing.finalMarked = true;
      existing.marked += attendanceCountBySession[String(session.id)] || 0;
      existing.expected += expected;
      map.set(unitKey, existing);
    });
    return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  }, [visible, activeStudentCountByClass, attendanceCountBySession]);

  const loadTech = async () => {
    try {
      const data = await req('/technologies');
      setTechs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load technology catalogue.');
    }
  };

  const loadUnits = async (nextClassId = classId, nextTechId = techId) => {
    if (!nextClassId || !nextTechId) {
      setUnits([]);
      return;
    }
    try {
      const data = await req(`/trainer-units?class_id=${encodeURIComponent(nextClassId)}&technology=${encodeURIComponent(nextTechId)}`);
      setUnits(Array.isArray(data) ? data : []);
    } catch (err) {
      setUnits([]);
      setError(err.message || 'Unable to load units for this technology and class.');
    }
  };

  useEffect(() => { loadTech(); }, []);
  useEffect(() => { if (trainerRole && myTrainer) setTrainerId(String(myTrainer.id)); }, [trainerRole, myTrainer]);
  useEffect(() => { if (!schoolId && activeSchools.length === 1) setSchoolId(String(activeSchools[0].id)); }, [activeSchools, schoolId]);
  useEffect(() => { if (classId && !activeClasses.some(cls => String(cls.id) === String(classId))) setClassId(''); }, [activeClasses, classId]);
  useEffect(() => {
    setUnitId('');
    if (!editing) loadUnits();
  }, [classId, techId, editing]);

  const openUnitModal = () => {
    if (!canCreateUnit || !classId || !techId) return;
    const next = Math.max(0, ...units.map(unit => Number(unit.unit_number) || 0)) + 1;
    setUnitForm({ unit_number: String(next), title: '', level: 'Level 1', objectives: '' });
    setUnitModalOpen(true);
    setError('');
  };

  const saveUnit = async event => {
    event.preventDefault();
    if (!classId || !techId) return setError('Select class and technology before adding a unit.');
    if (!/^\d+$/.test(unitForm.unit_number) || Number(unitForm.unit_number) <= 0) return setError('Enter a valid positive unit number.');
    if (!text(unitForm.title) || !text(unitForm.level) || !text(unitForm.objectives)) return setError('Unit/chapter title, level and objectives are required.');
    setUnitSaving(true);
    setError('');
    setSuccess('');
    try {
      const created = await req('/trainer-units', 'POST', {
        school_class: classId,
        technology: techId,
        unit_number: Number(unitForm.unit_number),
        title: text(unitForm.title),
        level: text(unitForm.level),
        objectives: text(unitForm.objectives),
      });
      await loadUnits(classId, techId);
      setUnitId(String(created.id));
      setUnitModalOpen(false);
      setSuccess(`${created.technology_name || 'Technology'} · Unit ${created.unit_number} added for ${selectedClass?.display_name || 'this class'}. Now schedule one or more class sessions under this unit.`);
    } catch (err) {
      setError(err.message || 'Unable to add unit.');
    } finally {
      setUnitSaving(false);
    }
  };

  const reset = () => {
    setClassId(''); setTechId(''); setUnitId(''); setUnits([]); setTopic(''); setNotes(''); setLast(false); setEditing(null);
  };

  const submit = async event => {
    event.preventDefault();
    setBusy('save'); setError(''); setSuccess('');
    const effectiveTrainer = trainerRole ? (myTrainer?.id || myTrainer?.trainer_id || user?.trainer_id) : trainerId;
    if (!schoolId || !classId || !effectiveTrainer || !techId || !unitId || !date || !start || !text(topic)) {
      setBusy(''); setError('School, class, trainer, technology, unit/chapter, date, start time and topic are required.'); return;
    }
    if (end && end <= start) { setBusy(''); setError('End time must be later than start time.'); return; }
    try {
      if (editing) {
        await req(`/sessions/${editing.id}`, 'PATCH', { technology: techId, is_last_session_for_unit: last });
        setSuccess('Session workflow updated.');
      } else {
        const data = await req('/sessions', 'POST', { school_class: classId, trainer: effectiveTrainer, technology: techId, curriculum_unit: unitId, is_last_session_for_unit: last, date, start_time: start, end_time: end || null, topic: text(topic), notes: text(notes) });
        setSuccess(`${data.technology_name || 'Technology'} · ${data.curriculum_unit_name || 'Unit'} class scheduled${last ? ' as the last session. Complete it only after every active student has attendance.' : '.'}`);
      }
      await refreshAll(); reset();
    } catch (err) { setError(err.message || 'Unable to save class session.'); }
    finally { setBusy(''); }
  };

  const edit = session => {
    setEditing(session); setTechId(String(session.technology_id || session.technology || '')); setLast(Boolean(session.is_last_session_for_unit)); setSchoolId(String(session.school_class_school || schoolId || '')); setClassId(String(session.school_class || session.class_id || '')); setUnitId(String(session.curriculum_unit_id || session.curriculum_unit || '')); setDate(session.date || date); setStart(session.start_time || start); setEnd(session.end_time || end); setTopic(session.topic || ''); setNotes(session.notes || ''); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const evaluate = async id => {
    setBusy(`eval-${id}`); setError(''); setSuccess('');
    try { const data = await req(`/course-completion/session/${id}/evaluate`, 'POST', {}); setSuccess(`Unit evaluated for ${data.evaluated_students} students: ${data.passed} passed, ${data.failed_or_pending} pending/failed.`); await refreshAll(); }
    catch (err) { setError(err.message || 'Unable to evaluate unit.'); }
    finally { setBusy(''); }
  };

  const change = async (id, action) => {
    setBusy(`status-${id}`); setError(''); setSuccess('');
    try { await req(`/sessions/${id}/${action}`, 'POST', {}); await refreshAll(); setSuccess(action === 'complete' ? 'Class session completed. Attendance remains stored per student for this class session.' : 'Class session started.'); }
    catch (err) { setError(err.message || 'Unable to update class session status.'); }
    finally { setBusy(''); }
  };

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
      <div><p className="text-[10px] uppercase tracking-[.2em] font-black text-blue-600">Academic Operations</p><h1 className="text-2xl sm:text-3xl font-black">Sessions & Schedule</h1><p className="mt-1 text-sm text-slate-500">Technology → Unit / Chapter → Class session → Student attendance. One unit can contain multiple class sessions.</p></div>
      <button onClick={() => { refreshAll(); loadTech(); if (classId && techId) loadUnits(classId, techId); }} disabled={!!busy || loading || unitSaving} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black inline-flex items-center gap-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
    </div>

    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}
    {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div>}

    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-blue-600">{editing ? 'Edit class session' : 'Create class session'}</p><h2 className="text-xl font-black mt-1">{editing ? 'Update last-session marker' : 'Schedule a session'}</h2></div><CalendarDays size={20} className="text-slate-300" /></div>
      <form onSubmit={submit} className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div><label className="label">School *</label><select className={field} value={schoolId} onChange={event => { setSchoolId(event.target.value); setClassId(''); setTechId(''); setUnitId(''); setUnits([]); }} disabled={!!editing} required><option value="">Select school</option>{activeSchools.map(school => <option key={school.id} value={school.id}>{school.name} · {school.school_code}</option>)}</select></div>
        <div><label className="label">Class *</label><select className={field} value={classId} onChange={event => { setClassId(event.target.value); setUnitId(''); setUnits([]); }} disabled={!schoolId || !!editing} required><option value="">Select class</option>{activeClasses.map(cls => <option key={cls.id} value={cls.id}>{cls.display_name || `${cls.grade}${cls.section || ''}`} · Grade {cls.grade}</option>)}</select></div>
        <div><label className="label">Technology / Session *</label><select className={field} value={techId} onChange={event => { setTechId(event.target.value); setUnitId(''); }} disabled={!classId} required><option value="">Select technology</option>{techs.map(technology => <option key={technology.id} value={technology.id}>{technology.name}</option>)}</select></div>
        <div><label className="label">Unit / Chapter *</label><div className="flex gap-2"><select className={`${field} min-w-0`} value={unitId} onChange={event => setUnitId(event.target.value)} disabled={!classId || !techId || !!editing} required><option value="">Select unit / chapter</option>{units.map(unit => <option key={unit.id} value={unit.id}>Unit {unit.unit_number} · {unit.title} · {unit.level}</option>)}</select>{canCreateUnit && <button type="button" title="Add unit / chapter" onClick={openUnitModal} disabled={!classId || !techId || !!editing} className="h-11 w-11 shrink-0 rounded-xl bg-blue-600 text-white inline-flex items-center justify-center disabled:opacity-40"><Plus size={17} /></button>}</div>{classId && techId && !units.length && <p className="mt-1 text-[10px] font-semibold text-slate-400">No unit exists for this technology + class yet. {canCreateUnit ? 'Use + to add the first unit/chapter.' : 'Ask a trainer to add one.'}</p>}</div>
        <div><label className="label">Is this the last session of this unit?</label><select className={field} value={last ? 'yes' : 'no'} onChange={event => setLast(event.target.value === 'yes')}><option value="no">No — more sessions remain</option><option value="yes">Yes — assessment follows</option></select></div>
        {!editing && <><div><label className="label">Date *</label><input className={field} type="date" value={date} onChange={event => setDate(event.target.value)} required /></div><div><label className="label">Start time *</label><input className={field} type="time" value={start} onChange={event => setStart(event.target.value)} required /></div><div><label className="label">End time</label><input className={field} type="time" value={end} onChange={event => setEnd(event.target.value)} /></div><div className="xl:col-span-2"><label className="label">Class topic *</label><input className={field} value={topic} onChange={event => setTopic(event.target.value)} placeholder="What was taught in this class?" required /></div><div className="xl:col-span-2"><label className="label">Notes</label><input className={field} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Optional notes" /></div></>}
        {last && <div className="sm:col-span-2 xl:col-span-4 rounded-2xl border border-violet-100 bg-violet-50 p-4"><div className="flex items-center gap-2 text-xs font-black text-violet-800"><Flag size={14} /> Unit-end assessment stage</div><p className="mt-1 text-xs text-violet-700">This is only the final-class marker. The class must have attendance for every active student before it can be completed; unit evaluation then uses the configured criteria.</p></div>}
        <div className="flex gap-2"><button disabled={!!busy} className="h-11 rounded-xl bg-blue-600 text-white px-4 text-xs font-black inline-flex items-center justify-center gap-2">{busy === 'save' ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />} {editing ? 'Save workflow' : 'Schedule class'}</button>{editing && <button type="button" onClick={reset} className="h-11 rounded-xl border border-slate-200 px-4 text-xs font-black">Cancel</button>}</div>
      </form>
    </section>

    {unitSummaries.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider font-black text-violet-600">Unit progress</p><h2 className="text-xl font-black mt-1">Technology → Unit / Chapter → Class sessions</h2><p className="text-xs text-slate-400 mt-1">Each unit can span multiple actual class sessions. Attendance belongs to each individual session.</p></div><Layers3 size={20} className="text-slate-300" /></div><div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{unitSummaries.map(unit => { const attendancePct = unit.expected ? Math.round((unit.marked / unit.expected) * 100) : 0; return <div key={unit.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase font-black text-violet-600">{unit.technology}</p><h3 className="font-black text-slate-900 mt-1">{unit.name}</h3></div>{unit.finalMarked && <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700"><Flag size={11}/> Final marked</span>}</div><div className="grid grid-cols-3 gap-2 mt-4"><div className="rounded-xl bg-white border border-slate-100 p-2"><p className="text-[9px] uppercase font-black text-slate-400">Classes</p><p className="text-lg font-black">{unit.sessions}</p></div><div className="rounded-xl bg-white border border-slate-100 p-2"><p className="text-[9px] uppercase font-black text-slate-400">Completed</p><p className="text-lg font-black">{unit.completed}</p></div><div className="rounded-xl bg-white border border-slate-100 p-2"><p className="text-[9px] uppercase font-black text-slate-400">Attendance</p><p className="text-lg font-black">{attendancePct}%</p></div></div></div>; })}</div></section>}

    <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-violet-600">Class register</p><h2 className="text-xl font-black">Technology → Unit / Chapter → Classes</h2></div><Users size={18} className="text-slate-300" /></div><div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-slate-50"><tr>{['Date','Technology','School / Class','Unit / Chapter / Topic','Attendance','Last session','Status','Actions'].map(header => <th key={header} className="px-4 py-3 text-left text-[9px] uppercase tracking-wider font-black text-slate-400">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map(session => { const sessionStatus = lower(session.status); const classKey = String(session.school_class || session.class_id || ''); const expected = activeStudentCountByClass[classKey] || 0; const marked = attendanceCountBySession[String(session.id)] || 0; const coverage = expected ? Math.min(100, Math.round((marked / expected) * 100)) : 0; return <tr key={session.id}><td className="px-4 py-3 whitespace-nowrap font-semibold">{session.date || '—'}<div className="text-[10px] text-slate-400">{session.start_time || '—'}{session.end_time ? ` → ${session.end_time}` : ''}</div></td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-[9px] font-black text-violet-700"><Layers3 size={11} />{session.technology_name || '—'}</span></td><td className="px-4 py-3"><b>{session.school_name || session.school_code || '—'}</b><div className="text-[10px] text-slate-400">{session.class_name || '—'}</div></td><td className="px-4 py-3 min-w-[250px]"><b>{session.curriculum_unit_name || session.curriculum_unit || '—'}</b><div className="text-[10px] text-slate-400">{session.topic || '—'}</div></td><td className="px-4 py-3 min-w-[115px]"><div className="text-[10px] font-black text-slate-700">{marked}/{expected || '—'}</div><div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${coverage}%` }} /></div><div className="text-[9px] text-slate-400 mt-1">{expected ? `${coverage}% marked` : 'No active students'}</div></td><td className="px-4 py-3">{session.is_last_session_for_unit ? <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700"><Flag size={11} /> Yes</span> : <span className="text-[10px] font-bold text-slate-400">No</span>}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[9px] uppercase font-black">{sessionStatus === 'completed' ? <CheckCircle2 size={11} /> : <Clock3 size={11} />} {sessionStatus}</span></td><td className="px-4 py-3 flex gap-1.5 flex-wrap">{trainerRole && <Link to={`/attendance?session=${encodeURIComponent(session.id)}`} className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[9px] font-black">{sessionStatus === 'completed' ? 'View attendance' : 'Attendance'}</Link>}{sessionStatus === 'planned' && <button disabled={!!busy} onClick={() => change(session.id, 'start')} className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[9px] font-black">Start</button>}{sessionStatus === 'in_progress' && <button disabled={!!busy} onClick={() => change(session.id, 'complete')} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black">Complete</button>}{session.is_last_session_for_unit && sessionStatus === 'completed' && <button disabled={!!busy} onClick={() => evaluate(session.id)} className="px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-[9px] font-black">{busy === `eval-${session.id}` ? 'Evaluating…' : 'Evaluate unit'}</button>}<button disabled={!!busy} onClick={() => edit(session)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[9px] font-black inline-flex items-center gap-1"><Edit3 size={11} /> Edit</button></td></tr>; })}{!visible.length && <tr><td colSpan={8} className="p-10 text-center text-slate-400">No class sessions in your current scope.</td></tr>}</tbody></table></div></section>

    {canCreateUnit && unitModalOpen && <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden"><div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-blue-600">Trainer curriculum</p><h2 className="text-xl font-black">Add Unit / Chapter</h2><p className="text-xs text-slate-500 mt-1">{techs.find(item => String(item.id) === String(techId))?.name || 'Technology'} · {selectedClass?.display_name || 'Selected class'}</p></div><button type="button" onClick={() => setUnitModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div><form onSubmit={saveUnit} className="p-6 space-y-4"><div className="grid grid-cols-2 gap-3"><div><label className="label">Unit number *</label><input className={field} type="number" min="1" step="1" value={unitForm.unit_number} onChange={event => setUnitForm(value => ({ ...value, unit_number: event.target.value }))} required /></div><div><label className="label">Level *</label><input className={field} value={unitForm.level} onChange={event => setUnitForm(value => ({ ...value, level: event.target.value }))} placeholder="Level 1" required /></div></div><div><label className="label">Unit / Chapter name *</label><input className={field} value={unitForm.title} onChange={event => setUnitForm(value => ({ ...value, title: event.target.value }))} placeholder="e.g. Sensors & Obstacle Detection" required /></div><div><label className="label">Learning objectives *</label><textarea rows="5" className={`${field} h-auto py-3`} value={unitForm.objectives} onChange={event => setUnitForm(value => ({ ...value, objectives: event.target.value }))} placeholder="What students will learn/build in this unit" required /></div><div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-900"><b>Flow:</b> create the unit/chapter once for this technology + class, then schedule multiple class sessions under it. Attendance is recorded separately for every student in every class session.</div><div className="flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={() => setUnitModalOpen(false)} className="h-11 rounded-xl border border-slate-200 px-4 text-xs font-black">Cancel</button><button type="submit" disabled={unitSaving} className="h-11 rounded-xl bg-blue-600 text-white px-5 text-xs font-black inline-flex items-center gap-2">{unitSaving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />} {unitSaving ? 'Adding…' : 'Add unit / chapter'}</button></div></form></div></div>}
    <style>{`.label{display:block;margin-bottom:.35rem;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#64748b}`}</style>
  </div>;
}
