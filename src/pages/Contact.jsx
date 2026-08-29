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
                <strong>📞 WhatsApp</strong>
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
