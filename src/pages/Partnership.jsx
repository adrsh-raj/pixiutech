import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import Plate from '../components/Plate.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import { JOURNEY, WHY } from '../data/site.js'

export default function Partnership() {
  return (
    <>
      <PageHead
        crumb="School partnership"
        title="From an Empty Room to a Working Innovation Lab."
        intro="Pixiu works as a long-term technology and STEM partner. The relationship starts before the room is built and continues long after it opens."
      />

      {/* --------------------------- JOURNEY --------------------------- */}
      <section className="band on-dark gridfield">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">The journey</p>
            <h2 className="h-sect">Seven Steps, One Continuing Relationship.</h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="journey">
              {JOURNEY.map((s) => (
                <article className="stop" key={s.no}>
                  <span className="stop__no">{s.no}</span>
                  <div className="stop__dot" />
                  <h3>{s.name}</h3>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* -------------------------- TRANSFORM -------------------------- */}
      <section className="band">
        <div className="shell split">
          <Reveal>
            <p className="eyebrow">The change</p>
            <h2 className="h-sect">The Same Room, Doing a Different Job.</h2>
            <p className="lede">
              Most schools already have the space. What they lack is the plan for it, the technology inside it, the
              curriculum that runs through it and the people to teach it. That is the gap Pixiu fills.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Plate
              src="/img/school_partnership.jpg"
              alt="Administrator and expert discussing lab plans"
              caption="From planning to execution"
            />
          </Reveal>
        </div>
      </section>

      {/* --------------------------- PHASES ---------------------------- */}
      <section className="band on-dark gridfield">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Phase detail</p>
            <h2 className="h-sect">What Happens, and Who Is Involved.</h2>
          </Reveal>
          <Reveal delay={80}>
            <div style={{ marginTop: 42 }}>
              {JOURNEY.map((s) => (
                <article className="phase" key={s.no}>
                  <p className="phase__k">{s.no}</p>
                  <div>
                    <h3>{s.name}</h3>
                    <p>{s.detail}</p>
                    <p className="phase__who">{s.who}</p>
                  </div>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* -------------------------- WHY PIXIU -------------------------- */}
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

      <CTAStrip title="Start With a Consultation." />
    </>
  )
}
