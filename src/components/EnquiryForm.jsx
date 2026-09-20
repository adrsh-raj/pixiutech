import { useState } from 'react'

const FIELDS = [
  { id: 'school', label: 'School name', ph: 'e.g. XYZ Academy', wide: true, req: true },
  { id: 'person', label: 'Contact person', ph: 'Full name', req: true, autoComplete: 'name' },
  { id: 'phone', label: 'Phone', ph: '+91', req: true, type: 'tel', autoComplete: 'tel' },
  { id: 'email', label: 'Email', ph: 'name@school.edu.in', req: true, type: 'email', autoComplete: 'email' },
  { id: 'city', label: 'City', ph: 'City', autoComplete: 'address-level2' },
  { id: 'strength', label: 'Student strength', ph: 'Approximate number of students who will use the lab', wide: true },
]

const EMPTY = { school: '', person: '', phone: '', email: '', city: '', strength: '', message: '', website: '' }

export default function EnquiryForm({ intent }) {
  const [values, setValues] = useState({
    ...EMPTY,
    message: intent === 'proposal' ? 'We would like a proposal for our school.\n\n' : '',
  })
  const [errors, setErrors] = useState([])
  const [status, setStatus] = useState(null)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const set = (id) => (e) => setValues((v) => ({ ...v, [id]: e.target.value }))

  async function send() {
    const missing = FIELDS.filter((f) => f.req && !values[f.id].trim())
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())

    if (missing.length) {
      setErrors(missing.map((f) => f.id))
      setStatus({
        kind: 'err',
        text: `Add your ${missing.map((f) => f.label.toLowerCase()).join(', ')} so we can get back to you.`,
      })
      document.getElementById(`f-${missing[0].id}`)?.focus()
      return
    }
    if (!emailOk) {
      setErrors(['email'])
      setStatus({ kind: 'err', text: 'That email address looks incomplete. Check it and send again.' })
      document.getElementById('f-email')?.focus()
      return
    }

    setErrors([])
    setStatus({ kind: '', text: 'Sending your enquiry...' })
    setSending(true)

    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'There was a problem sending your enquiry.')
      }

      setStatus(null)
      setSent(true)
    } catch (error) {
      setStatus({ kind: 'err', text: error.message || 'Network error. Please check your connection and try again.' })
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="form">
        <div className="form__done">
          <h3>Enquiry received</h3>
          <p>
            Thanks, {values.person.split(' ')[0]}. We'll review {values.school} and come back in less than 24 hours with next steps.
          </p>
          <p style={{ marginTop: 18 }}>
            <button
              className="btn btn--outline"
              type="button"
              onClick={() => {
                setValues(EMPTY)
                setErrors([])
                setStatus(null)
                setSent(false)
              }}
            >
              Send another enquiry
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="form" id="demo-form">
      <div className="form__grid">
        {FIELDS.map((f) => (
          <div className={`field ${f.wide ? 'field--wide' : ''}`} key={f.id}>
            <label htmlFor={`f-${f.id}`}>{f.label}</label>
            <input
              id={`f-${f.id}`}
              type={f.type || 'text'}
              placeholder={f.ph}
              value={values[f.id]}
              onChange={set(f.id)}
              autoComplete={f.autoComplete}
              required={Boolean(f.req)}
              aria-invalid={errors.includes(f.id)}
              className={errors.includes(f.id) ? 'bad' : ''}
            />
          </div>
        ))}
        <div className="field field--wide" aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          <label htmlFor="f-website">Website</label>
          <input id="f-website" value={values.website} onChange={set('website')} tabIndex={-1} autoComplete="off" />
        </div>
        <div className="field field--wide">
          <label htmlFor="f-message">Message</label>
          <textarea
            id="f-message"
            placeholder="Your space, the grades you want to cover, and anything already in place."
            value={values.message}
            onChange={set('message')}
          />
        </div>
      </div>

      <div className="form__foot">
        <button className="btn btn--primary" type="button" onClick={send} disabled={sending} aria-busy={sending}>
          {sending ? 'Sending…' : 'Send enquiry'} <span className="arw">→</span>
        </button>
        <span className="form__note">We reply in less than 24 hours.</span>
      </div>

      {status && (
        <p id="enquiry-form-status" className={`form__status ${status.kind}`} role="status" aria-live="polite">
          {status.text}
        </p>
      )}
    </div>
  )
}
