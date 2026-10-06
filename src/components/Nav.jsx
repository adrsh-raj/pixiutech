import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { NAV } from '../data/site.js'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const burgerRef = useRef(null)
  const drawerRef = useRef(null)

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      window.requestAnimationFrame(() => burgerRef.current?.focus())
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => drawerRef.current?.querySelector('a')?.focus(), 0)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      window.clearTimeout(focusTimer)
    }
  }, [open])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="shell nav__in">
        <Link className="brand" to="/">
          <img className="brand__logo" src="/img/logo.png" alt="Pixiu Tech" decoding="async" loading="eager" width="100" height="56" />
        </Link>
        <nav className="nav__links" aria-label="Primary navigation">
          {NAV.filter((n) => n.to !== '/contact').map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')} end={n.to === '/'}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav__right">
          <Link className="btn btn--primary btn--sm" to="/contact#demo-form">Book a Free Consultation</Link>
          <button ref={burgerRef} className="burger" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((v) => !v)}>
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
      <nav id="mobile-navigation" ref={drawerRef} className={`shell drawer ${open ? 'open' : ''}`} aria-label="Mobile navigation" aria-hidden={!open}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')} end={n.to === '/'}>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}