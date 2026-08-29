import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Route changes should land at the top of the new page, not mid-scroll.
// Exception: if there's a hash (#robotics etc.), let the page handle scrolling to it.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])
  return null
}
