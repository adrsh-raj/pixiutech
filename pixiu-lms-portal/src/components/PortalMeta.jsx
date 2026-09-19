import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import CookieConsent from './CookieConsent'

const SITE = 'https://portal.pixiutech.com'
const SHARE_IMAGE = 'https://pixiutech.com/img/hero_lab.jpg'

const META = {
  '/privacy': {
    title: 'Privacy Policy | Pixiu Tech Portal',
    description: 'Privacy Policy for the Pixiu Tech Learning Management Portal and public certificate verification service.',
  },
  '/terms': {
    title: 'Terms & Conditions | Pixiu Tech Portal',
    description: 'Terms & Conditions for the Pixiu Tech Learning Management Portal and related services.',
  },
}

function upsertMeta(selector, attribute, key, content) {
  let node = document.head.querySelector(selector)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attribute, key)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

function upsertCanonical(href) {
  let node = document.head.querySelector('link[rel="canonical"]')
  if (!node) {
    node = document.createElement('link')
    node.rel = 'canonical'
    document.head.appendChild(node)
  }
  node.href = href
}

function upsertRobots(content) {
  let node = document.head.querySelector('meta[name="robots"]')
  if (!node) {
    node = document.createElement('meta')
    node.name = 'robots'
    document.head.appendChild(node)
  }
  node.content = content
}

export default function PortalMeta() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
    const meta = META[path] || {
      title: 'Pixiu Tech Learning Portal',
      description: 'Pixiu Tech Learning Management Portal for students, trainers, schools and administrators.',
    }
    const indexable = Boolean(META[path])
    const canonical = `${SITE}${indexable ? path : '/'}`

    document.title = meta.title
    upsertRobots(indexable ? 'index,follow' : 'noindex,nofollow')
    upsertMeta('meta[name="description"]', 'name', 'description', meta.description)
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', meta.title)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', meta.description)
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website')
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonical)
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', SHARE_IMAGE)
    upsertMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', 'Pixiu Tech school innovation lab')
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'Pixiu Tech')
    upsertMeta('meta[property="og:locale"]', 'property', 'og:locale', 'en_IN')
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title)
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description)
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', SHARE_IMAGE)
    upsertCanonical(canonical)
  }, [pathname])
  return <CookieConsent />
}