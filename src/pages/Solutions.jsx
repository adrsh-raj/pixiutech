import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import CTAStrip from '../components/CTAStrip.jsx'
import { CAPABILITIES, DELIVERY, SYSTEM_LAYERS } from '../data/site.js'

export default function Solutions() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    window.setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [hash])

  return (
    <>
      <PageHead crumb="What we do" title="A school innovation programme is more than the equipment in the room." intro="We design the lab, learning path, delivery model and digital layer as one system—then adapt the mix to the school in front of us." aside={<div><span className="mono-label">CAPABILITY INDEX</span><strong>06 domains<br />04 system layers<br />01 connected programme</strong></div>} />

      <section className="capability-index">
        <div className="shell">
          <div className="capability-index__bar"><span className="mono-label">Choose a capability</span><nav aria-label="Capabilities">{CAPABILITIES.map(item => <a key={item.id} href={'#' + item.id}>{item.no} / {item.navTitle}</a>)}</nav></div>
        </div>
      </section>

      <section className="band-plain" id="lab-setup">
        <div className="shell brief-layout">
          <Reveal><span className="section-kicker">Lab setup</span><h2>From an empty room to a working learning environment.</h2></Reveal>
          <Reveal delay={100}><p>Space planning is part of the learning design. We consider room size, tables, storage, power, devices, kits, safety and the way students will move through a class before the first session starts.</p><ul className="feature-list">{['Space and equipment planning', 'Technology-domain configuration', 'Classroom-ready hardware and software', 'Launch checklist for school teams'].map(item => <li key={item}>{item}</li>)}</ul></Reveal>
        </div>
      </section>

      {CAPABILITIES.map((item, index) => (
        <section className={'capability-band ' + (index % 2 ? 'capability-band--reverse' : '')} id={item.id} key={item.id}>
          <div className="shell capability-layout">
            <Reveal className="capability-image"><img src={item.image} alt={item.imageAlt} loading="lazy" /><div className="capability-image__label"><span>{item.no}</span><span>{item.navTitle}</span></div></Reveal>
            <Reveal delay={80} className="capability-copy"><span className="section-kicker">{item.no} / capability</span><h2>{item.title}</h2><p className="capability-copy__short">{item.short}</p><p>{item.desc}</p><div className="included-list"><span className="mono-label">What this can include</span><ul>{item.includes.map(feature => <li key={feature}>{feature}</li>)}</ul></div><Link className="text-link" to="/contact?intent=proposal#demo-form">Discuss this capability <span>→</span></Link></Reveal>
          </div>
        </section>
      ))}

      <section className="programme-section" id="programme">
        <div className="shell">
          <div className="section-intro section-intro--split"><Reveal><span className="section-kicker section-kicker--light">Programme architecture</span><h2>Technology domains become a progression, not a shopping list.</h2></Reveal><Reveal delay={90}><p>Projects, assessment and teaching depth can change by grade. The same physical lab can support different levels of complexity when the programme is deliberately staged.</p></Reveal></div>
          <div className="programme-grid">
            <div><span>FOUNDATION</span><h3>Make it work</h3><p>Components, observation, simple logic, first builds and safe lab habits.</p></div>
            <div><span>CORE</span><h3>Make it respond</h3><p>Sensors, systems, debugging, mechanisms and repeatable project workflows.</p></div>
            <div><span>ADVANCED</span><h3>Make it think</h3><p>Data, AI, autonomous systems, design cycles and capstone problem-solving.</p></div>
          </div>
        </div>
      </section>

      <section className="delivery-model-section" id="delivery">
        <div className="shell">
          <Reveal><span className="section-kicker">Delivery models</span><h2>Choose the level of support that fits the school.</h2></Reveal>
          <div className="delivery-model-grid">
            <article><span className="mono-label">01 / RESIDENT</span><h3>Instructor-led</h3><p>Pixiu instructors run regular sessions while school teachers participate and build delivery confidence.</p></article>
            <article><span className="mono-label">02 / SHARED</span><h3>Co-delivered</h3><p>School faculty and Pixiu instructors share classroom delivery, planning and project guidance.</p></article>
            <article><span className="mono-label">03 / DIGITAL</span><h3>Portal-supported</h3><p>Use the digital learning layer to support student practice, missions and school workflows around the physical programme.</p></article>
          </div>
        </div>
      </section>

      <section className="system-recap">
        <div className="shell"><div className="section-intro"><Reveal><span className="section-kicker">The complete picture</span><h2>What a school is really buying.</h2></Reveal></div><div className="system-recap__grid">{SYSTEM_LAYERS.map(layer => <div key={layer.no}><span>{layer.no}</span><h3>{layer.title}</h3><p>{layer.text}</p></div>)}</div></div>
      </section>

      <CTAStrip title="Ready to plan around your school's actual room, grades and calendar?" primary="Start a school plan" />
    </>
  )
}
