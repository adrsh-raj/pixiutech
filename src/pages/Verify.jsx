import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2, Copy, Download, ExternalLink, Search, ShieldCheck, XCircle } from 'lucide-react'
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
  const [copied, setCopied] = useState(false)

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
  const units = Array.isArray(result?.units) ? result.units : Array.isArray(result?.marks) ? result.marks : []
  const breakdown = result?.score_breakdown && typeof result.score_breakdown === 'object' ? result.score_breakdown : {}
  const classSize = Number(result?.class_size) || 0
  const rankSlots = Number(result?.rank_slots) || Math.ceil(classSize * 0.25)
  const classRank = Number(result?.class_rank) || 0
  const top25 = result?.is_top25 === true || (classRank > 0 && rankSlots > 0 && classRank <= rankSlots)
  const rankDisplay = text(result?.rank_display) || '—'
  const publicVerificationUrl = `${PUBLIC_VERIFY_BASE}?cert=${encodeURIComponent(resolvedCertificateId)}`

  const copyVerificationLink = async () => {
    try {
      await navigator.clipboard.writeText(publicVerificationUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="verify-page">
      <section className="verify-hero"><div className="shell verify-shell"><div className="verify-eyebrow"><ShieldCheck size={16} /> Official Credential Verification</div><h1>Verify a Pixiu Tech Certificate</h1><p>Enter the certificate ID exactly as printed on the credential. The result is read from the Pixiu Tech certificate registry rather than from static browser data.</p></div></section>
      <section className="verify-content"><div className="shell verify-shell">
        <form className="verify-search-card" onSubmit={event => { event.preventDefault(); verify(certificateId) }}><div className="verify-search-input"><Search size={18} aria-hidden="true" /><input value={certificateId} onChange={event => setCertificateId(event.target.value)} placeholder="e.g. PX-XYZ-XYZ6A 01-2026-54D0DD" aria-label="Certificate ID" spellCheck="false" /></div><button className="btn btn--primary verify-search-btn" type="submit" disabled={loading}>{loading ? 'Checking Registry…' : 'Verify Certificate'}</button></form>
        {error && <div className="verify-alert verify-alert--error" role="alert"><XCircle size={20} /><div><strong>Certificate not verified</strong><span>{error}</span></div></div>}

        {result && <div className="verify-result">
          <div className={`verify-status ${verified ? 'verify-status--verified' : 'verify-status--warning'}`}>
            <div className="verify-status-icon">{verified ? <CheckCircle2 size={30} /> : <XCircle size={30} />}</div>
            <div>
              <span className="verify-status-kicker">{verified ? 'Credential verified' : 'Record returned'}</span>
              <h2>{verified ? 'Official Pixiu Tech Certificate' : 'Certificate is not currently verified'}</h2>
              <p>{verified ? 'The certificate ID matches an issued credential in the Pixiu Tech verification registry.' : text(result.reason) || 'The registry returned a record, but the credential did not satisfy verification requirements.'}</p>
            </div>
          </div>

          <div className="verify-grid">
            <article className="verify-card">
              <span className="verify-card-label">Student</span>
              <h3>{text(result.student_name) || '—'}</h3>
              <div className="verify-card-meta"><span>Student ID</span><strong>{text(result.student_id) || '—'}</strong></div>
              <div className="verify-card-meta"><span>School</span><strong>{text(result.school_name) || '—'}</strong></div>
              <div className="verify-card-meta"><span>Class</span><strong>{text(result.class_name) || '—'}</strong></div>
            </article>

            <article className="verify-card">
              <span className="verify-card-label">Certificate</span>
              <h3 className="verify-mono">{resolvedCertificateId || '—'}</h3>
              <div className="verify-stat-row">
                <div><span>Overall score</span><strong>{formatScore(result.overall_score)}</strong></div>
                <div><span>Issued</span><strong>{formatDate(result.issued_at)}</strong></div>
              </div>
              <div className="verify-card-meta"><span>Programme</span><strong>{text(result.programme_name) || 'Pixiu Technology Programme'}</strong></div>
            </article>
          </div>

          {verified && <section className="verify-card verify-card--wide verify-marks-card">
            <div className="verify-wide-head">
              <div>
                <span className="verify-card-label">Verified marks</span>
                <h3>Academic performance</h3>
              </div>
              <span className="verify-verified-chip"><CheckCircle2 size={14} /> Verified record</span>
            </div>

            <div className="verify-overall-strip">
              <div>
                <span>Official overall score</span>
                <strong>{formatScore(breakdown.overall_score ?? result.overall_score)}</strong>
              </div>
              <div>
                <span>Pass mark</span>
                <strong>{formatScore(breakdown.pass_mark)}</strong>
              </div>
              <div>
                <span>Units completed</span>
                <strong>{result.completion_count != null ? `${result.completion_count}${result.required_completion_count != null ? ` / ${result.required_completion_count}` : ''}` : units.length || 'Recorded'}</strong>
              </div>
            </div>

            <div className="verify-metrics-grid">
              <div className="verify-mark-metric"><span>Attendance</span><strong>{formatScore(breakdown.attendance_pct ?? result.attendance_rate)}</strong></div>
              <div className="verify-mark-metric"><span>Knowledge / Quiz</span><strong>{formatScore(breakdown.quiz_pct)}</strong></div>
              <div className="verify-mark-metric"><span>Practical Evaluation</span><strong>{formatScore(breakdown.practical_pct)}</strong></div>
              <div className="verify-mark-metric"><span>Trainer Review</span><strong>{formatScore(breakdown.trainer_review_pct)}</strong></div>
            </div>

            <div className="verify-tech-row">
              <span>Technologies completed</span>
              <strong>{technologies.length ? technologies.map(item => text(item?.name || item?.technology || item)).filter(Boolean).join(' · ') : '—'}</strong>
            </div>

            {units.length > 0 && <div className="verify-marks-table-wrap">
              <div className="verify-table-title">
                <div>
                  <span className="verify-card-label">Unit-wise marks</span>
                  <strong>Published learning record</strong>
                </div>
                <span>{units.length} units</span>
              </div>
              <div className="verify-table-scroll">
                <table className="verify-marks-table">
                  <thead>
                    <tr>{['Technology', 'Unit', 'Module', 'Sessions', 'Marks'].map(heading => <th key={heading}>{heading}</th>)}</tr>
                  </thead>
                  <tbody>
                    {units.map((unit, index) => (
                      <tr key={`${unit.unit_code || 'unit'}-${index}`}>
                        <td>{text(unit.technology) || '—'}</td>
                        <td className="verify-table-code">{text(unit.unit_code) || '—'}</td>
                        <td>{text(unit.title) || '—'}</td>
                        <td className="verify-table-number">{unit.sessions ?? unit.sessions_count ?? '—'}</td>
                        <td className="verify-table-score">{formatScore(unit.marks ?? unit.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="verify-footnote">Marks shown here are the published certificate record. The overall programme result is the official weighted score stored by Pixiu Tech.</p>
            </div>}
          </section>}

          {verified && <section className="verify-card verify-card--wide verify-ranking-card">
            <div className="verify-wide-head">
              <div>
                <span className="verify-card-label">Class ranking · public view</span>
                <h3>{top25 ? 'Ranked within the top 25%' : 'Public ranking band'}</h3>
              </div>
              <span className="verify-ranking-policy">Top 25% only</span>
            </div>

            <div className={`verify-ranking-main ${top25 ? 'verify-ranking-main--active' : ''}`}>
              <div>
                <span>Published class rank</span>
                <strong>{top25 ? rankDisplay : 'Not published'}</strong>
              </div>
              <div>
                <span>Class size</span>
                <strong>{classSize || '—'}</strong>
              </div>
              <div>
                <span>Published positions</span>
                <strong>{rankSlots || '—'}</strong>
              </div>
            </div>

            <div className="verify-ranking-note">
              {top25
                ? 'This certificate is within the published top 25% of its class. Rank is shown only within that public band.'
                : 'For student privacy, the public verification page does not publish ranks outside the top 25% or expose classmates’ names and scores. Full ranking remains inside the authenticated LMS.'}
            </div>
          </section>}

          <div className="verify-trust">
            <div>
              <span>Verification URL</span>
              <strong>{publicVerificationUrl}</strong>
            </div>
            <div className="verify-trust-actions">
              <button className="verify-copy-btn" type="button" onClick={copyVerificationLink} disabled={!resolvedCertificateId}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              {verified && pdfUrl && <a className="btn btn--primary verify-download" href={pdfUrl} target="_blank" rel="noreferrer"><Download size={16} /> View Certificate PDF</a>}
              <a href="/" className="verify-home-link">Return to Pixiu Tech <ExternalLink size={14} /></a>
            </div>
          </div>
        </div>}
        {!result && !loading && !error && <div className="verify-empty"><ShieldCheck size={28} /><h2>Ready to verify</h2><p>Use the certificate ID printed on the PDF or open this page from its verification link.</p></div>}
      </div></section>
    </div>
  )
}
