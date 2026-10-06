import { Link } from 'react-router-dom'

export default function CTAStrip({
  title = "Ready to Build Your School's Innovation Ecosystem?",
  primary = 'Book a Free Consultation',
  secondary = 'Request a Proposal',
}) {
  return (
    <section className="ctastrip gridfield">
      <div className="shell ctastrip__in">
        <div>
          <p className="eyebrow">Start a school conversation</p>
          <h2>{title}</h2>
        </div>
        <div className="ctastrip__btns">
          <Link className="btn btn--primary" to="/contact#demo-form">
            {primary} <span className="arw">→</span>
          </Link>
          <Link className="btn btn--ghost-light" to="/contact?intent=proposal#demo-form">
            {secondary} <span className="arw">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
