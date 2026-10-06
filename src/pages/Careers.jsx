import { useEffect, useMemo, useState } from 'react'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'

const API_BASE = (import.meta.env.VITE_API_URL || 'https://pixiu-django-api.onrender.com/api/v1').replace(/\/+$/, '')
const MAX_CV_BYTES = 2 * 1024 * 1024
const EMPTY = { name: '', email: '', phone: '', opening: '', cover_message: '', cv: null, website: '' }

export default function Careers() {
  const [openings, setOpenings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [values, setValues] = useState(EMPTY)
  const [selectedOpening, setSelectedOpening] = useState('')
  const [status, setStatus] = useState(null)
  const [submittedName, setSubmittedName] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let active = true
    fetch(API_BASE + '/public/careers/openings', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('Unable to load current openings.')
        return response.json()
      })
      .then(data => { if (active) setOpenings(Array.isArray(data) ? data : []) })
      .catch(error => { if (active) setLoadError(error.message || 'Unable to load current openings.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const selectedRole = useMemo(
    () => openings.find(item => String(item.id) === String(selectedOpening)),
    [openings, selectedOpening],
  )

  const set = key => event => setValues(previous => ({ ...previous, [key]: event.target.value }))

  const startApplication = openingId => {
    setSelectedOpening(openingId || '')
    setValues(previous => ({ ...previous, opening: openingId || '' }))
    window.setTimeout(() => document.getElementById('career-application')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40)
  }

  const handleCv = event => {
    const file = event.target.files?.[0] || null
    if (!file) {
      setValues(previous => ({ ...previous, cv: null }))
      return
    }
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
      const response = await fetch(API_BASE + '/public/careers/apply', {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const raw = payload.cv?.[0] || payload.detail || payload.error || 'Application could not be submitted.'
        const message = String(raw)
        if (/clamav|malware scan|security scan|scanner/i.test(message)) throw new Error('Application could not be submitted. Please try again shortly.')
        throw new Error(message)
      }
      setSubmittedName(values.name.trim())
      setStatus({ kind: 'success', text: 'Your application has been submitted successfully.' })
      setValues(EMPTY)
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
        title="Build things that have to work in a school."
        intro="We like people who can move between ideas and implementation: building, teaching, debugging, explaining and improving."
        aside={<div><span className="mono-label">WHAT MATTERS</span><strong>Curiosity.<br />Practicality.<br />Ownership.</strong></div>}
      />

      <section className="careers-section">
        <div className="shell">
          <Reveal><span className="section-kicker">Open positions</span><h2>Current opportunities.</h2><p className="quiet-note">Openings are pulled from the Pixiu recruitment service so the page stays current.</p></Reveal>

          {loading && <p className="quiet-note">Loading current openings…</p>}
          {loadError && <div className="inline-error" role="alert">{loadError}</div>}
          {!loading && !loadError && openings.length === 0 && (
            <div className="empty-careers">
              <strong>No published positions right now.</strong>
              <p>We are still open to thoughtful general applications from people who want to help build practical school technology programmes.</p>
              <button className="button button--outline" type="button" onClick={() => startApplication('')}>Send a general application ↗</button>
            </div>
          )}

          {!loading && !loadError && openings.length > 0 && (
            <Reveal delay={80}>
              <div className="careers-list">
                {openings.map(opening => (
                  <article className="career-card" key={opening.id}>
                    <div className="career-card__body">
                      <span className="mono-label">{opening.employment_type || 'Opening'}</span>
                      <h3>{opening.title}</h3>
                      <div className="career-card__meta">
                        {opening.location && <span>{opening.location}</span>}
                        {opening.location && opening.employment_type && <span>·</span>}
                        {opening.employment_type && <span>{opening.employment_type}</span>}
                      </div>
                      <p>{opening.description}</p>
                      {opening.requirements && <details><summary>Read what you will work on</summary><p>{opening.requirements}</p></details>}
                    </div>
                    <button className="button button--outline" type="button" onClick={() => startApplication(String(opening.id))}>Apply ↗</button>
                  </article>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <section className="career-form-section" id="career-application">
        <div className="shell career-form-layout">
          <Reveal>
            <span className="section-kicker">Application</span>
            <h2>Send your work into the system.</h2>
            <p>Upload a PDF CV up to 2 MB and tell us briefly what you want to contribute. We review applications against the kind of practical work Pixiu actually does.</p>
          </Reveal>

          <Reveal delay={90}>
            {status?.kind === 'success' ? (
              <div className="form-success" role="status" aria-live="polite">
                <span>✓ RECEIVED</span>
                <h3>Thank you, {submittedName}.</h3>
                <p>{status.text} We will review your application and contact you using the details provided.</p>
                <button className="button button--outline" type="button" onClick={() => { setStatus(null); setSubmittedName('') }}>Submit another application ↗</button>
              </div>
            ) : (
              <form className="career-form" onSubmit={send}>
                {selectedRole && <div className="career-selected"><span className="mono-label">APPLYING FOR</span><strong>{selectedRole.title}</strong></div>}
                {!selectedRole && openings.length > 0 && (
                  <div className="field field--wide">
                    <label htmlFor="career-opening">Position</label>
                    <select id="career-opening" value={values.opening} onChange={event => { setSelectedOpening(event.target.value); setValues(previous => ({ ...previous, opening: event.target.value })) }}>
                      <option value="">General application</option>
                      {openings.map(opening => <option key={opening.id} value={opening.id}>{opening.title}</option>)}
                    </select>
                  </div>
                )}

                <div className="form-grid">
                  <div className="field"><label htmlFor="career-name">Full name</label><input id="career-name" value={values.name} onChange={set('name')} placeholder="Your name" autoComplete="name" required /></div>
                  <div className="field"><label htmlFor="career-email">Email</label><input id="career-email" type="email" value={values.email} onChange={set('email')} placeholder="you@email.com" autoComplete="email" required /></div>
                  <div className="field"><label htmlFor="career-phone">Phone</label><input id="career-phone" type="tel" inputMode="numeric" maxLength={10} value={values.phone} onChange={event => setValues(previous => ({ ...previous, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit mobile" autoComplete="tel" required /></div>
                  <div className="field"><label htmlFor="career-cv">CV / Resume</label><input id="career-cv" type="file" accept="application/pdf,.pdf" onChange={handleCv} required /><small>PDF only · maximum 2 MB</small></div>
                  <div className="field field--wide"><label htmlFor="career-message">Message</label><textarea id="career-message" value={values.cover_message} onChange={set('cover_message')} placeholder="What are you good at, and what would you like to build?" /></div>
                </div>

                <div className="honeypot" aria-hidden="true"><label htmlFor="career-website">Website</label><input id="career-website" value={values.website} onChange={set('website')} tabIndex={-1} autoComplete="off" /></div>

                <div className="form-actions"><button className="button button--accent" type="submit" disabled={sending}>{sending ? 'Submitting…' : 'Submit application'} <span>↗</span></button><span className="form__note">Secure recruitment submission.</span></div>
                {status && status.kind === 'error' && <p className="form__status err" role="alert">{status.text}</p>}
              </form>
            )}
          </Reveal>
        </div>
      </section>
    </>
  )
}
