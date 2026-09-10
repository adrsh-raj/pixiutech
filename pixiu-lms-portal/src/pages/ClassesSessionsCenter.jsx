import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Edit3, Lock, Plus, School as SchoolIcon, Users, XCircle } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const today = () => new Date().toISOString().slice(0, 10);
const norm = v => String(v ?? '').trim().toLowerCase();
const same = (a, b) => String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();
const sessionLabel = status => ({ planned: 'Untaught', in_progress: 'Teaching', completed: 'Taught', cancelled: 'Cancelled' }[norm(status)] || 'Unknown');
const defaultSessionForm = (classes = [], trainers = []) => ({ school_class: classes[0]?.id || '', trainer: trainers[0]?.id || '', date: today(), start_time: '10:00', end_time: '11:00', topic: 'Regular class', notes: '' });

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || data.message || `Request failed (${response.status})`);
  return data;
}

export default function ClassesSessionsCenter() {
  const { user } = useAuth();
  const { schools = [], classes = [], trainers = [], students = [], sessions = [], refreshAll, loading } = useData();
  const [schoolId, setSchoolId] = useState('');
  const [classModal, setClassModal] = useState(null);
  const [sessionModal, setSessionModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [classForm, setClassForm] = useState({ school: '', grade: '', section: 'A' });
  const [sessionForm, setSessionForm] = useState(() => defaultSessionForm());

  const scopedSchool = useMemo(() => user?.role === 'school'
    ? schools.find(s => [s.id, s.school_id, s.school_code, s.code].some(v => same(v, user.school_id))) || schools[0] || null
    : schools.find(s => String(s.id) === String(schoolId)) || null, [schools, schoolId, user]);

  const scopedClasses = useMemo(() => classes.filter(c => {
    if (norm(c.status || 'active') === 'inactive') return false;
    if (!scopedSchool) return user?.role === 'admin' || user?.role === 'superadmin';
    return [c.school, c.school_id, c.school_code].some(v => same(v, scopedSchool.id) || same(v, scopedSchool.school_id) || same(v, scopedSchool.school_code));
  }), [classes, scopedSchool, user?.role]);

  const visibleTrainers = useMemo(() => trainers.filter(t => norm(t.status || 'active') !== 'inactive'), [trainers]);
  const scopedSessions = useMemo(() => sessions.filter(s => {
    if (!scopedClasses.length) return false;
    return scopedClasses.some(c => String(c.id) === String(s.school_class || s.class_id));
  }).sort((a, b) => `${a.date || ''}${a.start_time || ''}`.localeCompare(`${b.date || ''}${b.start_time || ''}`)), [sessions, scopedClasses]);
  const canManage = ['admin', 'superadmin', 'school'].includes(user?.role);
  const studentCount = id => students.filter(s => String(s.school_class || s.class_id) === String(id) && norm(s.status || 'active') !== 'inactive').length;

  const saveClass = async event => {
    event.preventDefault();
    if (!classForm.school || !String(classForm.grade).trim() || !String(classForm.section).trim()) return setError('School, grade and section are required.');
    setSaving(true); setError('');
    try {
      const payload = { school: classForm.school, grade: String(classForm.grade).trim(), section: String(classForm.section).trim().toUpperCase() };
      await request(classModal.id ? `/classes/${encodeURIComponent(classModal.id)}` : '/classes', classModal.id ? 'PATCH' : 'POST', payload);
      setClassModal(null); await refreshAll();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const deactivateClass = async item => {
    if (!window.confirm(`Deactivate ${item.display_name || 'this class'}? Existing student records are retained.`)) return;
    setSaving(true); setError('');
    try { await request(`/classes/${encodeURIComponent(item.id)}`, 'DELETE'); await refreshAll(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const openSessionModal = () => {
    setError('');
    setSessionForm(defaultSessionForm(scopedClasses, visibleTrainers));
    setSessionModal(true);
  };

  const saveSession = async event => {
    event.preventDefault();
    if (!sessionForm.school_class || !sessionForm.trainer || !sessionForm.date || !sessionForm.start_time || !String(sessionForm.topic).trim()) return setError('Class, trainer, date, start time and topic are required.');
    if (sessionForm.end_time && sessionForm.end_time <= sessionForm.start_time) return setError('End time must be later than start time.');
    setSaving(true); setError('');
    try {
      await request('/sessions', 'POST', { ...sessionForm, topic: sessionForm.topic.trim(), notes: sessionForm.notes.trim(), end_time: sessionForm.end_time || null });
      setSessionModal(false); await refreshAll();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const sessionAction = async (id, action) => {
    setSaving(true); setError('');
    try { await request(`/sessions/${encodeURIComponent(id)}/${action}`, 'POST', {}); await refreshAll(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return <div className="space-y-6 pb-10">
    <PageHeader eyebrow={user?.role || 'Admin'} title="Classes & Sessions" description="Live class rosters and scheduled sessions from the canonical Django API." actions={<RefreshButton onRefresh={refreshAll} loading={loading || saving} />} />
    {error && <ErrorState title="Classes & sessions action failed" description={error} onRetry={() => setError('')} />}

    <section className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.16em] text-blue-600 font-black">Academic operations</p><h2 className="text-xl font-black mt-1">Authorised classes</h2><p className="text-xs text-slate-400 mt-1">The API, not browser state, owns class/trainer relationships.</p></div><div className="flex flex-wrap gap-2 w-full lg:w-auto">{user?.role === 'admin' || user?.role === 'superadmin' ? <select className="field min-w-[220px] w-full sm:w-auto" value={schoolId} onChange={e => setSchoolId(e.target.value)}><option value="">All schools</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select> : null}{canManage && <button type="button" onClick={() => { setClassForm({ school: scopedSchool?.id || '', grade: '', section: 'A' }); setClassModal({ id: null }); }} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black w-full sm:w-auto"><Plus size={14} className="inline mr-1"/>New class</button>}{canManage && user?.role !== 'trainer' && <button type="button" onClick={openSessionModal} disabled={!scopedClasses.length || !visibleTrainers.length} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black w-full sm:w-auto disabled:opacity-50"><CalendarDays size={14} className="inline mr-1"/>Schedule session</button>}</div></section>

    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{scopedClasses.map(c => { const school = schools.find(s => [s.id, s.school_id, s.school_code, s.code].some(v => same(v, c.school_id) || same(v, c.school_code))); return <article key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm min-w-0"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[.14em] font-black text-blue-600 truncate">{school?.name || c.school_id || 'School'}</p><h3 className="text-lg font-black text-slate-900 mt-1 break-words">{c.display_name || `${c.grade}-${c.section}`}</h3></div><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase shrink-0">{c.status || 'active'}</span></div><div className="grid grid-cols-2 gap-3 mt-4"><div className="rounded-xl bg-slate-50 p-3"><Users size={15}/><p className="text-xl font-black mt-2">{studentCount(c.id)}</p><p className="text-[10px] uppercase font-black text-slate-400">Students</p></div><div className="rounded-xl bg-slate-50 p-3"><CalendarDays size={15}/><p className="text-xl font-black mt-2">{scopedSessions.filter(s => String(s.school_class || s.class_id) === String(c.id)).length}</p><p className="text-[10px] uppercase font-black text-slate-400">Sessions</p></div></div>{canManage && <div className="flex flex-col sm:flex-row gap-2 mt-4"><button type="button" onClick={() => { setClassForm({ school: c.school || school?.id || '', grade: c.grade || '', section: c.section || 'A' }); setClassModal({ id: c.id }); }} className="px-3 py-2 rounded-lg bg-slate-100 text-[10px] font-black"><Edit3 size={12} className="inline mr-1"/>Edit</button><button type="button" onClick={() => deactivateClass(c)} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black"><XCircle size={12} className="inline mr-1"/>Deactivate</button></div>}</article>; })}{!scopedClasses.length && <div className="md:col-span-2 xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-10"><EmptyState icon={<SchoolIcon size={20}/>} title="No classes" description="No active classes were returned for the current authorised scope."/></div>}</section>

    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-5 border-b border-slate-100"><p className="text-[10px] uppercase tracking-widest text-violet-600 font-black">Session register</p><h2 className="text-xl font-black mt-1">Scheduled sessions</h2></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Date','Class','Trainer','Topic','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase text-slate-400 font-black">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{scopedSessions.map(s => { const st = norm(s.status); return <tr key={s.id}><td className="px-4 py-3 whitespace-nowrap">{s.date || '—'}<div className="text-[10px] text-slate-400">{s.start_time || '—'} {s.end_time ? `→ ${s.end_time}` : ''}</div></td><td className="px-4 py-3 font-bold">{s.class_name || s.class_id || '—'}</td><td className="px-4 py-3">{s.trainer_name || s.trainer_id || '—'}</td><td className="px-4 py-3 min-w-[220px]">{s.topic || '—'}</td><td className="px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{st === 'completed' ? <CheckCircle2 size={11}/> : st === 'in_progress' ? <Clock3 size={11}/> : <CalendarDays size={11}/>} {sessionLabel(st)}</span></td><td className="px-4 py-3"><div className="flex gap-1.5">{canManage && st === 'planned' && <button disabled={saving} onClick={() => sessionAction(s.id,'start')} className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-black">Start</button>}{canManage && st === 'in_progress' && <button disabled={saving} onClick={() => sessionAction(s.id,'complete')} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black inline-flex items-center gap-1"><Lock size={11}/>Mark taught</button>}</div></td></tr>; })}{!scopedSessions.length && <tr><td colSpan={6} className="p-8"><EmptyState title="No sessions" description="No sessions are available in this scope."/></td></tr>}</tbody></table></div></section>

    {classModal && <Modal title={classModal.id ? 'Edit class' : 'New class'} onClose={() => setClassModal(null)}><form onSubmit={saveClass} className="space-y-3"><select className="field" value={classForm.school} onChange={e => setClassForm(v => ({...v,school:e.target.value}))} required><option value="">Select school</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select><input className="field" placeholder="Grade" value={classForm.grade} onChange={e => setClassForm(v => ({...v,grade:e.target.value}))} inputMode="numeric" required/><input className="field" placeholder="Section" value={classForm.section} onChange={e => setClassForm(v => ({...v,section:e.target.value}))} required/><button disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black">{saving ? 'Saving…' : 'Save class'}</button></form></Modal>}
    {sessionModal && <Modal title="Schedule session" onClose={() => setSessionModal(false)}><form onSubmit={saveSession} className="space-y-3"><div><label className="label">Class *</label><select className="field" value={sessionForm.school_class} onChange={e => setSessionForm(v => ({...v,school_class:e.target.value}))} required><option value="">Select class</option>{scopedClasses.map(c => <option key={c.id} value={c.id}>{c.display_name} · Grade {c.grade}</option>)}</select></div><div><label className="label">Trainer *</label><select className="field" value={sessionForm.trainer} onChange={e => setSessionForm(v => ({...v,trainer:e.target.value}))} required><option value="">Select trainer</option>{visibleTrainers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trainer_id})</option>)}</select></div><div><label className="label">Date *</label><input className="field" type="date" value={sessionForm.date} onChange={e => setSessionForm(v => ({...v,date:e.target.value}))} required/></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><div><label className="label">Start time *</label><input className="field" type="time" value={sessionForm.start_time} onChange={e => setSessionForm(v => ({...v,start_time:e.target.value}))} required/></div><div><label className="label">End time</label><input className="field" type="time" value={sessionForm.end_time} onChange={e => setSessionForm(v => ({...v,end_time:e.target.value}))}/></div></div><div><label className="label">Topic *</label><input className="field" placeholder="What will be taught?" value={sessionForm.topic} onChange={e => setSessionForm(v => ({...v,topic:e.target.value}))} required/></div><div><label className="label">Notes</label><textarea className="field min-h-20" placeholder="Optional notes" value={sessionForm.notes} onChange={e => setSessionForm(v => ({...v,notes:e.target.value}))}/></div><p className="text-[10px] text-slate-400">New sessions start as <b>Untaught</b>. Trainer can start the class and mark it <b>Taught</b> after delivery.</p><button disabled={saving} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black">{saving ? 'Scheduling…' : 'Schedule session'}</button></form></Modal>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}.label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:900;color:#64748b;margin-bottom:5px}`}</style>
  </div>;
}
function Modal({title,onClose,children}){return <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-4"><div className="bg-white w-full max-w-xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl shadow-2xl"><div className="sticky top-0 bg-white z-10 p-5 border-b border-slate-100 flex items-center justify-between gap-3"><h2 className="font-black text-slate-900">{title}</h2><button type="button" onClick={onClose} className="text-slate-400 text-xl">×</button></div><div className="p-5">{children}</div></div></div>}
