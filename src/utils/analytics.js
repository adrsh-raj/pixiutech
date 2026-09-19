const MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim()
const CONSENT_KEY = 'pixiu_analytics_consent'

function gtag(...args) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments) }
  window.gtag(...args)
}

export function getAnalyticsConsent() {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(CONSENT_KEY)
  return value === 'granted' || value === 'denied' ? value : null
}

export function setAnalyticsConsent(value) {
  if (typeof window === 'undefined') return
  const consent = value === 'granted' ? 'granted' : 'denied'
  window.localStorage.setItem(CONSENT_KEY, consent)
  gtag('consent', 'update', {
    analytics_storage: consent,
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
}

export function initAnalytics() {
  if (getAnalyticsConsent() !== 'granted') return
  if (!MEASUREMENT_ID || typeof window === 'undefined' || typeof document === 'undefined') return
  if (document.querySelector('script[data-pixiu-ga="true"]')) return

  // Analytics is loaded only after the visitor explicitly allows analytics.
  gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })
  gtag('js', new Date())
  gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID)
  script.dataset.pixiuGa = 'true'
  document.head.appendChild(script)
}

export function trackPageView(pathname) {
  if (getAnalyticsConsent() !== 'granted' || !MEASUREMENT_ID || typeof window === 'undefined') return
  initAnalytics()
  if (typeof window.gtag !== 'function') return

  window.gtag('event', 'page_view', {
    page_title: document.title,
    page_location: window.location.origin + pathname,
    page_path: pathname,
  })
}
