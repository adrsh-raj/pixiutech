import { useState, useEffect } from 'react'

export default function CountUp({ text, duration = 1500 }) {
  const [count, setCount] = useState('0')
  const [suffix, setSuffix] = useState('')

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const match = text.match(/(\d+)(.*)/)
    if (!match || prefersReducedMotion) {
      setCount(text)
      return
    }

    const target = parseInt(match[1], 10)
    const suf = match[2] || ''
    setSuffix(suf)

    let start = null
    let frameId
    const step = (timestamp) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setCount(Math.floor(easeOut * target).toString())

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step)
      } else {
        setCount(target.toString())
      }
    }
    frameId = window.requestAnimationFrame(step)

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
    }
  }, [text, duration])

  if (!text.match(/(\d+)(.*)/)) {
    return <span>{text}</span>
  }

  return (
    <span>
      {count}{suffix}
    </span>
  )
}
