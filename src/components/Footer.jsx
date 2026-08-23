import { Link } from 'react-router-dom'
import { NAV } from '../data/site.js'

export default function Footer() {
  return (
    <footer className="foot">
      <div className="shell">
        <div className="foot__top">
          <Link className="brand" to="/">
            <span className="brand__mark">PIXIU</span>
            <span className="brand__tag">Build · Learn · Innovate</span>
          </Link>
          <nav className="foot__nav" aria-label="Footer">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="foot__bot">
          <span>© {new Date().getFullYear()} Pixiu Tech LLP</span>
          <span>End-to-end STEM &amp; innovation solutions for schools</span>
        </div>
      </div>
    </footer>
  )
}
