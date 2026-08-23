import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import Plate from '../components/Plate.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import { STAGES } from '../data/site.js'

export default function Curriculum() {
  return (
    <>
      <PageHead
        crumb="Curriculum"
        title="Learning That Grows With the Student."
        intro="Five stages, each assuming the one before it. A student who joins in the early years keeps climbing instead of repeating the same introductory project every year."
      />

      {/* ---------------------------- LADDER --------------------------- */}
      <section className="band">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Progression</p>
            <h2 className="h-sect">Foundation to Innovation.</h2>
            <p className="lede">
              The shape matters more than the labels: capability compounds, and the room has to keep up with the
              students in it.
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
        </div>
      </section>

      {/* ------------------------ STAGE DETAIL ------------------------- */}
      <section className="band band--gray">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Stage by stage</p>
            <h2 className="h-sect">What Changes at Each Level.</h2>
          </Reveal>
          <Reveal delay={80}>
            <div style={{ marginTop: 44 }}>
              {STAGES.map((s) => (
                <article className="stage" key={s.lvl}>
                  <div>
                    <p className="stage__k">{s.lvl}</p>
                    <h3>{s.name}</h3>
                  </div>
                  <div>
                    <p>{s.detail}</p>
                    <ul>
                      {s.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* --------------------------- MAPPING --------------------------- */}
      <section className="band">
        <div className="shell split">
          <Reveal>
            <p className="eyebrow">Mapping</p>
            <h2 className="h-sect">Designed Against Your Grades, Not a Catalogue.</h2>
            <p className="lede">
              Curriculum is designed according to student age, grade and school requirements. During planning we map
              the stages onto your actual grade structure, timetable and academic calendar — including how the lab
              programme sits alongside what you already teach.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <Plate
              src="/img/ai_learning.jpg"
              alt="Student learning with AI software"
              caption="Stage progression mapped to modern technology"
            />
          </Reveal>
        </div>
      </section>

      {/* -------------------------- DELIVERY --------------------------- */}
      <section className="band band--gray">
        <div className="shell split">
          <Reveal>
            <Plate
              src="/img/stem_curriculum.jpg"
              alt="Instructor teaching STEM on a digital whiteboard"
              caption="Instructor-led session in the school's own lab"
            />
          </Reveal>
          <Reveal delay={80}>
            <p className="eyebrow">Delivery</p>
            <h2 className="h-sect">Taught in the Room, Not Handed Over as Files.</h2>
            <p className="lede">
              Curriculum only works when someone runs it. Sessions are delivered by Pixiu instructors on a fixed
              timetable, with your teachers onboarded alongside so the school builds its own capability over time.
            </p>
          </Reveal>
        </div>
      </section>

      <CTAStrip title="Want the Curriculum Mapped to Your Grades?" />
    </>
  )
}
