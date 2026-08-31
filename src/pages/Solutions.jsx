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
        title="End-to-End Innovation Lab Solutions"
        intro="Six technology domains, one complete ecosystem. We handle lab setup, hardware, curriculum, instructor deployment, and ongoing support."
      />

      {/* ==================== SOLUTION DEEP DIVES ==================== */}
      {SOLUTIONS.map((s, i) => (
        <section className={`band ${i % 2 === 0 ? 'band--gray' : ''}`} key={s.id} id={s.id}>
          <div className="shell">
            <Reveal>
              <div className={`sol-detail ${i % 2 !== 0 ? 'sol-detail--reverse' : ''}`}>
                <div className="sol-detail__img">
                  <img src={s.img} alt={s.title} loading="lazy" />
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
                <img src="/img/teacher_training.jpg" alt="Teacher training workshop" loading="lazy" />
              </div>
              <div className="sol-detail__body">
                <p className="eyebrow">TEACHER TRAINING</p>
                <h2 className="h-sect">Instructor Upskilling Programme</h2>
                <p className="lede">
                  We don't just teach students — we train your teachers to become confident STEM facilitators. By the end of the academic year, your staff can independently deliver sessions, manage the lab, and mentor student projects.
                </p>
                <ul className="check-list check-list--light">
                  <li>Hands-on Arduino & electronics workshops</li>
                  <li>Curriculum delivery training</li>
                  <li>Assessment & grading frameworks</li>
                  <li>Ongoing mentorship from Pixiu team</li>
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ==================== END-TO-END OVERVIEW ===================== */}
      <section className="band">
        <div className="shell" style={{ textAlign: 'center' }}>
          <Reveal>
            <p className="eyebrow">Complete Lab Transformation</p>
            <h2 className="h-sect">From Empty Room to Working Innovation Lab</h2>
            <p className="lede" style={{ maxWidth: '64ch', margin: '0 auto' }}>
              You don't need to source hardware, hire instructors, or design a curriculum separately. 
              Pixiu Tech handles the entire lifecycle — planning, setup, delivery, and long-term support — 
              under a single partnership.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className="wide-img" style={{ marginTop: 40 }}>
              <img src="/img/hero_lab.jpg" alt="Complete innovation lab setup" loading="lazy" />
              <p className="wide-img__caption">A fully operational Pixiu Tech innovation lab — designed for real teaching</p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p style={{ marginTop: 34 }}>
              <Link className="btn btn--primary btn--lg" to="/contact#demo-form">
                Book a Free Demo for Your School <span className="arw">→</span>
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      <CTAStrip title="Ready to Transform Your School?" primary="Book a Free Demo" />
    </>
  )
}
