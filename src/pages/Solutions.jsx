import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import Plate from '../components/Plate.jsx'
import Cycle from '../components/Cycle.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import { CAPABILITIES, AREAS } from '../data/site.js'

export default function Solutions() {
  return (
    <>
      <PageHead
        crumb="Solutions"
        title="One Partner. One Complete STEM Solution."
        intro="Six parts of the same job. Schools can take the whole ecosystem or start with the part they need most — but the parts are designed to work together."
      />

      {/* ----------------------- CAPABILITY DETAIL --------------------- */}
      <section className="band">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">What we deliver</p>
            <h2 className="h-sect">What Each Part Actually Involves.</h2>
          </Reveal>

          <Reveal delay={80}>
            <div className="caps">
              {CAPABILITIES.map((c) => (
                <article className="cap" key={c.no}>
                  <span className="cap__no">{c.no}</span>
                  <h3>{c.title}</h3>
                  <p>{c.detail}</p>
                  <ul>
                    {c.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------- SETUP ---------------------------- */}
      <section className="band band--gray">
        <div className="shell split">
          <Reveal>
            <p className="eyebrow">Lab design &amp; setup</p>
            <h2 className="h-sect">The Room Is Planned Around the Session.</h2>
            <p className="lede">
              A lab that looks impressive but jams up with thirty students in it fails quietly. We plan zoning,
              circulation, power, storage and sightlines against the way a session actually runs — brief, build, test,
              pack down.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Plate
              src="/img/stem_students.jpg"
              alt="Diverse students working together on a STEM science project in a modern school lab"
              caption="Designed for collaborative, hands-on learning"
            />
          </Reveal>
        </div>
      </section>

      {/* --------------------------- APPROACH -------------------------- */}
      <section className="band on-dark gridfield">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Our approach</p>
            <h2 className="h-sect">A Lab Is Only Valuable When Students Use It.</h2>
            <p className="lede">
              Pixiu doesn't simply install infrastructure. We help schools actually implement STEM education through
              curriculum, instructors, projects and ongoing support.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Cycle />
          </Reveal>
        </div>
      </section>

      {/* ---------------------------- AREAS ---------------------------- */}
      <section className="band band--tight">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Areas of learning</p>
            <h2 className="h-sect">Eight Domains, One Connected Lab.</h2>
            <p className="lede">
              These are not separate courses. A single student project usually crosses three or four of them at once.
            </p>
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

      {/* ------------------------ ROBOTICS / IoT ----------------------- */}
      <section className="band band--gray">
        <div className="shell split">
          <Reveal>
            <Plate
              src="/img/robotics_students.jpg"
              alt="Students building and programming a robot"
              caption="Robotics — hands-on building and control"
            />
          </Reveal>
          <Reveal delay={80}>
            <Plate
              src="/img/iot_circuit.jpg"
              alt="Student working on an electronic circuit"
              caption="Electronics & IoT — sensing, logic and response"
            />
          </Reveal>
        </div>
      </section>

      <CTAStrip title="Want This Mapped to Your School?" primary="Book a consultation" secondary="Request a proposal" />
    </>
  )
}
