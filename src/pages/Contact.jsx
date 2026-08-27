import { useSearchParams } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import EnquiryForm from '../components/EnquiryForm.jsx'

export default function Contact() {
  const [params] = useSearchParams()
  const intent = params.get('intent')

  return (
    <>
      <PageHead
        crumb="Contact"
        title="Let's Build Your School's Innovation Lab"
        intro="Tell us about your school. We'll come back with a custom plan and proposal."
      />

      <section className="band band--gray">
        <div className="shell contact__grid">
          <Reveal>
            <p className="eyebrow">Get In Touch</p>
            <h2 className="h-sect">Start With a Free Consultation</h2>
            <p className="lede">
              The first conversation costs nothing and commits you to nothing. We'll want to know which grades the lab should serve, what space you have, and what you already run.
            </p>

            <div className="contact-info">
              <div className="contact-info__item">
                <strong>📞 WhatsApp</strong>
                <a href="https://wa.me/917985403186" target="_blank" rel="noreferrer">+91 7985403186</a>
              </div>
              <div className="contact-info__item">
                <strong>📧 Email</strong>
                <span>hello@pixiutech.com</span>
              </div>
              <div className="contact-info__item">
                <strong>🏢 Company</strong>
                <span>Pixiu Tech LLP</span>
              </div>
              <div className="contact-info__item">
                <strong>⏰ Response Time</strong>
                <span>Within 2 working days</span>
              </div>
            </div>

            <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#e0f7e9', borderRadius: '12px', border: '1px solid #a7dfb8' }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#25D366', fontSize: '1.1rem' }}>🛒 Order Student Kits</strong>
              <p style={{ fontSize: '0.95rem', color: '#333', marginBottom: '0.75rem' }}>Get the official Pixiu robotics kit delivered to your home.</p>
              <a href="https://wa.me/917985403186?text=Hi%2C%20I%20want%20to%20order%20a%20student%20robotics%20kit" target="_blank" rel="noreferrer" className="btn btn--primary" style={{ background: '#25D366', borderColor: '#25D366' }}>
                Order on WhatsApp
              </a>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <EnquiryForm intent={intent} />
          </Reveal>
        </div>
      </section>
    </>
  )
}
