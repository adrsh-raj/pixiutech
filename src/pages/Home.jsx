import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import { DELIVERY, PLATFORM, PRINCIPLES, PROJECTS, PROOF, STARTING_POINTS, SYSTEM_LAYERS } from '../data/site.js'

export default function Home() {
  return (
    <>
      <section className="hero-new">
        <div className="shell hero-new__grid">
          <div className="hero-new__copy">
            <div className="hero-stamp"><span>STEM</span><span>ROBOTICS</span><span>AI</span><span>IoT</span></div>
            <Reveal>
              <span className="section-kicker section-kicker--light">School innovation, built to run</span>
              <h1>Build the room.<br /><em>Build the programme.</em><br />Keep it alive.</h1>
              <p>Pixiu Tech brings the physical lab, curriculum, instructors and school software together so technology becomes part of the academic year—not a room that gets installed and forgotten.</p>
              <div className="hero-new__actions">
                <Link className="button button--accent" to="/contact#demo-form">Plan a school lab <span>↗</span></Link>
                <Link className="text-link text-link--light" to="/solutions">See what we build <span>→</span></Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={120} className="hero-new__visual">
            <figure className="hero-image-main">
              <img src="/img/zenith/zenith_lab_setup.webp" alt="Completed innovation and robotics lab setup at Zenith Public School, Dadha" width="1200" height="800" fetchPriority="high" />
              <figcaption><span>FIELD NOTE 01</span><span>REAL SCHOOL IMPLEMENTATION</span></figcaption>
            </figure>
            <figure className="hero-image-detail">
              <img src="/img/zenith/zenith_robot_rover_demo.webp" alt="Students demonstrating a robotics rover" width="800" height="600" loading="eager" />
              <figcaption>Students testing an autonomous build</figcaption>
            </figure>
            <div className="hero-rail-label">DESIGNED FOR REAL TIMETABLES · REAL CLASSROOMS · REAL BUILDS</div>
          </Reveal>
        </div>
      </section>

      <section className="statement-band">
        <div className="shell statement-band__grid">
          <Reveal><span className="section-kicker">The Pixiu idea</span></Reveal>
          <Reveal delay={90}><h2>The school should not have to assemble the pieces <span>itself.</span></h2></Reveal>
          <Reveal delay={140}><p>Hardware vendors, curriculum files, trainers and software can all exist separately. The student experience does not. We design the system around the way a school actually operates.</p></Reveal>
        </div>
      </section>

      <section className="system-section">
        <div className="shell">
          <div className="section-intro section-intro--split">
            <Reveal>
              <span className="section-kicker">One connected system</span>
              <h2>Behind one school partner are four layers that have to work together.</h2>
            </Reveal>
            <Reveal delay={100}><p>Think of the programme as a loop: the room enables the lesson, the lesson creates work, the people make the work happen, and the digital layer keeps the system visible.</p></Reveal>
          </div>
          <div className="system-map">
            <div className="system-map__line" aria-hidden="true" />
            {SYSTEM_LAYERS.map(layer => (
              <Reveal key={layer.no} delay={Number(layer.no) * 45} className="system-layer">
                <div className="system-layer__no">{layer.no}</div>
                <div><span className="mono-label">{layer.kicker}</span><h3>{layer.title}</h3><p>{layer.text}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="starting-section">
        <div className="shell">
          <div className="section-intro">
            <Reveal><span className="section-kicker">Start where your school is</span><h2>Four starting points. One way of working.</h2></Reveal>
          </div>
          <div className="starting-grid">
            {STARTING_POINTS.map((item, index) => (
              <Reveal key={item.id} delay={index * 55}>
                <Link className="starting-card" to={item.href}>
                  <div><span className="mono-label">{item.label}</span><span className="starting-card__no">0{index + 1}</span></div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <span className="starting-card__arrow">↗</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="projects-section">
        <div className="shell">
          <div className="projects-head">
            <Reveal><span className="section-kicker section-kicker--light">What students actually make</span><h2>The technology is the medium. <em>The build is the point.</em></h2></Reveal>
            <Reveal delay={100}><Link className="text-link text-link--light" to="/solutions">Explore all capabilities →</Link></Reveal>
          </div>
          <div className="project-rail">
            {PROJECTS.map(project => (
              <article className="project-card" key={project.title}>
                <div className="project-card__image"><img src={project.image} alt="" loading="lazy" /></div>
                <div className="project-card__body"><div className="project-card__meta"><span>{project.label}</span><span>{project.grade}</span></div><h3>{project.title}</h3><p>{project.text}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="delivery-section" id="delivery">
        <div className="shell">
          <div className="section-intro section-intro--split">
            <Reveal><span className="section-kicker">From room to routine</span><h2>A lab launch is not the finish line.</h2></Reveal>
            <Reveal delay={100}><p>The delivery model is deliberately longer than installation. The aim is to get from an empty room to repeatable weekly learning, then keep improving the programme with the school.</p></Reveal>
          </div>
          <div className="delivery-timeline">
            <div className="delivery-timeline__track" aria-hidden="true" />
            {DELIVERY.map((step, index) => (
              <Reveal key={step.no} delay={index * 50} className="delivery-step">
                <div className="delivery-step__dot">{step.no}</div><div><h3>{step.title}</h3><p>{step.text}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="proof-section">
        <div className="shell proof-layout">
          <div className="proof-copy">
            <Reveal><span className="section-kicker">Proof of work</span><h2>{PROOF.title}</h2><p>{PROOF.text}</p><div className="proof-school"><strong>{PROOF.school}</strong><span>Physical lab · hands-on delivery · teacher co-teaching</span></div><Link className="button button--outline" to="/work">Open the implementation story <span>↗</span></Link></Reveal>
          </div>
          <div className="proof-gallery">
            {PROOF.images.map((item, index) => (
              <Reveal key={item.label} delay={70 * index} className={'proof-photo proof-photo--' + (index + 1)}><img src={item.src} alt={item.alt} loading="lazy" /><span>{item.label}</span></Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-section">
        <div className="shell platform-layout">
          <Reveal className="platform-screen">
            <div className="platform-screen__top"><span>PIXIU / SCHOOL PORTAL</span><span>LIVE SYSTEM</span></div>
            <div className="platform-screen__body">
              <div className="platform-screen__sidebar"><span className="is-current">MISSIONS</span><span>CLASSROOMS</span><span>ATTENDANCE</span><span>REPORTS</span></div>
              <div className="platform-screen__content"><span className="mono-label">STUDENT MISSION / 04</span><h3>Build a responsive rover.</h3><div className="platform-screen__diagram"><span>01 INPUT</span><i /><span>02 LOGIC</span><i /><span>03 ACTION</span></div><div className="platform-progress"><span /><span /><span /><span /><b>72%</b></div></div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <span className="section-kicker section-kicker--light">School portal</span>
            <h2>{PLATFORM.title}</h2>
            <p>{PLATFORM.text}</p>
            <ul className="feature-list feature-list--light">{PLATFORM.features.map(item => <li key={item}>{item}</li>)}</ul>
            <Link className="text-link text-link--light" to="/portal">See the portal entry point <span>→</span></Link>
          </Reveal>
        </div>
      </section>

      <section className="about-preview">
        <div className="shell about-preview__grid">
          <Reveal><span className="section-kicker">Who we are</span><h2>Not a kit catalogue. Not a one-day workshop.</h2></Reveal>
          <Reveal delay={100}><p>Our job is to make advanced technology teachable, repeatable and usable inside a real school environment. That means thinking about students, teachers, rooms, calendars and the software around all of them.</p><Link className="text-link" to="/about">Meet the thinking behind Pixiu <span>→</span></Link></Reveal>
        </div>
        <div className="shell principles-strip">
          {PRINCIPLES.map(item => <div key={item.no}><span>{item.no}</span><strong>{item.title}</strong></div>)}
        </div>
      </section>

      <CTAStrip />
    </>
  )
}
