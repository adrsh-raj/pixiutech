import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, CircleOff, Plus, Search, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const emptyForm = { name: '', email: '', phone: '', qualification: '', specialization: '', daily_rate: '', weekly_days: 2, rating: '', status: 'active', password: '', assigned_schools: [] };
const list = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const keyList = (...values) => values.filter(Boolean).map(value => String(value).trim()).filter(Boolean);
const normal = value => String(value ?? '').trim().toLowerCase();

export default function TrainerOperations() {
  const { user } = useAuth();
  const { trainers = [], schools = [], addTrainer, updateTrainerStatus, refreshAll, loading } = useData();
  const toast = useToast();
  const [assignments, setAssignments] = useState([]);
  const [assignmentError, setAssignmentError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadAssignments = async () => {
    try {
      const response = await apiFetch('/trainer-school-assignments', { cache: 'no-store' });
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(payload.detail || payload.error || `Unable to load trainer assignments (${response.status}).`);
      setAssignments(list(payload)); setAssignmentError('');
    } catch (error) { setAssignmentError(error.message); }
  };
  useEffect(() => { loadAssignments(); }, []);

  const activeSchools = useMemo(() => schools.filter(school => normal(school.status) === 'active'), [schools]);
  const schoolByKey = useMemo(() => {
    const map = new Map();
    schools.forEach(school => keyList(school.id, school.school_id, school.school_code, school.code).forEach(key => map.set(key, school)));
    return map;
  }, [schools]);
  const trainerAssignmentMap = useMemo(() => {
    const map = new Map();
    assignments.filter(item => normal(item.status || 'active') === 'active').forEach(item => {
      const trainerKeys = keyList(item.trainer, item.trainer_id);
      const schoolKeys = keyList(item.school, item.school_id, item.school_code);
      trainerKeys.forEach(trainerKey => {
        const existing = map.get(trainerKey) || [];
        schoolKeys.forEach(schoolKey => { if (!existing.includes(schoolKey)) existing.push(schoolKey); });
        map.set(trainerKey, existing);
      });
    });
    return map;
  }, [assignments]);
  const assignedSchools = trainer => {
    const keys = trainerAssignmentMap.get(String(trainer.id)) || trainerAssignmentMap.get(String(trainer.trainer_id)) || [];
    return keys;
  };

  const filteredTrainers = useMemo(() => {
    const text = query.trim().toLowerCase();
    return trainers.filter(trainer => {
      const schoolsForTrainer = assignedSchools(trainer);
      const matchesText = !text || [trainer.trainer_id, trainer.account_username, trainer.name, trainer.email, trainer.phone, trainer.specialization].some(value => String(value || '').toLowerCase().includes(text));
      const matchesStatus = statusFilter === 'all' || normal(trainer.status) === statusFilter;
      const matchesSchool = schoolFilter === 'all' || schoolsForTrainer.some(key => normal(key) === normal(schoolFilter));
      return matchesText && matchesStatus && matchesSchool;
    });
  }, [trainers, query, statusFilter, schoolFilter, trainerAssignmentMap]);

  const stats = useMemo(() => {
    const assigned = new Set();
    let unassigned = 0;
    trainers.forEach(trainer => { const current = assignedSchools(trainer); if (!current.length) unassigned += 1; current.forEach(key => assigned.add(key)); });
    return { total: trainers.length, active: trainers.filter(trainer => normal(trainer.status) === 'active').length, schoolsWithFaculty: [...assigned].map(key => schoolByKey.get(key)).filter(Boolean).length, unassigned };
  }, [trainers, trainerAssignmentMap, schoolByKey]);

  const openCreate = () => { setForm({ ...emptyForm, assigned_schools: activeSchools.length === 1 ? [activeSchools[0].school_code] : [] }); setShowModal(true); };
  const closeCreate = () => { if (!submitting) setShowModal(false); };
  const toggleSchool = code => setForm(prev => ({ ...prev, assigned_schools: prev.assigned_schools.includes(code) ? prev.assigned_schools.filter(value => value !== code) : [...prev.assigned_schools, code] }));

  const handleSubmit = async event => {
    event.preventDefault();
    if (submitting) return;
    const name = form.name.trim();
    if (!name) return toast.error('Trainer name is required.', 'Trainer setup failed');
    if (form.password.length < 12) return toast.error('Trainer password must be at least 12 characters.', 'Trainer setup failed');
    if (!form.assigned_schools.length) return toast.error('Select at least one active school.', 'Trainer setup failed');
    setSubmitting(true);
    const result = await addTrainer({ name, email: form.email.trim(), phone: form.phone.trim(), qualification: form.qualification.trim(), specialization: form.specialization.trim(), daily_rate: form.daily_rate === '' ? null : Number(form.daily_rate), weekly_days: form.weekly_days === '' ? null : Number(form.weekly_days), rating: form.rating === '' ? null : Number(form.rating), status: form.status, password: form.password, assigned_schools: form.assigned_schools });
    setSubmitting(false);
    if (!result?.success) return toast.error(result?.error || 'Trainer could not be created.', 'Trainer setup failed');
    await Promise.all([refreshAll(), loadAssignments()]);
    setShowModal(false); setForm(emptyForm);
    toast.success(`Trainer ${result.data?.trainer_id || result.data?.account_username || ''} created successfully.`, 'Trainer created');
  };

  const handleStatus = async trainer => {
    const nextStatus = normal(trainer.status) === 'active' ? 'inactive' : 'active';
    const result = await updateTrainerStatus(trainer.id, nextStatus);
    if (!result?.success) return toast.error(result?.error || 'Unable to update trainer status.', 'Trainer status failed');
    await Promise.all([refreshAll(), loadAssignments()]);
    toast.success(`${trainer.name} is now ${nextStatus}.`, 'Trainer status updated');
  };

  return <div className="space-y-6 max-w-7xl mx-auto pb-12">
    <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm"><div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5"><div><div className="flex items-center gap-2 mb-2"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider"><ShieldCheck size={12}/> Database Connected</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin: {user?.username || '—'}</span></div><h1 className="text-2xl font-black tracking-tight text-slate-900">Trainer Faculty & Academic Operations</h1><p className="text-sm text-slate-500 mt-1">Live trainer roster and school assignments from Django/PostgreSQL records.</p></div><button type="button" onClick={openCreate} disabled={!activeSchools.length || submitting} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50"><Plus size={17}/> Add Trainer</button></div>{!activeSchools.length&&<div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold">No active school exists in the database yet. Create and activate a school before assigning a trainer.</div>}{assignmentError&&<div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">Trainer-school assignments unavailable: {assignmentError}</div>}</section>
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{[['Total Trainers',stats.total,UsersRound,'bg-blue-50','text-blue-600'],['Active Trainers',stats.active,CheckCircle2,'bg-emerald-50','text-emerald-600'],['Schools With Faculty',stats.schoolsWithFaculty,Building2,'bg-violet-50','text-violet-600'],['Unassigned Trainers',stats.unassigned,CircleOff,'bg-amber-50','text-amber-600']].map(([label,value,Icon,bg,text])=><div key={label} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4"><div className={`w-11 h-11 rounded-xl ${bg} ${text} flex items-center justify-center`}><Icon size={21}/></div><div><div className="text-[10px] uppercase tracking-wider font-black text-slate-400">{label}</div><div className="text-2xl font-black text-slate-900 mt-0.5">{value}</div></div></div>)}</section>
    <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between"><div className="relative flex-1 max-w-xl"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search trainer name, ID, phone, email..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"/></div><div className="flex gap-2"><select value={schoolFilter} onChange={e=>setSchoolFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold"><option value="all">All Schools ({activeSchools.length})</option>{activeSchools.map(s=><option key={s.id} value={s.school_code}>{s.name} ({s.school_code})</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold"><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-black"><tr><th className="px-5 py-3.5">Trainer</th><th className="px-5 py-3.5">Contact</th><th className="px-5 py-3.5">Assigned Schools</th><th className="px-5 py-3.5">Rate / Days</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredTrainers.map(trainer=>{const assignmentsForTrainer=assignedSchools(trainer); const isActive=normal(trainer.status)==='active'; return <tr key={trainer.id||trainer.trainer_id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><UserRound size={18}/></div><div><div className="font-bold text-slate-900">{trainer.name||'Unnamed trainer'}</div><div className="text-[11px] font-mono text-blue-600">{trainer.trainer_id||trainer.account_username||'—'}</div></div></div></td><td className="px-5 py-4"><div>{trainer.email||'—'}</div><div className="text-xs text-slate-400 mt-1">{trainer.phone||'No phone'}</div></td><td className="px-5 py-4"><div className="flex flex-wrap gap-1.5">{assignmentsForTrainer.length?assignmentsForTrainer.map(key=><span key={key} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">{schoolByKey.get(key)?.name||schoolByKey.get(key)?.school_code||key}</span>):<span className="text-slate-400 text-xs">Not assigned</span>}</div></td><td className="px-5 py-4"><div className="font-semibold text-slate-800">{trainer.daily_rate!=null?`₹${Number(trainer.daily_rate).toLocaleString('en-IN')}`:'—'}</div><div className="text-xs text-slate-400 mt-1">{trainer.weekly_days?`${trainer.weekly_days} days/week`:'—'}</div></td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-black border ${isActive?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-slate-100 text-slate-500 border-slate-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${isActive?'bg-emerald-500':'bg-slate-400'}`}/>{trainer.status||'unknown'}</span></td><td className="px-5 py-4 text-right"><button type="button" disabled={loading} onClick={()=>handleStatus(trainer)} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-50">{isActive?'Deactivate':'Activate'}</button></td></tr>})}{!filteredTrainers.length&&<tr><td colSpan="6" className="px-5 py-16 text-center"><div className="text-sm font-bold text-slate-600">No trainer records found</div><div className="text-xs text-slate-400 mt-1">{trainers.length?'Try changing the search or filters.':'The trainer table is empty. Add the first trainer after creating an active school.'}</div></td></tr>}</tbody></table></div>{loading&&<div className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">Refreshing live records…</div>}</section>
    {showModal&&<div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200"><div className="sticky top-0 bg-white/95 backdrop-blur z-10 px-6 py-4 border-b border-slate-100 flex items-center justify-between"><div><h2 className="font-black text-lg text-slate-900">Create Trainer Account</h2><p className="text-xs text-slate-400 mt-0.5">Trainer ID and login username are generated by the backend.</p></div><button type="button" onClick={closeCreate} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X size={18}/></button></div><form onSubmit={handleSubmit} className="p-6 space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[['name','Full Name','text',true],['email','Email','email',false],['phone','Phone','tel',false],['qualification','Qualification','text',false],['specialization','Specialization','text',false],['daily_rate','Daily Rate (₹)','number',false]].map(([key,label,type,required])=><label key={key} className="block text-sm font-semibold text-slate-600">{label}<input required={required} type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200"/></label>)}<label className="block text-sm font-semibold text-slate-600">Password<input required minLength="12" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200"/></label></div><div><p className="text-sm font-bold text-slate-700 mb-2">Assign Active Schools</p>{activeSchools.length?<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{activeSchools.map(s=><button type="button" key={s.id} onClick={()=>toggleSchool(s.school_code)} className={`p-3 rounded-xl border text-left text-xs font-bold ${form.assigned_schools.includes(s.school_code)?'border-blue-400 bg-blue-50 text-blue-800':'border-slate-200 bg-white text-slate-600'}`}>{s.name}<span className="block text-[10px] font-mono text-slate-400 mt-1">{s.school_code}</span></button>)}</div>:<div className="text-sm text-slate-400">No active schools available.</div>}</div><div className="flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" disabled={submitting} onClick={closeCreate} className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-black">{submitting?'Creating…':'Create Trainer'}</button></div></form></div></div>}
  </div>;
}
