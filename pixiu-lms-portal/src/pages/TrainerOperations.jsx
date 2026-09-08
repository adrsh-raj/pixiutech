import { useMemo, useState } from 'react';
import { Building2, CheckCircle2, CircleOff, Mail, Phone, Plus, Search, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  qualification: '',
  specialization: '',
  daily_rate: '',
  weekly_days: 2,
  rating: '',
  status: 'Active',
  password: '',
  assigned_schools: [],
};

const normalizeAssignments = value => {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

export default function TrainerOperations() {
  const { user } = useAuth();
  const { trainers, schools, addTrainer, updateTrainerStatus, loading } = useData();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const activeSchools = useMemo(
    () => (schools || []).filter(school => String(school.status || '').toLowerCase() === 'active'),
    [schools]
  );

  const schoolByCode = useMemo(() => {
    const map = new Map();
    (schools || []).forEach(school => {
      [school.school_code, school.code, school.school_id, school.id]
        .filter(Boolean)
        .forEach(key => map.set(String(key), school));
    });
    return map;
  }, [schools]);

  const filteredTrainers = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (trainers || []).filter(trainer => {
      const assignments = normalizeAssignments(trainer.assigned_schools);
      const matchesText = !text || [
        trainer.trainer_id,
        trainer.account_username,
        trainer.name,
        trainer.email,
        trainer.phone,
        trainer.specialization,
      ].some(value => String(value || '').toLowerCase().includes(text));
      const matchesStatus = statusFilter === 'all' || String(trainer.status || '').toLowerCase() === statusFilter;
      const matchesSchool = schoolFilter === 'all' || assignments.includes(schoolFilter);
      return matchesText && matchesStatus && matchesSchool;
    });
  }, [trainers, query, statusFilter, schoolFilter]);

  const stats = useMemo(() => {
    const rows = trainers || [];
    const active = rows.filter(t => String(t.status || '').toLowerCase() === 'active').length;
    const assignedSchools = new Set(rows.flatMap(t => normalizeAssignments(t.assigned_schools)));
    const unassigned = rows.filter(t => normalizeAssignments(t.assigned_schools).length === 0).length;
    return { total: rows.length, active, assignedSchools: assignedSchools.size, unassigned };
  }, [trainers]);

  const openCreate = () => {
    setForm({ ...emptyForm, assigned_schools: activeSchools.length === 1 ? [activeSchools[0].school_code] : [] });
    setShowModal(true);
  };

  const closeCreate = () => {
    if (!submitting) setShowModal(false);
  };

  const toggleSchool = code => {
    setForm(previous => ({
      ...previous,
      assigned_schools: previous.assigned_schools.includes(code)
        ? previous.assigned_schools.filter(value => value !== code)
        : [...previous.assigned_schools, code],
    }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    const name = form.name.trim();
    const password = form.password;
    if (!name) return toast.error('Trainer name is required.');
    if (password.length < 12) return toast.error('Trainer password must be at least 12 characters.');
    if (!form.assigned_schools.length) return toast.error('Select at least one active school from the database.');

    setSubmitting(true);
    const result = await addTrainer({
      name,
      email: form.email.trim(),
      phone: form.phone.trim(),
      qualification: form.qualification.trim(),
      specialization: form.specialization.trim(),
      daily_rate: form.daily_rate === '' ? null : Number(form.daily_rate),
      weekly_days: form.weekly_days === '' ? null : Number(form.weekly_days),
      rating: form.rating === '' ? null : Number(form.rating),
      status: form.status,
      password,
      assigned_schools: form.assigned_schools,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error || 'Trainer could not be created.', 'Trainer Setup Failed');
      return;
    }

    setShowModal(false);
    setForm(emptyForm);
    const createdId = result.data?.trainer_id || result.data?.legacy_id || result.data?.account_username || 'new trainer';
    toast.success(`Trainer ${createdId} created and assigned from the live database.`, 'Trainer Created');
  };

  const handleStatus = async trainer => {
    const nextStatus = String(trainer.status || '').toLowerCase() === 'active' ? 'Inactive' : 'Active';
    const result = await updateTrainerStatus(trainer.id, nextStatus);
    if (!result.success) toast.error(result.error || 'Unable to update trainer status.');
    else toast.success(`${trainer.name} is now ${nextStatus.toLowerCase()}.`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider"><ShieldCheck size={12} /> Database Connected</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin: {user?.username || '—'}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Trainer Faculty & Academic Operations</h1>
            <p className="text-sm text-slate-500 mt-1">Live trainer roster driven only by the Django/PostgreSQL records. No seeded school or trainer names are used in this screen.</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm disabled:opacity-50" disabled={!activeSchools.length}>
            <Plus size={17} /> Add Trainer
          </button>
        </div>
        {!activeSchools.length && (
          <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold">
            No active school exists in the database yet. Create and activate a school before assigning a trainer.
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          ['Total Trainers', stats.total, UsersRound, 'text-blue-600', 'bg-blue-50'],
          ['Active Trainers', stats.active, CheckCircle2, 'text-emerald-600', 'bg-emerald-50'],
          ['Schools With Faculty', stats.assignedSchools, Building2, 'text-violet-600', 'bg-violet-50'],
          ['Unassigned Trainers', stats.unassigned, CircleOff, 'text-amber-600', 'bg-amber-50'],
        ].map(([label, value, Icon, text, bg]) => (
          <div key={label} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${bg} ${text} flex items-center justify-center`}><Icon size={21} /></div>
            <div><div className="text-[10px] uppercase tracking-wider font-black text-slate-400">{label}</div><div className="text-2xl font-black text-slate-900 mt-0.5">{value}</div></div>
          </div>
        ))}
      </section>

      <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search trainer name, ID, phone, email..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15" />
          </div>
          <div className="flex gap-2">
            <select value={schoolFilter} onChange={event => setSchoolFilter(event.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700">
              <option value="all">All Schools ({activeSchools.length})</option>
              {activeSchools.map(school => <option key={school.id} value={school.school_code}>{school.name} ({school.school_code})</option>)}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700">
              <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-black">
              <tr><th className="px-5 py-3.5">Trainer</th><th className="px-5 py-3.5">Contact</th><th className="px-5 py-3.5">Assigned Schools</th><th className="px-5 py-3.5">Rate / Days</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrainers.map(trainer => {
                const assignments = normalizeAssignments(trainer.assigned_schools);
                const isActive = String(trainer.status || '').toLowerCase() === 'active';
                return (
                  <tr key={trainer.id || trainer.trainer_id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4 min-w-[240px]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><UserRound size={18} /></div>
                        <div><div className="font-bold text-slate-900">{trainer.name || 'Unnamed Trainer'}</div><div className="text-[11px] font-mono text-blue-600">{trainer.trainer_id || trainer.account_username || '—'}</div></div>
                      </div>
                    </td>
                    <td className="px-5 py-4 min-w-[220px]"><div className="text-slate-700">{trainer.email || '—'}</div><div className="text-xs text-slate-400 mt-1">{trainer.phone || 'No phone'}</div></td>
                    <td className="px-5 py-4 min-w-[220px]">
                      <div className="flex flex-wrap gap-1.5">
                        {assignments.length ? assignments.map(code => <span key={code} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">{schoolByCode.get(code)?.name || code}</span>) : <span className="text-slate-400 text-xs">Not assigned</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4"><div className="font-semibold text-slate-800">{trainer.daily_rate != null ? `₹${Number(trainer.daily_rate).toLocaleString('en-IN')}` : '—'}</div><div className="text-xs text-slate-400 mt-1">{trainer.weekly_days ? `${trainer.weekly_days} days/week` : '—'}</div></td>
                    <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-black border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}><span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{trainer.status || 'Unknown'}</span></td>
                    <td className="px-5 py-4 text-right"><button onClick={() => handleStatus(trainer)} className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">{isActive ? 'Deactivate' : 'Activate'}</button></td>
                  </tr>
                );
              })}
              {!filteredTrainers.length && <tr><td colSpan="6" className="px-5 py-16 text-center"><div className="text-sm font-bold text-slate-600">No trainer records found</div><div className="text-xs text-slate-400 mt-1">{trainers?.length ? 'Try changing the search or filters.' : 'The trainer table is currently empty. Add the first trainer after creating an active school.'}</div></td></tr>}
            </tbody>
          </table>
        </div>
        {loading && <div className="px-5 py-3 text-xs font-semibold text-slate-400 border-t border-slate-100">Refreshing live records…</div>}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
            <div className="sticky top-0 bg-white/95 backdrop-blur z-10 px-6 py-4 border-b border-slate-100 flex items-center justify-between"><div><h2 className="font-black text-lg text-slate-900">Create Trainer Account</h2><p className="text-xs text-slate-400 mt-0.5">Trainer ID and login username are generated by the backend.</p></div><button onClick={closeCreate} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X size={18} /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ['name', 'Full Name', 'text', true], ['email', 'Email', 'email', false], ['phone', 'Phone', 'tel', false],
                  ['qualification', 'Qualification', 'text', false], ['specialization', 'Specialization', 'text', false], ['daily_rate', 'Daily Rate (₹)', 'number', false],
                  ['weekly_days', 'Teaching Days / Week', 'number', false], ['rating', 'Rating (0–5)', 'number', false],
                ].map(([key, label, type, required]) => (
                  <label key={key} className="text-xs font-bold text-slate-600">{label}<input required={required} type={type} min={key === 'weekly_days' ? 1 : key === 'rating' ? 0 : undefined} max={key === 'weekly_days' ? 7 : key === 'rating' ? 5 : undefined} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15" /></label>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600">Trainer Password <span className="text-slate-400">(minimum 12 characters)</span></label>
                <input type="password" required minLength={12} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15" autoComplete="new-password" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-xs font-bold text-slate-600">Assign Active Schools</label><span className="text-[11px] font-semibold text-slate-400">{form.assigned_schools.length} selected</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeSchools.map(school => {
                    const checked = form.assigned_schools.includes(school.school_code);
                    return <button type="button" key={school.id} onClick={() => toggleSchool(school.school_code)} className={`text-left p-3 rounded-xl border transition-colors ${checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><div className="font-bold text-sm text-slate-800">{school.name}</div><div className="text-[11px] font-mono text-slate-400 mt-0.5">{school.school_code}</div></button>;
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={closeCreate} disabled={submitting} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600">Cancel</button><button type="submit" disabled={submitting || !activeSchools.length} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50">{submitting ? 'Creating…' : 'Create Trainer'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
