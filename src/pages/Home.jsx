import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import CountUp from '../components/CountUp.jsx'
import {
  STATS,
  SOLUTIONS,
  PROCESS,
  WHY,
  PARTNER_SCHOOL,
  PILLARS,
  CYBERLAB_SPECS,
  PORTAL_SPECS,
} from '../data/site.js'

export default function Home() {
  return (
    <>
      {/* ============================= SECTION 1: HERO ============================= */}
      <section className="hero-v2 gridfield">
        <div className="shell hero-v2__content">
          <div className="hero-v2__grid">
            <Reveal>
              <span className="hero-v2__tag">STEM · Robotics · AI · IoT · Cyberlab</span>
              <h1 className="hero-v2__title">
                Helping Schools Build and Run
                <span className="hero-v2__accent">Working STEM & Technology Labs</span>
              </h1>
              <p className="hero-v2__sub">
                Complete lab setup, zero-install browser circuit simulator, student mission portal, and structured curriculum with trained instructors. From foundational breadboard circuits to autonomous robotics.
              </p>
              <div className="hero-v2__cta">
                <Link className="btn btn--primary btn--lg" to="/contact#demo-form">
                  Book a Free Consultation <span className="arw">→</span>
                </Link>
                <Link className="btn btn--ghost-light" to="/simulation">
                  Launch Virtual Cyberlab
                </Link>
              </div>
              <div className="hero-v2__bullets">
                <span className="hero-v2__bullet">
                  <span className="hero-v2__bullet-icon" aria-hidden="true" /> Turnkey Hardware & Tables
                </span>
                <span className="hero-v2__bullet">
                  <span className="hero-v2__bullet-icon" aria-hidden="true" /> Zero-Install Simulator
                </span>
                <span className="hero-v2__bullet">
                  <span className="hero-v2__bullet-icon" aria-hidden="true" /> Graded Lab Books
                </span>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="hero-passport">
                <div className="hero-passport__header">
                  <span className="hero-passport__status">
                    <span className="pulse-dot" aria-hidden="true" /> LIVE LAB DELIVERY
                  </span>
                  <span className="hero-passport__school">Zenith Public School, Dadha</span>
                </div>
                <div className="hero-passport__media">
                  <img
                    src="/img/zenith/zenith_curriculum_slide.jpg"
                    alt="Class 8 Robotics Lab Book curriculum presentation at Zenith Public School"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                </div>
                <div className="hero-passport__footer">
                  <div className="hero-passport__caption-title">Class 8 Robotics Lab Book</div>
                  <p className="hero-passport__caption-desc">
                    Delivered directly on classroom projector during live weekly lab sessions.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ========================== SECTION 2: STATS BAR ========================== */}
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

      {/* ===================== SECTION 3: THREE PILLARS ===================== */}
      <section className="band band--gray">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Complete STEM Infrastructure</p>
            <h2 className="h-sect">The Three Pillars of Pixiu Tech</h2>
            <p className="lede">
              A working school lab requires hardware, virtual simulation, and academic software working together. We deliver all three as a single unified system.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="pillar-grid">
              {PILLARS.map((p) => (
                <div className="pillar-card" key={p.id}>
                  <div className="pillar-card__top">
                    <span className="pillar-card__no">PILLAR {p.number}</span>
                    <span className="pillar-card__badge">Turnkey Delivery</span>
                  </div>
                  <h3 className="pillar-card__title">{p.title}</h3>
                  <div className="pillar-card__tagline">{p.tagline}</div>
                  <p className="pillar-card__desc">{p.desc}</p>
                  <ul className="pillar-card__list">
                    {p.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                  <div className="pillar-card__action">
                    <Link className="btn btn--outline btn--sm" to={p.to}>
                      {p.actionText} <span className="arw">→</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= SECTION 4: VIRTUAL CYBERLAB DEEP DIVE ================= */}
      <section className="band on-dark gridfield" id="cyberlab-preview">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Zero-Install Electronics Workbench</p>
            <h2 className="h-sect">{CYBERLAB_SPECS.title}</h2>
            <p className="lede">{CYBERLAB_SPECS.desc}</p>
          </Reveal>

          <div className="feature-split">
            <Reveal delay={60}>
              <div>
                <div className="spec-list">
                  {CYBERLAB_SPECS.points.map((spec) => (
                    <div className="spec-item" key={spec.title}>
                      <div className="spec-item__title">{spec.title}</div>
                      <div className="spec-item__detail">{spec.detail}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 28 }}>
                  <Link className="btn btn--primary" to="/simulation">
                    Launch Cyberlab Simulator <span className="arw">→</span>
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="passport-card passport-card--dark">
                <div className="passport-card__header">
                  <span className="passport-badge">{CYBERLAB_SPECS.passportImage.tag}</span>
                  <span className="passport-meta">Zenith Public School</span>
                </div>
                <div className="passport-card__media">
                  <img
                    src={CYBERLAB_SPECS.passportImage.src}
                    alt={CYBERLAB_SPECS.passportImage.alt}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="passport-card__caption">
                  <strong>Physical Computing Workbench</strong>
                  <p>{CYBERLAB_SPECS.passportImage.caption}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= SECTION 5: STUDENT & SCHOOL LMS PORTAL ================= */}
      <section className="band" id="lms-portal-preview">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">{PORTAL_SPECS.badge}</p>
            <h2 className="h-sect">{PORTAL_SPECS.title}</h2>
            <p className="lede">{PORTAL_SPECS.desc}</p>
          </Reveal>

          <Reveal delay={80}>
            <div className="portal-grid">
              <div className="portal-card">
                <div className="portal-card__role">Student Experience</div>
                <h3 className="portal-card__title">Guided Missions & Skill Mastery</h3>
                <div className="portal-card__features">
                  {PORTAL_SPECS.studentFeatures.map((f) => (
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
                <div className="portal-card__role">Educator & Admin Suite</div>
                <h3 className="portal-card__title">School Lab Governance & Analytics</h3>
                <div className="portal-card__features">
                  {PORTAL_SPECS.schoolFeatures.map((f) => (
                    <div className="portal-feature" key={f.title}>
                      <strong>{f.title}</strong>
                      <p>{f.desc}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <Link className="btn btn--primary" to="/portal">
                    Teacher & Admin Login <span className="arw">→</span>
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= SECTION 6: FLAGSHIP PARTNER SCHOOL ================= */}
      <section className="band band--partner" id="partner-school">
        <div className="shell">
          <Reveal>
            <div className="partner-header">
              <div className="partner-header__top">
                <span className="partner-pill">{PARTNER_SCHOOL.role}</span>
                <span className="partner-est">{PARTNER_SCHOOL.established}</span>
              </div>
              <h2 className="h-sect">{PARTNER_SCHOOL.name}</h2>
              <p className="lede">{PARTNER_SCHOOL.description}</p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="partner-passports">
              {PARTNER_SCHOOL.highlights.slice(0, 3).map((h) => (
                <div className="passport-card" key={h.title}>
                  <div className="passport-card__header">
                    <span className="passport-badge">Active Build</span>
                    <span className="passport-meta">Classroom</span>
                  </div>
                  <div className="passport-card__media">
                    <img src={h.img} alt={h.alt} loading="lazy" decoding="async" />
                  </div>
                  <div className="passport-card__caption">
                    <strong>{h.title}</strong>
                    <p>{h.desc}</p>
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

      {/* ================= SECTION 7: TECHNOLOGY DOMAINS ================= */}
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

      {/* ================= SECTION 8: IMPLEMENTATION PROCESS ================= */}
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
            <div className="passport-card">
              <div className="passport-card__header">
                <span className="passport-badge">Faculty Upskilling</span>
                <span className="passport-meta">Mentorship</span>
              </div>
              <div className="passport-card__media">
                <img
                  src="/img/zenith/zenith_teacher_co_teaching.jpg"
                  alt="Teacher training and co-teaching session at Zenith Public School"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="passport-card__caption">
                <strong>Co-Teaching and Capability Transfer</strong>
                <p>Pixiu Tech instructors lead weekly sessions while school faculty observe, assist, and gain confidence.</p>
              </div>
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
