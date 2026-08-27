import { useState, useEffect, useRef } from 'react'

export default function CountUp({ text, duration = 2000 }) {
  const [count, setCount] = useState('0')
  const [suffix, setSuffix] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    // Check if the user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const match = text.match(/(\d+)(.*)/)
    if (!match || prefersReducedMotion) {
      setCount(text)
      return
    }
    
    const target = parseInt(match[1], 10)
    const suf = match[2] || ''
    setSuffix(suf)

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          let start = null
          const step = (timestamp) => {
            if (!start) start = timestamp
            const progress = Math.min((timestamp - start) / duration, 1)
            // easeOut expo for a nice fast start and slow finish
            const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
            
            setCount(Math.floor(easeOut * target).toString())
            
            if (progress < 1) {
              window.requestAnimationFrame(step)
            } else {
              setCount(target.toString())
            }
          }
          window.requestAnimationFrame(step)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (ref.current) observer.observe(ref.current)

    return () => observer.disconnect()
  }, [text, duration])

  // If text is not a number string, fallback to just rendering text
  if (!text.match(/(\d+)(.*)/)) {
    return <span>{text}</span>
  }

  return (
    <span ref={ref}>
      {count}{suffix}
    </span>
  )
}
