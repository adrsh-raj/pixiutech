import { useEffect, useMemo, useState } from 'react';
import { Check, Edit3, Link2, RefreshCw, Users, X } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const list = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const active = value => String(value || '').trim().toLowerCase() === 'active';
const key = value => String(value ?? '').trim();

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || payload.message || `Request failed (${response.status})`);
  return payload;
}

export default function TrainerAssignments() {
  const [trainers, setTrainers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [trainerResponse, schoolResponse, assignmentResponse] = await Promise.all([
        request('/trainers'), request('/schools'), request('/trainer-school-assignments'),
      ]);
      setTrainers(list(trainerResponse)); setSchools(list(schoolResponse)); setAssignments(list(assignmentResponse));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const activeTrainers = useMemo(() => trainers.filter(t => active(t.status)), [trainers]);
  const activeSchools = useMemo(() => schools.filter(s => active(s.status)), [schools]);
  const trainerName = useMemo(() => trainers.find(t => key(t.id) === key(selectedTrainer) || key(t.trainer_id) === key(selectedTrainer))?.name || '', [selectedTrainer, trainers]);
  const currentAssignments = useMemo(() => assignments.filter(a => active(a.status) && (key(a.trainer) === key(selectedTrainer) || key(a.trainer_id) === key(selectedTrainer))), [assignments, selectedTrainer]);

  const openEditor = trainer => {
    const trainerKey = key(trainer.id);
    const current = assignments.filter(a => active(a.status) && (key(a.trainer) === trainerKey || key(a.trainer_id) === key(trainer.trainer_id))).map(a => key(a.school));
    setSelectedTrainer(trainerKey); setSelectedSchools(current); setEditing(trainer);
  };
  const toggleSchool = schoolId => setSelectedSchools(prev => prev.includes(key(schoolId)) ? prev.filter(id => id !== key(schoolId)) : [...prev, key(schoolId)]);

  const save = async () => {
    if (!editing) return;
    setSaving(true); setError('');
    try {
      const selected = new Set(selectedSchools.map(key));
      const current = assignments.filter(a => active(a.status) && (key(a.trainer) === key(editing.id) || key(a.trainer_id) === key(editing.trainer_id)));
      const currentBySchool = new Map(current.map(a => [key(a.school), a]));
      for (const assignment of current) {
        const school = key(assignment.school);
        if (!selected.has(school)) await request(`/trainer-school-assignments/${encodeURIComponent(assignment.id)}`, 'PATCH', { status: 'inactive', assigned_to: new Date().toISOString().slice(0,10) });
      }
      for (const schoolId of selectedSchools) {
        if (currentBySchool.has(key(schoolId))) continue;
        await request('/trainer-school-assignments', 'POST', { trainer: editing.id, school: schoolId, status: 'active', assigned_from: new Date().toISOString().slice(0,10) });
      }
      await load(); setEditing(null); setSelectedTrainer(''); setSelectedSchools([]);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Admin" title="Trainer–School Assignments" description="One place to assign, edit and deactivate trainer-school relationships. Only active schools and active trainers can be assigned." actions={<RefreshButton onRefresh={load} loading={loading || saving} />} />
    {error && <ErrorState title="Assignment action failed" description={error} onRetry={load} />}
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-100"><h2 className="font-black text-slate-900">Current active assignments</h2><p className="text-xs text-slate-400 mt-1">Edit a trainer to change exactly which schools they can teach.</p></div>{loading ? <div className="p-12 text-center text-sm text-slate-400">Loading assignments…</div> : assignments.filter(a => active(a.status)).length === 0 ? <div className="p-12"><EmptyState icon={<Link2 size={20}/>} title="No active assignments" description="Create a trainer, create a school, then connect them here."/></div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-5 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400">Trainer</th><th className="px-5 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400">School</th><th className="px-5 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400">From</th><th className="px-5 py-3 text-right text-[10px] uppercase tracking-wide text-slate-400">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{assignments.filter(a => active(a.status)).map(a => <tr key={a.id}><td className="px-5 py-3 font-semibold">{a.trainer_id || a.trainer || '—'}</td><td className="px-5 py-3">{a.school_code || a.school || '—'}</td><td className="px-5 py-3 text-slate-500">{a.assigned_from || '—'}</td><td className="px-5 py-3 text-right"><button type="button" onClick={() => { const t = trainers.find(item => key(item.id) === key(a.trainer) || key(item.trainer_id) === key(a.trainer_id)); if (t) openEditor(t); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-xs font-bold"><Edit3 size={13}/> Edit trainer schools</button></td></tr>)}</tbody></table></div>}</section>
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"><div className="flex items-center gap-2 mb-4"><Users size={17} className="text-blue-600"/><h2 className="font-black">Trainer roster</h2></div>{activeTrainers.length ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{activeTrainers.map(trainer => { const count = assignments.filter(a => active(a.status) && (key(a.trainer) === key(trainer.id) || key(a.trainer_id) === key(trainer.trainer_id))).length; return <button type="button" key={trainer.id} onClick={() => openEditor(trainer)} className="text-left rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50/30"><p className="font-black text-slate-900">{trainer.name}</p><p className="text-[10px] font-mono text-blue-600 mt-1">{trainer.trainer_id}</p><p className="text-xs text-slate-400 mt-2">{count} active school{count === 1 ? '' : 's'}</p></button>; })}</div> : <EmptyState title="No active trainers" description="Create an active trainer first."/>}</section>
    {editing && <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"><div className="flex items-center justify-between p-5 border-b border-slate-100"><div><h2 className="font-black text-lg text-slate-900">Assign schools</h2><p className="text-xs text-slate-400 mt-1">{trainerName}</p></div><button type="button" onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-slate-100"><X size={18}/></button></div><div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">{activeSchools.map(school => { const checked = selectedSchools.includes(key(school.id)); return <button type="button" key={school.id} onClick={() => toggleSchool(school.id)} className={`w-full flex items-center justify-between gap-3 rounded-xl border p-4 text-left ${checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}><div><p className="font-bold text-slate-900">{school.name}</p><p className="text-[10px] font-mono text-slate-400">{school.school_code}</p></div>{checked ? <Check size={18} className="text-blue-600"/> : <span className="w-5 h-5 rounded-md border border-slate-300"/>}</button>; })}</div><div className="flex justify-end gap-2 p-5 border-t border-slate-100"><button type="button" disabled={saving} onClick={() => setEditing(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button type="button" disabled={saving || !selectedSchools.length} onClick={save} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-50">{saving ? <><RefreshCw size={14} className="inline mr-1 animate-spin"/>Saving…</> : 'Save assignments'}</button></div></div></div>}
  </div>;
}
