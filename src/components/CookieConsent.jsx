import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAnalyticsConsent, initAnalytics, setAnalyticsConsent, trackPageView } from '../utils/analytics.js'

export default function CookieConsent() {
  const [choice, setChoice] = useState(() => getAnalyticsConsent())
  const [open, setOpen] = useState(() => getAnalyticsConsent() === null)

  useEffect(() => {
    const reopen = () => {
      setChoice(getAnalyticsConsent())
      setOpen(true)
    }
    window.addEventListener('pixiu:privacy-open', reopen)
    return () => window.removeEventListener('pixiu:privacy-open', reopen)
  }, [])

  const choose = (value) => {
    setAnalyticsConsent(value)
    setChoice(value)
    if (value === 'granted') {
      initAnalytics()
      trackPageView(window.location.pathname)
    }
    setOpen(false)
  }

  if (!open || choice) {
    return null
  }

  return (
    <aside className="privacy-consent" role="dialog" aria-label="Cookie preferences" aria-live="polite">
      <div className="privacy-consent__copy">
        <strong>Privacy choices</strong>
        <p>We use optional analytics cookies to understand how visitors use Pixiu Tech. Essential site functions work without them.</p>
        <Link to="/privacy">Read our Privacy Policy</Link>
      </div>
      <div className="privacy-consent__actions">
        <button className="btn btn--outline btn--sm" type="button" onClick={() => choose('denied')}>Decline</button>
        <button className="btn btn--primary btn--sm" type="button" onClick={() => choose('granted')}>Allow analytics</button>
      </div>
    </aside>
  )
}
