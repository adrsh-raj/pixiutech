import { useSearchParams } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import EnquiryForm from '../components/EnquiryForm.jsx'
import { JOURNEY } from '../data/site.js'

export default function Contact() {
  const [params] = useSearchParams()
  const intent = params.get('intent')

  return (
    <>
      <PageHead
        crumb="Contact"
        title="Ready to Build Your School's Innovation Ecosystem?"
        intro="Tell us about your school and your space. We'll come back with a plan and a proposal built around it."
      />

      <section className="band band--gray">
        <div className="shell contact__grid">
          <Reveal>
            <p className="eyebrow">Enquiry</p>
            <h2 className="h-sect">Start With a Consultation.</h2>
            <p className="lede">
              The first conversation costs nothing and commits you to nothing. We'll want to know which grades the lab
              should serve, what space you have, and what you already run.
            </p>
            <div className="contact__aside">
              <div>Pixiu Tech LLP</div>
              <div>STEM · Robotics · AI · IoT · Innovation</div>
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px', color: '#333' }}>
                <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#1D6EFF' }}>Buy Student Kits</strong>
                <span>WhatsApp: <strong><a href="https://wa.me/917985403186" target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#0A1A33' }}>+91 7985403186</a></strong></span>
              </div>
              <div style={{ marginTop: '1rem' }}>Reply within two working days</div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <EnquiryForm intent={intent} />
          </Reveal>
        </div>
      </section>

      <section className="band on-dark gridfield">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">What happens next</p>
            <h2 className="h-sect">The First Three Steps.</h2>
          </Reveal>
          <Reveal delay={80}>
            <div style={{ marginTop: 42 }}>
              {JOURNEY.slice(0, 3).map((s) => (
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
    </>
  )
}
