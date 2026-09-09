import { useMemo, useState } from 'react';
import { Box, ChevronRight, ClipboardList, Plus, RefreshCw, Wrench, X } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const list = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const text = value => String(value ?? '').trim();
const norm = value => text(value).toLowerCase();

async function request(path, method='GET', body) {
  const response = await apiFetch(path, { method, cache: method === 'GET' ? 'no-store' : undefined, ...(body !== undefined ? { headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || payload.message || `Request failed (${response.status})`);
  return payload;
}

export default function HardwareKitsV2() {
  const { user } = useAuth();
  const { schools = [], classes = [], refreshAll, loading } = useData();
  const [kits, setKits] = useState([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [kitForm, setKitForm] = useState(null);
  const [componentForm, setComponentForm] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingKits, setLoadingKits] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoadingKits(true); setError('');
    try { const payload = await request('/kits'); setKits(list(payload)); }
    catch (err) { setError(err.message); }
    finally { setLoadingKits(false); }
  };

  const visibleKits = useMemo(() => schoolFilter ? kits.filter(k => String(k.school || '') === String(schoolFilter)) : kits, [kits, schoolFilter]);
  const classOptions = useMemo(() => kitForm?.school ? classes.filter(c => String(c.school || c.school_id) === String(kitForm.school)) : [], [classes, kitForm?.school]);
  const canEdit = ['admin','superadmin','school'].includes(user?.role);

  const saveKit = async event => {
    event.preventDefault();
    if (!kitForm || busy) return;
    if (!kitForm.kit_code.trim() || !kitForm.name.trim() || !kitForm.school) { setError('Kit code, name and school are required.'); return; }
    setBusy(true); setError('');
    try {
      const saved = kitForm.id ? await request(`/kits/${kitForm.id}`, 'PATCH', kitForm) : await request('/kits', 'POST', kitForm);
      await refreshAll(); await load(); setSelected(saved?.data || saved); setKitForm(null);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const saveComponent = async event => {
    event.preventDefault(); if (!componentForm || busy || !selected) return;
    if (!componentForm.name.trim()) { setError('Component name is required.'); return; }
    setBusy(true); setError('');
    try { const payload = { ...componentForm, kit: selected.id, quantity: Number(componentForm.quantity || 1) }; await request(componentForm.id ? `/kit-components/${componentForm.id}` : '/kit-components', componentForm.id ? 'PATCH' : 'POST', payload); setComponentForm(null); await refreshSelected(selected.id); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const saveMaintenance = async event => {
    event.preventDefault(); if (!maintenanceForm || busy || !selected) return;
    setBusy(true); setError('');
    try { await request('/kit-maintenance', 'POST', { ...maintenanceForm, kit: selected.id, performed_at: new Date(maintenanceForm.performed_at).toISOString() }); setMaintenanceForm(null); await refreshSelected(selected.id); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const refreshSelected = async id => {
    try { const fresh = await request(`/kits/${id}`); setSelected(fresh); await load(); }
    catch (err) { setError(err.message); }
  };

  const deactivate = async kit => {
    if (!window.confirm(`Retire ${kit.kit_code}?`)) return;
    setBusy(true); setError('');
    try { await request(`/kits/${kit.id}`, 'DELETE'); await refreshAll(); await load(); if (selected?.id === kit.id) setSelected(null); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return <div className="space-y-5 pb-10"><PageHeader eyebrow="Operations" title="Hardware & Kits" description="Live kit registry, components and maintenance history from the Django inventory API." actions={<div className="flex gap-2"><RefreshButton onRefresh={async()=>{await Promise.all([refreshAll(),load()])}} loading={loading||loadingKits||busy}/>{canEdit&&<button type="button" onClick={()=>setKitForm({id:null,kit_code:'',name:'',description:'',school:user?.role==='school'?(schools[0]?.id||''):'',school_class:'',condition:'good',status:'available'})} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black inline-flex items-center gap-2"><Plus size={14}/> New Kit</button>}</div>} />
    {error && <ErrorState title="Hardware action failed" description={error} onRetry={()=>{setError('');load();}}/>}
    <section className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Registry</p><p className="text-sm text-slate-600 mt-1">{loadingKits?'Loading live kits…':`${visibleKits.length} kit record${visibleKits.length===1?'':'s'}`}</p></div>{user?.role!=='school'&&<select className="field sm:max-w-xs" value={schoolFilter} onChange={e=>setSchoolFilter(e.target.value)}><option value="">All schools</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select>}</section>
    {visibleKits.length===0 ? <div className="bg-white border border-slate-200 rounded-2xl p-10"><EmptyState icon={<Box size={20}/>} title="No kits found" description="No kit records exist in the current authorised scope."/></div> : <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{visibleKits.map(kit=><article key={kit.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Box size={18}/></span><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{kit.status || 'available'}</span></div><h2 className="font-black text-slate-900 mt-4">{kit.kit_code} · {kit.name}</h2><p className="text-xs text-slate-500 mt-1">{kit.school_code || 'School'} · {kit.class_name || 'Class not assigned'}</p><p className="text-[10px] text-slate-400 mt-3">{(kit.components || []).length} components · {kit.condition || 'condition not recorded'}</p><div className="flex flex-wrap gap-2 mt-4"><button type="button" onClick={()=>refreshSelected(kit.id)} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black inline-flex items-center gap-1">Open <ChevronRight size={12}/></button>{canEdit&&<button type="button" onClick={()=>setKitForm({...kit})} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black">Edit</button>}{user?.role==='admin'&&<button type="button" onClick={()=>deactivate(kit)} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black">Retire</button>}</div></article>)}</section>}

    {kitForm&&<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><form onSubmit={saveKit} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="font-black text-lg">{kitForm.id?'Edit kit':'Create kit'}</h2><p className="text-xs text-slate-400 mt-1">All values are persisted in the inventory database.</p></div><button type="button" onClick={()=>setKitForm(null)}><X size={18}/></button></div><div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3"><input className="field" placeholder="Kit code" value={kitForm.kit_code} onChange={e=>setKitForm(v=>({...v,kit_code:e.target.value}))} required/><input className="field" placeholder="Kit name" value={kitForm.name} onChange={e=>setKitForm(v=>({...v,name:e.target.value}))} required/><select className="field" value={kitForm.school||''} onChange={e=>setKitForm(v=>({...v,school:e.target.value,school_class:''}))} disabled={user?.role==='school'} required><option value="">Select school</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select><select className="field" value={kitForm.school_class||''} onChange={e=>setKitForm(v=>({...v,school_class:e.target.value||null}))} disabled={!kitForm.school}><option value="">Class (optional)</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select><select className="field" value={kitForm.condition||'good'} onChange={e=>setKitForm(v=>({...v,condition:e.target.value}))}><option value="new">New</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_repair">Needs repair</option><option value="damaged">Damaged</option></select><select className="field" value={kitForm.status||'available'} onChange={e=>setKitForm(v=>({...v,status:e.target.value}))}><option value="available">Available</option><option value="assigned">Assigned</option><option value="maintenance">Maintenance</option><option value="lost">Lost</option><option value="retired">Retired</option></select><textarea className="field md:col-span-2 min-h-24" placeholder="Description" value={kitForm.description||''} onChange={e=>setKitForm(v=>({...v,description:e.target.value}))}/></div><div className="p-5 border-t border-slate-100 flex justify-end gap-2"><button type="button" onClick={()=>setKitForm(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button disabled={busy} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black">{busy?'Saving…':'Save kit'}</button></div></form></div>}

    {selected&&<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-blue-600">Kit detail</p><h2 className="text-xl font-black">{selected.kit_code} · {selected.name}</h2></div><button type="button" onClick={()=>setSelected(null)}><X size={18}/></button></div><div className="p-5 space-y-6"><div className="flex flex-wrap gap-2">{canEdit&&<button type="button" onClick={()=>setComponentForm({id:null,name:'',role:'',specs:'',quantity:1,condition:'good',status:'available',first_used_session:''})} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black"><Plus size={13} className="inline mr-1"/> Add component</button>}{canEdit&&<button type="button" onClick={()=>setMaintenanceForm({maintenance_type:'inspection',notes:'',performed_at:new Date().toISOString().slice(0,16)})} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black"><Wrench size={13} className="inline mr-1"/> Add maintenance</button>}</div><section><h3 className="font-black flex items-center gap-2"><ClipboardList size={16}/> Components</h3><div className="space-y-2 mt-3">{(selected.components||[]).map(c=><div key={c.id} className="p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1"><p className="font-bold text-sm">{c.name}</p><p className="text-[10px] text-slate-400 mt-1">Qty {c.quantity} · {c.condition} · {c.status}</p><p className="text-[10px] text-slate-500 mt-1">{c.role||'Role not set'} · {c.specs||'Specs not set'}</p></div>{canEdit&&<button type="button" onClick={()=>setComponentForm({...c})} className="px-3 py-1.5 rounded-lg bg-slate-100 text-[10px] font-black">Edit</button>}</div>)}{!(selected.components||[]).length&&<EmptyState compact title="No components" description="No component records are attached to this kit."/>}</div></section><section><h3 className="font-black flex items-center gap-2"><Wrench size={16}/> Maintenance history</h3><div className="space-y-2 mt-3">{(selected.maintenance_history||[]).map(m=><div key={m.id} className="p-3 rounded-xl bg-slate-50"><p className="text-sm font-bold">{m.maintenance_type}</p><p className="text-[10px] text-slate-400 mt-1">{m.performed_at} · {m.performed_by_name || 'Recorded staff'}</p><p className="text-xs text-slate-600 mt-1">{m.notes||'No notes'}</p></div>)}{!(selected.maintenance_history||[]).length&&<EmptyState compact title="No maintenance history" description="No maintenance events are recorded for this kit."/>}</div></section></div></div></div>}
    {componentForm&&<Modal title={componentForm.id?'Edit component':'Add component'} onClose={()=>setComponentForm(null)}><form onSubmit={saveComponent} className="space-y-3"><input className="field" placeholder="Component name" value={componentForm.name} onChange={e=>setComponentForm(v=>({...v,name:e.target.value}))} required/><input className="field" placeholder="Role" value={componentForm.role||''} onChange={e=>setComponentForm(v=>({...v,role:e.target.value}))}/><input className="field" placeholder="Specs" value={componentForm.specs||''} onChange={e=>setComponentForm(v=>({...v,specs:e.target.value}))}/><div className="grid grid-cols-2 gap-2"><input className="field" type="number" min="1" value={componentForm.quantity} onChange={e=>setComponentForm(v=>({...v,quantity:e.target.value}))}/><select className="field" value={componentForm.condition||'good'} onChange={e=>setComponentForm(v=>({...v,condition:e.target.value}))}><option value="new">New</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_repair">Needs repair</option><option value="damaged">Damaged</option></select></div><select className="field" value={componentForm.status||'available'} onChange={e=>setComponentForm(v=>({...v,status:e.target.value}))}><option value="available">Available</option><option value="in_use">In use</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option></select><div className="flex justify-end gap-2"><button type="button" onClick={()=>setComponentForm(null)} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold">Cancel</button><button disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">Save</button></div></form></Modal>}
    {maintenanceForm&&<Modal title="Add maintenance event" onClose={()=>setMaintenanceForm(null)}><form onSubmit={saveMaintenance} className="space-y-3"><select className="field" value={maintenanceForm.maintenance_type} onChange={e=>setMaintenanceForm(v=>({...v,maintenance_type:e.target.value}))}><option value="inspection">Inspection</option><option value="repair">Repair</option><option value="replacement">Replacement</option><option value="cleaning">Cleaning</option><option value="other">Other</option></select><input type="datetime-local" className="field" value={maintenanceForm.performed_at} onChange={e=>setMaintenanceForm(v=>({...v,performed_at:e.target.value}))} required/><textarea className="field min-h-24" placeholder="Notes" value={maintenanceForm.notes} onChange={e=>setMaintenanceForm(v=>({...v,notes:e.target.value}))}/><div className="flex justify-end gap-2"><button type="button" onClick={()=>setMaintenanceForm(null)} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold">Cancel</button><button disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black">Save maintenance</button></div></form></Modal>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}`}</style>
  </div>;
}
function Modal({ title, onClose, children }) { return <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><h2 className="font-black text-lg">{title}</h2><button type="button" onClick={onClose}><X size={18}/></button></div><div className="p-5">{children}</div></div></div>; }
