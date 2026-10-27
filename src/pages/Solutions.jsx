import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import { SOLUTIONS } from '../data/site.js'
import '../styles/solutions.css'

function SolutionsOrbit() {
  return (
    <div className="solutions-orbit" aria-label="Six technology domains around a complete school lab">
      <div className="solutions-orbit__glow" />
      <svg className="solutions-orbit__lines" viewBox="0 0 620 480" fill="none" aria-hidden="true">
        <ellipse cx="310" cy="240" rx="265" ry="126" />
        <ellipse cx="310" cy="240" rx="196" ry="208" transform="rotate(38 310 240)" />
        <ellipse cx="310" cy="240" rx="196" ry="208" transform="rotate(-38 310 240)" />
        <path d="M74 172 228 214m-154 94 154-44m318-92-154 42m154 94-154-44M195 57l78 132m152-132-78 132M195 423l78-132m152 132-78-132" />
        <circle cx="74" cy="172" r="4" /><circle cx="74" cy="308" r="4" />
        <circle cx="546" cy="172" r="4" /><circle cx="546" cy="308" r="4" />
        <circle cx="195" cy="57" r="4" /><circle cx="425" cy="57" r="4" />
        <circle cx="195" cy="423" r="4" /><circle cx="425" cy="423" r="4" />
      </svg>
      <div className="solutions-orbit__core"><img src="/img/logo.png" alt="Pixiu Tech" width="100" height="56" /><small>HANDS-ON LEARNING</small></div>
      {SOLUTIONS.map((solution, index) => (
        <a className={`solutions-orbit__node solutions-orbit__node--${index + 1}`} key={solution.id} href={`#${solution.id}`}>
          <span className="solutions-orbit__node-dot" />{solution.title.replace(' Lab', '').replace(' & Machine Learning', ' & ML').replace('Computational Design & 3D', 'Design & 3D').replace(' Technology', '')}
        </a>
      ))}
      <div className="solutions-orbit__caption"><span /> Designed around your school</div>
    </div>
  )
}

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
      <section className="solutions-hero">
        <div className="solutions-hero__grid" aria-hidden="true" />
        <div className="shell solutions-hero__layout">
          <div className="solutions-hero__copy">
            <p className="solutions-kicker"><span /> PIXIU TECH · SCHOOL SOLUTIONS</p>
            <h1>One learning ecosystem.<br /><span>Six paths to discovery.</span></h1>
            <p className="solutions-hero__intro">We help schools turn STEM curiosity into practical skills, with the labs, curriculum, instructors, and support to make learning happen.</p>
            <div className="solutions-hero__actions">
              <a className="btn btn--primary btn--lg" href="#solution-pathways">Explore the domains <span className="arw">↓</span></a>
              <Link className="btn btn--ghost-light" to="/contact#demo-form">Plan a school lab</Link>
            </div>
            <div className="solutions-hero__meta"><span>01</span> PLAN <i /> <span>02</span> EQUIP <i /> <span>03</span> TEACH <i /> <span>04</span> SUPPORT</div>
          </div>
          <SolutionsOrbit />
        </div>
        <a className="solutions-scroll-cue" href="#solution-pathways"><span /> Explore six domains</a>
      </section>

      <section className="solutions-index" id="solution-pathways" aria-label="Explore technology domains">
        <div className="shell solutions-index__inner">
          <p>EXPLORE BY DOMAIN</p>
          <nav aria-label="Technology domains">
            {SOLUTIONS.map((solution, index) => (
              <a key={solution.id} href={`#${solution.id}`}><span>0{index + 1}</span>{solution.title.replace(' Lab', '').replace(' & Machine Learning', ' & ML').replace('Computational Design & 3D', 'Design & 3D').replace(' Technology', '')}<b aria-hidden="true">↗</b></a>
            ))}
          </nav>
        </div>
      </section>

      {/* ==================== SOLUTION DEEP DIVES ==================== */}
      {SOLUTIONS.map((s, i) => (
        <section className={`band solutions-detail-section ${i % 2 === 0 ? 'band--gray' : ''}`} key={s.id} id={s.id}>
          <div className="shell">
            <Reveal>
              <div className={`sol-detail ${i % 2 !== 0 ? 'sol-detail--reverse' : ''}`}>
                <div className="sol-detail__img">
                  <img src={s.img} alt={s.alt || s.title} loading="lazy" decoding="async" width="900" height="562" />
                  <span className="solutions-image-index">0{i + 1} <i /> 0{SOLUTIONS.length}</span>
                </div>
                <div className="sol-detail__body">
                  <p className="eyebrow"><span className="solutions-detail-number">0{i + 1}</span>{s.id.toUpperCase()}</p>
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
      <section className="band on-dark gridfield solutions-training">
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
          <Reveal delay={120}>
            <p style={{ marginTop: 34 }}>
              <Link className="btn btn--primary btn--lg" to="/contact#demo-form">
                Book a Free Consultation for Your School <span className="arw">→</span>
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      <CTAStrip title="Planning a School Lab?" primary="Book a Free Consultation" />
    </>
  )
}
