import { useEffect, useMemo, useState } from 'react'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'

const API_BASE = (import.meta.env.VITE_API_URL || 'https://pixiu-django-api.onrender.com/api/v1').replace(/\/+$/, '')
const MAX_CV_BYTES = 2 * 1024 * 1024

const emptyForm = { name: '', email: '', phone: '', opening: '', cover_message: '', cv: null, website: '' }

export default function Careers() {
  const [openings, setOpenings] = useState([])
  const [loadingOpenings, setLoadingOpenings] = useState(true)
  const [openingsError, setOpeningsError] = useState('')
  const [values, setValues] = useState(emptyForm)
  const [selectedOpening, setSelectedOpening] = useState('')
  const [status, setStatus] = useState(null)
  const [submittedName, setSubmittedName] = useState('')
  const [sending, setSending] = useState(false)

  const loadOpenings = async () => {
    setLoadingOpenings(true)
    try {
      const response = await fetch(`${API_BASE}/public/careers/openings`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      if (!response.ok) throw new Error('Unable to load current openings.')
      const data = await response.json()
      setOpenings(Array.isArray(data) ? data : [])
      setOpeningsError('')
    } catch (error) {
      setOpeningsError(error.message || 'Unable to load current openings.')
    } finally {
      setLoadingOpenings(false)
    }
  }

  useEffect(() => { void loadOpenings() }, [])

  const selectedRole = useMemo(() => openings.find(item => String(item.id) === String(selectedOpening)), [openings, selectedOpening])

  const set = id => event => setValues(previous => ({ ...previous, [id]: event.target.value }))

  const startApplication = openingId => {
    setSelectedOpening(openingId || '')
    setValues(previous => ({ ...previous, opening: openingId || '' }))
    window.setTimeout(() => document.getElementById('career-application')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40)
  }

  const handleCv = event => {
    const file = event.target.files?.[0] || null
    if (!file) { setValues(previous => ({ ...previous, cv: null })); return }
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      event.target.value = ''
      setStatus({ kind: 'error', text: 'CV must be a PDF file.' })
      setValues(previous => ({ ...previous, cv: null }))
      return
    }
    if (file.size > MAX_CV_BYTES) {
      event.target.value = ''
      setStatus({ kind: 'error', text: 'CV must be 2 MB or smaller.' })
      setValues(previous => ({ ...previous, cv: null }))
      return
    }
    setStatus(null)
    setValues(previous => ({ ...previous, cv: file }))
  }

  const send = async event => {
    event.preventDefault()
    setStatus(null)
    const cleanPhone = String(values.phone || '').replace(/\D/g, '')
    if (!values.name.trim() || !values.email.trim() || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setStatus({ kind: 'error', text: 'Enter your name, email, and a valid 10-digit mobile number.' })
      return
    }
    if (!values.cv) {
      setStatus({ kind: 'error', text: 'Please upload your CV as a PDF (max 2 MB).' })
      return
    }
    if (values.website) return

    const data = new FormData()
    if (values.opening) data.append('opening', values.opening)
    data.append('name', values.name.trim())
    data.append('email', values.email.trim().toLowerCase())
    data.append('phone', cleanPhone)
    data.append('cover_message', values.cover_message.trim())
    data.append('website', values.website)
    data.append('cv', values.cv)

    setSending(true)
    try {
      const response = await fetch(`${API_BASE}/public/careers/apply`, { method: 'POST', body: data, headers: { Accept: 'application/json' }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const rawError = payload.cv?.[0] || payload.detail || payload.error || 'Application could not be submitted.'
        const error = String(rawError)
        if (/clamav|malware scan|security scan|scanner/i.test(error)) {
          throw new Error('Application could not be submitted. Please try again shortly.')
        }
        throw new Error(error)
      }
      const applicantName = values.name.trim()
      setSubmittedName(applicantName)
      setStatus({ kind: 'success', text: 'Your application has been submitted successfully.' })
      setValues(emptyForm)
      setSelectedOpening('')
    } catch (error) {
      setStatus({ kind: 'error', text: error.message || 'Application could not be submitted. Please try again.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <PageHead
        crumb="Careers"
        title="Build the Future With Pixiu Tech"
        intro="We hire people who enjoy building, teaching, and solving practical problems across STEM, Robotics, AI, and school technology."
      />

      <section className="band band--gray">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Open Positions</p>
            <h2 className="h-sect">Current Opportunities</h2>
          </Reveal>

          {loadingOpenings && <p className="lede">Loading current openings…</p>}
          {openingsError && <div className="form__status err" role="alert">{openingsError}</div>}
          {!loadingOpenings && !openingsError && openings.length === 0 && (
            <div className="career-card" style={{ marginTop: 24 }}>
              <div className="career-card__body">
                <h3>No published positions right now</h3>
                <p>We are not advertising a specific role at the moment, but you can still send a general application below.</p>
              </div>
              <a className="btn btn--outline" href="#career-application" onClick={() => startApplication('')}>Send a general application</a>
            </div>
          )}

          {!loadingOpenings && !openingsError && openings.length > 0 && (
            <Reveal delay={80}>
              <div className="careers-list">
                {openings.map(opening => (
                  <article className="career-card" key={opening.id}>
                    <div className="career-card__body">
                      <h3>{opening.title}</h3>
                      <div className="career-card__meta">
                        {opening.location && <span>{opening.location}</span>}
                        {opening.location && opening.employment_type && <span aria-hidden="true">·</span>}
                        {opening.employment_type && <span>{opening.employment_type}</span>}
                      </div>
                      <p>{opening.description}</p>
                      {opening.requirements && <div style={{ marginTop: 14 }}><strong style={{ color: 'var(--ink)' }}>What you'll work on</strong><p style={{ whiteSpace: 'pre-line', marginTop: 6 }}>{opening.requirements}</p></div>}
                    </div>
                    <button className="btn btn--outline" type="button" onClick={() => startApplication(String(opening.id))}>Apply for this role</button>
                  </article>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <section className="band" id="career-application">
        <div className="shell" style={{ maxWidth: 760 }}>
          <Reveal>
            <p className="eyebrow">Applications</p>
            <h2 className="h-sect">Send Your Application</h2>
            <p className="lede">Email, phone number, and a PDF CV are required. CV uploads are limited to 2 MB.</p>
          </Reveal>

          <Reveal delay={80}>
            {status?.kind === 'success' ? (
              <div className="form__done" role="status" aria-live="polite" style={{ marginTop: 24 }}>
                <span className="form__status-mark" aria-hidden="true">✓</span>
                <h3>Thank you, {submittedName}.</h3>
                <p>{status.text} Our team will review your application and contact you using the details provided.</p>
                <button
                  className="btn btn--outline"
                  type="button"
                  style={{ marginTop: 18 }}
                  onClick={() => { setStatus(null); setSubmittedName('') }}
                >
                  Submit another application
                </button>
              </div>
            ) : (
            <form className="form" style={{ marginTop: 24 }} onSubmit={send}>
              {selectedRole && <div className="field field--wide"><label htmlFor="career-selected-opening">Applying for</label><input id="career-selected-opening" value={selectedRole.title} readOnly /></div>}
              {!selectedRole && openings.length > 0 && <div className="field field--wide"><label htmlFor="career-opening">Position</label><select id="career-opening" value={values.opening} onChange={event => { setSelectedOpening(event.target.value); setValues(previous => ({ ...previous, opening: event.target.value })) }}><option value="">General application</option>{openings.map(opening => <option key={opening.id} value={opening.id}>{opening.title}</option>)}</select></div>}
              <div className="form__grid">
                <div className="field"><label htmlFor="career-name">Full name</label><input id="career-name" value={values.name} onChange={set('name')} placeholder="Your name" autoComplete="name" required /></div>
                <div className="field"><label htmlFor="career-email">Email</label><input id="career-email" type="email" value={values.email} onChange={set('email')} placeholder="you@email.com" autoComplete="email" required /></div>
                <div className="field"><label htmlFor="career-phone">Phone (10 digits)</label><input id="career-phone" type="tel" inputMode="numeric" maxLength={10} value={values.phone} onChange={event => setValues(previous => ({ ...previous, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="9876543210" autoComplete="tel" required /></div>
                <div className="field"><label htmlFor="career-cv">CV / Resume (PDF)</label><input id="career-cv" type="file" accept="application/pdf,.pdf" onChange={handleCv} required /><span style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>PDF only · maximum 2 MB</span></div>
                <div className="field field--wide"><label htmlFor="career-message">Message</label><textarea id="career-message" value={values.cover_message} onChange={set('cover_message')} placeholder="Tell us briefly about your background and what you would like to contribute." /></div>
              </div>
              <div className="field" aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}><label htmlFor="career-website">Website</label><input id="career-website" value={values.website} onChange={set('website')} tabIndex={-1} autoComplete="off" /></div>
              <div className="form__foot">
                <button className="btn btn--primary" type="submit" disabled={sending}>{sending ? 'Submitting…' : 'Submit Application'} <span className="arw">→</span></button>
                <span className="form__note">Your CV is submitted securely for recruitment review.</span>
              </div>
              {status && <p className={`form__status ${status.kind === 'success' ? '' : 'err'}`} role="status" aria-live="polite">{status.kind === 'success' ? <span aria-hidden="true" className="form__status-mark">✓</span> : null}{status.text}</p>}
            </form>
            )}
          </Reveal>
        </div>
      </section>
    </>
  )
}