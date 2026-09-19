const MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim()

function gtag(...args) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments) }
  window.gtag(...args)
}

export function initAnalytics() {
  if (!MEASUREMENT_ID || typeof window === 'undefined' || typeof document === 'undefined') return
  if (document.querySelector('script[data-pixiu-ga="true"]')) return

  // Google Consent Mode keeps analytics storage denied by default and disables
  // advertising/personalisation signals. There is no visible analytics UI.
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
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
  if (!MEASUREMENT_ID || typeof window === 'undefined') return
  initAnalytics()
  if (typeof window.gtag !== 'function') return

  window.gtag('event', 'page_view', {
    page_title: document.title,
    page_location: window.location.origin + pathname,
    page_path: pathname,
  })
}
