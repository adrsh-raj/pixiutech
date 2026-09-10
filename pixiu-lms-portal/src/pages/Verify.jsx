import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Download, ExternalLink, QrCode, Search, ShieldCheck, XCircle } from 'lucide-react';
import { API_BASE } from '../config/api';
import { generateStudentTranscriptPDF } from '../utils/transcriptGenerator';

const text = value => String(value ?? '').trim();
const normalize = value => text(value).toUpperCase();

export default function Verify() {
  const initialId = useMemo(() => new URLSearchParams(window.location.search).get('id') || new URLSearchParams(window.location.search).get('cert') || '', []);
  const [studentId, setStudentId] = useState(initialId);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const verify = async value => {
    const id = text(value);
    if (!id) { setError('Enter a Student ID to verify the credential.'); setResult(null); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch(`${API_BASE}/public/certificates/verify/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 404) { setError(payload.reason || 'No Pixiu Tech credential matches this Student ID.'); return; }
      if (!response.ok) throw new Error(payload.detail || payload.reason || `Verification failed (${response.status}).`);
      setResult(payload);
      window.history.replaceState({}, '', `/verify?id=${encodeURIComponent(id)}`);
    } catch (err) { setError(err.message || 'Unable to reach the Pixiu Tech registry.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (initialId) verify(initialId); }, [initialId]);

  const verified = result?.verified === true;
  const downloadCertificate = () => {
    if (!verified) return;
    const student = {
      name: result.student_name,
      student_id: result.student_id,
      school_id: result.school_code,
      school_name: result.school_name,
      class_name: result.class_name,
      current_level: result.current_level,
      tech_level: result.current_level,
      certificate_issued: true,
      status: 'active',
    };
    generateStudentTranscriptPDF({
      student,
      school: { name: result.school_name, school_code: result.school_code },
      attendanceRate: result.attendance_rate,
      studentReviews: result.assessments || [],
      projects: result.projects || [],
      curriculum: [],
      isOfficialCertificate: true,
      certificate: result,
    });
  };

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><div className="flex items-center gap-3"><img src="/img/logo.png" alt="Pixiu Tech" className="h-11 w-11 rounded-xl border border-slate-200 object-contain"/><div><p className="text-sm font-black tracking-wide text-slate-900">PIXIU TECH</p><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Central Credential Registry</p></div></div><a href="/" className="text-xs font-black text-blue-600 hover:text-blue-700">Portal Login</a></div></header>
    <main className="mx-auto max-w-5xl px-5 py-10">
      <section className="mx-auto max-w-3xl text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ShieldCheck size={28}/></div><p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Official Credential Authentication</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Verify a Pixiu Tech Graduate Certificate</h1><p className="mt-3 text-sm leading-6 text-slate-500">Enter the permanent Student ID printed on the certificate, or open this page from the QR code. Verification is read directly from the server-authoritative LMS registry.</p></section>
      <section className="mx-auto mt-8 max-w-3xl rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><form onSubmit={e => { e.preventDefault(); verify(studentId); }} className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={17} className="absolute left-4 top-4 text-slate-400"/><input autoFocus value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="e.g. XYZ6A 01" className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"/></div><button disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50"><Search size={15}/>{loading ? 'Checking Registry…' : 'Verify Credential'}</button></form>{error && <div className="mt-3 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><XCircle size={19} className="mt-0.5 shrink-0"/><div><p className="font-black">Credential Not Verified</p><p className="mt-1">{error}</p></div></div>}</section>
      {result && <section className="mx-auto mt-8 max-w-3xl space-y-5">
        <div className={`rounded-3xl border p-5 ${verified ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3">{verified ? <CheckCircle2 className="text-emerald-600" size={28}/> : <XCircle className="text-amber-600" size={28}/>}<div><p className="text-[10px] font-black uppercase tracking-[0.16em]">{verified ? 'Credential Verified' : 'Credential Not Verified'}</p><h2 className="mt-1 text-xl font-black">{verified ? 'Official Pixiu Tech Graduate Certificate' : 'Record found, but not an active graduate credential'}</h2></div></div>{verified && <button type="button" onClick={downloadCertificate} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white"><Download size={14}/> Print / Save Certificate</button>}</div>{!verified && <p className="mt-3 text-sm text-amber-900">{result.reason || 'The credential has not met the public verification requirements.'}</p>}</div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Student</p><h3 className="mt-2 text-lg font-black">{result.student_name}</h3><p className="mt-1 font-mono text-xs text-blue-600">{result.student_id}</p><div className="mt-4 space-y-2 text-xs text-slate-600"><p><span className="font-black text-slate-800">School:</span> {result.school_name}</p><p><span className="font-black text-slate-800">Class:</span> {result.class_name}</p><p><span className="font-black text-slate-800">Level:</span> {result.current_level || '—'}</p></div></div><div className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Credential</p><p className="mt-2 break-all font-mono text-xs font-bold text-slate-800">{result.certificate_ref}</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase text-slate-400">Completion</p><p className="mt-1 text-lg font-black">{result.completion_count}/{result.required_completion_count}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[9px] font-black uppercase text-slate-400">Attendance</p><p className="mt-1 text-lg font-black">{result.attendance_rate}%</p></div></div></div></div>
        {verified && <div className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Official QR Verification</p><p className="mt-1 text-sm font-black">Scan to reopen this exact registry record</p></div><QrCode className="text-blue-600" size={22}/></div><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(result.verification_url)}`} alt="Credential verification QR" className="h-36 w-36 rounded-2xl border border-slate-200 bg-white p-2"/><div className="min-w-0"><p className="break-all font-mono text-[11px] text-blue-600">{result.verification_url}</p><p className="mt-3 text-xs text-slate-500">Registry: {result.registry || 'Pixiu Tech Central Registry'}</p><p className="mt-1 text-xs text-slate-500">Trainer record: {result.trainer_name || '—'}</p></div></div></div>}
        {!!result.assessments?.length && <div className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Award size={18} className="text-blue-600"/><h3 className="font-black">Course Completion Record</h3></div><div className="mt-4 divide-y divide-slate-100">{result.assessments.map((item, index) => <div key={`${item.unit_code}-${item.level}-${index}`} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-slate-800">{item.title || item.unit_code || item.level}</p><p className="text-[10px] text-slate-400">{item.level || 'Unit'} · {item.unit_code || '—'} · {item.assessment_date}</p></div><div className="text-xs font-black text-slate-700">Score {item.score ?? '—'}{item.rating != null ? ` · Rating ${item.rating}/5` : ''}</div></div>)}</div></div>}
        {!!result.projects?.length && <div className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-black">Practical Project Record</h3><ExternalLink size={17} className="text-slate-400"/></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{result.projects.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><p className="text-sm font-black">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.status || '—'}{item.score != null ? ` · Score ${item.score}` : ''}</p></div>)}</div></div>}
        <p className="text-center text-[10px] font-semibold text-slate-400">Verification source: Pixiu Tech Central Registry · No static/local browser data is used for credential decisions.</p>
      </section>}
    </main>
    <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 text-[10px] font-semibold text-slate-400"><span>© Pixiu Tech LLP</span><a href="/verify" className="hover:text-slate-600">Credential Verification</a></div></footer>
  </div>;
}