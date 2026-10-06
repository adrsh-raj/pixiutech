import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { CAPABILITIES } from '../data/site.js'

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [whatOpen, setWhatOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const burgerRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    setOpen(false)
    setWhatOpen(false)
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false)
        setWhatOpen(false)
        window.requestAnimationFrame(() => burgerRef.current?.focus())
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => menuRef.current?.querySelector('a')?.focus(), 0)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <header className={'site-nav ' + (scrolled ? 'site-nav--scrolled' : '')}>
      <div className="shell site-nav__inner">
        <Link className="site-brand" to="/" aria-label="Pixiu Tech home">
          <img src="/img/logo.png" alt="Pixiu Tech" width="104" height="58" decoding="async" loading="eager" />
        </Link>

        <nav className="site-nav__desktop" aria-label="Primary navigation">
          <div className="nav-menu-wrap">
            <button className={'nav-link-button ' + (pathname === '/solutions' ? 'is-active' : '')} type="button" onClick={() => setWhatOpen(v => !v)} aria-expanded={whatOpen} aria-controls="what-we-do-menu">
              What we do <span aria-hidden="true">⌄</span>
            </button>
            {whatOpen && (
              <div className="nav-dropdown" id="what-we-do-menu">
                <div className="nav-dropdown__intro">
                  <span className="mono-label">06 CAPABILITIES</span>
                  <strong>Build the system your school actually needs.</strong>
                </div>
                <div className="nav-dropdown__grid">
                  {CAPABILITIES.slice(0, 5).map(item => (
                    <Link key={item.id} to={'/solutions#' + item.id} onClick={() => setWhatOpen(false)}>
                      <span>{item.no}</span>
                      <div><strong>{item.navTitle}</strong><small>{item.short}</small></div>
                    </Link>
                  ))}
                  <Link className="nav-dropdown__all" to="/solutions" onClick={() => setWhatOpen(false)}>
                    <span>→</span><div><strong>See the complete system</strong><small>Lab, curriculum, delivery and digital layer.</small></div>
                  </Link>
                </div>
              </div>
            )}
          </div>
          <NavLink to="/about" className={({ isActive }) => 'site-nav__link ' + (isActive ? 'is-active' : '')}>Who we are</NavLink>
          <NavLink to="/work" className={({ isActive }) => 'site-nav__link ' + (isActive ? 'is-active' : '')}>Proof of work</NavLink>
          <NavLink to="/portal" className={({ isActive }) => 'site-nav__link ' + (isActive ? 'is-active' : '')}>School portal</NavLink>
          <NavLink to="/faq" className={({ isActive }) => 'site-nav__link ' + (isActive ? 'is-active' : '')}>FAQ</NavLink>
        </nav>

        <div className="site-nav__actions">
          <Link className="nav-cta" to="/contact#demo-form">Talk to Pixiu <span aria-hidden="true">↗</span></Link>
          <button ref={burgerRef} className="nav-toggle" type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'}>
            <span /><span />
          </button>
        </div>
      </div>

      <nav id="mobile-nav" ref={menuRef} className={'mobile-nav ' + (open ? 'is-open' : '')} aria-label="Mobile navigation" aria-hidden={!open}>
        <div className="mobile-nav__head"><span className="mono-label">NAVIGATION</span><button type="button" onClick={() => setOpen(false)}>Close</button></div>
        <Link to="/solutions">What we do <span>→</span></Link>
        <Link to="/about">Who we are <span>→</span></Link>
        <Link to="/work">Proof of work <span>→</span></Link>
        <Link to="/portal">School portal <span>→</span></Link>
        <Link to="/faq">FAQ <span>→</span></Link>
        <Link className="mobile-nav__cta" to="/contact#demo-form">Start a school plan <span>↗</span></Link>
      </nav>
    </header>
  )
}
