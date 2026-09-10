import { useEffect, useMemo, useState } from 'react';
import { Box, ChevronRight, ClipboardList, ImagePlus, Plus, Wrench, X } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const list = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const text = value => String(value ?? '').trim();
const same = (a, b) => text(a).toUpperCase() === text(b).toUpperCase();

async function request(path, method = 'GET', body) {
  const init = { method, cache: method === 'GET' ? 'no-store' : undefined };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const response = await apiFetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || payload.message || `Request failed (${response.status})`);
  return payload;
}

function buildKitFormData(form) {
  const data = new FormData();
  ['kit_code', 'name', 'description', 'school', 'condition', 'status'].forEach(key => data.append(key, form[key] ?? ''));
  if (form.school_class) data.append('school_class', form.school_class);
  if (form.image instanceof File) data.append('image', form.image);
  return data;
}

export default function HardwareKitsV2() {
  const { user } = useAuth();
  const { schools = [], classes = [], refreshAll, loading } = useData();
  const [kits, setKits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [kitForm, setKitForm] = useState(null);
  const [componentForm, setComponentForm] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingKits, setLoadingKits] = useState(false);
  const [error, setError] = useState('');

  const canEdit = ['admin', 'superadmin', 'school'].includes(user?.role);
  const ownSchool = useMemo(() => schools.find(s => same(s.id, user?.school_id) || same(s.school_code, user?.school_id) || same(s.school_code, user?.school_code)), [schools, user?.school_id, user?.school_code]);

  const load = async () => {
    setLoadingKits(true); setError('');
    try { setKits(list(await request('/kits'))); }
    catch (err) { setError(err.message || 'Unable to load kits.'); }
    finally { setLoadingKits(false); }
  };
  useEffect(() => { load(); }, []);

  const visibleKits = useMemo(() => schoolFilter ? kits.filter(k => same(k.school, schoolFilter) || same(k.school_id, schoolFilter) || same(k.school_code, schools.find(s => same(s.id, schoolFilter))?.school_code)) : kits, [kits, schoolFilter, schools]);
  const classOptions = useMemo(() => {
    if (!kitForm?.school) return [];
    const school = schools.find(s => same(s.id, kitForm.school) || same(s.school_code, kitForm.school));
    return classes.filter(c => same(c.school, kitForm.school) || same(c.school_id, kitForm.school) || same(c.school_code, school?.school_code));
  }, [classes, schools, kitForm?.school]);

  const refreshSelected = async id => {
    try { setSelected(await request(`/kits/${id}`)); await load(); }
    catch (err) { setError(err.message || 'Unable to load kit details.'); }
  };

  const openNewKit = () => setKitForm({ id: null, kit_code: '', name: '', description: '', school: user?.role === 'school' ? (ownSchool?.id || '') : '', school_class: '', condition: 'good', status: 'available', image: null, image_url: '' });
  const openEditKit = kit => setKitForm({ id: kit.id, kit_code: kit.kit_code || '', name: kit.name || '', description: kit.description || '', school: kit.school || '', school_class: kit.school_class || '', condition: kit.condition || 'good', status: kit.status || 'available', image: null, image_url: kit.image_url || '' });

  const saveKit = async event => {
    event.preventDefault();
    if (!kitForm || busy) return;
    if (!text(kitForm.kit_code) || !text(kitForm.name) || !kitForm.school) { setError('Kit code, name and school are required.'); return; }
    setBusy(true); setError('');
    try {
      const saved = await request(kitForm.id ? `/kits/${kitForm.id}` : '/kits', kitForm.id ? 'PATCH' : 'POST', buildKitFormData(kitForm));
      await refreshAll(); await load(); setSelected(saved?.data || saved); setKitForm(null);
    } catch (err) { setError(err.message || 'Kit could not be saved.'); }
    finally { setBusy(false); }
  };

  const saveComponent = async event => {
    event.preventDefault();
    if (!componentForm || busy || !selected) return;
    if (!text(componentForm.name)) { setError('Component name is required.'); return; }
    setBusy(true); setError('');
    try {
      const body = new FormData();
      body.append('kit', selected.id); body.append('name', componentForm.name.trim()); body.append('role', componentForm.role || ''); body.append('specs', componentForm.specs || ''); body.append('quantity', String(Number(componentForm.quantity || 1))); body.append('condition', componentForm.condition || 'good'); body.append('status', componentForm.status || 'available');
      if (componentForm.image instanceof File) body.append('image', componentForm.image);
      await request(componentForm.id ? `/kit-components/${componentForm.id}` : '/kit-components', componentForm.id ? 'PATCH' : 'POST', body);
      setComponentForm(null); await refreshSelected(selected.id);
    } catch (err) { setError(err.message || 'Component could not be saved.'); }
    finally { setBusy(false); }
  };

  const saveMaintenance = async event => {
    event.preventDefault();
    if (!maintenanceForm || busy || !selected) return;
    setBusy(true); setError('');
    try {
      await request('/kit-maintenance', 'POST', { ...maintenanceForm, kit: selected.id, performed_at: new Date(maintenanceForm.performed_at).toISOString() });
      setMaintenanceForm(null); await refreshSelected(selected.id);
    } catch (err) { setError(err.message || 'Maintenance record could not be saved.'); }
    finally { setBusy(false); }
  };

  const retire = async kit => {
    if (!window.confirm(`Retire ${kit.kit_code}?`)) return;
    setBusy(true); setError('');
    try { await request(`/kits/${kit.id}`, 'DELETE'); await refreshAll(); await load(); setSelected(null); }
    catch (err) { setError(err.message || 'Kit could not be retired.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Operations" title="Hardware & Kits" description="Create real kit records with photos, optional class assignment, components and maintenance history." actions={<div className="flex gap-2"><RefreshButton onRefresh={async () => { await refreshAll(); await load(); }} loading={loading || loadingKits || busy}/>{canEdit && <button type="button" onClick={openNewKit} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black"><Plus size={14} className="inline mr-1"/>New Kit</button>}</div>} />
    {error && <ErrorState title="Hardware action failed" description={error} onRetry={load}/>} 
    <section className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Registry</p><p className="text-sm text-slate-600 mt-1">{loadingKits ? 'Loading live kits…' : `${visibleKits.length} kit record${visibleKits.length === 1 ? '' : 's'}`}</p></div>{user?.role !== 'school' && <select className="field sm:max-w-xs" value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}><option value="">All schools</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select>}</section>
    {!visibleKits.length ? <div className="bg-white border border-slate-200 rounded-2xl p-10"><EmptyState icon={<Box size={20}/>} title="No kits found" description="No kit records exist in the current authorised scope. Use New Kit to create the first one."/></div> : <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{visibleKits.map(kit => <article key={kit.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">{kit.image_url ? <img src={kit.image_url} alt={`${kit.kit_code} ${kit.name}`} className="h-44 w-full object-cover" loading="lazy"/> : <div className="h-44 bg-slate-50 flex items-center justify-center text-slate-300"><Box size={34}/></div>}<div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{kit.kit_code}</p><p className="text-sm font-bold text-slate-600 mt-1">{kit.name}</p></div><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{kit.status || 'available'}</span></div><p className="text-xs text-slate-500 mt-2">{kit.school_code || 'School'} · {kit.class_name || 'Class not assigned'}</p><p className="text-[10px] text-slate-400 mt-3">{(kit.components || []).length} components · {kit.condition || 'condition not recorded'}</p><div className="flex flex-wrap gap-2 mt-4"><button type="button" onClick={() => refreshSelected(kit.id)} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black inline-flex items-center gap-1">Open <ChevronRight size={12}/></button>{canEdit && <button type="button" onClick={() => openEditKit(kit)} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black">Edit</button>}{user?.role === 'admin' && <button type="button" onClick={() => retire(kit)} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black">Retire</button>}</div></div></article>)}</section>}

    {kitForm && <Modal title={kitForm.id ? 'Edit kit' : 'Create kit'} onClose={() => setKitForm(null)}><form onSubmit={saveKit} className="space-y-3"><input className="field" placeholder="Kit code" value={kitForm.kit_code} onChange={e => setKitForm(v => ({...v, kit_code:e.target.value}))} required/><input className="field" placeholder="Kit name" value={kitForm.name} onChange={e => setKitForm(v => ({...v, name:e.target.value}))} required/><select className="field" value={kitForm.school || ''} onChange={e => setKitForm(v => ({...v, school:e.target.value, school_class:''}))} disabled={user?.role === 'school'} required><option value="">Select school</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select><select className="field" value={kitForm.school_class || ''} onChange={e => setKitForm(v => ({...v, school_class:e.target.value}))} disabled={!kitForm.school}><option value="">Class (optional)</option>{classOptions.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}</select><div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-4"><label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white p-5 text-center hover:bg-blue-50"><ImagePlus size={22} className="text-blue-600"/><span className="text-xs font-black text-slate-700">Add kit photo</span><span className="text-[10px] text-slate-400">JPG, PNG or WebP — the photo will be stored on the kit record.</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => setKitForm(v => ({...v,image:e.target.files?.[0] || null}))}/></label>{kitForm.image instanceof File && <div className="mt-3 overflow-hidden rounded-xl border border-blue-100"><img src={URL.createObjectURL(kitForm.image)} alt="Kit preview" className="h-40 w-full object-cover"/></div>}{!(kitForm.image instanceof File) && kitForm.image_url && <div className="mt-3 overflow-hidden rounded-xl border border-slate-200"><img src={kitForm.image_url} alt="Current kit" className="h-40 w-full object-cover"/></div>}</div><div className="grid grid-cols-2 gap-3"><select className="field" value={kitForm.condition || 'good'} onChange={e => setKitForm(v => ({...v, condition:e.target.value}))}><option value="new">New</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_repair">Needs repair</option><option value="damaged">Damaged</option></select><select className="field" value={kitForm.status || 'available'} onChange={e => setKitForm(v => ({...v,status:e.target.value}))}><option value="available">Available</option><option value="assigned">Assigned</option><option value="maintenance">Maintenance</option><option value="lost">Lost</option><option value="retired">Retired</option></select></div><textarea className="field min-h-24" placeholder="Description" value={kitForm.description || ''} onChange={e => setKitForm(v => ({...v,description:e.target.value}))}/><button disabled={busy} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black">{busy ? 'Saving…' : 'Save kit with photo'}</button></form></Modal>}

    {selected && <Modal title={`${selected.kit_code} · ${selected.name}`} onClose={() => setSelected(null)}><div className="space-y-6">{selected.image_url && <img src={selected.image_url} alt={`${selected.kit_code} ${selected.name}`} className="h-56 w-full rounded-2xl object-cover"/>}<div className="flex flex-wrap gap-2">{canEdit && <button type="button" onClick={() => setComponentForm({id:null,name:'',role:'',specs:'',quantity:1,condition:'good',status:'available',image:null})} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black"><Plus size={13} className="inline mr-1"/>Add component</button>}{canEdit && <button type="button" onClick={() => setMaintenanceForm({maintenance_type:'inspection',notes:'',performed_at:new Date().toISOString().slice(0,16)})} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black"><Wrench size={13} className="inline mr-1"/>Add maintenance</button>}</div><section><h3 className="font-black"><ClipboardList size={16} className="inline mr-1"/>Components</h3><div className="space-y-2 mt-3">{(selected.components || []).map(c => <div key={c.id} className="p-3 rounded-xl border border-slate-200 flex gap-3">{c.image_url ? <img src={c.image_url} alt={c.name} className="h-14 w-14 rounded-lg object-cover"/> : <div className="h-14 w-14 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300"><Box size={17}/></div>}<div><p className="font-bold text-sm">{c.name}</p><p className="text-[10px] text-slate-400 mt-1">Qty {c.quantity} · {c.condition} · {c.status}</p></div></div>)}{!(selected.components || []).length && <EmptyState compact title="No components" description="No component records are attached to this kit."/>}</div></section><section><h3 className="font-black"><Wrench size={16} className="inline mr-1"/>Maintenance</h3><div className="space-y-2 mt-3">{(selected.maintenance_history || []).map(m => <div key={m.id} className="p-3 rounded-xl bg-slate-50"><p className="font-bold text-sm">{m.maintenance_type}</p><p className="text-[10px] text-slate-400 mt-1">{m.performed_at}</p><p className="text-xs mt-1">{m.notes || 'No notes'}</p></div>)}{!(selected.maintenance_history || []).length && <EmptyState compact title="No maintenance history" description="No maintenance events are recorded."/>}</div></section></div></Modal>}

    {componentForm && <Modal title={componentForm.id ? 'Edit component' : 'Add component'} onClose={() => setComponentForm(null)}><form onSubmit={saveComponent} className="space-y-3"><input className="field" placeholder="Component name" value={componentForm.name} onChange={e => setComponentForm(v => ({...v,name:e.target.value}))} required/><input className="field" placeholder="Role" value={componentForm.role || ''} onChange={e => setComponentForm(v => ({...v,role:e.target.value}))}/><input className="field" placeholder="Specs" value={componentForm.specs || ''} onChange={e => setComponentForm(v => ({...v,specs:e.target.value}))}/><input className="field" type="number" min="1" value={componentForm.quantity} onChange={e => setComponentForm(v => ({...v,quantity:e.target.value}))}/><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3"><ImagePlus size={18} className="text-slate-500"/><span className="flex-1 text-xs font-bold text-slate-600">Add component image<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-[10px]" onChange={e => setComponentForm(v => ({...v,image:e.target.files?.[0] || null}))}/></span></label><div className="grid grid-cols-2 gap-3"><select className="field" value={componentForm.condition || 'good'} onChange={e => setComponentForm(v => ({...v,condition:e.target.value}))}><option value="new">New</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_repair">Needs repair</option><option value="damaged">Damaged</option></select><select className="field" value={componentForm.status || 'available'} onChange={e => setComponentForm(v => ({...v,status:e.target.value}))}><option value="available">Available</option><option value="in_use">In use</option><option value="maintenance">Maintenance</option></select></div><button disabled={busy} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black">Save component</button></form></Modal>}
    {maintenanceForm && <Modal title="Add maintenance" onClose={() => setMaintenanceForm(null)}><form onSubmit={saveMaintenance} className="space-y-3"><input className="field" placeholder="Maintenance type" value={maintenanceForm.maintenance_type} onChange={e => setMaintenanceForm(v => ({...v,maintenance_type:e.target.value}))} required/><input className="field" type="datetime-local" value={maintenanceForm.performed_at} onChange={e => setMaintenanceForm(v => ({...v,performed_at:e.target.value}))} required/><textarea className="field min-h-20" placeholder="Notes" value={maintenanceForm.notes} onChange={e => setMaintenanceForm(v => ({...v,notes:e.target.value}))}/><button disabled={busy} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black">Save maintenance</button></form></Modal>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}`}</style>
  </div>;
}
function Modal({ title, onClose, children }) { return <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><h2 className="font-black text-lg">{title}</h2><button type="button" onClick={onClose} aria-label="Close"><X size={18}/></button></div><div className="p-5">{children}</div></div></div>}
