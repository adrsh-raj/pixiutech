import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getAnalyticsConsent, initAnalytics, setAnalyticsConsent, trackPageView } from '../utils/analytics.js'

export default function CookieConsent() {
  const [open, setOpen] = useState(() => getAnalyticsConsent() === null)
  const firstActionRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(() => firstActionRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    const reopen = () => {
      setOpen(true)
    }
    window.addEventListener('pixiu:privacy-open', reopen)
    return () => window.removeEventListener('pixiu:privacy-open', reopen)
  }, [])

  const choose = (value) => {
    setAnalyticsConsent(value)
    if (value === 'granted') {
      initAnalytics()
      trackPageView(window.location.pathname)
    }
    setOpen(false)
  }

  if (!open) {
    return null
  }

  return (
    <aside className="privacy-consent" role="dialog" aria-modal="true" aria-label="Cookie preferences" aria-labelledby="privacy-consent-title" aria-describedby="privacy-consent-description" aria-live="polite">
      <div className="privacy-consent__copy">
        <strong id="privacy-consent-title">Privacy choices</strong>
        <p id="privacy-consent-description">We use optional analytics cookies to understand how visitors use Pixiu Tech. Essential site functions work without them.</p>
        <Link to="/privacy">Read our Privacy Policy</Link>
      </div>
      <div className="privacy-consent__actions">
        <button ref={firstActionRef} className="btn btn--outline btn--sm" type="button" onClick={() => choose('denied')}>Decline</button>
        <button className="btn btn--primary btn--sm" type="button" onClick={() => choose('granted')}>Allow analytics</button>
      </div>
    </aside>
  )
}
