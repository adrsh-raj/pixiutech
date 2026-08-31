import { Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import Home from './pages/Home.jsx'
import Solutions from './pages/Solutions.jsx'
import Careers from './pages/Careers.jsx'
import Login from './pages/Login.jsx'
import Hub from './pages/Hub.jsx'
import PortalBridge from './pages/PortalBridge.jsx'
import Contact from './pages/Contact.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/portal" element={<PortalBridge />} />
          <Route path="/hub" element={<PortalBridge />} />
          <Route path="/login" element={<PortalBridge />} />
          <Route path="/contact" element={<Contact />} />
          {/* Redirects for deleted pages */}
          <Route path="/curriculum" element={<Navigate to="/solutions" replace />} />
          <Route path="/partnership" element={<Navigate to="/" replace />} />
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
