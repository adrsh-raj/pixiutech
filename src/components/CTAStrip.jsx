import { Link } from 'react-router-dom'

export default function CTAStrip({
  title = 'Have a room, a problem or a school goal? Start there.',
  primary = 'Plan a school lab',
  secondary = 'Request a proposal',
}) {
  return (
    <section className="cta-block">
      <div className="shell cta-block__inner">
        <div>
          <span className="section-kicker section-kicker--light">Start a conversation</span>
          <h2>{title}</h2>
          <p>Tell us what you already have and what you want students to be able to do.</p>
        </div>
        <div className="cta-block__actions">
          <Link className="button button--light" to="/contact#demo-form">{primary}<span>↗</span></Link>
          <Link className="button button--dark-outline" to="/contact?intent=proposal#demo-form">{secondary}<span>↗</span></Link>
        </div>
      </div>
    </section>
  )
}
