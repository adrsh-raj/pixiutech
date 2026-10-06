import { Link } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import { PROOF } from '../data/site.js'

export default function Work() {
  return (
    <>
      <PageHead crumb="Proof of work" title="Show the work. Show the room. Show the people." intro="A school technology company earns trust by showing what delivery looks like after the pitch. This is one implementation story from the Pixiu programme." />
      <section className="case-hero">
        <div className="shell case-hero__grid">
          <Reveal className="case-hero__image"><img src={PROOF.images[0].src} alt={PROOF.images[0].alt} /><span>01 / THE ROOM</span></Reveal>
          <Reveal delay={100}><span className="section-kicker">{PROOF.school}</span><h2>{PROOF.title}</h2><p>{PROOF.text}</p><div className="case-facts"><div><span>FORMAT</span><strong>Innovation lab</strong></div><div><span>DELIVERY</span><strong>Hands-on sessions</strong></div><div><span>PARTNERSHIP</span><strong>School + Pixiu</strong></div></div></Reveal>
        </div>
      </section>
      <section className="case-gallery">
        <div className="shell"><div className="case-gallery__intro"><Reveal><span className="section-kicker">Inside the implementation</span><h2>Three views tell more than one hero image.</h2></Reveal><Reveal delay={100}><p>The visual story moves from infrastructure to people to student work—because that is the sequence a real programme depends on.</p></Reveal></div>
          <div className="case-gallery__grid">{PROOF.images.slice(1).map((item, index) => <Reveal key={item.label} delay={index * 80}><figure><img src={item.src} alt={item.alt} loading="lazy" /><figcaption><span>0{index + 2}</span><strong>{item.label}</strong></figcaption></figure></Reveal>)}</div>
        </div>
      </section>
      <section className="case-lessons">
        <div className="shell case-lessons__grid"><Reveal><span className="section-kicker">What the story means</span><h2>A working lab needs more than hardware.</h2></Reveal><Reveal delay={100}><div className="lesson-stack"><article><span>01</span><h3>Physical setup is the first layer.</h3><p>Students need a room arranged for making, storing, testing and resetting work between sessions.</p></article><article><span>02</span><h3>People turn equipment into learning.</h3><p>Teacher participation and instructor support keep the lab connected to the academic experience.</p></article><article><span>03</span><h3>Projects make the system visible.</h3><p>When students can show a working build, the value of the programme becomes tangible to the school.</p></article></div></Reveal></div>
      </section>
      <section className="case-next"><div className="shell"><Reveal><span className="section-kicker section-kicker--light">Next</span><h2>See how the full school solution is structured.</h2><Link className="button button--light" to="/solutions">Explore what we build <span>↗</span></Link></Reveal></div></section>
    </>
  )
}
