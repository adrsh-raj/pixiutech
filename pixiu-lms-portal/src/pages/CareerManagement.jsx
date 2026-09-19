import { useEffect, useState } from 'react';
import { BriefcaseBusiness, Download, Edit3, Plus, Trash2, Users, X } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const emptyOpening = { title: '', location: '', employment_type: '', description: '', requirements: '', status: 'draft', sort_order: 0 };
const statuses = ['new', 'reviewed', 'shortlisted', 'rejected', 'hired'];

export default function CareerManagement() {
  const toast = useToast();
  const [tab, setTab] = useState('openings');
  const [openings, setOpenings] = useState([]);
  const [applications, setApplications] = useState([]);
  const [openingForm, setOpeningForm] = useState(emptyOpening);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [openingResponse, applicationResponse] = await Promise.all([
        apiFetch('/careers/openings?limit=200', { cache: 'no-store' }),
        apiFetch('/careers/applications?limit=500', { cache: 'no-store' }),
      ]);
      const openingData = await openingResponse.json().catch(() => []);
      const applicationData = await applicationResponse.json().catch(() => []);
      if (!openingResponse.ok) throw new Error(openingData.detail || 'Unable to load career openings.');
      if (!applicationResponse.ok) throw new Error(applicationData.detail || 'Unable to load applications.');
      setOpenings(Array.isArray(openingData) ? openingData : openingData.results || []);
      setApplications(Array.isArray(applicationData) ? applicationData : applicationData.results || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load careers.', 'Careers');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const saveOpening = async event => {
    event.preventDefault();
    if (!openingForm.title.trim() || !openingForm.description.trim()) return toast.error('Title and description are required.');
    setSaving(true);
    try {
      const path = editingId ? `/careers/openings/${editingId}` : '/careers/openings';
      const response = await apiFetch(path, {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...openingForm, title: openingForm.title.trim(), description: openingForm.description.trim(), requirements: openingForm.requirements.trim(), sort_order: Number(openingForm.sort_order) || 0 }),
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Career opening could not be saved.');
      toast.success(editingId ? 'Career opening updated.' : 'Career opening created.', 'Careers');
      setShowForm(false); setEditingId(null); setOpeningForm(emptyOpening);
      await load();
    } catch (error) { toast.error(error.message || 'Could not save opening.', 'Careers'); }
    finally { setSaving(false); }
  };

  const removeOpening = async opening => {
    if (!window.confirm(`Delete “${opening.title}”? Existing applications will be kept.`)) return;
    const response = await apiFetch(`/careers/openings/${opening.id}`, { method: 'DELETE', cache: 'no-store' });
    if (!response.ok) { const data = await response.json().catch(() => ({})); return toast.error(data.detail || 'Unable to delete opening.', 'Careers'); }
    toast.success('Career opening deleted.');
    await load();
  };

  const changeApplicationStatus = async (application, nextStatus) => {
    const response = await apiFetch(`/careers/applications/${application.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }), cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(data.detail || 'Unable to update application.');
    setApplications(current => current.map(row => row.id === application.id ? data : row));
  };

  const downloadCv = async application => {
    try {
      const response = await apiFetch(`/careers/applications/${application.id}/cv`, { cache: 'no-store' });
      if (!response.ok) throw new Error('CV could not be downloaded.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = application.cv_original_name || 'resume.pdf'; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(error.message || 'CV download failed.'); }
  };

  return <div className="space-y-6 pb-12">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Recruitment</p><h1 className="text-2xl font-black text-slate-900">Careers</h1><p className="mt-1 text-sm text-slate-500">Create live job openings and securely receive applications from pixiutech.com.</p></div>
      <button type="button" onClick={() => { setEditingId(null); setOpeningForm(emptyOpening); setShowForm(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"><Plus size={16}/> Create opening</button>
    </div>

    <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm w-fit"><button type="button" onClick={() => setTab('openings')} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === 'openings' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}><BriefcaseBusiness size={14} className="mr-1 inline"/>Openings ({openings.length})</button><button type="button" onClick={() => setTab('applications')} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === 'applications' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}><Users size={14} className="mr-1 inline"/>Applications ({applications.length})</button></div>

    {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading recruitment data…</div> : tab === 'openings' ? (
      <div className="grid gap-4">
        {openings.map(opening => <article key={opening.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-slate-900">{opening.title}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${opening.status === 'published' ? 'bg-emerald-50 text-emerald-700' : opening.status === 'closed' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{opening.status}</span></div><p className="mt-2 text-sm text-slate-500">{opening.location || 'Location not specified'}{opening.employment_type ? ` • ${opening.employment_type}` : ''}</p><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{opening.description}</p><p className="mt-3 text-xs font-semibold text-slate-400">{opening.application_count || 0} applications</p></div>
            <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => { setEditingId(opening.id); setOpeningForm({ title: opening.title || '', location: opening.location || '', employment_type: opening.employment_type || '', description: opening.description || '', requirements: opening.requirements || '', status: opening.status || 'draft', sort_order: opening.sort_order || 0 }); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Edit3 size={14}/> Edit</button><button type="button" onClick={() => removeOpening(opening)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"><Trash2 size={14}/> Delete</button></div>
          </div>
        </article>)}
        {!openings.length && <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center"><BriefcaseBusiness className="mx-auto text-slate-300" size={30}/><h2 className="mt-3 font-black text-slate-800">No openings yet</h2><p className="mt-1 text-sm text-slate-500">Create an opening and publish it when applications are ready.</p></div>}
      </div>
    ) : (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Applicant</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">CV</th></tr></thead><tbody className="divide-y divide-slate-100">{applications.map(application => <tr key={application.id} className="text-sm"><td className="px-4 py-4"><div className="font-bold text-slate-800">{application.name}</div><div className="text-xs text-slate-400">{application.email}</div></td><td className="px-4 py-4 text-slate-600">{application.opening_title || 'General Application'}</td><td className="px-4 py-4 text-slate-600">{application.phone}</td><td className="px-4 py-4 text-xs text-slate-500">{new Date(application.created_at).toLocaleString('en-IN')}</td><td className="px-4 py-4"><select value={application.status} onChange={event => changeApplicationStatus(application, event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold"><option value="new">New</option>{statuses.slice(1).map(item => <option key={item} value={item}>{item[0].toUpperCase()+item.slice(1)}</option>)}</select></td><td className="px-4 py-4"><button type="button" disabled={!application.cv_available} onClick={() => downloadCv(application)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Download size={13}/> Download</button></td></tr>)}</tbody></table></div>
        {!applications.length && <div className="p-12 text-center text-sm text-slate-500">No applications received yet.</div>}
      </div>
    )}

    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h2 className="font-black text-slate-900">{editingId ? 'Edit career opening' : 'Create career opening'}</h2><p className="text-xs text-slate-500">Published openings appear immediately on pixiutech.com.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><form onSubmit={saveOpening} className="space-y-4 p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Job title *<input value={openingForm.title} onChange={e => setOpeningForm({...openingForm,title:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" required /></label><label className="text-xs font-bold text-slate-600">Location<input value={openingForm.location} onChange={e => setOpeningForm({...openingForm,location:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Remote / Varanasi / Hata" /></label><label className="text-xs font-bold text-slate-600">Employment type<input value={openingForm.employment_type} onChange={e => setOpeningForm({...openingForm,employment_type:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Full-time" /></label><label className="text-xs font-bold text-slate-600">Status<select value={openingForm.status} onChange={e => setOpeningForm({...openingForm,status:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Description *<textarea rows="5" value={openingForm.description} onChange={e => setOpeningForm({...openingForm,description:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" required /></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Requirements / what you'll work on<textarea rows="5" value={openingForm.requirements} onChange={e => setOpeningForm({...openingForm,requirements:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="One requirement per line" /></label></div><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create opening'}</button></div></form></div></div>}
  </div>;
}