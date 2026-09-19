import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import Home from './pages/Home.jsx'
import Solutions from './pages/Solutions.jsx'
import Careers from './pages/Careers.jsx'
import FAQ from './pages/FAQ.jsx'
import PortalBridge from './pages/PortalBridge.jsx'
import Contact from './pages/Contact.jsx'
import Simulation from './pages/Simulation.jsx'
import Verify from './pages/Verify.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import SiteMeta from './components/SiteMeta.jsx'
import TermsAndConditions from './pages/TermsAndConditions.jsx'
import NotFound from './pages/NotFound.jsx'
import { LMS_LOGIN_URL } from './config/runtime.js'
import CookieConsent from './components/CookieConsent.jsx'

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/portal" element={<PortalBridge />} />
          <Route path="/hub" element={<PortalBridge />} />
          <Route path="/login" element={<ProductionLoginRedirect />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/curriculum" element={<Navigate to="/solutions" replace />} />
          <Route path="/partnership" element={<Navigate to="/" replace />} />
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <CookieConsent />
    </>
  )
}
