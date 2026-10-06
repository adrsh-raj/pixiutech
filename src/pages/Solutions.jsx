import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import { SOLUTIONS } from '../data/site.js'

export default function Solutions() {
  const { hash } = useLocation()

  // Scroll to the section matching the hash
  useEffect(() => {
    if (hash) {
      setTimeout(() => {
        const el = document.querySelector(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [hash])

  return (
    <>
      <PageHead
        crumb="Solutions"
        title="School Lab Setup Across Six Technology Domains"
        intro="We handle lab setup, hardware, curriculum, instructor deployment, and ongoing support across six technology domains."
      />

      {/* ==================== SOLUTION DEEP DIVES ==================== */}
      {SOLUTIONS.map((s, i) => (
        <section className={`band ${i % 2 === 0 ? 'band--gray' : ''}`} key={s.id} id={s.id}>
          <div className="shell">
            <Reveal>
              <div className={`sol-detail ${i % 2 !== 0 ? 'sol-detail--reverse' : ''}`}>
                <div className="sol-detail__img">
                  <img src={s.img} alt={s.alt || s.title} loading="lazy" decoding="async" width="900" height="562" />
                </div>
                <div className="sol-detail__body">
                  <p className="eyebrow">{s.id.toUpperCase()}</p>
                  <h2 className="h-sect">{s.title}</h2>
                  <p className="lede">{s.desc}</p>
                  <ul className="check-list">
                    {s.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p style={{ marginTop: 24 }}>
                    <Link className="btn btn--outline" to={`/contact?intent=proposal#demo-form`}>
                      Discuss this solution <span className="arw">→</span>
                    </Link>
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      ))}

      {/* ==================== TEACHER TRAINING ======================== */}
      <section className="band on-dark gridfield">
        <div className="shell">
          <Reveal>
            <div className="sol-detail">
              <div className="sol-detail__img">
                <img src="/img/zenith/zenith_teacher_co_teaching.jpg" alt="Teacher training and co-teaching session at Zenith Public School" loading="lazy" decoding="async" width="900" height="600" />
              </div>
              <div className="sol-detail__body">
                <p className="eyebrow">TEACHER TRAINING</p>
                <h2 className="h-sect">Instructor Upskilling Programme</h2>
                <p className="lede">
                  We teach students while training your teachers to deliver STEM sessions. Your staff learn the lesson flow, lab routines, and project guidance needed to manage classes and mentor student work.
                </p>
                <ul className="check-list check-list--light">
                  <li>Hands-on Arduino & electronics workshops</li>
                  <li>Curriculum delivery training</li>
                  <li>Assessment & grading frameworks</li>
                  <li>Ongoing mentorship from Pixiu team</li>
                </ul>
                <p style={{ marginTop: 24 }}>
                  <Link className="btn btn--ghost-light" to="/contact?intent=proposal#demo-form">
                    Plan your training <span className="arw">→</span>
                  </Link>
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ==================== END-TO-END OVERVIEW ===================== */}
      <section className="band">
        <div className="shell" style={{ textAlign: 'center' }}>
          <Reveal>
            <p className="eyebrow">Lab Setup and Delivery</p>
            <h2 className="h-sect">From an Empty Room to a Working Lab</h2>
            <p className="lede" style={{ maxWidth: '64ch', margin: '0 auto' }}>
              You don't need to source hardware, hire instructors, or design a curriculum separately. 
              Pixiu Tech handles the full delivery cycle, from planning and setup to teaching and long-term support, 
              under a single partnership.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className="wide-img" style={{ marginTop: 40 }}>
              <img src="/img/zenith/zenith_lab_setup.jpg" alt="A complete innovation and robotics lab setup at Zenith Public School, Dadha" loading="lazy" decoding="async" width="1200" height="800" />
              <p className="wide-img__caption">A working Pixiu Tech robotics and STEM lab at Zenith Public School, Dadha</p>
            </div>
          </Reveal>
        </div>
      </section>

      <CTAStrip title="Planning a School Lab?" primary="Book a Free Consultation" />
    </>
  )
}
