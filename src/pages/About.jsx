import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import Plate from '../components/Plate.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import { AREAS } from '../data/site.js'

export default function About() {
  return (
    <>
      <PageHead
        crumb="About"
        title="Practical Technology Education for Schools."
        intro="Pixiu Tech LLP builds STEM learning ecosystems — infrastructure, curriculum, instructors and innovation combined into one integrated programme."
      />

      {/* ---------------------------- COMPANY --------------------------- */}
      <section className="band on-dark gridfield">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">About Pixiu</p>
          </Reveal>
          <div className="about__grid">
            <Reveal>
              <p className="about__lead">
                Pixiu Tech LLP is building practical technology education for schools by combining infrastructure,
                curriculum, instructors and innovation into one integrated ecosystem.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <div className="mv">
                <p className="mv__k">Mission</p>
                <p>Make technology practical. Make learning hands-on. Make innovation accessible.</p>
              </div>
              <div className="mv">
                <p className="mv__k">Vision</p>
                <p>
                  Every school should have a place where students don't just learn technology — they build with it.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------- BELIEF ---------------------------- */}
      <section className="band">
        <div className="shell split">
          <Reveal>
            <p className="eyebrow">What we believe</p>
            <h2 className="h-sect">A Lab Is a Programme, Not a Purchase.</h2>
            <p className="lede">
              Schools across India have invested in innovation labs that sit locked most of the week. The equipment is
              rarely the problem. What's missing is the sequence of lessons, the person to run them, and someone
              accountable for the room still working next term.
            </p>
            <p className="lede">
              Pixiu is built around that gap. We take responsibility for the whole chain — so the measure of our work
              is what students build, not what was delivered.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Plate
              src="/img/stem_curriculum.jpg"
              alt="Instructor leading a STEM session with students engaged in learning"
              caption="The outcome we're measured on — engaged student learning"
            />
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- SCOPE ---------------------------- */}
      <section className="band band--tight band--gray">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Scope of work</p>
            <h2 className="h-sect">Where We Work.</h2>
            <p className="lede">
              Pixiu partners with schools across STEM, Robotics, Artificial Intelligence, IoT, Coding, Electronics, 3D
              Design and Innovation — from initial lab planning through to term-by-term delivery and support.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className="why" style={{ marginTop: 44 }}>
              {AREAS.map(([name, sub]) => (
                <div className="why__item" key={name}>
                  <h3>{name}</h3>
                  <p>{sub}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <CTAStrip title="Talk to Us About Your School." />
    </>
  )
}
