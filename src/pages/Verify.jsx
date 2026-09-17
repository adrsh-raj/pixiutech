import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, ExternalLink, Search, ShieldCheck, XCircle } from 'lucide-react'
import '../styles/verify.css'

const text = (value) => String(value ?? '').trim()
const PUBLIC_VERIFY_BASE = 'https://pixiutech.com/verify'

function normalizeApiBase(value) {
  const candidate = text(value)
  if (!candidate) return ''
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    let pathname = url.pathname.replace(/\/+$/, '')
    if (!pathname || pathname === '/') pathname = '/api/v1'
    else if (pathname === '/api') pathname = '/api/v1'
    else if (!pathname.endsWith('/api/v1')) pathname = `${pathname}/api/v1`
    url.pathname = pathname
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL || import.meta.env.VITE_DJANGO_API_URL)
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return text(value)
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function formatScore(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toFixed(2)}%` : '—'
}

export default function Verify() {
  const initialCertificate = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return text(params.get('cert') || params.get('certificate') || params.get('token'))
  }, [])
  const [certificateId, setCertificateId] = useState(initialCertificate)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const verify = async (value = certificateId) => {
    const key = text(value)
    setError('')
    setResult(null)
    if (!key) { setError('Enter the certificate ID printed on the credential.'); return }
    if (!API_BASE) { setError('The verification service is not configured on this website. Set VITE_API_URL to the Pixiu Tech Django API root and redeploy.'); return }
    setLoading(true)
    try {
      const queryName = TOKEN_PATTERN.test(key) ? 'token' : 'cert'
      const response = await fetch(`${API_BASE}/public/certificates/verify?${queryName}=${encodeURIComponent(key)}`, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (response.status === 404) throw new Error(payload.reason || 'No Pixiu Tech certificate matches this verification code.')
      if (!response.ok) throw new Error(payload.detail || payload.reason || `Verification failed (${response.status}).`)
      setResult(payload)
      const canonicalId = text(payload.certificate_id || payload.certificate_ref || key)
      window.history.replaceState({}, '', `/verify?cert=${encodeURIComponent(canonicalId)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach the Pixiu Tech verification registry.')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (initialCertificate) verify(initialCertificate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCertificate])

  const verified = result?.verified === true
  const resolvedCertificateId = text(result?.certificate_id || result?.certificate_ref || certificateId)
  const pdfUrl = resolvedCertificateId && API_BASE ? `${API_BASE}/public/certificates/pdf/${encodeURIComponent(resolvedCertificateId)}` : ''
  const technologies = Array.isArray(result?.technologies) ? result.technologies : Array.isArray(result?.completed_technologies) ? result.completed_technologies : []
  const units = Array.isArray(result?.units) ? result.units : []
  const publicVerificationUrl = `${PUBLIC_VERIFY_BASE}?cert=${encodeURIComponent(resolvedCertificateId)}`

  return (
    <div className="verify-page">
      <section className="verify-hero"><div className="shell verify-shell"><div className="verify-eyebrow"><ShieldCheck size={16} /> Official Credential Verification</div><h1>Verify a Pixiu Tech Certificate</h1><p>Enter the certificate ID exactly as printed on the credential. The result is read from the Pixiu Tech certificate registry rather than from static browser data.</p></div></section>
      <section className="verify-content"><div className="shell verify-shell">
        <form className="verify-search-card" onSubmit={event => { event.preventDefault(); verify(certificateId) }}><div className="verify-search-input"><Search size={18} aria-hidden="true" /><input value={certificateId} onChange={event => setCertificateId(event.target.value)} placeholder="e.g. PX-XYZ-XYZ6A 01-2026-54D0DD" aria-label="Certificate ID" spellCheck="false" /></div><button className="btn btn--primary verify-search-btn" type="submit" disabled={loading}>{loading ? 'Checking Registry…' : 'Verify Certificate'}</button></form>
        {error && <div className="verify-alert verify-alert--error" role="alert"><XCircle size={20} /><div><strong>Certificate not verified</strong><span>{error}</span></div></div>}
        {result && <div className="verify-result">
          <div className={`verify-status ${verified ? 'verify-status--verified' : 'verify-status--warning'}`}><div className="verify-status-icon">{verified ? <CheckCircle2 size={30} /> : <XCircle size={30} />}</div><div><span className="verify-status-kicker">{verified ? 'Credential verified' : 'Record returned'}</span><h2>{verified ? 'Official Pixiu Tech Certificate' : 'Certificate is not currently verified'}</h2><p>{verified ? 'The certificate ID matches an issued credential in the Pixiu Tech verification registry.' : text(result.reason) || 'The registry returned a record, but the credential did not satisfy verification requirements.'}</p></div></div>
          <div className="verify-grid">
            <article className="verify-card"><span className="verify-card-label">Student</span><h3>{text(result.student_name) || '—'}</h3><div className="verify-card-meta"><span>Student ID</span><strong>{text(result.student_id) || '—'}</strong></div><div className="verify-card-meta"><span>School</span><strong>{text(result.school_name) || '—'}</strong></div><div className="verify-card-meta"><span>Class</span><strong>{text(result.class_name) || '—'}</strong></div></article>
            <article className="verify-card"><span className="verify-card-label">Certificate</span><h3 className="verify-mono">{resolvedCertificateId || '—'}</h3><div className="verify-stat-row"><div><span>Overall score</span><strong>{formatScore(result.overall_score)}</strong></div><div><span>Issued</span><strong>{formatDate(result.issued_at)}</strong></div></div><div className="verify-card-meta"><span>Programme</span><strong>{text(result.programme_name) || 'Pixiu Technology Programme'}</strong></div></article>
          </div>
          <div className="verify-card verify-card--wide"><div className="verify-wide-head"><div><span className="verify-card-label">Completion record</span><h3>Programme evidence</h3></div>{verified && pdfUrl && <a className="btn btn--primary verify-download" href={pdfUrl} target="_blank" rel="noreferrer"><Download size={16} /> View Certificate PDF</a>}</div><div className="verify-evidence-grid"><div><span>Technologies completed</span><strong>{technologies.length ? technologies.map(item => text(item?.name || item?.technology || item)).filter(Boolean).join(' · ') : '—'}</strong></div><div><span>Completed units</span><strong>{result.completion_count != null ? `${result.completion_count}${result.required_completion_count != null ? ` / ${result.required_completion_count}` : ''}` : units.length || 'Recorded'}</strong></div><div><span>Attendance</span><strong>{result.attendance_rate != null ? `${result.attendance_rate}%` : '—'}</strong></div><div><span>Issued by</span><strong>{text(result.issued_by || result.trainer_name) || 'Pixiu Tech LLP'}</strong></div></div></div>
          {verified && units.length > 0 && <div className="verify-card verify-card--wide"><div className="verify-wide-head"><div><span className="verify-card-label">Completed Technology Units</span><h3>Unit-wise completion and scores</h3></div><span className="verify-card-label">{units.length} unique units</span></div><div style={{ overflowX: 'auto', marginTop: 18 }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650, fontSize: 12 }}><thead><tr style={{ background: '#F5F8FC' }}>{['Technology', 'Unit', 'Module', 'Sessions', 'Score'].map(heading => <th key={heading} style={{ padding: '12px 14px', textAlign: heading === 'Score' || heading === 'Sessions' ? 'center' : 'left', borderBottom: '1px solid #D9E2EE', color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{heading}</th>)}</tr></thead><tbody>{units.map((unit, index) => <tr key={`${unit.unit_code || 'unit'}-${index}`}><td style={{ padding: '13px 14px', fontWeight: 800, borderBottom: '1px solid #EDF1F6' }}>{text(unit.technology) || '—'}</td><td style={{ padding: '13px 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: '#1768FF', borderBottom: '1px solid #EDF1F6' }}>{text(unit.unit_code) || '—'}</td><td style={{ padding: '13px 14px', borderBottom: '1px solid #EDF1F6' }}>{text(unit.title) || '—'}</td><td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: 800, borderBottom: '1px solid #EDF1F6' }}>{unit.sessions ?? '—'}</td><td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: 900, color: '#071A33', borderBottom: '1px solid #EDF1F6' }}>{formatScore(unit.score)}</td></tr>)}</tbody></table></div><p style={{ margin: '14px 0 0', color: '#94A3B8', fontSize: 10 }}>Unit scores are sourced from published LMS practical assessments; the overall programme score is the official weighted result.</p></div>}
          <div className="verify-trust"><div><span>Verification URL</span><strong>{publicVerificationUrl}</strong></div><a href="/" className="verify-home-link">Return to Pixiu Tech <ExternalLink size={14} /></a></div>
        </div>}
        {!result && !loading && !error && <div className="verify-empty"><ShieldCheck size={28} /><h2>Ready to verify</h2><p>Use the certificate ID printed on the PDF or open this page from its verification link.</p></div>}
      </div></section>
    </div>
  )
}
