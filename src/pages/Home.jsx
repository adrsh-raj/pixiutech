import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import Plate from '../components/Plate.jsx'
import Cycle from '../components/Cycle.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import { CAPABILITIES, AREAS, STAGES, WHY } from '../data/site.js'

export default function Home() {
  return (
    <>
      {/* ---------------------------- HERO ---------------------------- */}
      <section className="hero">
        <div className="shell hero__in">
          <div>
            <p className="hero__tag">End-to-end STEM &amp; innovation partner for schools</p>
            <h1>
              Build the Future
              <br />
              Inside Your <em>School.</em>
            </h1>
            <p className="hero__sub">
              Pixiu Tech provides end-to-end STEM, Robotics, AI, IoT and Innovation solutions that transform school
              spaces into practical, engaging learning environments.
            </p>
            <div className="hero__cta">
              <Link className="btn btn--primary" to="/contact">
                Book a school consultation <span className="arw">→</span>
              </Link>
              <Link className="btn btn--ghost" to="/solutions">
                Explore our solutions
              </Link>
            </div>
            <div className="hero__meta">
              <span>Lab design</span>
              <span>Curriculum</span>
              <span>Instructors</span>
              <span>Ongoing support</span>
            </div>
          </div>

          <div className="hero__art">
            <Plate
              src="/img/innovation_lab.jpg"
              alt="Modern school innovation lab with 3D printers, robotics kits, and computers"
              caption="Modern innovation lab — configured to the school's space"
            />
          </div>
        </div>
      </section>

      {/* -------------------------- WHAT WE DO ------------------------ */}
      <section className="band">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">What we do</p>
            <h2 className="h-sect">One Partner. One Complete STEM Solution.</h2>
            <p className="lede">
              Schools usually have to assemble a lab from separate vendors — one for equipment, another for content,
              another for people. Pixiu covers the whole ecosystem under a single working relationship.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="caps">
              {CAPABILITIES.map((c) => (
                <article className="cap" key={c.no}>
                  <span className="cap__no">{c.no}</span>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                </article>
              ))}
            </div>
          </Reveal>

          <Reveal delay={140}>
            <p style={{ marginTop: 34 }}>
              <Link className="btn btn--outline" to="/solutions">
                See what each part involves <span className="arw">→</span>
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* --------------------------- APPROACH ------------------------- */}
      <section className="band on-dark gridfield">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Our approach</p>
            <h2 className="h-sect">A Lab Is Only Valuable When Students Use It.</h2>
            <p className="lede">
              Installing infrastructure is the easy part. Pixiu stays through the harder part — getting curriculum
              running, instructors in the room, and students building every week.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Cycle />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------- AREAS --------------------------- */}
      <section className="band band--tight">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Areas of learning</p>
            <h2 className="h-sect">Eight Domains, One Connected Lab.</h2>
          </Reveal>
        </div>
        <div className="shell">
          <Reveal delay={80}>
            <div className="areas">
              {AREAS.map(([name, sub]) => (
                <div className="area" key={name}>
                  <strong>{name}</strong>
                  <span>{sub}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* -------------------------- CURRICULUM ------------------------ */}
      <section className="band band--gray">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Curriculum</p>
            <h2 className="h-sect">Learning That Grows With the Student.</h2>
            <p className="lede">
              Each stage assumes what came before it, so a student who starts young keeps climbing rather than
              repeating.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="ladder">
              {STAGES.map((s) => (
                <article className="rung" key={s.lvl}>
                  <span className="rung__lvl">{s.lvl}</span>
                  <h3>{s.name}</h3>
                  <p>{s.short}</p>
                </article>
              ))}
            </div>
          </Reveal>

          <Reveal delay={140}>
            <p className="lede" style={{ marginTop: 32 }}>
              Curriculum is designed according to student age, grade and the school's own academic requirements —
              mapped in detail during planning, not off the shelf.
            </p>
            <p style={{ marginTop: 26 }}>
              <Link className="btn btn--outline" to="/curriculum">
                See the full progression <span className="arw">→</span>
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------- PARTNERSHIP ------------------------ */}
      <section className="band">
        <div className="shell split split--wide-left">
          <Reveal>
            <p className="eyebrow">School partnership</p>
            <h2 className="h-sect">From an Empty Room to a Working Innovation Lab.</h2>
            <p className="lede">
              Consultation, planning, setup, training, classes, projects and continuous support. Pixiu works as a
              long-term technology and STEM partner — the relationship starts before the room is built and continues
              long after it opens.
            </p>
            <p style={{ marginTop: 28 }}>
              <Link className="btn btn--outline" to="/partnership">
                How a partnership runs <span className="arw">→</span>
              </Link>
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Plate
              src="/img/school_partnership.jpg"
              alt="School administrator and technology expert discussing a blueprint for a modern lab"
              caption="Partnership — from planning to a working innovation lab"
            />
          </Reveal>
        </div>
      </section>

      {/* --------------------------- WHY PIXIU ------------------------ */}
      <section className="band band--gray">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Why Pixiu</p>
            <h2 className="h-sect">Built to Be Used, Not Just Installed.</h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="why">
              {WHY.map(([t, d]) => (
                <div className="why__item" key={t}>
                  <h3>{t}</h3>
                  <p>{d}</p>
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
