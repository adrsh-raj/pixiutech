import { Link } from 'react-router-dom'
import { FOOTER_GROUPS } from '../data/site.js'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="site-footer__top">
          <div className="site-footer__about">
            <Link className="footer-brand" to="/">
              <img src="/img/logo.png" alt="Pixiu Tech" width="104" height="58" loading="lazy" decoding="async" />
            </Link>
            <p>School technology, treated as a connected system: lab, curriculum, instructors and digital tools.</p>
            <a className="footer-email" href="mailto:director@pixiutech.com">director@pixiutech.com ↗</a>
          </div>

          <div className="site-footer__links">
            {FOOTER_GROUPS.map(group => (
              <div key={group.title}>
                <span className="mono-label mono-label--light">{group.title}</span>
                <nav aria-label={group.title + ' links'}>
                  {group.links.map(link => <Link key={link.to} to={link.to}>{link.label}</Link>)}
                </nav>
              </div>
            ))}
          </div>
        </div>

        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} Pixiu Tech LLP</span>
          <span>STEM · Robotics · AI · IoT · Innovation</span>
          <button type="button" onClick={() => window.dispatchEvent(new Event('pixiu:privacy-open'))}>Privacy choices</button>
        </div>
      </div>
    </footer>
  )
}
