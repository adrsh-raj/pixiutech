import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const TITLES = {
  '/': 'Pixiu Tech | STEM, Robotics & AI Labs for Schools',
  '/solutions': 'School STEM, Robotics & AI Solutions | Pixiu Tech',
  '/faq': 'FAQs | STEM, Robotics & AI Labs for Schools | Pixiu Tech',
  '/portal': 'Pixiu Tech Learning Portal',
  '/verify': 'Certificate Verification | Pixiu Tech',
  '/careers': 'Careers at Pixiu Tech',
  '/contact': 'Contact Pixiu Tech | School Technology Solutions',
  '/simulation': 'STEM Simulations | Pixiu Tech',
  '/privacy': 'Privacy Policy | Pixiu Tech',
  '/terms': 'Terms & Conditions | Pixiu Tech',
}

export default function SiteTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
    document.title = TITLES[path] || 'Page Not Found | Pixiu Tech'
  }, [pathname])

  return null
}
