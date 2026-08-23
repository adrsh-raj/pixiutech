import { useState, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { NAV } from '../data/site.js'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])

  return (
    <header className="nav">
      <div className="shell nav__in">
        <Link className="brand" to="/">
          <span className="brand__mark">PIXIU</span>
          <span className="brand__tag">Build · Learn · Innovate</span>
        </Link>

        <nav className="nav__links" aria-label="Primary">
          {NAV.filter((n) => n.to !== '/contact').map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')} end={n.to === '/'}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav__right">
          <Link className="btn btn--primary btn--sm" to="/contact">
            Book a consultation
          </Link>
          <button
            className="burger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
          </button>
        </div>
      </div>

      <div className={`shell drawer ${open ? 'open' : ''}`}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')} end={n.to === '/'}>
            {n.label}
          </NavLink>
        ))}
      </div>
    </header>
  )
}
