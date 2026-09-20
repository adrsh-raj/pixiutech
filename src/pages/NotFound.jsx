import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import '../styles/notfound.css'

export default function NotFound() {
  return (
    <div className="notfound" aria-labelledby="notfound-title">
      <section className="notfound__hero">
        <div className="shell notfound__shell">
          <Reveal>
            <div className="notfound__code" aria-hidden="true">404</div>
            <p className="eyebrow">Page not found</p>
            <h1 id="notfound-title">This page isn’t available.</h1>
            <p className="notfound__lead">
              The link may be outdated or the address may contain a typo. The page you were looking for is not part of the current Pixiu Tech website.
            </p>
            <div className="notfound__actions">
              <Link className="btn btn--primary" to="/">
                <span aria-hidden="true">←</span> Back to homepage
              </Link>
              <Link className="btn btn--outline" to="/solutions">
                Explore solutions <span aria-hidden="true">→</span>
              </Link>
              <Link className="notfound__contact" to="/contact">
                Contact Pixiu Tech
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="band band--gray">
        <div className="shell notfound__help">
          <div>
            <h2>Looking for something specific?</h2>
            <p>Start with our solutions, verify a certificate, read the FAQs, or tell us what your school needs.</p>
          </div>
          <div className="notfound__quicklinks">
            <Link to="/solutions">School solutions</Link>
            <Link to="/verify">Certificate verification</Link>
            <Link to="/faq">Frequently asked questions</Link>
            <Link to="/contact">School enquiry</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
