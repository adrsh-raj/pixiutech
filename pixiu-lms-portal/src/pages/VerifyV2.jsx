import { useEffect, useState } from 'react';
import { Award, CheckCircle2, Download, ExternalLink, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../context/AuthContext';
import { API_BASE } from '../config/api';

const text = v => String(v ?? '').trim();

export default function VerifyV2() {
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const key = params.get('cert') || params.get('certificate') || '';
  const token = params.get('token') || '';

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError('');
      try {
        const query = token ? `?token=${encodeURIComponent(token)}` : `?certificate=${encodeURIComponent(key)}`;
        const r = await apiFetch(`/public/certificates/verify${query}`, { cache: 'no-store' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.reason || d?.detail || 'Certificate could not be verified.');
        if (alive) setData(d);
      } catch (e) { if (alive) setError(e.message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [key, token]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;
  if (error || !data?.verified) return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm"><XCircle size={42} className="mx-auto text-rose-500"/><h1 className="mt-4 text-2xl font-black text-slate-900">Certificate not verified</h1><p className="mt-2 text-sm text-slate-500">{error || data?.reason || 'No valid Pixiu Tech certificate was found.'}</p><p className="mt-5 font-mono text-xs text-slate-400 break-all">{key}</p></div></div>;

  const cert = data;
  const techs = Array.isArray(cert.technologies) ? cert.technologies : [];
  const units = Array.isArray(cert.units) ? cert.units : [];
  const pdfUrl = `${API_BASE}/public/certificates/pdf/${encodeURIComponent(cert.certificate_id)}`;

  return <div className="min-h-screen bg-slate-50 py-8 px-4"><main className="max-w-5xl mx-auto space-y-5"><header className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5"><div><p className="text-[10px] uppercase tracking-[.25em] font-black text-blue-300">Pixiu Tech Verification</p><h1 className="mt-2 text-3xl font-black">Verified Certificate</h1><p className="mt-2 text-sm text-slate-300">Certificate ID: {cert.certificate_id}</p></div><div className="rounded-2xl bg-white/10 border border-white/10 p-4 text-center"><ShieldCheck className="mx-auto text-emerald-300"/><p className="mt-2 text-[10px] font-black uppercase">{cert.status}</p></div></header><section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wider font-black text-blue-600">Student</p><h2 className="text-2xl font-black">{cert.student_name}</h2><p className="text-sm text-slate-500">{cert.student_id} · {cert.school_name} · {cert.class_name}</p></div></div><div className="mt-5 flex flex-wrap gap-2">{techs.map(t => <span key={t.code || t.name} className="rounded-xl bg-violet-50 text-violet-700 px-3 py-2 text-xs font-black">{t.name || t.code}</span>)}</div><div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3"><div className="stat"><p>Overall score</p><b>{cert.overall_score}%</b></div><div className="stat"><p>Completion</p><b>Passed</b></div><div className="stat"><p>Issue date</p><b>{new Date(cert.issued_at).toLocaleDateString()}</b></div><div className="stat"><p>Verification</p><b className="text-emerald-700">Valid</b></div></div><div className="mt-5 flex flex-wrap gap-2"><a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs font-black inline-flex items-center gap-2"><Download size={14}/> Official Certificate PDF</a>{cert.verification_url && <a href={cert.verification_url} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black inline-flex items-center gap-2"><ExternalLink size={14}/> Verification link</a>}</div></section><section className="bg-white rounded-3xl border border-slate-200 overflow-hidden"><div className="p-5 border-b border-slate-100"><h2 className="font-black">Completed Technology Units</h2></div><div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-slate-50"><tr>{['Technology','Unit','Module','Sessions','Score'].map(h => <th key={h} className="px-4 py-3 text-left text-[9px] uppercase tracking-wider font-black text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{units.map((u,i)=><tr key={`${u.unit_code}-${i}`}><td className="px-4 py-3 text-xs font-bold">{u.technology||'—'}</td><td className="px-4 py-3 font-mono text-[10px]">{u.unit_code||'—'}</td><td className="px-4 py-3 text-xs">{u.title||'—'}</td><td className="px-4 py-3 text-xs font-black">{u.sessions??'—'}</td><td className="px-4 py-3 text-xs font-black">{u.score??'—'}</td></tr>)}</tbody></table></div></section><footer className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-1"><CheckCircle2 size={12}/> This result is served from the Pixiu Tech certificate registry.</footer></main><style>{`.stat{border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:#f8fafc}.stat p{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:900}.stat b{display:block;margin-top:5px;font-size:15px;font-weight:900}`}</style></div>;
}
