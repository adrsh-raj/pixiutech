import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import CountUp from '../components/CountUp.jsx'
import {
  STATS,
  SOLUTIONS,
  PROCESS,
  WHY,
  REAL_LAB_SHOWCASE,
  PORTAL_SHOWCASE,
} from '../data/site.js'

export default function Home() {
  return (
    <>
      {/* ============================= HERO ============================= */}
      <section className="hero-v2">
        <div className="hero-v2__bg">
          <img
            src="/img/hero_lab.jpg"
            alt="Pixiu Tech classroom session on AI and machine learning"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width="1440"
            height="804"
          />
          <div className="hero-v2__overlay" />
        </div>
        <div className="shell hero-v2__content">
          <Reveal>
            <p className="hero-v2__tag">STEM · Robotics · AI · IoT · Drones</p>
            <h1 className="hero-v2__title">
              Turnkey Robotics, AI & IoT Labs<br />
              <span className="hero-v2__accent">Engineered for Modern Schools</span>
            </h1>
            <p className="hero-v2__sub">
              Complete innovation lab setup, plug-and-play hardware kits, graded NEP 2020 curriculum, resident expert instructors, and browser-based virtual circuit simulation.
            </p>
            <div className="hero-v2__cta">
              <Link className="btn btn--primary btn--lg" to="/contact#demo-form">
                Book a Free Consultation <span className="arw">→</span>
              </Link>
              <Link className="btn btn--ghost-light" to="/solutions">
                Explore Lab Solutions
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
                    <img src={s.img} alt={s.alt || s.title} loading="lazy" decoding="async" width="900" height="562" />
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

      {/* ================= SECTION: DEDICATED LMS & VIRTUAL LAB ================= */}
      <section className="band band--gray" id="school-portal">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">{PORTAL_SHOWCASE.badge}</p>
            <h2 className="h-sect">{PORTAL_SHOWCASE.title}</h2>
            <p className="lede">{PORTAL_SHOWCASE.desc}</p>
          </Reveal>

          <Reveal delay={80}>
            <div className="portal-showcase-grid">
              <div className="portal-card">
                <div className="portal-card__role">Student Mission Hub</div>
                <h3 className="portal-card__title">Guided Missions & Virtual Circuit Simulator</h3>
                <div className="portal-card__features">
                  {PORTAL_SHOWCASE.studentFeatures.map((f) => (
                    <div className="portal-feature" key={f.title}>
                      <strong>{f.title}</strong>
                      <p>{f.desc}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <Link className="btn btn--outline" to="/portal">
                    Access Student Portal <span className="arw">→</span>
                  </Link>
                </div>
              </div>

              <div className="portal-card">
                <div className="portal-card__role">School Management</div>
                <h3 className="portal-card__title">Teacher Dashboards & Academic Analytics</h3>
                <div className="portal-card__features">
                  {PORTAL_SHOWCASE.schoolFeatures.map((f) => (
                    <div className="portal-feature" key={f.title}>
                      <strong>{f.title}</strong>
                      <p>{f.desc}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <Link className="btn btn--primary" to="/portal">
                    School Management Suite <span className="arw">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= SECTION: REAL LAB SHOWCASE (2 REAL IMAGES) ================= */}
      <section className="band" id="real-lab">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">{REAL_LAB_SHOWCASE.badge}</p>
            <h2 className="h-sect">{REAL_LAB_SHOWCASE.title}</h2>
            <p className="lede">{REAL_LAB_SHOWCASE.desc}</p>
          </Reveal>

          <Reveal delay={80}>
            <div className="real-lab-grid">
              {REAL_LAB_SHOWCASE.items.map((item) => (
                <div className="real-lab-card" key={item.title}>
                  <div className="real-lab-card__header">
                    <span className="real-lab-card__badge">{item.badge}</span>
                    <span className="real-lab-card__meta">{item.meta}</span>
                  </div>
                  <div className="real-lab-card__img">
                    <img src={item.img} alt={item.alt} loading="lazy" decoding="async" width="900" height="675" />
                  </div>
                  <div className="real-lab-card__body">
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="real-lab-proof">
              <div className="real-lab-proof__quote">
                <blockquote>
                  "{REAL_LAB_SHOWCASE.quote.text}"
                </blockquote>
                <cite>{REAL_LAB_SHOWCASE.quote.cite}</cite>
              </div>
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
              <img src="/img/teacher_training.jpg" alt="Teacher training workshop" loading="lazy" decoding="async" width="900" height="600" />
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
                <Link className="btn btn--outline" to="/solutions">
                  Explore Training Curriculum <span className="arw">→</span>
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
