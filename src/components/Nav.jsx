import { useState, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { NAV } from '../data/site.js'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="shell nav__in">
        <Link className="brand" to="/">
          <span className="brand__mark">PIXIU TECH</span>
          <span className="brand__tag">STEM · Robotics · AI</span>
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
            Book a Demo
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
