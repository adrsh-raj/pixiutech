import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import { LMS_LOGIN_URL } from '../config/runtime.js'

export default function PortalBridge() {
  return (
    <div className="portal-entry">
      <div className="shell portal-entry__grid">
        <Reveal><span className="section-kicker section-kicker--light">School portal</span><h1>The classroom does not stop at the lab door.</h1><p>Sign in to the Pixiu Tech portal for student missions, virtual circuit practice and school programme workflows.</p><a className="button button--accent" href={LMS_LOGIN_URL}>Login to school portal <span>↗</span></a><Link className="text-link text-link--light" to="/">Back to Pixiu Tech <span>→</span></Link></Reveal>
        <Reveal delay={100} className="portal-entry__screen">
          <div className="portal-entry__chrome"><span>PORTAL.PIXIUTECH.COM</span><span>SECURE ENTRY</span></div>
          <div className="portal-entry__body"><span className="mono-label">STUDENT WORKSPACE</span><h2>Mission 04</h2><div className="portal-entry__rows"><div><span>BUILD</span><strong>Responsive rover</strong></div><div><span>SIMULATION</span><strong>8 / 10 checks passed</strong></div><div><span>TEACHER</span><strong>Review requested</strong></div></div><div className="portal-entry__footer"><span>LIVE</span><span>PHYSICAL + DIGITAL</span></div></div>
        </Reveal>
      </div>
    </div>
  )
}
