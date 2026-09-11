import { useEffect, useMemo, useState } from 'react';
import { Award, ClipboardPenLine, Download, Plus, RefreshCw, ShieldCheck, Star, X } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';
import { generateStudentTranscriptPDF } from '../utils/transcriptGenerator';

const rows = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const text = value => String(value ?? '').trim();
const key = value => text(value).toUpperCase().replace(/\s+/g, '');
const unitKey = review => key(review.level || review.unit_code || review.title);

function errorText(payload, status) {
  if (!payload || typeof payload !== 'object') return `Request failed (${status}).`;
  const fields = payload.fields && typeof payload.fields === 'object'
    ? Object.entries(payload.fields).flatMap(([field, value]) => (Array.isArray(value) ? value : [value]).map(item => `${field}: ${typeof item === 'object' ? JSON.stringify(item) : String(item)}`))
    : [];
  return fields.length ? fields.join(' ') : text(payload.detail || payload.error || payload.message) || `Request failed (${status}).`;
}

async function request(path, method='GET', body) {
  const response = await apiFetch(path, { method, cache: method === 'GET' ? 'no-store' : undefined, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(errorText(payload, response.status)); error.status = response.status; error.fields = payload.fields || {}; throw error; }
  return payload;
}

export default function TrainerReviews() {
  const { user } = useAuth();
  const { students = [], studentReviews = [], projects = [], refreshAll, getStudentAttendance, loading } = useData();
  const [reviews, setReviews] = useState(studentReviews);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [form, setForm] = useState({ unit_code: '', level: '', title: '', score: '', rating: '', status: 'published', feedback: '', assessment_date: new Date().toISOString().slice(0,10) });
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [certBusy, setCertBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setReviews(studentReviews), [studentReviews]);
  const activeStudents = useMemo(() => students.filter(s => text(s.status || 'active').toLowerCase() !== 'inactive'), [students]);
  const getStudentReviews = student => reviews.filter(r => key(r.student_id || r.student) === key(student.student_id || student.id));
  const getStudentProjects = student => projects.filter(p => key(p.student_id || p.student) === key(student.student_id || student.id));
  const completionCount = student => { const unique = new Set(getStudentReviews(student).filter(r => text(r.status || '').toLowerCase() === 'published' && r.score != null).map(unitKey).filter(Boolean)); return unique.size; };
  const isCertified = student => /certified graduate/i.test(text(student.current_level));

  const save = async event => {
    event.preventDefault();
    const selected = activeStudents.find(student => String(student.id) === String(selectedStudent));
    if (!selectedStudent || !selected || !text(form.title)) { setError('Select a student and enter a review title.'); return; }
    if (form.score !== '' && (Number(form.score) < 0 || Number(form.score) > 100)) { setError('Score must be between 0 and 100.'); return; }
    if (form.rating !== '' && (Number(form.rating) < 0 || Number(form.rating) > 5)) { setError('Rating must be between 0 and 5.'); return; }
    const studentId = String(selected.id);
    setBusy(true); setError('');
    try {
      await request('/assessments', 'POST', {
        student: studentId,
        unit_code: text(form.unit_code),
        level: text(form.level),
        title: text(form.title),
        score: form.score === '' ? null : Number(form.score),
        rating: form.rating === '' ? null : Number(form.rating),
        status: form.status,
        feedback: text(form.feedback),
        assessment_date: form.assessment_date,
      });
      await refreshAll();
      setModal(false);
      setSelectedStudent('');
      setForm({ unit_code:'', level:'', title:'', score:'', rating:'', status:'published', feedback:'', assessment_date:new Date().toISOString().slice(0,10) });
    } catch (err) {
      setError(err.message || 'Unable to save the review.');
    } finally { setBusy(false); }
  };

  const printCertificate = student => {
    const reviewsForStudent = getStudentReviews(student); const projectsForStudent = getStudentProjects(student);
    generateStudentTranscriptPDF({ student: { ...student, current_level: /certified graduate/i.test(text(student.current_level)) ? student.current_level : 'Level 5 (Certified Graduate)' }, school: { name: student.school_name || 'PIXIU Tech Partner School', school_code: student.school_code || student.school_id || '' }, attendanceRate: getStudentAttendance(student.student_id || student.id), studentReviews: reviewsForStudent, projects: projectsForStudent, curriculum: [], isOfficialCertificate: true, certificate: { verified: true, certificate_ref: `PIXIU-${student.school_code || student.school_id || 'SCH'}-${String(student.student_id || '').replace(/\s+/g,'')}-${new Date().getFullYear()}`, verification_url: `${window.location.origin}/verify?id=${encodeURIComponent(student.student_id)}`, trainer_name: user?.display_name || user?.username || '' } });
  };

  const issueCertificate = async student => {
    const count = completionCount(student); if (count < 6) return setError(`${student.name} needs ${6 - count} more published unit evaluation${count === 5 ? '' : 's'} before certificate issuance.`);
    setCertBusy(String(student.id)); setError('');
    try { const result = await request(`/certificates/issue/${encodeURIComponent(student.id)}`, 'POST', {}); await refreshAll(); printCertificate({ ...student, current_level: result.current_level || 'Level 5 (Certified Graduate)', school_code: result.school_code || student.school_code, school_name: result.school_name || student.school_name }); }
    catch (err) { setError(err.message); }
    finally { setCertBusy(''); }
  };

  return <div className="space-y-5 pb-10"><PageHeader eyebrow="Trainer" title="Student Reviews & Certificates" description="Record trainer assessments and issue a server-verified graduate certificate only after course completion." actions={<div className="flex gap-2"><RefreshButton onRefresh={refreshAll} loading={loading || busy || !!certBusy}/><button type="button" onClick={()=>{setError('');setModal(true)}} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><Plus size={14}/> New Review</button></div>} />
    {error && <ErrorState title="Trainer action failed" description={error} onRetry={()=>setError('')} />}
    {activeStudents.length === 0 ? <div className="bg-white border border-slate-200 rounded-2xl p-10"><EmptyState icon={<ClipboardPenLine size={20}/>} title="No students in scope" description="No active student records are currently visible to this trainer."/></div> : <section className="space-y-3">{activeStudents.map(student=>{ const count=completionCount(student); const certified=isCertified(student); const mine=getStudentReviews(student); return <article key={student.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-slate-900">{student.name}</p><span className="font-mono text-[10px] text-slate-400">{student.student_id}</span>{certified && <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700">Certified</span>}</div><p className="mt-1 text-xs text-slate-500">{student.school_name || 'Partner School'} · {student.class_name || 'Class'} · {mine.length} assessment record{mine.length===1?'':'s'}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase ${count >= 6 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{count}/6 units complete</span>{count >= 6 && !certified ? <button type="button" onClick={()=>issueCertificate(student)} disabled={certBusy===String(student.id)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-black text-white disabled:opacity-50">{certBusy===String(student.id) ? <RefreshCw size={14} className="animate-spin"/> : <Award size={14}/>} Issue Certificate</button> : <button type="button" onClick={()=>printCertificate(student)} disabled={!certified} title={certified ? 'Print verified graduate certificate' : 'Complete 6 published unit evaluations first'} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><Download size={14}/> {certified ? 'Print Certificate' : 'Needs 6 Units'}</button>}<span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400"><ShieldCheck size={14}/> Server verified</span></div></div></article>})}</section>}
    {reviews.length>0 && <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><div className="p-5 border-b border-slate-100"><h2 className="font-black">Assessment Ledger</h2><p className="mt-1 text-xs text-slate-400">Published trainer evaluations feed course completion and certificate eligibility.</p></div><div className="divide-y divide-slate-100">{reviews.map(review=><article key={review.id} className="p-5"><div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider font-black text-violet-600">{review.unit_code || review.level || 'Assessment'}</p><h2 className="text-sm font-black text-slate-900 mt-1">{review.title || 'Student review'}</h2><p className="text-xs text-slate-500 mt-1">{review.student_id || review.student || 'Student'} · {review.assessment_date || '—'}</p></div><div className="flex items-center gap-3"><span className="font-black text-sm">{review.score ?? '—'}</span>{review.rating != null && <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-black"><Star size={13} fill="currentColor"/>{review.rating}/5</span>}</div></div>{review.feedback && <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{review.feedback}</p>}</article>)}</div></section>}
    {modal && <div className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><form onSubmit={save} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-lg font-black">New Student Review</h2><p className="text-xs text-slate-400 mt-1">The signed-in trainer is stored as the assessor and the selected student must be in this trainer's authorized school scope.</p></div><button type="button" onClick={()=>setModal(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={18}/></button></div><div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3"><select className="field md:col-span-2" value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)} required><option value="">Select student</option>{activeStudents.map(s=><option key={s.id} value={s.id}>{s.name} · {s.student_id}</option>)}</select><input className="field" placeholder="Review title" value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} required/><input className="field" placeholder="Unit code" value={form.unit_code} onChange={e=>setForm(v=>({...v,unit_code:e.target.value}))}/><input className="field" placeholder="Level" value={form.level} onChange={e=>setForm(v=>({...v,level:e.target.value}))}/><input className="field" type="number" min="0" max="100" step="0.1" placeholder="Score (0–100)" value={form.score} onChange={e=>setForm(v=>({...v,score:e.target.value}))}/><input className="field" type="number" min="0" max="5" step="0.1" placeholder="Rating (0–5)" value={form.rating} onChange={e=>setForm(v=>({...v,rating:e.target.value}))}/><input className="field" type="date" value={form.assessment_date} onChange={e=>setForm(v=>({...v,assessment_date:e.target.value}))}/><select className="field" value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value}))}><option value="draft">Draft</option><option value="published">Published</option></select><textarea className="field md:col-span-2 min-h-32" placeholder="Feedback" value={form.feedback} onChange={e=>setForm(v=>({...v,feedback:e.target.value}))}/></div><div className="p-5 border-t border-slate-100 flex justify-end gap-2"><button type="button" onClick={()=>setModal(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button disabled={busy} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><RefreshCw size={13}/>{busy?'Saving…':'Save Review'}</button></div></form></div>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}`}</style></div>;
}
