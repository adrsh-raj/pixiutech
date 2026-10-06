import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import CountUp from '../components/CountUp.jsx'
import { STATS, SOLUTIONS, PROCESS, WHY, PARTNER_SCHOOL } from '../data/site.js'

export default function Home() {
  return (
    <>
      {/* ============================= HERO ============================= */}
      <section className="hero-v2">
        <div className="hero-v2__bg">
          <img src="/img/hero_lab.jpg" alt="Pixiu Tech classroom session on AI and machine learning" loading="eager" fetchPriority="high" decoding="async" />
          <div className="hero-v2__overlay" />
        </div>
        <div className="shell hero-v2__content">
          <Reveal>
            <p className="hero-v2__tag">STEM · Robotics · AI · IoT · Drones</p>
            <h1 className="hero-v2__title">
              Helping Schools Build and Run<br />
              <span className="hero-v2__accent">Working STEM & Technology Labs</span>
            </h1>
            <p className="hero-v2__sub">
              Lab setup, practical curriculum, trained instructors, and ongoing support. Your school gets the equipment, teaching plan, and delivery team needed to run STEM, Robotics, and AI classes.
            </p>
            <div className="hero-v2__cta">
              <Link className="btn btn--primary btn--lg" to="/contact#demo-form">
                Book a Free Consultation <span className="arw">→</span>
              </Link>
              <Link className="btn btn--ghost-light" to="/solutions">
                Explore Solutions
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================== STATS BAR ========================== */}
      <section className="stats-bar">
        <div className="shell">
          <div className="stats-bar__grid">
            {STATS.map((s) => (
              <div className="stat" key={s.label}>
                <span className="stat__number"><CountUp text={s.number} /></span>
                <span className="stat__label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====================== SOLUTIONS PREVIEW ====================== */}
      <section className="band">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Technology Domains</p>
            <h2 className="h-sect">Six Technology Domains, One Delivery Team</h2>
            <p className="lede">
              Robotics, AI, IoT, drones, computational design, and 3D printing, with the lab setup and teaching support needed to use each domain in school.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="solutions-grid">
              {SOLUTIONS.map((s) => (
                <Link to={`/solutions#${s.id}`} className="sol-card" key={s.id}>
                  <div className="sol-card__img">
                    <img src={s.img} alt={s.alt || s.title} loading="lazy" decoding="async" />
                  </div>
                  <div className="sol-card__body">
                    <h3>{s.title}</h3>
                    <p>{s.short}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Reveal>

          <Reveal delay={140}>
            <p style={{ marginTop: 34, textAlign: 'center' }}>
              <Link className="btn btn--outline" to="/solutions">
                See all solutions in detail <span className="arw">→</span>
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ===================== PARTNER SCHOOL SHOWCASE ===================== */}
      <section className="band band--partner" id="partner-school">
        <div className="shell">
          <Reveal>
            <div className="partner-header">
              <div className="partner-header__top">
                <span className="partner-pill">Flagship Partner School</span>
                <span className="partner-est">Estd. 1999</span>
              </div>
              <h2 className="h-sect">Zenith Public School, Dadha</h2>
              <p className="lede">
                Real-world classroom implementation: complete computer lab setup, graded Class 6 to 10 robotics curriculum, physical prototyping kits, and weekly hands-on instruction delivered by Pixiu Tech specialists.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="partner-grid">
              {PARTNER_SCHOOL.highlights.map((h) => (
                <div className="partner-card" key={h.title}>
                  <div className="partner-card__img">
                    <img src={h.img} alt={h.alt} loading="lazy" decoding="async" />
                  </div>
                  <div className="partner-card__body">
                    <h3 className="partner-card__title">{h.title}</h3>
                    <p className="partner-card__desc">{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="partner-proof">
              <div className="partner-proof__quote">
                <blockquote>
                  "Pixiu Tech provides the complete ecosystem: the curriculum books, the physical component kits, and the specialist instructors who teach our students while our teachers upskill alongside."
                </blockquote>
                <cite>Robotics & STEM Innovation Lab · Zenith Public School, Dadha</cite>
              </div>
              <div className="partner-proof__cta">
                <Link className="btn btn--primary" to="/contact#demo-form">
                  Book a Consultation for Your School <span className="arw">→</span>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ====================== WORKSHOP IMAGE ======================== */}
      <section className="band band--no-pad-top">
        <div className="shell">
          <Reveal>
            <div className="wide-img">
              <img src="/img/zenith/zenith_arduino_hands_on.jpg" alt="Students in hands-on robotics session at Zenith Public School, Dadha" loading="lazy" decoding="async" />
              <p className="wide-img__caption">Live robotics lab session at Zenith Public School, Dadha: hands-on circuit wiring, coding, and testing</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================== HOW IT WORKS ========================= */}
      <section className="band band--gray">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">How It Works</p>
            <h2 className="h-sect">How We Take a Lab from Plan to Weekly Classes</h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="process-grid">
              {PROCESS.map((p, i) => (
                <div className="process-step" key={p.no}>
                  <div className="process-step__no" aria-hidden="true">{p.no}</div>
                  <h3>{p.name}</h3>
                  <p>{p.text}</p>
                  {i < PROCESS.length - 1 && <div className="process-step__arrow">→</div>}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================== TEACHER TRAINING ===================== */}
      <section className="band">
        <div className="shell split">
          <Reveal>
            <div className="split__img">
              <img src="/img/zenith/zenith_teacher_co_teaching.jpg" alt="Teacher training and co-teaching session at Zenith Public School" loading="lazy" decoding="async" />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div>
              <p className="eyebrow">Teacher Training</p>
              <h2 className="h-sect">Train Your Teachers to Run STEM Sessions</h2>
              <p className="lede">
                Our instructors teach students while training your faculty. Over the academic year, teachers learn the tools, lesson flow, and lab routines needed to run STEM sessions independently.
              </p>
              <ul className="check-list">
                <li>Hands-on Arduino & electronics training</li>
                <li>Curriculum walkthrough & session planning</li>
                <li>Ongoing mentorship & support</li>
              </ul>
              <p style={{ marginTop: 24 }}>
                <Link className="btn btn--outline" to="/contact#demo-form">
                  Discuss Teacher Training <span className="arw">→</span>
                </Link>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================== WHY PIXIU ========================== */}
      <section className="band on-dark gridfield">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Why Pixiu Tech</p>
            <h2 className="h-sect">Built for Implementation, Not a One-Time Installation</h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="why-v2">
              {WHY.map((w) => (
                <div className="why-v2__item" key={w.title}>
                  <h3>{w.title}</h3>
                  <p>{w.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <CTAStrip />
    </>
  )
}
