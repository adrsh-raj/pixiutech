import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../utils/analytics.js'

const SITE = 'https://www.pixiutech.com'
const DEFAULT_IMAGE = `${SITE}/img/hero_lab.jpg`

const CANONICAL_REDIRECTS = {
  '/hub': '/portal',
  '/curriculum': '/solutions',
  '/partnership': '/',
  '/about': '/',
}

const META = {
  '/': { title: 'Pixiu Tech | STEM, Robotics & AI Labs for Schools', description: 'Pixiu Tech helps schools plan, equip and run STEM, Robotics, AI and IoT programmes with labs, curriculum, instructors and ongoing support.', imageAlt: 'Pixiu Tech school innovation lab for STEM, Robotics and AI learning' },
  '/solutions': { title: 'School STEM, Robotics & AI Solutions | Pixiu Tech', description: 'Explore Pixiu Tech solutions for school Robotics, AI and Machine Learning, IoT, Drone Technology, Computational Design and custom innovation labs.', imageAlt: 'Pixiu Tech technology solutions for school innovation labs' },
  '/faq': { title: 'FAQs | STEM, Robotics & AI Labs for Schools | Pixiu Tech', description: 'Find answers about Pixiu Tech school innovation labs, hardware, curriculum, instructors, teacher training, board alignment and getting started.', imageAlt: 'Pixiu Tech school STEM and robotics programme' },
  '/portal': { title: 'Pixiu Tech Learning Portal', description: 'Access the Pixiu Tech Learning Portal for student learning, school operations, trainer workflows and programme progress.', imageAlt: 'Pixiu Tech Learning Portal' },
  '/verify': { title: 'Certificate Verification | Pixiu Tech', description: 'Verify an issued Pixiu Tech certificate using the credential ID printed on the certificate.', imageAlt: 'Pixiu Tech certificate verification' },
  '/careers': { title: 'Careers at Pixiu Tech', description: 'Explore current career opportunities at Pixiu Tech and submit a secure application with your PDF CV.', imageAlt: 'Careers at Pixiu Tech' },
  '/contact': { title: 'Contact Pixiu Tech | School Technology Solutions', description: 'Talk to Pixiu Tech about school Robotics, AI, IoT, Drone Technology, STEM labs, curriculum, instructors and implementation support.', imageAlt: 'Contact Pixiu Tech about school technology solutions' },
  '/simulation': { title: 'STEM Simulations | Pixiu Tech', description: 'Explore interactive STEM and technology simulations from Pixiu Tech.', imageAlt: 'Pixiu Tech STEM simulation experience' },
  '/privacy': { title: 'Privacy Policy | Pixiu Tech', description: 'Read the Pixiu Tech Privacy Policy covering the website, certificate verification and Learning Management Portal.', imageAlt: 'Pixiu Tech privacy policy' },
  '/terms': { title: 'Terms & Conditions | Pixiu Tech', description: 'Read the Pixiu Tech Terms & Conditions for use of the website, certificate verification service and Learning Management Portal.', imageAlt: 'Pixiu Tech terms and conditions' },
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

export default function SiteMeta() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
    const meta = META[path] || { title: 'Page Not Found | Pixiu Tech', description: 'The requested Pixiu Tech page could not be found.', imageAlt: 'Pixiu Tech' }
    const canonicalPath = META[path] ? path : (CANONICAL_REDIRECTS[path] || '')
    const canonical = `${SITE}${canonicalPath}`
    document.title = meta.title
    upsertRobots(META[path] ? 'index,follow' : 'noindex,nofollow')
    upsertMeta('meta[name="description"]', 'name', 'description', meta.description)
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', meta.title)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', meta.description)
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website')
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonical)
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', DEFAULT_IMAGE)
    upsertMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', meta.imageAlt)
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'Pixiu Tech')
    upsertMeta('meta[property="og:locale"]', 'property', 'og:locale', 'en_IN')
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title)
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description)
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', DEFAULT_IMAGE)
    upsertCanonical(canonical)
    trackPageView(path)
  }, [pathname])
  return null
}
export { META }