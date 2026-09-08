import { useMemo, useState } from 'react';
import {
  Activity, BarChart3, BookOpen, Box, Building2, CalendarDays, CheckCircle2,
  ClipboardCheck, IndianRupee, Plus, Server, UsersRound, UserRound, Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import KpiCard from '../components/ui/KpiCard';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import RefreshButton from '../components/ui/RefreshButton';
import PageHeader from '../components/ui/PageHeader';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import ErrorState from '../components/ui/ErrorState';

const emptySchool = { name: '', school_code: '', principal_name: '', phone: '', email: '', address: '', lab_name: '', lab_location: '' };

const text = value => String(value ?? '').trim();
const amount = value => {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const dateKey = value => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? text(value).slice(0, 10) : d.toISOString().slice(0, 10);
};
const sameDay = (value, target) => dateKey(value) === target;
const lower = value => text(value).toLowerCase();

function pickAmount(row, keys) {
  for (const key of keys) {
    const n = amount(row?.[key]);
    if (n) return n;
  }
  return 0;
}

function ChartCard({ title, subtitle, children, empty }) {
  return <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden min-w-0">
    <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
      <div><h2 className="font-black text-slate-900">{title}</h2>{subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}</div>
      <BarChart3 size={17} className="text-slate-300 shrink-0" />
    </div>
    <div className="p-5">{empty ? <EmptyState title={`No ${title.toLowerCase()} available yet`} description="This panel will populate automatically when matching records are added to the database." /> : children}</div>
  </section>;
}

function MiniBars({ items, valueKey = 'value', labelKey = 'label', suffix = '' }) {
  const max = Math.max(...items.map(item => Number(item[valueKey]) || 0), 1);
  return <div className="space-y-3">{items.map(item => <div key={item[labelKey]}>
    <div className="flex items-center justify-between gap-3 text-xs mb-1"><span className="font-semibold text-slate-600 truncate">{item[labelKey]}</span><span className="font-black text-slate-800">{item[valueKey]}{suffix}</span></div>
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.max(4, (Number(item[valueKey]) / max) * 100)}%` }} /></div>
  </div>)}</div>;
}

export default function AdminCommandCenter() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    schools = [], classes = [], students = [], trainers = [], sessions = [], attendance = [], billing = [], inventory = [],
    addSchool, loading
  } = useData();
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [schoolForm, setSchoolForm] = useState(emptySchool);
  const [saving, setSaving] = useState(false);

  const today = dateKey(new Date());
  const activeSchools = useMemo(() => schools.filter(s => lower(s.status) === 'active'), [schools]);
  const activeTrainers = useMemo(() => trainers.filter(t => lower(t.status) === 'active'), [trainers]);
  const scopeSchool = selectedSchool === 'all' ? null : selectedSchool;
  const scopedClasses = useMemo(() => scopeSchool ? classes.filter(c => text(c.school_id || c.school_code) === scopeSchool) : classes, [classes, scopeSchool]);
  const scopedStudents = useMemo(() => scopeSchool ? students.filter(s => text(s.school_id || s.school_code) === scopeSchool) : students, [students, scopeSchool]);
  const scopedTrainers = useMemo(() => scopeSchool ? activeTrainers.filter(t => text(t.assigned_schools).includes(scopeSchool)) : activeTrainers, [activeTrainers, scopeSchool]);
  const scopedSessions = useMemo(() => scopeSchool ? sessions.filter(s => text(s.school_id || s.school_code) === scopeSchool) : sessions, [sessions, scopeSchool]);
  const scopedAttendance = useMemo(() => scopeSchool ? attendance.filter(a => text(a.school_id || a.school_code) === scopeSchool || scopedSessions.some(s => String(s.id) === String(a.session_id))) : attendance, [attendance, scopeSchool, scopedSessions]);
  const scopedBilling = useMemo(() => scopeSchool ? billing.filter(b => text(b.school_id || b.school_code) === scopeSchool) : billing, [billing, scopeSchool]);

  const todaySessions = useMemo(() => scopedSessions.filter(s => sameDay(s.date || s.start_time || s.scheduled_for, today) && !['cancelled', 'completed'].includes(lower(s.status))), [scopedSessions, today]);
  const todayAttendance = useMemo(() => scopedAttendance.filter(a => sameDay(a.date || a.timestamp || a.created_at, today)), [scopedAttendance, today]);
  const attendancePresent = todayAttendance.filter(a => ['present', 'late'].includes(lower(a.status))).length;
  const attendancePct = todayAttendance.length ? Math.round((attendancePresent / todayAttendance.length) * 100) : null;
  const pendingInvoices = scopedBilling.filter(b => !['paid', 'settled', 'void', 'cancelled'].includes(lower(b.status)));
  const revenue = scopedBilling.reduce((sum, b) => sum + pickAmount(b, ['paid_amount', 'amount_paid', 'collected_amount', 'received_amount']) || (lower(b.status) === 'paid' ? pickAmount(b, ['amount', 'total_amount', 'invoice_amount', 'grand_total', 'total']) : 0), 0);
  const invoiced = scopedBilling.filter(b => !['void', 'cancelled'].includes(lower(b.status))).reduce((sum, b) => sum + pickAmount(b, ['amount', 'total_amount', 'invoice_amount', 'grand_total', 'total']), 0);
  const outstanding = Math.max(0, invoiced - revenue);

  const attendanceTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(); d.setDate(d.getDate() - (6 - index)); return dateKey(d); });
    return days.map(day => {
      const rows = scopedAttendance.filter(a => sameDay(a.date || a.timestamp || a.created_at, day));
      const present = rows.filter(a => ['present', 'late'].includes(lower(a.status))).length;
      return { label: day.slice(5), value: rows.length ? Math.round((present / rows.length) * 100) : 0, count: rows.length };
    }).filter(item => item.count > 0);
  }, [scopedAttendance]);

  const gradeDistribution = useMemo(() => {
    const map = new Map();
    scopedStudents.forEach(student => {
      const cls = scopedClasses.find(c => String(c.id) === String(student.class_id));
      const grade = text(student.grade || cls?.grade || 'Unspecified');
      map.set(grade, (map.get(grade) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })).map(([label, value]) => ({ label: `Grade ${label}`, value }));
  }, [scopedStudents, scopedClasses]);

  const schoolStudents = useMemo(() => activeSchools.map(school => ({ label: school.name, value: scopedStudents.filter(s => text(s.school_id || s.school_code) === text(school.school_code || school.code || school.id)).length })).filter(item => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 8), [activeSchools, scopedStudents]);

  const revenueTrend = useMemo(() => {
    const map = new Map();
    scopedBilling.forEach(row => {
      const key = dateKey(row.paid_at || row.payment_date || row.updated_at || row.created_at || row.invoice_date || row.date);
      if (!key) return;
      const value = pickAmount(row, ['paid_amount', 'amount_paid', 'collected_amount', 'received_amount']) || (lower(row.status) === 'paid' ? pickAmount(row, ['amount', 'total_amount', 'invoice_amount', 'grand_total', 'total']) : 0);
      if (value) map.set(key, (map.get(key) || 0) + value);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([label, value]) => ({ label: label.slice(5), value: Math.round(value) }));
  }, [scopedBilling]);

  const trainerWorkload = useMemo(() => {
    return scopedTrainers.map(trainer => ({
      label: trainer.name || trainer.trainer_id || 'Trainer',
      value: scopedSessions.filter(s => String(s.trainer_id || '') === String(trainer.id || trainer.trainer_id || '')).length
    })).filter(item => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [scopedSessions, scopedTrainers]);

  const hardwareHealth = useMemo(() => {
    const counts = new Map();
    inventory.forEach(item => { const status = text(item.status || item.condition || 'Unknown') || 'Unknown'; counts.set(status, (counts.get(status) || 0) + 1); });
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [inventory]);

  const upcoming = useMemo(() => [...scopedSessions].filter(s => !['completed', 'cancelled'].includes(lower(s.status))).sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`)).slice(0, 6), [scopedSessions]);
  const schoolName = scopeSchool ? activeSchools.find(s => text(s.school_code || s.code || s.id) === scopeSchool)?.name || scopeSchool : 'Entire Network';

  const submitSchool = async event => {
    event.preventDefault();
    const code = text(schoolForm.school_code).toUpperCase();
    if (!text(schoolForm.name) || !code) return toast.error('School name and school code are required.');
    setSaving(true);
    const result = await addSchool({ ...schoolForm, school_code: code, name: text(schoolForm.name) });
    setSaving(false);
    if (!result.success) return toast.error(result.error || 'School could not be created.', 'School Setup Failed');
    setSchoolForm(emptySchool); setShowSchoolModal(false); toast.success(`${schoolForm.name} is now in the live database.`, 'School Onboarded');
  };

  const metricCards = [
    { icon: <Building2 size={20}/>, label: 'Active Schools', value: activeSchools.length, color: 'emerald', to: '/schools' },
    { icon: <UserRound size={20}/>, label: 'Active Trainers', value: activeTrainers.length, color: 'amber', to: '/trainers' },
    { icon: <UsersRound size={20}/>, label: 'Students', value: scopedStudents.length, color: 'blue', to: '/students' },
    { icon: <BookOpen size={20}/>, label: 'Active Classes', value: scopedClasses.filter(c => lower(c.status || 'active') !== 'inactive').length, color: 'violet', to: '/sessions' },
    { icon: <CalendarDays size={20}/>, label: "Today's Sessions", value: todaySessions.length, color: 'blue', to: '/sessions' },
    { icon: <ClipboardCheck size={20}/>, label: 'Attendance Today', value: attendancePct == null ? '—' : `${attendancePct}%`, subtext: todayAttendance.length ? `${todayAttendance.length} attendance records` : 'No attendance data yet', color: 'emerald', to: '/attendance' },
    { icon: <Wallet size={20}/>, label: 'Pending Invoices', value: pendingInvoices.length, color: 'rose', to: '/billing' },
    { icon: <IndianRupee size={20}/>, label: 'Revenue Collected', value: `₹${Math.round(revenue).toLocaleString('en-IN')}`, color: 'emerald', to: '/payments' },
    { icon: <IndianRupee size={20}/>, label: 'Outstanding Balance', value: `₹${Math.round(outstanding).toLocaleString('en-IN')}`, color: 'rose', to: '/billing' },
  ];

  return <div className="space-y-6 max-w-[1440px] mx-auto pb-12">
    <Breadcrumbs items={[{ label: 'Command Center' }]} />
    <PageHeader
      eyebrow="ADMIN CONTROL PLANE"
      title="Command Center"
      description={`Live operational state • ${schoolName}`}
      actions={<div className="flex flex-wrap gap-2"><RefreshButton onRefresh={() => {}} loading={loading} /><button onClick={() => setShowSchoolModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm"><Plus size={16}/> Onboard School</button></div>}
    />

    <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
      <Server size={18} className="text-blue-600 shrink-0" />
      <div className="flex-1 min-w-0"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dashboard Scope</div><select value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)} className="mt-1 w-full bg-transparent font-bold text-sm text-slate-800 focus:outline-none"><option value="all">Entire Network</option>{activeSchools.map(s => <option key={s.id} value={s.school_code}>{s.name} ({s.school_code})</option>)}</select></div>
      <div className="text-xs text-slate-400 font-semibold shrink-0">{scopeSchool ? 'School filtered' : `${activeSchools.length} active schools`}</div>
    </section>

    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">{metricCards.map(card => <KpiCard key={card.label} {...card} onClick={() => navigate(card.to)} />)}</section>

    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <ChartCard title="Attendance Trend" subtitle="Last 7 days with recorded attendance" empty={!attendanceTrend.length}><MiniBars items={attendanceTrend} suffix="%" /></ChartCard>
      <ChartCard title="Student Level Distribution" subtitle="Students grouped by their current class grade" empty={!gradeDistribution.length}><MiniBars items={gradeDistribution} /></ChartCard>
      <ChartCard title="School-wise Students" subtitle="Active schools with enrolled students" empty={!schoolStudents.length}><MiniBars items={schoolStudents} /></ChartCard>
      <ChartCard title="Revenue Trend" subtitle="Collected payment records by recorded date" empty={!revenueTrend.length}><MiniBars items={revenueTrend.map(item => ({ ...item, label: `₹${item.label}` }))} /></ChartCard>
      <ChartCard title="Trainer Workload" subtitle="Scheduled/completed session records per active trainer" empty={!trainerWorkload.length}><MiniBars items={trainerWorkload} /></ChartCard>
      <ChartCard title="Hardware Health" subtitle="Current inventory condition/status distribution" empty={!hardwareHealth.length}><MiniBars items={hardwareHealth} /></ChartCard>
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><h2 className="font-black">Upcoming Sessions</h2><p className="text-xs text-slate-400 mt-0.5">Latest session records for the current scope</p></div><Activity size={17} className="text-slate-300" /></div>{upcoming.map(s => <div key={s.id} className="px-5 py-4 border-b border-slate-100 last:border-0 flex items-center justify-between gap-4"><div className="min-w-0"><div className="font-bold text-sm text-slate-800 truncate">{s.topic || s.title || 'Untitled session'}</div><div className="text-xs text-slate-400 mt-1">{s.date || 'Date not recorded'}{s.time ? ` • ${s.time}` : ''}</div></div><span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded-lg shrink-0">{s.status || 'scheduled'}</span></div>)}{!upcoming.length && <EmptyState icon={<CheckCircle2 size={24}/>} title="No upcoming sessions" description="Sessions will appear here as they are scheduled in the live database." />}</section>
      <section className="bg-slate-950 text-white rounded-2xl p-6 shadow-sm"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-300 flex items-center justify-center"><Server size={19}/></div><div><h2 className="font-black">Operating principle</h2><p className="text-xs text-slate-400 mt-0.5">The dashboard never invents a metric.</p></div></div><div className="grid grid-cols-2 gap-3 mt-5"><div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="text-[10px] uppercase tracking-wider text-slate-500">Live records</div><div className="text-2xl font-black mt-1">{schools.length + trainers.length + students.length + classes.length + sessions.length}</div></div><div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="text-[10px] uppercase tracking-wider text-slate-500">Attendance records</div><div className="text-2xl font-black mt-1">{scopedAttendance.length}</div></div></div><p className="text-xs leading-relaxed text-slate-400 mt-5">When a source collection is empty, the relevant card or chart stays empty instead of displaying sample percentages or placeholder business figures.</p></section>
    </section>

    <Modal isOpen={showSchoolModal} onClose={() => setShowSchoolModal(false)} title="Onboard School" size="lg">
      <form onSubmit={submitSchool} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[['name','School Name','text',true],['school_code','School Code','text',true],['principal_name','Principal Name','text',false],['phone','Phone','tel',false],['email','Email','email',false],['lab_name','Lab Name','text',false],['lab_location','Lab Location','text',false]].map(([key,label,type,required]) => <label key={key} className="text-xs font-bold text-slate-600">{label}<input required={required} value={schoolForm[key]} onChange={e => setSchoolForm(prev => ({ ...prev, [key]: e.target.value }))} type={type} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></label>)}<label className="text-xs font-bold text-slate-600 sm:col-span-2">Address<textarea value={schoolForm.address} onChange={e => setSchoolForm(prev => ({ ...prev, address: e.target.value }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" rows="3" /></label></div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2"><button type="button" onClick={() => setShowSchoolModal(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold">Cancel</button><button disabled={saving} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50">{saving ? 'Creating…' : 'Create School'}</button></div>
      </form>
    </Modal>
  </div>;
}
