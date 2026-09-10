import { useMemo, useState } from 'react';
import { BookOpen, Eye, FileText, Layers, Search, ShieldCheck, Trash2, Upload, X, Link2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth, apiFetch } from '../context/AuthContext';
import { openProtectedMaterial } from '../utils/protectedMaterial';

const TYPE_OPTIONS = [['pdf', 'PDF'], ['video', 'Video'], ['link', 'Link'], ['note', 'Note'], ['image', 'Image']];
const TARGET_OPTIONS = [['trainer', 'Trainer'], ['student', 'Student'], ['school', 'School'], ['all', 'All portals']];
const WATERMARKABLE_TYPES = new Set(['pdf', 'image']);

export default function ContentHub() {
  const { content = [], refreshAll, deleteContent } = useData();
  const { role } = useAuth();
  const toast = useToast();
  const [targetRole, setTargetRole] = useState('all');
  const [grade, setGrade] = useState('all');
  const [status, setStatus] = useState('published');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', content_type: 'pdf', grade: '', level: '', unit_code: '', url: '', target_role: 'student', status: 'published', file: null, is_watermarked: true });

  const grades = useMemo(() => Array.from(new Set(content.map(item => item.grade).filter(Boolean).map(String))).sort((a, b) => Number(a) - Number(b)), [content]);
  const filtered = useMemo(() => content.filter(item => {
    const haystack = `${item.title || ''} ${item.description || ''} ${item.unit_code || ''} ${item.level || ''}`.toLowerCase();
    return (targetRole === 'all' || String(item.target_role || '').toLowerCase() === targetRole) && (grade === 'all' || String(item.grade) === grade) && (status === 'all' || String(item.status || '').toLowerCase() === status) && haystack.includes(query.trim().toLowerCase());
  }), [content, targetRole, grade, status, query]);

  const resetForm = () => setForm({ title: '', description: '', content_type: 'pdf', grade: '', level: '', unit_code: '', url: '', target_role: 'student', status: 'published', file: null, is_watermarked: true });

  const submit = async event => {
    event.preventDefault();
    if (!form.file && !form.url.trim()) return toast.error('Add an uploaded file or a resource URL.');
    if (form.file && form.content_type === 'link') return toast.error('Link content must use a URL instead of a file.');
    if (!form.grade.trim() || !/^\d+$/.test(form.grade.trim())) return toast.error('Grade must be numeric.');
    if ((form.target_role === 'student' || form.target_role === 'trainer' || form.target_role === 'all') && !form.grade.trim()) return toast.error('Grade is required for portal sharing.');
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'file') { if (value) body.append('file', value); return; }
        if (value !== null && value !== undefined) body.append(key, String(value));
      });
      if (form.target_role === 'trainer') body.set('is_watermarked', 'false');
      const response = await apiFetch('/content', { method: 'POST', body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || payload.message || 'Content upload failed.');
      toast.success(`“${payload.title || form.title}” saved. ${payload.is_watermarked ? 'Pixiu Tech watermark applied.' : 'Original copy saved.'}`);
      setOpen(false);
      resetForm();
      await refreshAll?.();
    } catch (error) { toast.error(error.message || 'Content upload failed.'); }
    finally { setSaving(false); }
  };

  const openMaterial = async item => {
    try {
      if (item.file) {
        await openProtectedMaterial(`/content/${item.id}/file`, item.title || 'Pixiu-Material');
        return;
      }
      if (item.url) {
        const opened = window.open(item.url, '_blank', 'noopener,noreferrer');
        if (!opened) throw new Error('Please allow pop-ups to open this resource.');
        return;
      }
      throw new Error('This learning content has no file or URL yet.');
    } catch (error) { toast.error(error.message || 'Unable to open material.'); }
  };

  const canWatermark = WATERMARKABLE_TYPES.has(form.content_type) && form.target_role !== 'trainer';

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600">Learning</p><h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 break-words">Learning Content</h1><p className="text-sm text-slate-500 mt-1 max-w-4xl">Student-facing PDF/image uploads can carry a permanent Pixiu Tech watermark. Trainer-only copies stay original. Portal sharing is linked to active classes in the selected grade.</p></div>{role === 'admin' && <button type="button" onClick={() => setOpen(true)} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center justify-center gap-2"><Upload size={15}/> Add Content</button>}</div>
    <section className="grid grid-cols-2 xl:grid-cols-4 gap-3"><Metric icon={BookOpen} label="Content" value={content.length}/><Metric icon={Layers} label="Published" value={content.filter(i => i.status === 'published').length}/><Metric icon={FileText} label="Trainer" value={content.filter(i => i.target_role === 'trainer').length}/><Metric icon={ShieldCheck} label="Watermarked" value={content.filter(i => i.is_watermarked).length}/></section>
    <section className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, unit or level" className="field pl-9"/></div><select value={targetRole} onChange={e => setTargetRole(e.target.value)} className="field"><option value="all">All targets</option>{TARGET_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={grade} onChange={e => setGrade(e.target.value)} className="field"><option value="all">All grades</option>{grades.map(item => <option key={item} value={item}>Grade {item}</option>)}</select><select value={status} onChange={e => setStatus(e.target.value)} className="field"><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></section>
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{filtered.map(item => <article key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between min-w-0"><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase">{item.content_type || 'content'}</span>{item.grade && <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black">Grade {item.grade}</span>}<span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black">{item.target_role || '—'}</span>{item.file && <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${item.is_watermarked ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>{item.is_watermarked ? 'Pixiu Watermarked' : 'Original Copy'}</span>}</div><h2 className="font-black text-slate-900 mt-3 break-words">{item.title}</h2><p className="text-xs text-slate-500 mt-2 line-clamp-3 break-words">{item.description || 'No description stored.'}</p><p className="text-[10px] text-slate-400 mt-3 break-words">{item.unit_code || 'No unit code'} · {item.level || 'No level'}</p></div><div className="flex items-center justify-between gap-2 border-t border-slate-100 mt-5 pt-4"><button type="button" onClick={() => openMaterial(item)} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-[11px] font-black inline-flex items-center gap-1.5"><Eye size={13}/> Open</button>{role === 'admin' && <button type="button" onClick={async () => { if (!window.confirm(`Archive “${item.title}”?`)) return; const result = await deleteContent(item.id); result?.success ? toast.success('Content archived.') : toast.error(result?.error || 'Unable to archive content.'); }} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={15}/></button>}</div></article>)}{!filtered.length && <div className="col-span-full"><div className="p-10 text-center border border-dashed border-slate-200 rounded-2xl text-sm text-slate-400">No learning content matches the current filters.</div></div>}</section>
    {open && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"><div className="bg-white rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto shadow-2xl"><div className="sticky top-0 z-10 bg-white p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="font-black text-slate-900">Add Learning Content</h2><p className="text-xs text-slate-500 mt-1">Choose who receives it. Student-facing PDF/image files can be permanently watermarked.</p></div><button onClick={() => setOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 shrink-0"><X size={18}/></button></div><form onSubmit={submit} className="p-4 sm:p-5 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Title"><input className="field" value={form.title} onChange={e => setForm(v => ({...v,title:e.target.value}))} required/></Field><Field label="Content type"><select className="field" value={form.content_type} onChange={e => setForm(v => ({...v,content_type:e.target.value,file:e.target.value === 'link' ? null : v.file,is_watermarked:e.target.value === 'pdf' || e.target.value === 'image'}))}>{TYPE_OPTIONS.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Field label="Grade"><input className="field" value={form.grade} onChange={e => setForm(v => ({...v,grade:e.target.value}))} inputMode="numeric" required/></Field><Field label="Level"><input className="field" value={form.level} onChange={e => setForm(v => ({...v,level:e.target.value}))}/></Field><Field label="Unit code"><input className="field" value={form.unit_code} onChange={e => setForm(v => ({...v,unit_code:e.target.value}))}/></Field></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Share with"><select className="field" value={form.target_role} onChange={e => setForm(v => ({...v,target_role:e.target.value,is_watermarked:e.target.value === 'trainer' ? false : v.is_watermarked}))}>{TARGET_OPTIONS.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Status"><select className="field" value={form.status} onChange={e => setForm(v => ({...v,status:e.target.value}))}><option value="draft">Draft</option><option value="published">Published</option></select></Field></div>{canWatermark && <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 cursor-pointer"><input type="checkbox" className="mt-0.5" checked={form.is_watermarked} onChange={e => setForm(v => ({...v,is_watermarked:e.target.checked}))}/><span><span className="block text-xs font-black text-emerald-800">Apply Pixiu Tech watermark</span><span className="block mt-0.5 text-[10px] text-emerald-700">Permanent “PIXIU TECH • STUDENT COPY • CONFIDENTIAL” watermark is written into uploaded PDF/image files.</span></span></label>}{form.target_role !== 'trainer' && form.grade && <p className="text-[10px] text-slate-500">Published grade-based sharing will automatically link this material to active classes in Grade {form.grade}.</p>}{form.content_type !== 'link' && <Field label="Upload file"><input className="field" type="file" accept={form.content_type === 'image' ? 'image/*' : form.content_type === 'pdf' ? 'application/pdf,.pdf' : undefined} onChange={e => setForm(v => ({...v,file:e.target.files?.[0] || null}))}/><p className="mt-1 text-[10px] text-slate-400">PDF/image uploads: watermark runs on the server when enabled. Trainer-only uploads are preserved as original.</p></Field>}<Field label="External resource URL"><div className="relative"><Link2 size={14} className="absolute left-3 top-3 text-slate-400"/><input className="field pl-9" value={form.url} onChange={e => setForm(v => ({...v,url:e.target.value}))} type="url" placeholder="https://…" required={!form.file && (form.content_type === 'link' || form.status === 'published')}/></div><p className="mt-1 text-[10px] text-slate-400">External resources stay on the source host and are opened directly.</p></Field><Field label="Description"><textarea className="field min-h-24" value={form.description} onChange={e => setForm(v => ({...v,description:e.target.value}))}/></Field><div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-50">{saving ? 'Uploading…' : 'Save Content'}</button></div></form></div></div>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}`}</style>
  </div>;
}
function Field({label,children}){return <div><label className="block text-[10px] uppercase tracking-wide font-black text-slate-400 mb-1">{label}</label>{children}</div>}
function Metric({icon:Icon,label,value}){return <div className="bg-white border border-slate-200 rounded-2xl p-4 min-w-0"><div className="flex items-center justify-between gap-2"><span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"><Icon size={16}/></span><span className="text-[9px] uppercase tracking-wide font-black text-slate-400 truncate">{label}</span></div><p className="text-2xl font-black text-slate-900 mt-3">{value}</p></div>}
