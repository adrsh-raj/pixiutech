import { useEffect } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import EnquiryForm from '../components/EnquiryForm.jsx'

export default function Contact() {
  const [params] = useSearchParams()
  const intent = params.get('intent')
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) {
      setTimeout(() => {
        const el = document.querySelector(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [hash])

  return (
    <>
      <PageHead
        crumb="Contact"
        title="Let's Build Your School's Innovation Lab"
        intro="Tell us about your school. We'll come back with a custom plan and proposal."
      />

      <section className="band band--gray" id="enquiry">
        <div className="shell contact__grid">
          <Reveal>
            <p className="eyebrow">Get In Touch</p>
            <h2 className="h-sect">Start With a Free Consultation</h2>
            <p className="lede">
              The first conversation costs nothing and commits you to nothing. We'll want to know which grades the lab should serve, what space you have, and what you already run.
            </p>

            <div className="contact-info">
              <div className="contact-info__item">
                <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  WhatsApp
                </strong>
                <a href="https://wa.me/917985403186" target="_blank" rel="noreferrer">+91 7985403186</a>
              </div>
              <div className="contact-info__item">
                <strong>📧 Email</strong>
                <span>director@pixiutech.com</span>
              </div>
              <div className="contact-info__item">
                <strong>🏢 Company</strong>
                <span>Pixiu Tech LLP</span>
              </div>
              <div className="contact-info__item">
                <strong>⏰ Response Time</strong>
                <span>Less than 24 hours</span>
              </div>
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
