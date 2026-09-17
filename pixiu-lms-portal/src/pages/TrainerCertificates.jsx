import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Copy, Download, ExternalLink, FileText, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config/api';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const text = value => String(value ?? '').trim();

export default function TrainerCertificates() {
  const { user } = useAuth();
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(null);
  const [scorecardLoading, setScorecardLoading] = useState(null);
  const [issued, setIssued] = useState(null);
  const isAllowed = ['trainer', 'admin', 'superadmin'].includes(user?.role);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/students', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Unable to load students.');
      setStudents(Array.isArray(payload) ? payload : payload.results || payload.data || []);
    } catch (error) { toast.error(error.message, 'Certificate workspace'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isAllowed) loadStudents(); }, [isAllowed]);
  const rows = useMemo(
    () => students.filter(student => !query || [student.name, student.student_id, student.class_name, student.school_name].join(' ').toLowerCase().includes(query.toLowerCase())).slice(0, 100),
    [students, query],
  );

  const issue = async student => {
    setIssuing(student.id);
    try {
      const response = await apiFetch(`${API_BASE}/certificates/issue/${encodeURIComponent(student.id)}`, { method: 'POST', cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.reason || 'Certificate cannot be issued yet.');
      if (payload.verified !== true || payload.issued !== true || !payload.verification_url || !payload.certificate_id) {
        throw new Error('The server did not confirm an issued and verifiable certificate. No certificate was generated.');
      }
      setIssued(payload);
      toast.success(`${payload.student_name} certificate and scorecard are ready.`, 'Credential issued');
    } catch (error) { toast.error(error.message, 'Certificate issue failed'); }
    finally { setIssuing(null); }
  };

  const openPublicCertificatePdf = payload => {
    if (payload?.verified !== true || payload?.issued !== true || !payload?.certificate_id) return;
    window.open(`${API_BASE}/public/certificates/pdf/${encodeURIComponent(payload.certificate_id)}`, '_blank', 'noopener,noreferrer');
  };

  const openScorecard = async payload => {
    if (!payload?.certificate_id || !payload?.student_id) return;
    setScorecardLoading(payload.certificate_id);
    try {
      const response = await apiFetch(`/certificates/scorecard/${encodeURIComponent(payload.student_id)}`, { cache: 'no-store' });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.detail || `Scorecard generation failed (${response.status}).`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) toast.warning('Allow pop-ups to open the scorecard PDF.');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(error.message, 'Scorecard generation failed');
    } finally {
      setScorecardLoading(null);
    }
  };

  const copyVerificationUrl = url => navigator.clipboard?.writeText(url).then(() => toast.success('Verification URL copied.')).catch(() => toast.warning('Could not copy automatically.'));
  if (!isAllowed) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6"><h1 className="font-black text-rose-900">Authorised trainer/admin access required</h1><p className="mt-1 text-sm text-rose-800">This workspace only allows certificate issuance by an authorised trainer or administrator.</p></div>;

  return <div className="max-w-6xl space-y-6 pb-10">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-blue-600"><ShieldCheck size={14}/> Server-authoritative credential issuance</div>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Graduate Certificates</h1>
        <p className="mt-1 text-sm text-slate-500">Each issued credential now produces two official papers from the backend: a certificate-size graduate certificate and an A4 student score card with class ranking.</p>
      </div>
      <div className="flex gap-2"><button type="button" onClick={loadStudents} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"><RefreshCw size={14}/> Refresh</button><Link to="/verify" target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white"><ExternalLink size={14}/> Verify Page</Link></div>
    </div>

    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900"><b>Certification rule:</b> the latest completed session marked as Last Session closes the programme. The server requires <b>overall score ≥ 70%</b>. Ranking uses the same score calculation as certification; only <b>positions 1–10</b> print as <b>1/35 … 10/35</b>. A student ranked 11 onward displays <b>-</b> in the personal rank field.</div>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4"><div className="relative max-w-xl"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-500" placeholder="Search student, ID, class or school…"/></div></div>
      {loading ? <div className="p-10 text-center text-slate-400">Loading student registry…</div> : !rows.length ? <div className="p-10 text-center text-slate-500">No matching students found.</div> : <div className="divide-y divide-slate-100">{rows.map(student=><div key={student.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-black text-slate-900">{student.name}</p><p className="mt-1 font-mono text-[11px] text-blue-600">{student.student_id||'No Student ID'} · {student.class_name||'—'}</p><p className="mt-1 text-xs text-slate-400">Status: {student.status||'active'}</p></div><div className="flex shrink-0 gap-2"><button type="button" disabled={issuing===student.id} onClick={()=>issue(student)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"><Award size={14}/>{issuing===student.id?'Checking…':'Issue Certificate'}</button></div></div>)}</div>}
    </section>

    {issued&&<section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700"><CheckCircle2 size={16}/> Issued & registry verified</div>
          <h2 className="mt-1 text-xl font-black text-emerald-950">{issued.student_name}</h2>
          <p className="mt-1 font-mono text-xs text-emerald-800">{issued.certificate_ref}</p>
          <p className="mt-2 text-xs text-emerald-800">Overall score: <b>{Number(issued.overall_score).toFixed(2)}%</b> · Rank: <b>{issued.rank_display || '-'}</b> · Issued by {issued.issued_by||'Authorised Pixiu Tech staff'}</p>
          <p className="mt-1 text-xs text-emerald-800">Technologies: {(issued.completed_technologies||issued.technologies||[]).map(item=>item?.name||item).join(' + ')||'—'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={()=>openPublicCertificatePdf(issued)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white"><Download size={14}/> Official Certificate</button>
          <button type="button" disabled={scorecardLoading===issued.certificate_id} onClick={()=>openScorecard(issued)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-black text-emerald-800 disabled:opacity-50"><FileText size={14}/>{scorecardLoading===issued.certificate_id?'Generating…':'A4 Score Card'}</button>
          <a href={issued.verification_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-black text-emerald-800"><ExternalLink size={14}/> Verify</a>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Verification URL</p><p className="mt-2 break-all font-mono text-[11px] text-blue-700">{issued.verification_url}</p><button type="button" onClick={()=>copyVerificationUrl(issued.verification_url)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-700"><Copy size={13}/> Copy URL</button></div>
    </section>}

    {issued&&<div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600"><p>The official certificate and score card are generated server-side from the LMS records. The score card freezes the class ranking snapshot at certificate issuance, while the public verification page exposes only certificate-level data.</p></div>}
  </div>;
}
