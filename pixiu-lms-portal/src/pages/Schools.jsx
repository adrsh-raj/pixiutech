import { useEffect, useMemo, useState } from 'react';
import { Building2, Search, Plus, Phone, Users, BookOpen, CheckCircle, Edit, Megaphone, Receipt, X, Check, Send } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

const emptyForm = { school_code: '', name: '', principal_name: '', phone: '', email: '', address: '', lab_name: '', lab_location: '', lab_capacity: '', lab_notes: '', status: 'active' };

export default function Schools() {
  const { schools = [], classes = [], students = [], trainers = [], billing = [], addSchool, updateSchool, deleteSchool, pushSchoolNotification } = useData();
  const toast = useToast();
  const [assignments, setAssignments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [notificationSchool, setNotificationSchool] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [notification, setNotification] = useState({ title: '', message: '', priority: 'normal' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('pixiu_auth_token');
        const response = await fetch(`${window.location.origin}/api/trainer-school-assignments`, { headers: { Authorization: `Bearer ${token || ''}` }, cache: 'no-store' });
        const payload = await response.json().catch(() => []);
        if (!response.ok) throw new Error(payload.detail || payload.error || 'Unable to load trainer assignments.');
        if (!cancelled) setAssignments(Array.isArray(payload) ? payload : payload.results || payload.data || []);
      } catch (error) { if (!cancelled) toast.error(error.message, 'Trainer assignments unavailable'); }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const statusOptions = useMemo(() => [...new Set(schools.map(s => String(s.status || '').toLowerCase()).filter(Boolean))].sort(), [schools]);
  const filteredSchools = useMemo(() => schools.filter(school => {
    const query = searchTerm.trim().toLowerCase();
    const code = String(school.school_code || school.code || '').toLowerCase();
    return (!query || String(school.name || '').toLowerCase().includes(query) || code.includes(query)) && (statusFilter === 'all' || String(school.status || '').toLowerCase() === statusFilter);
  }), [schools, searchTerm, statusFilter]);

  const trainersForSchool = schoolId => {
    const ids = assignments.filter(a => String(a.school || a.school_id || '').toLowerCase() === String(schoolId).toLowerCase() && String(a.status || '').toLowerCase() === 'active').flatMap(a => [a.trainer, a.trainer_id]).filter(Boolean).map(String);
    return trainers.filter(trainer => ids.includes(String(trainer.id)) || ids.includes(String(trainer.trainer_id)));
  };
  const studentsForSchool = schoolId => students.filter(student => String(student.school_id || '').toLowerCase() === String(schoolId).toLowerCase());
  const classesForSchool = schoolId => classes.filter(item => String(item.school_id || '').toLowerCase() === String(schoolId).toLowerCase());
  const invoicesForSchool = schoolId => billing.filter(item => String(item.school_id || '').toLowerCase() === String(schoolId).toLowerCase());

  const startAdd = () => { setForm(emptyForm); setEditingSchool(null); setIsAddOpen(true); };
  const openEdit = school => { setEditingSchool(school); setForm({ school_code: school.school_code || school.code || '', name: school.name || '', principal_name: school.principal_name || '', phone: school.phone || '', email: school.email || '', address: school.address || '', lab_name: school.lab_name || '', lab_location: school.lab_location || '', lab_capacity: school.lab_capacity ?? '', lab_notes: school.lab_notes || '', status: String(school.status || 'active').toLowerCase() }); };

  const submitSchool = async event => {
    event.preventDefault();
    if (saving) return;
    const code = String(form.school_code || '').trim().toUpperCase();
    if (!code) return toast.error('School code is required.', 'School save failed');
    if (!editingSchool && schools.some(school => String(school.school_code || school.code || '').trim().toUpperCase() === code)) return toast.error(`School code ${code} already exists. Use a different code.`, 'Duplicate school code');
    if (!String(form.name || '').trim()) return toast.error('School name is required.', 'School save failed');
    setSaving(true);
    const payload = { ...form, school_code: code, name: String(form.name).trim(), lab_capacity: form.lab_capacity === '' ? null : Number(form.lab_capacity) };
    const result = editingSchool ? await updateSchool(editingSchool.id, payload) : await addSchool(payload);
    setSaving(false);
    if (!result?.success) return toast.error(result?.error || 'The server rejected the school record. Check the field values and try again.', 'School save failed');
    toast.success(editingSchool ? 'School updated successfully.' : 'School added successfully.', editingSchool ? 'School Updated' : 'School Added');
    setEditingSchool(null); setIsAddOpen(false); setForm(emptyForm);
  };

  const deactivateSchool = async school => {
    if (!window.confirm(`Deactivate ${school.name}? The record will be retained for audit history.`)) return;
    const result = await deleteSchool(school.id);
    if (!result?.success) return toast.error(result.error || 'Unable to deactivate school.', 'School deactivation failed');
    toast.success(`${school.name} has been deactivated.`, 'School Deactivated');
  };

  const sendNotification = async event => {
    event.preventDefault();
    const target = notificationSchool?.school_code || notificationSchool?.code || notificationSchool?.id || '';
    const result = await pushSchoolNotification({ target_school_id: target, title: notification.title, message: notification.message, priority: notification.priority });
    if (!result?.success) return toast.error(result.error || 'Unable to dispatch announcement.', 'Announcement failed');
    toast.success('Announcement dispatched successfully.', 'Notification Sent'); setNotificationSchool(null); setNotification({ title: '', message: '', priority: 'normal' });
  };

  return <div className="pb-10 space-y-6">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><div><div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider"><Building2 size={14}/> Partner Schools</div><h1 className="text-2xl font-bold text-slate-900 mt-1">School Directory</h1><p className="text-sm text-slate-500 mt-1">Canonical school records, live relationships and operational status.</p></div><button type="button" onClick={startAdd} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pixiu-blue text-white text-sm font-bold"><Plus size={17}/> Onboard School</button></div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5"><Metric icon={<Building2 size={22}/>} label="Total Schools" value={schools.length}/><Metric icon={<CheckCircle size={22}/>} label="Active Schools" value={schools.filter(s => String(s.status).toLowerCase() === 'active').length}/><Metric icon={<Users size={22}/>} label="Enrolled Students" value={students.length}/><Metric icon={<Receipt size={22}/>} label="Invoiced Value" value={`₹${billing.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString('en-IN')}`}/></div>
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"><div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search school name or code..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm"/></div><div className="flex items-center gap-2 text-sm"><span className="text-slate-500 font-semibold">Status</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm"><option value="all">All statuses</option>{statusOptions.map(status => <option key={status} value={status}>{status}</option>)}</select></div></div>{filteredSchools.length === 0 ? <div className="p-10 text-center text-slate-500">No schools found.</div> : <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200"><th className="p-4">School</th><th className="p-4">Principal & Lab</th><th className="p-4">Assigned Faculty</th><th className="p-4">Students / Classes</th><th className="p-4">Billing</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredSchools.map(school => { const schoolStudents = studentsForSchool(school.id); const schoolClasses = classesForSchool(school.id); const schoolInvoices = invoicesForSchool(school.id); const schoolTrainers = trainersForSchool(school.id); const amount = schoolInvoices.reduce((sum, item) => sum + (Number(item.amount) || 0), 0); return <tr key={school.id} className="hover:bg-slate-50/60"><td className="p-4"><div className="font-bold text-slate-900">{school.name || 'Unnamed school'}</div><div className="text-xs font-mono text-pixiu-blue mt-1">{school.school_code || school.code || 'No code'}</div><span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600">{school.status || 'unknown'}</span></td><td className="p-4"><div className="text-sm font-semibold text-slate-800">{school.principal_name || 'Not provided'}</div><div className="text-xs text-slate-500 mt-1 flex items-center gap-1">{school.phone ? <><Phone size={12}/>{school.phone}</> : 'No phone'}</div><div className="text-xs text-slate-400 mt-1">{school.lab_name || 'No lab name'}{school.lab_location ? ` • ${school.lab_location}` : ''}</div></td><td className="p-4">{schoolTrainers.length ? schoolTrainers.map(t => <div key={t.id || t.trainer_id} className="text-sm font-semibold text-slate-800">{t.name}</div>) : <span className="text-sm text-slate-400">No active assignment</span>}</td><td className="p-4"><div className="text-sm font-semibold text-slate-700 flex items-center gap-1"><Users size={14}/>{schoolStudents.length}</div><div className="text-sm font-semibold text-slate-700 flex items-center gap-1 mt-1"><BookOpen size={14}/>{schoolClasses.length}</div></td><td className="p-4"><div className="text-sm font-bold text-slate-800">₹{amount.toLocaleString('en-IN')}</div><div className="text-xs text-slate-500 mt-1">{schoolInvoices.length} invoice{schoolInvoices.length === 1 ? '' : 's'}</div></td><td className="p-4"><div className="flex justify-end gap-1"><button type="button" onClick={() => setNotificationSchool(school)} className="p-2 text-slate-500 hover:text-pixiu-blue rounded-lg" title="Send announcement"><Megaphone size={16}/></button><button type="button" onClick={() => openEdit(school)} className="p-2 text-slate-500 hover:text-emerald-600 rounded-lg" title="Edit school"><Edit size={16}/></button><button type="button" disabled={saving} onClick={() => deactivateSchool(school)} className="px-2 py-1.5 text-xs font-bold text-slate-500 hover:text-red-600 rounded-lg" title="Deactivate school">Deactivate</button></div></td></tr>; })}</tbody></table></div>}</div>
    {(isAddOpen || editingSchool) && <Modal title={editingSchool ? 'Edit School' : 'Onboard School'} onClose={() => { if (!saving) { setIsAddOpen(false); setEditingSchool(null); } }}><form onSubmit={submitSchool} className="space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="School code *"><input required value={form.school_code} disabled={Boolean(editingSchool)} onChange={e => setForm({...form, school_code: e.target.value.toUpperCase()})} className="input"/></Field><Field label="School name *"><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input"/></Field><Field label="Principal name"><input value={form.principal_name} onChange={e => setForm({...form, principal_name: e.target.value})} className="input"/></Field><Field label="Phone"><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input"/></Field><Field label="Email"><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input"/></Field><Field label="Address"><input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input"/></Field><Field label="Lab name"><input value={form.lab_name} onChange={e => setForm({...form, lab_name: e.target.value})} className="input"/></Field><Field label="Lab location"><input value={form.lab_location} onChange={e => setForm({...form, lab_location: e.target.value})} className="input"/></Field><Field label="Lab capacity"><input type="number" min="0" value={form.lab_capacity} onChange={e => setForm({...form, lab_capacity: e.target.value})} className="input"/></Field><Field label="Status"><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input"><option value="active">Active</option><option value="inactive">Inactive</option></select></Field></div><Field label="Lab notes"><textarea rows="3" value={form.lab_notes} onChange={e => setForm({...form, lab_notes: e.target.value})} className="input"/></Field><div className="flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" disabled={saving} onClick={() => { setIsAddOpen(false); setEditingSchool(null); }} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : <><Check size={15}/> Save School</>}</button></div></form></Modal>}
    {notificationSchool && <Modal title="Send School Announcement" onClose={() => setNotificationSchool(null)}><form onSubmit={sendNotification} className="space-y-4"><p className="text-sm text-slate-500">Target: <span className="font-bold text-slate-800">{notificationSchool.name}</span></p><Field label="Title *"><input required value={notification.title} onChange={e => setNotification({...notification,title:e.target.value})} className="input"/></Field><Field label="Message *"><textarea required rows="5" value={notification.message} onChange={e => setNotification({...notification,message:e.target.value})} className="input"/></Field><Field label="Priority"><select value={notification.priority} onChange={e => setNotification({...notification,priority:e.target.value})} className="input"><option value="normal">Normal</option><option value="high">High</option></select></Field><div className="flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={() => setNotificationSchool(null)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary"><Send size={15}/> Dispatch</button></div></form></Modal>}
    <style>{`.input{width:100%;box-sizing:border-box;padding:.65rem .75rem;border:1px solid #cbd5e1;border-radius:.75rem;background:#fff;color:#0f172a}.input:focus{outline:2px solid rgba(37,99,235,.18);border-color:#2563eb}.btn-primary,.btn-secondary{display:inline-flex;align-items:center;gap:.4rem;border-radius:.75rem;padding:.6rem .9rem;font-size:.875rem;font-weight:700;cursor:pointer}.btn-primary{border:1px solid #2563eb;background:#2563eb;color:#fff}.btn-secondary{border:1px solid #e2e8f0;background:#fff;color:#475569}`}</style>
  </div>;
}
function Field({ label, children }) { return <div><label className="block text-[10px] uppercase tracking-wide font-black text-slate-400 mb-1">{label}</label>{children}</div>; }
function Metric({ icon, label, value }) { return <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center">{icon}</div><div><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">{label}</p><p className="text-2xl font-black text-slate-900 mt-1">{value}</p></div></div>; }
function Modal({ title, onClose, children }) { return <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200"><div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 py-4 border-b border-slate-100 flex items-center justify-between"><h2 className="font-black text-slate-900">{title}</h2><button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700"><X size={18}/></button></div><div className="p-5">{children}</div></div></div>; }
