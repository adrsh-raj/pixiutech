import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Eye, FileText, Layers, Search, ShieldCheck, Trash2, Upload, X, Link2, Video } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth, apiFetch } from '../context/AuthContext';
import { openProtectedMaterial } from '../utils/protectedMaterial';
import LearningVideoPlayer from '../components/LearningVideoPlayer';

const TYPES = [['pdf','PDF'],['video','Video'],['link','Link'],['note','Note'],['image','Image']];
const TARGETS = [['student','Student'],['trainer','Trainer'],['student_trainer','Student + Trainer (same content ID)'],['school','School'],['all','All portals']];
const VIDEO_EXTENSIONS = ['.mp4', '.webm'];
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const clean = v => String(v ?? '').trim();
const code = v => clean(v?.school_code || v?.school_id || v?.code).toUpperCase();
const isActive = v => clean(v?.status || 'active').toLowerCase() !== 'inactive';
const asRows = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : [];

export default function ContentHub(){
  const { content=[], schools=[], classes=[], refreshAll, deleteContent } = useData();
  const { role } = useAuth();
  const toast = useToast();
  const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[query,setQuery]=useState(''),[targetFilter,setTargetFilter]=useState('all'),[gradeFilter,setGradeFilter]=useState('all'),[statusFilter,setStatusFilter]=useState('published');
  const [schoolOptions,setSchoolOptions]=useState([]),[videoMaterial,setVideoMaterial]=useState(null);
  const [form,setForm]=useState({title:'',description:'',content_type:'pdf',school:'',grade:'',level:'',unit_code:'',url:'',target_role:role==='trainer'?'student':'student',status:'published',file:null,is_watermarked:true});
  const availableSchools = useMemo(()=>schools.filter(isActive),[schools]);
  const contentSchools = useMemo(()=>schoolOptions.length ? schoolOptions.filter(isActive) : availableSchools,[schoolOptions,availableSchools]);
  const activeClasses = useMemo(()=>classes.filter(isActive),[classes]);
  const gradesForSchool = useMemo(()=>{
    const selected=clean(form.school), school=contentSchools.find(s=>String(s.id)===selected || code(s)===selected.toUpperCase());
    const schoolCode=code(school);
    return [...new Set(activeClasses.filter(c=>!schoolCode || code(c)===schoolCode).map(c=>clean(c.grade)).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  },[activeClasses,contentSchools,form.school]);
  const grades=[...new Set(content.map(x=>clean(x.grade)).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  useEffect(()=>{
    const pending=content.some(x=>x.content_type==='video'&&['queued','processing'].includes(x.video_processing_status));
    if(!pending) return undefined;
    const timer=window.setInterval(()=>{void refreshAll?.();},5000);
    return ()=>window.clearInterval(timer);
  },[content,refreshAll]);

  const filtered=useMemo(()=>content.filter(x=>{
    const hay=`${x.title||''} ${x.description||''} ${x.unit_code||''} ${x.level||''}`.toLowerCase();
    return (targetFilter==='all'||clean(x.target_role).toLowerCase()===targetFilter)&&(gradeFilter==='all'||clean(x.grade)===gradeFilter)&&(statusFilter==='all'||clean(x.status).toLowerCase()===statusFilter)&&hay.includes(query.trim().toLowerCase());
  }),[content,targetFilter,gradeFilter,statusFilter,query]);

  const reset=()=>setForm({title:'',description:'',content_type:'pdf',school:'',grade:'',level:'',unit_code:'',url:'',target_role:role==='trainer'?'student':'student',status:'published',file:null,is_watermarked:true});
  const schoolName=contentSchools.find(s=>String(s.id)===String(form.school))?.name || form.school;
  const openComposer=async()=>{
    reset();
    setOpen(true);
    try{
      const response=await apiFetch('/schools',{cache:'no-store'});
      if(response.ok) setSchoolOptions(asRows(await response.json().catch(()=>[])));
    }catch{}
  };
  const submit=async e=>{
    e.preventDefault();
    if(form.content_type==='video'){
      if(!form.file) return toast.error('Select an MP4 or WebM video.');
      const name=String(form.file.name||'').toLowerCase();
      const mime=String(form.file.type||'').toLowerCase();
      if(!VIDEO_EXTENSIONS.some(ext=>name.endsWith(ext))) return toast.error('Only MP4 and WebM videos are supported.');
      if(mime && !['video/mp4','video/webm'].includes(mime)) return toast.error('Video MIME type must be video/mp4 or video/webm.');
      if(form.file.size>MAX_VIDEO_BYTES) return toast.error('Video must be 500 MB or smaller.');
    }else if(!form.file&&!clean(form.url)){
      return toast.error('Add a file or resource URL.');
    }
    if(form.file&&form.content_type==='link') return toast.error('Link content must use a URL.');
    if(!form.school) return toast.error('Select the target school.');
    if(!/^\d+$/.test(clean(form.grade))) return toast.error('Select a valid grade.');
    if(!gradesForSchool.includes(clean(form.grade))) return toast.error(`No active Grade ${form.grade} class exists in ${schoolName}.`);
    if(role==='trainer'&&form.target_role!=='student') return toast.error('Trainers can share learning content with students only.');
    setSaving(true);
    try{
      const body=new FormData();
      Object.entries(form).forEach(([k,v])=>{if(k==='file'){if(v)body.append('file',v);return;}if(v!==null&&v!==undefined&&v!=='')body.append(k,String(v));});
      body.set('target_role',role==='trainer'?'student':form.target_role);
      if(form.content_type==='video') {
        body.delete('url');
        body.set('is_watermarked','false');
      } else if(role==='trainer'||form.target_role==='student') {
        body.set('is_watermarked',String(form.is_watermarked));
      } else {
        body.set('is_watermarked','false');
      }
      const r=await apiFetch('/content',{method:'POST',body}); const p=await r.json().catch(()=>({}));
      if(!r.ok){const fields=p.fields&&typeof p.fields==='object'?Object.entries(p.fields).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' '):'';throw new Error(fields||p.detail||p.error||'Content upload failed.');}
      toast.success(`Content saved for ${schoolName}, Grade ${form.grade}.`);setOpen(false);reset();await refreshAll?.();
    }catch(err){toast.error(err.message||'Content upload failed.');}finally{setSaving(false);}
  };
  const openMaterial=async item=>{
    try{
      if(item.content_type==='video'){
        if(item.video_processing_status!=='ready') {
          toast.error(item.video_processing_status==='failed' ? (item.video_processing_error || 'Video processing failed.') : 'Video is still being optimized. Please wait.');
          return;
        }
        setVideoMaterial(item);
        return;
      }
      await openProtectedMaterial(item);
    }catch(err){
      toast.error(err.message||'Unable to open material.');
    }
  };
  const canWatermark=new Set(['pdf','image']).has(form.content_type)&&form.target_role==='student';

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600">Learning</p><h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">Learning Content</h1><p className="text-sm text-slate-500 mt-1">Every content item is scoped to a specific school and grade. Trainer sharing is limited to assigned schools.</p></div>{(role==='admin'||role==='trainer')&&<button type="button" onClick={openComposer} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><Upload size={15}/> Add Content</button>}</div>
    <section className="grid grid-cols-2 xl:grid-cols-4 gap-3"><Metric icon={BookOpen} label="Content" value={content.length}/><Metric icon={Layers} label="Published" value={content.filter(x=>x.status==='published').length}/><Metric icon={Video} label="Videos" value={content.filter(x=>x.content_type==='video').length}/><Metric icon={ShieldCheck} label="Watermarked" value={content.filter(x=>x.is_watermarked).length}/></section>
    <section className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, unit or level" className="field pl-9"/></div>{role!=='student'&&<select value={targetFilter} onChange={e=>setTargetFilter(e.target.value)} className="field"><option value="all">All targets</option>{TARGETS.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>}<select value={gradeFilter} onChange={e=>setGradeFilter(e.target.value)} className="field"><option value="all">All grades</option>{grades.map(g=><option key={g} value={g}>Grade {g}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="field"><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></section>
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{filtered.map(item=><article key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5"><div className="flex items-center gap-2 flex-wrap"><span className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase">{item.content_type||'content'}</span>{item.grade&&<span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black">Grade {item.grade}</span>}<span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black">{item.target_role==='student_trainer'?'Student + Trainer':(item.target_role||'—')}</span>{item.content_type==='video'&&(
  item.video_processing_status==='ready'
    ? <span className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700 text-[10px] font-black inline-flex items-center gap-1"><Video size={11}/> View only</span>
    : item.video_processing_status==='failed'
      ? <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black">Processing failed</span>
      : <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-black">Optimizing video…</span>
)}{item.content_type!=='video'&&item.file&&<span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black">{item.is_watermarked?'Pixiu Watermarked':'Original Copy'}</span>}</div><h2 className="font-black text-slate-900 mt-3">{item.title}</h2><p className="text-xs text-slate-500 mt-2 line-clamp-3">{item.description||'No description stored.'}</p><p className="text-[10px] text-slate-400 mt-3">{item.unit_code||'No unit code'} · {item.level||'No level'}</p><div className="flex items-center justify-between border-t border-slate-100 mt-5 pt-4"><button type="button" disabled={item.content_type==='video'&&item.video_processing_status!=='ready'} onClick={()=>openMaterial(item)} className="px-3 py-2 rounded-lg bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[11px] font-black inline-flex items-center gap-1.5"><Eye size={13}/> {item.content_type==='video' ? (item.video_processing_status==='ready' ? 'Watch' : 'Processing…') : 'Open'}</button>{role==='admin'&&<button type="button" onClick={async()=>{if(!window.confirm(`Archive “${item.title}”?`))return;const r=await deleteContent(item.id);r?.success?toast.success('Content archived.'):toast.error(r?.error||'Unable to archive content.');}} className="p-2 rounded-lg text-slate-400 hover:text-rose-600"><Trash2 size={15}/></button>}</div></article>)}{!filtered.length&&<div className="col-span-full p-10 text-center border border-dashed border-slate-200 rounded-2xl text-sm text-slate-400">No learning content matches the current filters.</div>}</section>
    {open&&<div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3"><div className="bg-white rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto shadow-2xl"><div className="sticky top-0 bg-white p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="font-black text-slate-900">Add Learning Content</h2><p className="text-xs text-slate-500 mt-1">Choose the audience and exact school + grade before publishing.</p></div><button type="button" onClick={()=>setOpen(false)} className="p-2 text-slate-400"><X size={18}/></button></div><form onSubmit={submit} className="p-4 sm:p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Title"><input className="field" value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} required/></Field><Field label="Content type"><select className="field" value={form.content_type} onChange={e=>setForm(v=>({...v,content_type:e.target.value,file:null,url:'',is_watermarked:e.target.value==='pdf'||e.target.value==='image'}))}>{TYPES.map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label={role==='trainer'?'Assigned school':'School'}><select className="field" value={form.school} onChange={e=>setForm(v=>({...v,school:e.target.value,grade:''}))} required><option value="">Select school…</option>{contentSchools.map(s=><option key={s.id} value={s.id}>{s.name} · {code(s)}</option>)}</select></Field><Field label="Grade"><select className="field" value={form.grade} onChange={e=>setForm(v=>({...v,grade:e.target.value}))} disabled={!form.school} required><option value="">{form.school?'Select grade…':'Select school first…'}</option>{gradesForSchool.map(g=><option key={g} value={g}>Grade {g}</option>)}</select></Field></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Level"><input className="field" value={form.level} onChange={e=>setForm(v=>({...v,level:e.target.value}))}/></Field><Field label="Unit code"><input className="field" value={form.unit_code} onChange={e=>setForm(v=>({...v,unit_code:e.target.value}))}/></Field></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Share with"><select className="field" value={form.target_role} onChange={e=>setForm(v=>({...v,target_role:e.target.value,is_watermarked:e.target.value==='student'&&v.content_type!=='video'}))} disabled={role==='trainer'}>{(role==='trainer'?[['student','Student']]:TARGETS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field><Field label="Status"><select className="field" value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value}))}><option value="draft">Draft</option><option value="published">Published</option></select></Field></div>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[10px] text-blue-800">{form.school&&form.grade?`Only active classes in ${schoolName}, Grade ${form.grade}, will receive this content.`:'Select a school and grade to define the delivery scope.'}</div>
      {canWatermark&&<label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><input type="checkbox" checked={form.is_watermarked} onChange={e=>setForm(v=>({...v,is_watermarked:e.target.checked}))}/><span><b className="block text-xs text-emerald-800">Apply Pixiu Tech watermark</b><span className="text-[10px] text-emerald-700">Student-facing PDF/image copies can be permanently watermarked.</span></span></label>}
      {form.content_type!=='link'&&<Field label={form.content_type==='video'?'Upload video':'Upload file'}><input className="field" type="file" accept={form.content_type==='video'?'.mp4,.webm,video/mp4,video/webm':form.content_type==='image'?'image/*':form.content_type==='pdf'?'application/pdf,.pdf':undefined} onChange={e=>setForm(v=>({...v,file:e.target.files?.[0]||null}))}/>{form.content_type==='video'&&<p className="mt-1 text-[10px] text-slate-400">MP4 or WebM only · maximum 500 MB · stored in private Supabase Storage.</p>}</Field>}
      {form.content_type==='link'&&<Field label="External resource URL"><div className="relative"><Link2 size={14} className="absolute left-3 top-3 text-slate-400"/><input className="field pl-9" type="url" value={form.url} onChange={e=>setForm(v=>({...v,url:e.target.value}))} placeholder="https://…" required/></div></Field>}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-600">One upload creates exactly one Learning Content record / ID. Choosing <b>Student + Trainer</b> assigns that same content ID to both audiences.</div>
      <Field label="Description"><textarea className="field min-h-24" value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></Field>
      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={()=>setOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button disabled={saving} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-black">{saving?'Uploading…':'Save Content'}</button></div>
    </form></div></div>}
    {videoMaterial&&<LearningVideoPlayer material={videoMaterial} onClose={()=>setVideoMaterial(null)}/>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}.field:disabled{background:#f8fafc;color:#94a3b8}`}</style>
  </div>;
}
function Field({label,children}){return <div><label className="block text-[10px] uppercase tracking-wide font-black text-slate-400 mb-1">{label}</label>{children}</div>}
function Metric({icon:Icon,label,value}){return <div className="bg-white border border-slate-200 rounded-2xl p-4"><div className="flex items-center justify-between"><span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center"><Icon size={16}/></span><span className="text-[9px] uppercase tracking-wide font-black text-slate-400">{label}</span></div><p className="text-2xl font-black text-slate-900 mt-3">{value}</p></div>}
