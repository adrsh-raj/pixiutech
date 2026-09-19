import { Link } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'

export const FAQ_ITEMS = [
  {
    q: 'What does Pixiu Tech provide to schools?',
    a: 'Pixiu Tech provides end-to-end school technology ecosystems: lab planning and setup, robotics and STEM kits, AI/IoT/drone and computational-design solutions, curriculum, instructor deployment, teacher training, and ongoing support.'
  },
  {
    q: 'Which technology domains can a school choose?',
    a: 'Schools can combine Robotics, AI & Machine Learning, Computational Design & 3D, Drone Technology, and IoT & Smart Systems. Pixiu Tech can also create a custom mix based on the school’s space, budget, academic goals, and board.'
  },
  {
    q: 'Do you provide the hardware and set up the lab?',
    a: 'Yes. Pixiu Tech can handle the physical lab setup and the learning hardware together, including equipment, kits, software requirements, and classroom-ready configuration.'
  },
  {
    q: 'Do we need an existing innovation lab?',
    a: 'No. The programme can be planned around the space you already have, from a small robotics corner to a complete innovation lab. During the initial consultation, we can assess the available room, infrastructure, budget, and intended grades.'
  },
  {
    q: 'Do you provide instructors and teacher training?',
    a: 'Yes. Pixiu Tech can deploy trained instructors for programme delivery and also upskill the school’s teaching faculty through hands-on training, curriculum walkthroughs, session planning, and ongoing mentorship.'
  },
  {
    q: 'Can the programme be aligned to our school board and academic calendar?',
    a: 'Yes. Custom solutions can be mapped to CBSE, ICSE, or a state-board context and aligned with the school’s academic calendar, grade structure, available time, and chosen technology domains.'
  },
  {
    q: 'How does a school get started with Pixiu Tech?',
    a: 'Start with a free consultation. Tell us about your school, grades, available space, existing setup, and goals. We then use that information to discuss the appropriate solution and proposal.'
  },
  {
    q: 'How can we request a proposal?',
    a: 'Use the Request a Proposal or Book a Free Consultation buttons on the website, or contact Pixiu Tech directly through the enquiry form. The first consultation does not commit the school to a purchase.'
  },
]

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
