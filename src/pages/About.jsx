import { Link } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import { COMPANY, PRINCIPLES } from '../data/site.js'

export default function About() {
  return (
    <>
      <PageHead crumb={COMPANY.kicker} title={COMPANY.title} intro={COMPANY.intro} aside={<div><span className="mono-label">OUR WORK SITS BETWEEN</span><strong>Curriculum<br />Hardware<br />People<br />Software</strong></div>} />
      <section className="about-story">
        <div className="shell about-story__grid">
          <Reveal className="about-story__image"><img src="/img/innovation_lab.webp" alt="Students collaborating in a school innovation lab" loading="lazy" /><span>THE ENVIRONMENT MATTERS</span></Reveal>
          <Reveal delay={100}><span className="section-kicker">Why Pixiu exists</span><h2>{COMPANY.detail}</h2><p>That sounds operational. It is. Good educational technology has to survive real rooms, real teachers, real class periods and real constraints.</p><p>We care about the part after the demo: whether the kit still gets opened next month, whether a teacher knows what the next lesson is, whether a student can understand the failure mode, and whether the school can see what is happening.</p></Reveal>
        </div>
      </section>

      <section className="principles-section">
        <div className="shell">
          <Reveal><span className="section-kicker">Working principles</span><h2>How we decide what belongs in the programme.</h2></Reveal>
          <div className="principles-grid">{PRINCIPLES.map(item => <article key={item.no}><span>{item.no}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
        </div>
      </section>

      <section className="team-model-section">
        <div className="shell">
          <Reveal><span className="section-kicker section-kicker--light">The connected team</span><h2>Different jobs. One student experience.</h2></Reveal>
          <div className="team-model"><div><span>CURRICULUM</span><h3>What should students learn?</h3><p>Sequence, projects, assessment and progression.</p></div><div><span>IMPLEMENTATION</span><h3>What does the school need?</h3><p>Room, equipment, setup, timetable and operating routines.</p></div><div><span>INSTRUCTORS</span><h3>How does the lesson feel?</h3><p>Hands-on coaching, debugging, demonstration and confidence-building.</p></div><div><span>PLATFORM</span><h3>What happens between classes?</h3><p>Missions, simulation, attendance, records and published verification.</p></div></div>
        </div>
      </section>

      <section className="about-loop">
        <div className="shell">
          <Reveal><span className="section-kicker">Our operating loop</span><h2>Design → build → teach → measure → improve.</h2><p>A school programme becomes stronger when the physical and digital evidence comes back into the next planning decision. That feedback loop is why we treat the parts as one system.</p></Reveal>
          <div className="loop-line"><span>DESIGN</span><i /><span>BUILD</span><i /><span>TEACH</span><i /><span>MEASURE</span><i /><span>IMPROVE</span></div>
          <Link className="button button--outline" to="/solutions">See the system in detail <span>↗</span></Link>
        </div>
      </section>
    </>
  )
}
