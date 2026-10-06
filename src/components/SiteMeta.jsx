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
  '/': { title: 'Pixiu Tech | School STEM, Robotics, AI Labs & Virtual CyberLab Solutions', description: 'Pixiu Tech delivers turnkey school STEM lab solutions, Robotics & AI curriculum, hands-on physical computing, and virtual CyberLabs for schools across India.', imageAlt: 'Pixiu Tech school innovation lab for STEM, Robotics and AI learning' },
  '/solutions': { title: 'School STEM, Robotics, AI, IoT & Virtual Lab Solutions | Pixiu Tech', description: 'Explore Pixiu Tech turnkey solutions for school Robotics, AI and Machine Learning, IoT, Drone Technology, Computational Design and custom innovation labs.', imageAlt: 'Pixiu Tech technology solutions for school innovation labs' },
  '/faq': { title: 'FAQs | STEM, Robotics & AI Labs for Schools | Pixiu Tech', description: 'Find answers about Pixiu Tech school innovation labs, hardware, curriculum, instructors, teacher training, board alignment and getting started.', imageAlt: 'Pixiu Tech school STEM and robotics programme' },
  '/portal': { title: 'Pixiu Tech Learning Portal | Student & Teacher Hub', description: 'Access the Pixiu Tech Learning Portal for student learning, school operations, trainer workflows and programme progress.', imageAlt: 'Pixiu Tech Learning Portal' },
  '/verify': { title: 'Official Certificate Verification | Pixiu Tech Registry', description: 'Verify an issued Pixiu Tech credential and view official student course completion records.', imageAlt: 'Pixiu Tech certificate verification' },
  '/careers': { title: 'Careers at Pixiu Tech | STEM & Robotics Instructors', description: 'Explore career opportunities at Pixiu Tech for robotics trainers, STEM educators, and technology curriculum engineers.', imageAlt: 'Careers at Pixiu Tech' },
  '/contact': { title: 'Set Up a School Robotics & AI Lab | Contact Pixiu Tech', description: 'Talk to Pixiu Tech about school Robotics, AI, IoT, Drone Technology, STEM labs, curriculum, instructors and implementation support.', imageAlt: 'Contact Pixiu Tech about school technology solutions' },
  '/simulation': { title: 'Virtual CyberLab & Circuit Simulator | Pixiu Tech', description: 'Explore Pixiu Tech Virtual CyberLab: browser-based circuit simulation, Blockly coding, and IoT testing for students.', imageAlt: 'Pixiu Tech STEM simulation experience' },
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