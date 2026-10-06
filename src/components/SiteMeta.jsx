import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../utils/analytics.js'

const SITE = 'https://www.pixiutech.com'
const DEFAULT_IMAGE = SITE + '/img/zenith/zenith_lab_setup.webp'
const CANONICAL_REDIRECTS = { '/hub': '/portal', '/curriculum': '/solutions', '/partnership': '/contact' }

const META = {
  '/': { title: 'Pixiu Tech | School Innovation Labs, STEM, Robotics & AI', description: 'Pixiu Tech connects school labs, curriculum, instructors and digital tools into practical STEM, Robotics, AI, IoT and innovation programmes.' },
  '/solutions': { title: 'What We Do | School STEM, Robotics, AI & Innovation | Pixiu Tech', description: 'Explore Pixiu Tech capabilities across Robotics, AI & data, IoT, design, drones and custom school programmes.' },
  '/about': { title: 'Who We Are | Pixiu Tech', description: 'Meet the thinking behind Pixiu Tech: practical school technology programmes designed around curriculum, hardware, people and software.' },
  '/work': { title: 'Proof of Work | Pixiu Tech', description: 'See a real Pixiu Tech school implementation: the room, the people and the student builds.' },
  '/faq': { title: 'FAQs | Pixiu Tech', description: 'Practical answers about Pixiu Tech school labs, curriculum, instructors, technology domains and implementation.' },
  '/portal': { title: 'School Portal | Pixiu Tech', description: 'Enter the Pixiu Tech school portal for student missions, simulation and programme workflows.' },
  '/verify': { title: 'Certificate Verification | Pixiu Tech', description: 'Verify an issued Pixiu Tech credential through the official certificate registry.' },
  '/careers': { title: 'Careers | Pixiu Tech', description: 'Explore current roles at Pixiu Tech for people who enjoy building, teaching and improving practical technology programmes.' },
  '/contact': { title: 'Talk to Pixiu Tech | School Innovation Programmes', description: 'Start a conversation about your school lab, curriculum, instructors, technology requirements and programme goals.' },
  '/simulation': { title: 'Virtual Circuit Simulation | Pixiu Tech', description: 'Access the Pixiu Tech browser-based circuit simulation experience.' },
  '/privacy': { title: 'Privacy Policy | Pixiu Tech', description: 'Read the Pixiu Tech Privacy Policy.' },
  '/terms': { title: 'Terms & Conditions | Pixiu Tech', description: 'Read the Pixiu Tech Terms & Conditions.' },
}

function upsertMeta(selector, attribute, key, content) {
  let node = document.head.querySelector(selector)
  if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, key); document.head.appendChild(node) }
  node.setAttribute('content', content)
}

function upsertCanonical(href) {
  let node = document.head.querySelector('link[rel="canonical"]')
  if (!node) { node = document.createElement('link'); node.rel = 'canonical'; document.head.appendChild(node) }
  node.href = href
}

export default function SiteMeta() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
    const meta = META[path] || { title: 'Page Not Found | Pixiu Tech', description: 'The requested Pixiu Tech page could not be found.' }
    const canonicalPath = META[path] ? path : (CANONICAL_REDIRECTS[path] || '')
    const canonical = SITE + canonicalPath
    document.title = meta.title
    upsertMeta('meta[name="description"]', 'name', 'description', meta.description)
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', meta.title)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', meta.description)
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonical)
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', DEFAULT_IMAGE)
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title)
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description)
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', DEFAULT_IMAGE)
    upsertCanonical(canonical)
    const robots = document.head.querySelector('meta[name="robots"]')
    if (robots) robots.content = META[path] ? 'index,follow' : 'noindex,nofollow'
    trackPageView(path)
  }, [pathname])
  return null
}
export { META }
