import { Link } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import '../styles/faq.css'

export { FAQ_ITEMS } from '../data/faq.js'
import { FAQ_ITEMS } from '../data/faq.js'
export default function FAQ() {
  return (
    <>
      <PageHead
        crumb="FAQ"
        title="Frequently Asked Questions"
        intro="Practical answers about Pixiu Tech’s school technology labs, programmes, implementation, training, and support."
      />

      <section className="band band--gray">
        <div className="shell" style={{ maxWidth: 920 }}>
          <Reveal>
            <p className="eyebrow">Before You Start</p>
            <h2 className="h-sect">Questions Schools Usually Ask</h2>
            <p className="lede">
              Still unsure where to begin? Start with a consultation and we can map the right combination of technology, curriculum, hardware, and delivery for your school.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="faq-list" style={{ marginTop: 30 }}>
              {FAQ_ITEMS.map((item) => (
                <details className="faq-item" key={item.q}>
                  <summary>{item.q}<span aria-hidden="true">+</span></summary>
                  <div className="faq-item__answer">{item.a}</div>
                </details>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div style={{ marginTop: 34, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn btn--primary" to="/contact#demo-form">
                Book a Free Consultation <span className="arw">→</span>
              </Link>
              <Link className="btn btn--outline" to="/solutions">
                Explore Solutions <span className="arw">→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
