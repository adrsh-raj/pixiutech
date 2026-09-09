import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Edit3, Lock, Plus, School as SchoolIcon, UserCheck, Users, XCircle } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const list = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const norm = value => String(value ?? '').trim().toLowerCase();
const same = (a, b) => String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();
const today = () => new Date().toISOString().slice(0, 10);

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, {
    method,
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    cache: method === 'GET' ? 'no-store' : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.error || data.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
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
  const [sessionForm, setSessionForm] = useState({ school_class: '', trainer: '', date: today(), start_time: '', end_time: '', topic: '', notes: '' });

  const scopedSchool = useMemo(() => {
    if (user?.role === 'school') {
      const key = user?.school_id;
      return schools.find(s => [s.id, s.school_id, s.school_code, s.code].some(v => same(v, key))) || null;
    }
    return schools.find(s => String(s.id) === String(schoolId)) || null;
  }, [schools, schoolId, user?.role, user?.school_id]);

  const schoolKey = scopedSchool ? String(scopedSchool.id) : '';
  const scopedClasses = useMemo(() => classes.filter(item => {
    if (norm(item.status || 'active') === 'inactive') return false;
    if (!scopedSchool) return user?.role === 'admin' || user?.role === 'superadmin';
    return [item.school, item.school_id, item.school_code].filter(Boolean).some(v => same(v, scopedSchool.id) || same(v, scopedSchool.school_id) || same(v, scopedSchool.school_code));
  }), [classes, scopedSchool, user?.role]);

  const trainerKeys = useMemo(() => new Set([user?.id, user?.related_id, user?.username].filter(Boolean).map(String)), [user]);
  const scopedSessions = useMemo(() => sessions.filter(session => {
    const classMatch = scopedClasses.some(c => String(c.id) === String(session.school_class || session.class_id));
    if (user?.role === 'trainer') return classMatch && [session.trainer, session.trainer_id].filter(Boolean).some(v => trainerKeys.has(String(v)));
    if (user?.role === 'student') return classMatch;
    if (scopedSchool) return classMatch;
    return true;
  }).sort((a, b) => `${a.date || ''}${a.start_time || ''}`.localeCompare(`${b.date || ''}${b.start_time || ''}`)), [sessions, scopedClasses, scopedSchool, trainerKeys, user?.role]);

  const visibleTrainers = useMemo(() => {
    if (!scopedSchool) return trainers.filter(t => norm(t.status) !== 'inactive');
    const assigned = new Set();
    sessions.filter(s => scopedClasses.some(c => String(c.id) === String(s.school_class || s.class_id))).forEach(s => [s.trainer, s.trainer_id].filter(Boolean).forEach(v => assigned.add(String(v))));
    return trainers.filter(t => norm(t.status) !== 'inactive' && (assigned.has(String(t.id)) || assigned.has(String(t.trainer_id))));
  }, [scopedSchool, sessions, scopedClasses, trainers]);

  useEffect(() => {
    if (user?.role === 'school' && scopedSchool) setSchoolId(scopedSchool.id);
    if (user?.role === 'trainer') {
      const first = scopedSessions[0];
      if (first) setSessionForm(v => ({ ...v, school_class: first.school_class || first.class_id || '', trainer: first.trainer || '' }));
    }
  }, [user?.role, scopedSchool?.id]);

  const openNewClass = () => {
    setError('');
    setClassForm({ school: scopedSchool?.id || '', grade: '', section: 'A' });
    setClassModal({ id: null });
  };

  const editClass = item => {
    setError('');
    setClassForm({ school: item.school || scopedSchool?.id || '', grade: item.grade || '', section: item.section || 'A' });
    setClassModal({ id: item.id });
  };

  const saveClass = async event => {
    event.preventDefault();
    if (user?.role !== 'admin' && user?.role !== 'superadmin' && user?.role !== 'school') return;
    if (!classForm.school || !String(classForm.grade).trim() || !String(classForm.section).trim()) {
      setError('School, grade and section are required.'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = { school: classForm.school, grade: String(classForm.grade).trim(), section: String(classForm.section).trim().toUpperCase() };
      if (classModal?.id) await request(`/classes/${encodeURIComponent(classModal.id)}`, 'PATCH', payload);
      else await request('/classes', 'POST', payload);
      setClassModal(null);
      await refreshAll();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const deactivateClass = async item => {
    if (!window.confirm(`Deactivate ${item.display_name || 'this class'}? Existing student IDs remain retained.`)) return;
    setSaving(true); setError('');
    try { await request(`/classes/${encodeURIComponent(item.id)}`, 'DELETE'); await refreshAll(); } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const openNewSession = () => {
    setError('');
    setSessionForm({ school_class: scopedClasses[0]?.id || '', trainer: visibleTrainers[0]?.id || '', date: today(), start_time: '', end_time: '', topic: '', notes: '' });
    setSessionModal(true);
  };

  const saveSession = async event => {
    event.preventDefault();
    if (!sessionForm.school_class || !sessionForm.trainer || !sessionForm.date || !sessionForm.start_time || !String(sessionForm.topic).trim()) {
      setError('Class, trainer, date, start time and topic are required.'); return;
    }
    setSaving(true); setError('');
    try {
      await request('/sessions', 'POST', { school_class: sessionForm.school_class, trainer: sessionForm.trainer, date: sessionForm.date, start_time: sessionForm.start_time, end_time: sessionForm.end_time || null, topic: sessionForm.topic.trim(), notes: sessionForm.notes.trim() });
      setSessionModal(false); await refreshAll();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const sessionAction = async (id, action) => {
    setSaving(true); setError('');
    try { await request(`/sessions/${encodeURIComponent(id)}/${action}`, 'POST', {}); await refreshAll(); } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const studentCount = classId => students.filter(s => String(s.school_class || s.class_id) === String(classId) && norm(s.status) !== 'inactive').length;
  const schoolName = school => school?.name || school?.school_code || school?.school_id || 'School';
  const canManage = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'school';

  return (
    <div className="space-y-6 pb-10">
      <PageHeader eyebrow={user?.role === 'trainer' ? 'Trainer' : user?.role === 'student' ? 'Student' : user?.role === 'school' ? 'School' : 'Admin'} title="Classes & Sessions" description="Live class rosters and scheduled sessions from the Django API. No frontend-only class or session records are created." actions={<RefreshButton onRefresh={refreshAll} loading={loading || saving} />} />
      {error && <ErrorState title="Classes & sessions action failed" description={error} onRetry={() => setError('')} />}

      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div><p className="text-[10px] uppercase tracking-[.16em] text-blue-600 font-black">Class administration</p><h2 className="text-xl font-black mt-1">Your authorised classes</h2><p className="text-xs text-slate-400 mt-1">{canManage ? 'Create, edit or deactivate classes in the live academic database.' : 'Read-only class information from your authorised school or trainer scope.'}</p></div>
          <div className="flex flex-wrap gap-2">
            {user?.role === 'admin' || user?.role === 'superadmin' ? <select className="field min-w-[220px]" value={schoolId} onChange={e => setSchoolId(e.target.value)}><option value="">All schools</option>{schools.filter(s => norm(s.status) !== 'inactive').map(s => <option key={s.id} value={s.id}>{schoolName(s)} ({s.school_code})</option>)}</select> : null}
            {canManage && <button type="button" onClick={openNewClass} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black"><Plus size={14}/> New class</button>}
            {(canManage && user?.role !== 'trainer') && <button type="button" onClick={openNewSession} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black"><CalendarDays size={14}/> Schedule session</button>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {scopedClasses.map(item => {
          const school = schools.find(s => [s.id, s.school_id, s.school_code, s.code].some(v => same(v, item.school_id) || same(v, item.school_code)));
          return <article key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.14em] font-black text-blue-600">{schoolName(school)}</p><h3 className="text-lg font-black text-slate-900 mt-1">{item.display_name || `${item.grade}-${item.section}`}</h3></div><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{item.status || 'active'}</span></div><div className="grid grid-cols-2 gap-3 mt-4"><div className="rounded-xl bg-slate-50 border border-slate-100 p-3"><Users size={15} className="text-blue-600"/><p className="text-xl font-black mt-2">{studentCount(item.id)}</p><p className="text-[10px] uppercase font-black text-slate-400">Students</p></div><div className="rounded-xl bg-slate-50 border border-slate-100 p-3"><CalendarDays size={15} className="text-violet-600"/><p className="text-xl font-black mt-2">{scopedSessions.filter(s => String(s.school_class || s.class_id) === String(item.id)).length}</p><p className="text-[10px] uppercase font-black text-slate-400">Sessions</p></div></div>{canManage && <div className="flex gap-2 mt-4"><button type="button" onClick={() => editClass(item)} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black inline-flex items-center gap-1"><Edit3 size={12}/> Edit</button><button type="button" onClick={() => deactivateClass(item)} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black inline-flex items-center gap-1"><XCircle size={12}/> Deactivate</button></div>}</article>;
        })}
        {!scopedClasses.length && <div className="md:col-span-2 xl:col-span-3 bg-white rounded-2xl border border-slate-200 p-10"><EmptyState icon={<SchoolIcon size={20}/>} title="No classes in this scope" description="The Django API returned no active classes for the selected school or your authorised scope."/></div>}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-5 border-b border-slate-100"><p className="text-[10px] uppercase tracking-[.16em] text-violet-600 font-black">Session register</p><h2 className="text-xl font-black mt-1">Scheduled sessions</h2><p className="text-xs text-slate-400 mt-1">Statuses come directly from the canonical Session record.</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Date','Class','Trainer','Topic','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400 font-black">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{scopedSessions.slice(0, 100).map(session => { const st = norm(session.status); return <tr key={session.id}><td className="px-4 py-3 whitespace-nowrap"><p className="font-semibold">{session.date || '—'}</p><p className="text-[10px] text-slate-400">{session.start_time || '—'} {session.end_time ? `→ ${session.end_time}` : ''}</p></td><td className="px-4 py-3"><p className="font-bold">{session.class_name || session.class_id || '—'}</p></td><td className="px-4 py-3">{session.trainer_name || session.trainer_id || '—'}</td><td className="px-4 py-3"><p className="font-bold">{session.topic || '—'}</p><p className="text-[10px] text-slate-400">{session.notes || ''}</p></td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{st === 'completed' ? <CheckCircle2 size={11}/> : st === 'in_progress' ? <Clock3 size={11}/> : <CalendarDays size={11}/>} {st || 'unknown'}</span></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{canManage && st === 'planned' && <button type="button" disabled={saving} onClick={() => sessionAction(session.id,'start')} className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-black">Start</button>}{canManage && st === 'in_progress' && <button type="button" disabled={saving} onClick={() => sessionAction(session.id,'complete')} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black inline-flex items-center gap-1"><Lock size={11}/> Complete</button>}{st === 'completed' && <span className="text-[10px] text-slate-400 font-bold">Locked history</span>}</div></td></tr>; })}{!scopedSessions.length && <tr><td colSpan={6} className="p-8"><EmptyState icon={<UserCheck size={18}/>} title="No sessions found" description="No sessions are currently present in your authorised class scope."/></td></tr>}</tbody></table></div></section>

      {classModal && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"><form onSubmit={saveClass} className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h3 className="font-black text-lg">{classModal.id ? 'Edit class' : 'Create class'}</h3><p className="text-xs text-slate-400 mt-1">Grade and section are authoritative academic identifiers.</p></div><button type="button" onClick={() => setClassModal(null)} className="p-2 rounded-lg hover:bg-slate-100"><XCircle size={17}/></button></div><div className="p-5 space-y-3"><select className="field" value={classForm.school} onChange={e => setClassForm(v => ({...v, school: e.target.value}))} disabled={user?.role === 'school'} required><option value="">Select school</option>{schools.filter(s => norm(s.status) !== 'inactive').map(s => <option key={s.id} value={s.id}>{schoolName(s)} ({s.school_code})</option>)}</select><input className="field" type="number" min="1" max="12" placeholder="Grade" value={classForm.grade} onChange={e => setClassForm(v => ({...v, grade: e.target.value}))} required/><input className="field" maxLength="4" placeholder="Section" value={classForm.section} onChange={e => setClassForm(v => ({...v, section: e.target.value}))} required/></div><div className="p-5 border-t border-slate-100 flex justify-end gap-2"><button type="button" onClick={() => setClassModal(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-50">{saving ? 'Saving…' : 'Save class'}</button></div></form></div>}

      {sessionModal && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"><form onSubmit={saveSession} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h3 className="font-black text-lg">Schedule session</h3><p className="text-xs text-slate-400 mt-1">Only trainers assigned to the selected school should be scheduled.</p></div><button type="button" onClick={() => setSessionModal(false)} className="p-2 rounded-lg hover:bg-slate-100"><XCircle size={17}/></button></div><div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3"><select className="field" value={sessionForm.school_class} onChange={e => setSessionForm(v => ({...v, school_class:e.target.value}))} required><option value="">Select class</option>{scopedClasses.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}</select><select className="field" value={sessionForm.trainer} onChange={e => setSessionForm(v => ({...v, trainer:e.target.value}))} required><option value="">Select trainer</option>{visibleTrainers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.trainer_id})</option>)}</select><input className="field" type="date" value={sessionForm.date} onChange={e => setSessionForm(v=>({...v,date:e.target.value}))} required/><input className="field" type="time" value={sessionForm.start_time} onChange={e => setSessionForm(v=>({...v,start_time:e.target.value}))} required/><input className="field" type="time" value={sessionForm.end_time} onChange={e => setSessionForm(v=>({...v,end_time:e.target.value}))}/><input className="field" placeholder="Session topic" value={sessionForm.topic} onChange={e=>setSessionForm(v=>({...v,topic:e.target.value}))} required/><textarea className="field min-h-24 md:col-span-2" placeholder="Notes (optional)" value={sessionForm.notes} onChange={e=>setSessionForm(v=>({...v,notes:e.target.value}))}/></div><div className="p-5 border-t border-slate-100 flex justify-end gap-2"><button type="button" onClick={() => setSessionModal(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-50">{saving ? 'Scheduling…' : 'Schedule session'}</button></div></form></div>}
      <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}`}</style>
    </div>
  );
}
