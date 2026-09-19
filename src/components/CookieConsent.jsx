import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './cookie-consent.css'
import { CONSENT_EVENT, CONSENT_KEY, getConsent, revokeGoogleTagConsent } from './AnalyticsTracker.jsx'

function saveConsent(consent) {
  try { window.localStorage.setItem(CONSENT_KEY, consent) } catch (e) {}
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { consent } }))
}

export default function CookieConsent() {
  const [choice, setChoice] = useState(getConsent)
  const [open, setOpen] = useState(() => getConsent() === 'unset')
  const dialogRef = useRef(null)

  useEffect(() => {
    const onConsentChange = (event) => {
      const next = event.detail?.consent || getConsent()
      setChoice(next)
      setOpen(false)
    }
    window.addEventListener(CONSENT_EVENT, onConsentChange)
    return () => window.removeEventListener(CONSENT_EVENT, onConsentChange)
  }, [])

  useEffect(() => {
    if (!open) return
    const focusTimer = window.setTimeout(() => dialogRef.current?.querySelector('button')?.focus(), 0)
    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll('button, a[href]')
      if (!focusable?.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { window.clearTimeout(focusTimer); document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  const accept = () => { saveConsent('accepted'); setChoice('accepted'); setOpen(false) }
  const decline = () => { revokeGoogleTagConsent(); saveConsent('declined'); setChoice('declined'); setOpen(false) }

  return (
    <>
      {open && (
        <section ref={dialogRef} className="cookie-consent" role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title">
          <div className="cookie-consent__content">
            <p className="cookie-consent__eyebrow">Privacy &amp; Analytics</p>
            <h2 id="cookie-consent-title">Choose your analytics preference</h2>
            <p>Pixiu Tech uses essential browser storage for site preferences and, only with your permission, Google Analytics to understand page visits. Analytics is not loaded until you choose. <span>Read our <Link to="/privacy">Privacy Policy</Link>.</span></p>
          </div>
          <div className="cookie-consent__actions">
            <button type="button" className="btn btn--outline" onClick={decline}>Decline analytics</button>
            <button type="button" className="btn btn--primary" onClick={accept}>Allow analytics</button>
          </div>
        </section>
      )}
      {choice !== 'unset' && <button type="button" className="cookie-settings" onClick={() => setOpen(true)} aria-label="Open privacy and analytics settings">Privacy settings</button>}
    </>
  )
}