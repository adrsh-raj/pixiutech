import { useMemo, useState } from 'react';
import { BookOpen, Building2, CalendarDays, CheckCircle2, Plus, UserRound, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import KpiCard from '../components/ui/KpiCard';

const emptySchool = { name: '', school_code: '', principal_name: '', phone: '', email: '', address: '', lab_name: '', lab_location: '' };
const assignments = value => Array.isArray(value) ? value.map(v => String(v).trim()).filter(Boolean) : String(value || '').split(',').map(v => v.trim()).filter(Boolean);

export default function AdminCommandCenter() {
  const { schools, classes, students, trainers, sessions, addSchool, loading } = useData();
  const toast = useToast();
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [schoolForm, setSchoolForm] = useState(emptySchool);
  const [saving, setSaving] = useState(false);

  const activeSchools = useMemo(() => (schools || []).filter(s => String(s.status || '').toLowerCase() === 'active'), [schools]);
  const scoped = useMemo(() => {
    if (selectedSchool === 'all') return { schools: schools || [], classes: classes || [], students: students || [], trainers: trainers || [], sessions: sessions || [] };
    return {
      schools: (schools || []).filter(s => s.school_code === selectedSchool),
      classes: (classes || []).filter(c => c.school_id === selectedSchool || c.school_code === selectedSchool),
      students: (students || []).filter(s => s.school_id === selectedSchool || s.school_code === selectedSchool),
      trainers: (trainers || []).filter(t => assignments(t.assigned_schools).includes(selectedSchool)),
      sessions: (sessions || []).filter(s => s.school_id === selectedSchool || s.school_code === selectedSchool),
    };
  }, [schools, classes, students, trainers, sessions, selectedSchool]);

  const activeTrainers = scoped.trainers.filter(t => String(t.status || '').toLowerCase() === 'active');
  const upcomingSessions = useMemo(() => [...scoped.sessions].filter(s => !['completed', 'cancelled'].includes(String(s.status || '').toLowerCase())).sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`)).slice(0, 6), [scoped.sessions]);
  const schoolName = selectedSchool === 'all' ? 'Entire Network' : (schools || []).find(s => s.school_code === selectedSchool)?.name || selectedSchool;

  const submitSchool = async event => {
    event.preventDefault();
    const code = schoolForm.school_code.trim().toUpperCase();
    if (!schoolForm.name.trim() || !code) return toast.error('School name and school code are required.');
    setSaving(true);
    const result = await addSchool({ ...schoolForm, school_code: code, name: schoolForm.name.trim() });
    setSaving(false);
    if (!result.success) return toast.error(result.error || 'School could not be created.', 'School Setup Failed');
    setSchoolForm(emptySchool);
    setShowSchoolModal(false);
    toast.success(`${schoolForm.name} has been added to the live database.`, 'School Onboarded');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Admin Control Plane</p><h1 className="text-3xl font-black tracking-tight text-slate-900 mt-1">Command Center</h1><p className="text-sm text-slate-500 mt-1">Live operational state from Django/PostgreSQL. No demo schools, trainers, classes, or fake metrics are rendered.</p></div>
        <div className="flex gap-2"><button onClick={() => setShowSchoolModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"><Plus size={16} /> Onboard School</button><Link to="/trainers" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold"><UserRound size={16} /> Trainer Faculty</Link></div>
      </section>

      <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3"><Building2 size={18} className="text-blue-600" /><div className="flex-1"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Database Scope</div><select value={selectedSchool} onChange={event => setSelectedSchool(event.target.value)} className="mt-1 w-full max-w-xl bg-transparent font-bold text-sm text-slate-800 focus:outline-none"><option value="all">Entire Network ({activeSchools.length} active schools)</option>{activeSchools.map(school => <option key={school.id} value={school.school_code}>{school.name} ({school.school_code})</option>)}</select></div><span className="text-xs font-semibold text-slate-400">Current scope: {schoolName}</span></section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5"><KpiCard icon={<Building2 size={22} />} label="Active Schools" value={activeSchools.filter(s => selectedSchool === 'all' || s.school_code === selectedSchool).length} color="emerald" /><KpiCard icon={<BookOpen size={22} />} label="Classrooms" value={scoped.classes.length} color="violet" /><KpiCard icon={<UsersRound size={22} />} label="Students" value={scoped.students.length} color="blue" /><KpiCard icon={<UserRound size={22} />} label="Active Trainers" value={activeTrainers.length} color="amber" /></section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><h2 className="font-black text-slate-900">Upcoming Sessions</h2><p className="text-xs text-slate-400 mt-0.5">Current session records</p></div><CalendarDays size={18} className="text-slate-300" /></div><div className="divide-y divide-slate-100">{upcomingSessions.map(session => <div key={session.id} className="px-5 py-4 flex items-center justify-between gap-4"><div><div className="font-bold text-sm text-slate-800">{session.topic || 'Untitled session'}</div><div className="text-xs text-slate-400 mt-1">{session.date || 'No date'} {session.time ? `• ${session.time}` : ''}</div></div><span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{session.status || 'scheduled'}</span></div>)}{!upcomingSessions.length && <div className="px-5 py-12 text-center"><CheckCircle2 size={28} className="mx-auto text-emerald-400"/><div className="mt-2 text-sm font-bold text-slate-600">No upcoming sessions</div><div className="text-xs text-slate-400 mt-1">Configure a school, class, trainer and session to populate this area.</div></div>}</div></section>

        <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100"><h2 className="font-black text-slate-900">Live School Directory</h2><p className="text-xs text-slate-400 mt-0.5">Only API-backed schools are shown</p></div><div className="divide-y divide-slate-100">{activeSchools.map(school => <button key={school.id} onClick={() => setSelectedSchool(school.school_code)} className={`w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 ${selectedSchool === school.school_code ? 'bg-blue-50/50' : ''}`}><div><div className="font-bold text-sm text-slate-800">{school.name}</div><div className="text-[11px] font-mono text-blue-600 mt-1">{school.school_code}</div></div><span className="text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg">Active</span></button>)}{!activeSchools.length && <div className="px-5 py-12 text-center text-sm font-semibold text-slate-500">No active schools in the database yet.</div>}</div></section>
      </div>

      {loading && <div className="text-center text-xs font-semibold text-slate-400">Refreshing live records…</div>}

      {showSchoolModal && <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4"><form onSubmit={submitSchool} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6"><div className="flex items-center justify-between mb-5"><div><h2 className="text-lg font-black text-slate-900">Onboard School</h2><p className="text-xs text-slate-400 mt-0.5">Creates the school record and its inactive account.</p></div><button type="button" onClick={() => setShowSchoolModal(false)} className="text-slate-400 font-bold">Close</button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[['name','School Name','text',true],['school_code','School Code','text',true],['principal_name','Principal Name','text',false],['phone','Phone','tel',false],['email','Email','email',false],['lab_name','Lab Name','text',false],['lab_location','Lab Location','text',false]].map(([key,label,type,required]) => <label key={key} className="text-xs font-bold text-slate-600">{label}<input required={required} value={schoolForm[key]} onChange={event => setSchoolForm({ ...schoolForm, [key]: event.target.value })} type={type} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none" /></label>)}<label className="text-xs font-bold text-slate-600 sm:col-span-2">Address<textarea value={schoolForm.address} onChange={event => setSchoolForm({ ...schoolForm, address: event.target.value })} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none" rows="3" /></label></div><div className="flex justify-end gap-2 mt-6"><button type="button" onClick={() => setShowSchoolModal(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold">Cancel</button><button disabled={saving} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Create School'}</button></div></form></div>}
    </div>
  );
}
