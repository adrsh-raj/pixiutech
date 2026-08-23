import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Route changes should land at the top of the new page, not mid-scroll.
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
