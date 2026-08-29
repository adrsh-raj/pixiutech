import { Link } from 'react-router-dom'
import { NAV } from '../data/site.js'

export default function Footer() {
  return (
    <footer className="foot">
      <div className="shell">
        <div className="foot__grid">
          <div className="foot__about">
            <Link className="brand" to="/">
              <img className="brand__logo" src="/img/logo.png" alt="Pixiu Tech" />
            </Link>
            <p className="foot__desc">
              Pixiu Tech is an end-to-end STEM, Robotics, AI, and Innovation solutions provider for schools. 
              We design labs, deliver curriculum, train teachers, and support schools long-term.
            </p>
          </div>

          <div className="foot__links-group">
            <h4>Quick Links</h4>
            <nav className="foot__nav-col" aria-label="Footer">
              {NAV.filter((n) => n.to !== '/contact').map((n) => (
                <Link key={n.to} to={n.to}>{n.label}</Link>
              ))}
            </nav>
          </div>

          <div className="foot__links-group">
            <h4>Connect</h4>
            <nav className="foot__nav-col">
              <Link to="/contact">Contact Us</Link>
              <a href="mailto:director@pixiutech.com">Email Us</a>
              <Link to="/careers">Careers</Link>
            </nav>
          </div>
        </div>

        <div className="foot__bot">
          <span>© {new Date().getFullYear()} Pixiu Tech LLP. All rights reserved.</span>
          <span>End-to-end STEM & Innovation solutions for schools</span>
        </div>
      </div>
    </footer>
  )
}
