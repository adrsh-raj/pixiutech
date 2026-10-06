import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import EnquiryForm from '../components/EnquiryForm.jsx'

export default function Contact() {
  const [params] = useSearchParams()
  const { hash } = useLocation()
  const intent = params.get('intent')

  useEffect(() => {
    const target = hash || window.location.hash
    if (!target) return
    const timer = window.setTimeout(() => {
      const id = target.replace(/^#/, '')
      const element = document.getElementById(id)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element?.querySelector('input')?.focus()
    }, 120)
    return () => window.clearTimeout(timer)
  }, [hash])

  return (
    <>
      <PageHead
        crumb="Talk to Pixiu"
        title="Start with the school you actually have."
        intro="Tell us the room, grades, timetable, technology already in place and the outcome you want. We will shape the right programme around it."
        aside={<div><span className="mono-label">FIRST CONVERSATION</span><strong>No purchase commitment.<br />Just a clear starting point.</strong></div>}
      />

      <section className="contact-section" id="enquiry">
        <div className="shell contact-layout">
          <Reveal className="contact-copy">
            <span className="section-kicker">Tell us what is in the room</span>
            <h2>Good programmes start with useful constraints.</h2>
            <p>We can talk about a new lab, an existing room that is not being used enough, a curriculum you want to introduce, or a digital layer you need around the programme.</p>

            <div className="contact-checklist">
              <div><span>01</span><p>Grades and number of students</p></div>
              <div><span>02</span><p>Available room, infrastructure and existing equipment</p></div>
              <div><span>03</span><p>Technology domains and academic goals</p></div>
              <div><span>04</span><p>Preferred delivery model and school calendar</p></div>
            </div>

            <div className="contact-direct">
              <div><span>WhatsApp</span><a href="https://wa.me/917985403186" target="_blank" rel="noreferrer">+91 7985403186 ↗</a></div>
              <div><span>Email</span><a href="mailto:director@pixiutech.com">director@pixiutech.com ↗</a></div>
              <div><span>Company</span><strong>Pixiu Tech LLP</strong></div>
              <div><span>Reply</span><strong>Usually within 24 hours</strong></div>
            </div>
          </Reveal>

          <Reveal delay={90} className="contact-form-wrap">
            <div className="form-kicker"><span>School enquiry</span><span>{intent === 'proposal' ? 'Proposal request' : 'New conversation'}</span></div>
            <EnquiryForm intent={intent} />
          </Reveal>
        </div>
      </section>
    </>
  )
}
