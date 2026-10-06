import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import SiteMeta from './components/SiteMeta.jsx'
import { LMS_LOGIN_URL } from './config/runtime.js'
import CookieConsent from './components/CookieConsent.jsx'

const Home = lazy(() => import('./pages/Home.jsx'))
const Solutions = lazy(() => import('./pages/Solutions.jsx'))
const About = lazy(() => import('./pages/About.jsx'))
const Work = lazy(() => import('./pages/Work.jsx'))
const Careers = lazy(() => import('./pages/Careers.jsx'))
const FAQ = lazy(() => import('./pages/FAQ.jsx'))
const PortalBridge = lazy(() => import('./pages/PortalBridge.jsx'))
const Contact = lazy(() => import('./pages/Contact.jsx'))
const Simulation = lazy(() => import('./pages/Simulation.jsx'))
const Verify = lazy(() => import('./pages/Verify.jsx'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'))
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

function ProductionLoginRedirect() {
  useEffect(() => {
    window.location.replace(LMS_LOGIN_URL)
  }, [])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <SiteMeta />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Nav />
      <main id="main-content" tabIndex={-1}>
        <Suspense fallback={<div className="route-loading" role="status" aria-live="polite">Loading page…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/about" element={<About />} />
            <Route path="/work" element={<Work />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/portal" element={<PortalBridge />} />
            <Route path="/hub" element={<Navigate to="/portal" replace />} />
            <Route path="/login" element={<ProductionLoginRedirect />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/curriculum" element={<Navigate to="/solutions#programme" replace />} />
            <Route path="/partnership" element={<Navigate to="/contact?intent=proposal#demo-form" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <CookieConsent />
    </>
  )
}
