import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Camera, ChevronRight, Plus, Wrench, X, Save, Trash2 } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

async function req(path, method='GET', body, form=false) {
  const options = { method };
  if (body !== undefined) {
    options.headers = form ? {} : { 'Content-Type': 'application/json' };
    options.body = form ? body : JSON.stringify(body);
  }
  const response = await apiFetch(path, options);
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json().catch(() => ({})) : {};
  if (!response.ok) throw new Error(payload.detail || payload.error || 'Request failed.');
  return payload;
}

const blankComponent = kitId => ({ kit: kitId, name: '', role: '', specs: '', first_used_session: '', quantity: 1, condition: 'good', status: 'available' });
const blankMaintenance = kitId => ({ kit: kitId, maintenance_type: 'inspection', notes: '', performed_at: new Date().toISOString().slice(0,16) });

export default function KitInventoryCenter() {
  const { user } = useAuth();
  const { schools=[], classes=[], sessions=[], refreshAll, loading } = useData();
  const [kits, setKits] = useState([]);
  const [school, setSchool] = useState('');
  const [selected, setSelected] = useState(null);
  const [componentForm, setComponentForm] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState(null);
  const [kitFormOpen, setKitFormOpen] = useState(false);
  const [form, setForm] = useState({ kit_code:'', name:'', description:'', school:'', school_class:'', condition:'good', status:'available' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const kitImageRef = useRef();
  const componentImageRef = useRef();

  const classOptions = useMemo(() => form.school ? classes.filter(c => String(c.school_id || c.school_code || '') === String(form.school)) : [], [classes, form.school]);
  const sessionOptions = useMemo(() => selected ? sessions.filter(s => String(s.school_class || s.class_id || '') === String(selected.school_class || selected.class_id || '')) : sessions, [sessions, selected]);
  const effectiveSchool = school || form.school || schools[0]?.id || '';

  async function load() {
    setError('');
    try {
      const qs = school ? `?school=${encodeURIComponent(school)}` : '';
      const data = await req(`/kits${qs}`);
      setKits(Array.isArray(data) ? data : data?.data || []);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [school]);

  const refreshSelected = async id => {
    const data = await req(`/kits/${id}`);
    setSelected(data);
    await load();
  };

  const saveKit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!form.school) throw new Error('Select a school.');
      const payload = { ...form, school_class: form.school_class || null };
      const created = await req('/kits', 'POST', payload);
      const file = kitImageRef.current?.files?.[0];
      if (file && created?.id) { const fd = new FormData(); fd.append('image', file); await req(`/kits/${created.id}/upload-image`, 'POST', fd, true); }
      setForm({ kit_code:'', name:'', description:'', school:'', school_class:'', condition:'good', status:'available' });
      if (kitImageRef.current) kitImageRef.current.value = '';
      setKitFormOpen(false); await refreshSelected(created.id);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const saveComponent = async e => {
    e.preventDefault(); if (!componentForm) return; setBusy(true); setError('');
    try {
      const editing = Boolean(componentForm.id);
      const payload = { ...componentForm, first_used_session: componentForm.first_used_session || null, quantity: Number(componentForm.quantity || 1) };
      const saved = editing ? await req(`/kit-components/${componentForm.id}`, 'PATCH', payload) : await req('/kit-components', 'POST', payload);
      const id = saved.id || componentForm.id;
      const file = componentImageRef.current?.files?.[0];
      if (file && id) { const fd = new FormData(); fd.append('image', file); await req(`/kit-components/${id}/upload-image`, 'POST', fd, true); }
      setComponentForm(null); if (componentImageRef.current) componentImageRef.current.value = ''; await refreshSelected(selected.id);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const removeComponent = async id => {
    setBusy(true); setError('');
    try { await req(`/kit-components/${id}`, 'DELETE'); setComponentForm(null); await refreshSelected(selected.id); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const removeComponentImage = async id => {
    setBusy(true); setError('');
    try { await req(`/kit-components/${id}/remove-image`, 'POST', {}); await refreshSelected(selected.id); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const saveMaintenance = async e => {
    e.preventDefault(); if (!maintenanceForm) return; setBusy(true); setError('');
    try {
      const payload = { ...maintenanceForm, performed_at: new Date(maintenanceForm.performed_at).toISOString() };
      await req('/kit-maintenance', 'POST', payload); setMaintenanceForm(null); await refreshSelected(selected.id);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow={user?.role==='admin'?'Operations':'School Hardware'} title="Hardware & Kits" description="Kit, component, image and maintenance records are database-backed. Images use the configured media storage and are not kept in static JavaScript." actions={<RefreshButton onRefresh={()=>{load();refreshAll()}} loading={loading||busy}/>} />
    {error && <ErrorState title="Hardware action failed" description={error} onRetry={load} />}
    {(user?.role==='admin'||user?.role==='school') && <section className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2"><Plus size={17}/><h2 className="font-black">Add kit</h2></div><span className="text-[10px] uppercase font-black text-slate-400">Persistent register</span></div>{kitFormOpen ? <form onSubmit={saveKit} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"><input className="field" placeholder="Kit ID" value={form.kit_code} onChange={e=>setForm({...form,kit_code:e.target.value})} required/><input className="field" placeholder="Kit name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/><select className="field" value={form.school} onChange={e=>setForm({...form,school:e.target.value,school_class:''})}><option value="">Select school</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name} ({s.school_code||s.code})</option>)}</select><select className="field" value={form.school_class} onChange={e=>setForm({...form,school_class:e.target.value})} disabled={!form.school}><option value="">Assigned class</option>{classOptions.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select><select className="field" value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})}><option value="new">New</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_repair">Needs repair</option><option value="damaged">Damaged</option></select><select className="field" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="available">Available</option><option value="assigned">Assigned</option><option value="maintenance">Maintenance</option><option value="lost">Lost</option><option value="retired">Retired</option></select><input className="field" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><input ref={kitImageRef} type="file" accept="image/png,image/jpeg,image/webp" className="field"/><div className="sm:col-span-2 xl:col-span-4 flex gap-2"><button disabled={busy} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-50">Save kit</button><button type="button" onClick={()=>setKitFormOpen(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">Cancel</button></div></form> : <button type="button" onClick={()=>setKitFormOpen(true)} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">Create a kit record</button>}</section>}

    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h2 className="font-black">Kit register</h2><p className="text-xs text-slate-400 mt-1">Select a kit for its full component and maintenance record.</p></div>{user?.role==='admin' && <select value={school} onChange={e=>setSchool(e.target.value)} className="field max-w-[240px]"><option value="">All schools</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}</div><div className="divide-y divide-slate-100">{kits.map(k=><button type="button" key={k.id} onClick={()=>setSelected(k)} className="w-full text-left p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-slate-50"><div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">{k.image_url?<img src={k.image_url} alt="" className="w-full h-full object-cover"/>:<Box size={20} className="text-slate-300"/>}</div><div className="flex-1"><p className="font-black text-slate-800">{k.kit_code} · {k.name}</p><p className="text-xs text-slate-400 mt-1">{k.school_code||'Unassigned school'} · {k.class_name||'Class not assigned'} · {k.components?.length||0} components</p></div><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{k.condition}</span><span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black uppercase">{k.status}</span><ChevronRight size={16} className="text-slate-300"/></button>)}{!kits.length&&<EmptyState icon={<Box size={19}/>} title="No kits found" description="Create a kit or choose another school scope."/>}</div></section>

    {selected && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6 flex items-end sm:items-center justify-center" onClick={()=>setSelected(null)}><section className="bg-white rounded-3xl w-full max-w-4xl max-h-[94vh] overflow-y-auto" onClick={e=>e.stopPropagation()}><div className="p-5 border-b border-slate-200 flex justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wide text-blue-600 font-black">Kit detail</p><h2 className="text-xl font-black mt-1">{selected.kit_code} · {selected.name}</h2><p className="text-xs text-slate-500 mt-1">{selected.school_code||'—'} · {selected.class_name||'Class not assigned'}</p></div><button onClick={()=>setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18}/></button></div><div className="p-5 space-y-6">
      <div className="flex flex-wrap gap-2"><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" id="kit-image-replace" onChange={e=>e.target.files?.[0]&&uploadImage(`/kits/${selected.id}/upload-image`,e.target.files[0])}/><label htmlFor="kit-image-replace" className="cursor-pointer px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-black"><Camera size={13} className="inline mr-1"/>Replace kit image</label>{selected.image_url&&<button onClick={()=>uploadImage(`/kits/${selected.id}/remove-image`,null)} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-black">Remove kit image</button>}<button onClick={()=>setComponentForm(blankComponent(selected.id))} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black"><Plus size={13} className="inline mr-1"/>Add component</button><button onClick={()=>setMaintenanceForm(blankMaintenance(selected.id))} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black"><Wrench size={13} className="inline mr-1"/>Add maintenance</button></div>
      <div><h3 className="font-black text-slate-900 mb-3">Components</h3><div className="space-y-2">{(selected.components||[]).map(c=><div key={c.id} className="p-3 rounded-2xl border border-slate-200 flex flex-col lg:flex-row lg:items-center gap-3"><div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">{c.image_url?<img src={c.image_url} alt="" className="w-full h-full object-cover"/>:<Box size={16} className="text-slate-300"/>}</div><div className="flex-1 min-w-0"><p className="font-bold text-sm">{c.name}</p><p className="text-[10px] text-slate-500 mt-1">Qty {c.quantity} · {c.condition} · {c.status}</p><p className="text-[10px] text-slate-400 mt-1 truncate">{c.role||'Role not set'} · {c.specs||'Specs not set'} · First used: {c.first_used_session_label}</p></div><div className="flex flex-wrap gap-1.5"><button onClick={()=>setComponentForm(c)} className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black">Edit</button>{c.image_url&&<button onClick={()=>removeComponentImage(c.id)} className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black">Remove image</button>}<button onClick={()=>removeComponent(c.id)} className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black"><Trash2 size={11} className="inline mr-1"/>Delete</button></div></div>)}{!(selected.components||[]).length&&<EmptyState compact title="No components" description="Add the real components assigned to this kit."/>}</div></div>
      <div><h3 className="font-black text-slate-900 mb-3 flex items-center gap-2"><Wrench size={16}/> Maintenance history</h3><div className="space-y-2">{(selected.maintenance_history||[]).map(m=><div key={m.id} className="p-3 rounded-xl bg-slate-50"><p className="text-sm font-bold">{m.maintenance_type}</p><p className="text-[10px] text-slate-500 mt-1">{m.performed_at} · {m.performed_by_name}</p><p className="text-xs text-slate-600 mt-1">{m.notes||'No notes'}</p></div>)}{!(selected.maintenance_history||[]).length&&<p className="text-xs text-slate-400">No maintenance history.</p>}</div></div>
    </div></section></div>}

    {componentForm && <Modal title={componentForm.id?'Edit component':'Add component'} onClose={()=>setComponentForm(null)}><form onSubmit={saveComponent} className="space-y-3"><input className="field" placeholder="Component name" value={componentForm.name} onChange={e=>setComponentForm({...componentForm,name:e.target.value})} required/><input className="field" placeholder="Role" value={componentForm.role||''} onChange={e=>setComponentForm({...componentForm,role:e.target.value})}/><textarea className="field min-h-20" placeholder="Specs" value={componentForm.specs||''} onChange={e=>setComponentForm({...componentForm,specs:e.target.value})}/><select className="field" value={componentForm.first_used_session||''} onChange={e=>setComponentForm({...componentForm,first_used_session:e.target.value})}><option value="">First used session not recorded</option>{sessionOptions.map(s=><option key={s.id} value={s.id}>{s.date} · {s.topic}</option>)}</select><div className="grid grid-cols-2 gap-2"><input type="number" min="1" className="field" placeholder="Quantity" value={componentForm.quantity} onChange={e=>setComponentForm({...componentForm,quantity:e.target.value})}/><select className="field" value={componentForm.condition} onChange={e=>setComponentForm({...componentForm,condition:e.target.value})}><option value="new">New</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_repair">Needs repair</option><option value="damaged">Damaged</option></select></div><select className="field" value={componentForm.status} onChange={e=>setComponentForm({...componentForm,status:e.target.value})}><option value="available">Available</option><option value="assigned">Assigned</option><option value="maintenance">Maintenance</option><option value="lost">Lost</option><option value="retired">Retired</option></select><input ref={componentImageRef} type="file" accept="image/png,image/jpeg,image/webp" className="field"/><div className="flex gap-2"><button disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-50"><Save size={14}/> Save</button><button type="button" onClick={()=>setComponentForm(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">Cancel</button></div></form></Modal>}
    {maintenanceForm && <Modal title="Add maintenance record" onClose={()=>setMaintenanceForm(null)}><form onSubmit={saveMaintenance} className="space-y-3"><select className="field" value={maintenanceForm.maintenance_type} onChange={e=>setMaintenanceForm({...maintenanceForm,maintenance_type:e.target.value})}><option value="inspection">Inspection</option><option value="repair">Repair</option><option value="replacement">Replacement</option><option value="cleaning">Cleaning</option></select><input type="datetime-local" className="field" value={maintenanceForm.performed_at} onChange={e=>setMaintenanceForm({...maintenanceForm,performed_at:e.target.value})} required/><textarea className="field min-h-24" placeholder="Notes" value={maintenanceForm.notes} onChange={e=>setMaintenanceForm({...maintenanceForm,notes:e.target.value})}/><div className="flex gap-2"><button disabled={busy} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">Save maintenance</button><button type="button" onClick={()=>setMaintenanceForm(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">Cancel</button></div></form></Modal>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}`}</style>
  </div>;
}

function Modal({ title, onClose, children }) { return <div className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center" onClick={onClose}><div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><h3 className="text-lg font-black text-slate-900">{title}</h3><button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X size={17}/></button></div>{children}</div></div>}
