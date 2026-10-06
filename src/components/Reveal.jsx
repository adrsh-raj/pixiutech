import { useEffect, useRef, useState } from 'react'

export default function Reveal({ children, className = '', delay = 0, ...rest }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={'reveal ' + (visible ? 'reveal--visible ' : '') + className}
      style={{ '--reveal-delay': String(delay) + 'ms' }}
      {...rest}
    >
      {children}
    </div>
  )
}
