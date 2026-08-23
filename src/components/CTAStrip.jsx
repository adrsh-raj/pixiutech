import { Link } from 'react-router-dom'

export default function CTAStrip({
  title = "Ready to Build Your School's Innovation Ecosystem?",
  primary = 'Book a consultation',
  secondary = 'Request a proposal',
}) {
  return (
    <section className="ctastrip gridfield">
      <div className="shell ctastrip__in">
        <h2>{title}</h2>
        <div className="ctastrip__btns">
          <Link className="btn btn--primary" to="/contact">
            {primary} <span className="arw">→</span>
          </Link>
          <Link className="btn btn--ghost" to="/contact?intent=proposal">
            {secondary}
          </Link>
        </div>
      </div>
    </section>
  )
}
