import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import CountUp from '../components/CountUp.jsx'
import { STATS, SOLUTIONS, PROCESS, WHY } from '../data/site.js'

export default function Home() {
  return (
    <>
      {/* ============================= HERO ============================= */}
      <section className="hero-v2">
        <div className="hero-v2__bg">
          <img src="/img/hero_lab.jpg" alt="Modern school STEM innovation lab" />
          <div className="hero-v2__overlay" />
        </div>
        <div className="shell hero-v2__content">
          <Reveal>
            <p className="hero-v2__tag">STEM · Robotics · AI · IoT · Drones</p>
            <h1 className="hero-v2__title">
              Empowering Schools with<br />
              <span className="hero-v2__accent">Future-Ready Innovation Labs</span>
            </h1>
            <p className="hero-v2__sub">
              End-to-end lab setup, hands-on curriculum, trained instructors, and ongoing support — everything your school needs to teach STEM, Robotics, and AI.
            </p>
            <div className="hero-v2__cta">
              <Link className="btn btn--primary btn--lg" to="/contact">
                Book a Free Demo <span className="arw">→</span>
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
                <span className="stat__icon">{s.icon}</span>
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
            <p className="eyebrow">Comprehensive Tech Domains</p>
            <h2 className="h-sect">One Managed Ecosystem. Six Innovation Domains.</h2>
            <p className="lede">
              From robotics and AI to drones and 3D printing — we cover every domain your school needs to deliver future-ready education.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="solutions-grid">
              {SOLUTIONS.map((s) => (
                <Link to={`/solutions#${s.id}`} className="sol-card" key={s.id}>
                  <div className="sol-card__img">
                    <img src={s.img} alt={s.title} loading="lazy" />
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

      {/* ====================== WORKSHOP IMAGE ======================== */}
      <section className="band band--no-pad-top">
        <div className="shell">
          <Reveal>
            <div className="wide-img">
              <img src="/img/workshop_action.jpg" alt="Students in an energetic STEM robotics workshop" loading="lazy" />
              <p className="wide-img__caption">Live workshops — where students build, fail, fix, and celebrate</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================== HOW IT WORKS ========================= */}
      <section className="band band--gray">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">How It Works</p>
            <h2 className="h-sect">Deploying Your Innovation Hub in 4 Seamless Steps</h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="process-grid">
              {PROCESS.map((p, i) => (
                <div className="process-step" key={p.no}>
                  <div className="process-step__no">{p.icon}</div>
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
              <img src="/img/teacher_training.jpg" alt="Teacher training workshop" loading="lazy" />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div>
              <p className="eyebrow">Teacher Training</p>
              <h2 className="h-sect">Empowering Your Teaching Faculty</h2>
              <p className="lede">
                Our instructors don't just teach students — they upskill your existing faculty. By the end of the year, your teachers can independently run STEM sessions.
              </p>
              <ul className="check-list">
                <li>Hands-on Arduino & electronics training</li>
                <li>Curriculum walkthrough & session planning</li>
                <li>Ongoing mentorship & support</li>
              </ul>
              <p style={{ marginTop: 24 }}>
                <Link className="btn btn--outline" to="/contact">
                  Enquire about training <span className="arw">→</span>
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
            <h2 className="h-sect">The Premium Corporate Approach — Engineered for Action, Not Just Exhibition.</h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="why-v2">
              {WHY.map((w) => (
                <div className="why-v2__item" key={w.title}>
                  <span className="why-v2__icon">{w.icon}</span>
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
