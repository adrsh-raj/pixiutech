import { useState } from 'react'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import { CAREERS } from '../data/site.js'

export default function Careers() {
  const [values, setValues] = useState({ name: '', email: '', role: '', message: '' })
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState(null)

  const set = (id) => (e) => setValues((v) => ({ ...v, [id]: e.target.value }))

  async function send(e) {
    e.preventDefault()
    if (!values.name.trim() || !values.email.trim()) {
      setStatus({ kind: 'err', text: 'Please fill in your name and email.' })
      return
    }
    setStatus({ kind: '', text: 'Sending...' })
    try {
      const res = await fetch('https://formspree.io/f/xzepqjep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "Type": "Career Application",
          "Name": values.name,
          "Email": values.email,
          "Role": values.role || 'General Application',
          "Message": values.message,
        }),
      })
      if (res.ok) { setStatus(null); setSent(true) }
      else setStatus({ kind: 'err', text: 'Something went wrong. Please try again.' })
    } catch { setStatus({ kind: 'err', text: 'Network error. Check your connection.' }) }
  }

  return (
    <>
      <PageHead
        crumb="Careers"
        title="Build the Future With Us"
        intro="We're on a mission to bring practical, hands-on STEM education to every school. If you're passionate about robotics, AI, and teaching — we'd love to hear from you."
      />

      {/* ========================= CULTURE ============================= */}
      <section className="band band--gray">
        <div className="shell">
          <Reveal>
            <div className="culture-grid">
              <div className="culture-card">
                <span className="culture-card__icon">🚀</span>
                <h3>Impact-Driven</h3>
                <p>Your work directly shapes how students experience technology. Every session you build or deliver changes minds.</p>
              </div>
              <div className="culture-card">
                <span className="culture-card__icon">🔧</span>
                <h3>Hands-On Culture</h3>
                <p>We build things. From curriculum to circuits to classroom experiences — everyone gets their hands dirty.</p>
              </div>
              <div className="culture-card">
                <span className="culture-card__icon">🌱</span>
                <h3>Grow With Us</h3>
                <p>We're a young, fast-moving team. You'll wear multiple hats, learn fast, and have real ownership from Day 1.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ====================== OPEN POSITIONS ======================== */}
      <section className="band">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Open Positions</p>
            <h2 className="h-sect">Current Openings</h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="careers-list">
              {CAREERS.map((c) => (
                <article className="career-card" key={c.title}>
                  <div className="career-card__body">
                    <h3>{c.title}</h3>
                    <div className="career-card__meta">
                      <span>📍 {c.location}</span>
                      <span>⏰ {c.type}</span>
                    </div>
                    <p>{c.desc}</p>
                  </div>
                  <a href="#apply" className="btn btn--outline">Apply Now</a>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== APPLICATION FORM ======================= */}
      <section className="band band--gray" id="apply">
        <div className="shell" style={{ maxWidth: 640 }}>
          <Reveal>
            <p className="eyebrow">Apply</p>
            <h2 className="h-sect">Send Us Your Application</h2>
            <p className="lede">Tell us about yourself. We'll get back within a week.</p>
          </Reveal>
          <Reveal delay={80}>
            {sent ? (
              <div className="form__done" style={{ marginTop: 24 }}>
                <h3>Application Received! 🎉</h3>
                <p>Thanks, {values.name.split(' ')[0]}. We'll review your profile and reach out soon.</p>
              </div>
            ) : (
              <form className="form" style={{ marginTop: 24 }} onSubmit={send}>
                <div className="form__grid">
                  <div className="field">
                    <label htmlFor="c-name">Full Name</label>
                    <input id="c-name" type="text" placeholder="Your name" value={values.name} onChange={set('name')} required />
                  </div>
                  <div className="field">
                    <label htmlFor="c-email">Email</label>
                    <input id="c-email" type="email" placeholder="you@email.com" value={values.email} onChange={set('email')} required />
                  </div>
                  <div className="field field--wide">
                    <label htmlFor="c-role">Position you're applying for</label>
                    <input id="c-role" type="text" placeholder="e.g. STEM Instructor" value={values.role} onChange={set('role')} />
                  </div>
                  <div className="field field--wide">
                    <label htmlFor="c-msg">Tell us about yourself</label>
                    <textarea id="c-msg" placeholder="Your background, experience, and why you want to join Pixiu Tech..." value={values.message} onChange={set('message')} />
                  </div>
                </div>
                <div className="form__foot">
                  <button className="btn btn--primary" type="submit">
                    Submit Application <span className="arw">→</span>
                  </button>
                </div>
                {status && (
                  <p className={`form__status ${status.kind}`} role="status">{status.text}</p>
                )}
              </form>
            )}
          </Reveal>
        </div>
      </section>
    </>
  )
}
