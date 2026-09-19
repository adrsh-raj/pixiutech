import { Link } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'

export default function NotFound() {
  return (
    <>
      <PageHead
        crumb="404"
        title="This Page Isn't Here."
        intro="The link may be out of date, or the address may have a typo in it."
      />
      <section className="band">
        <div className="shell">
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Link className="btn btn--primary" to="/">
              Return to Pixiu Tech <span className="arw">→</span>
            </Link>
            <Link className="btn btn--outline" to="/contact">
              Talk to Pixiu Tech
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
