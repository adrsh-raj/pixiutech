import { useEffect, useRef, useState } from 'react'
import { CYCLE } from '../data/site.js'

// The five stages light up in order once the track scrolls into view —
// the sequence itself is the point, so it plays as a sequence.
export default function Cycle() {
  const ref = useRef(null)
  const [lit, setLit] = useState(-1)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) {
      setLit(CYCLE.length)
      return
    }
    const el = ref.current
    if (!el) return
    const timers = []
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          CYCLE.forEach((_, i) => timers.push(setTimeout(() => setLit(i + 1), i * 160)))
          io.disconnect()
        })
      },
      { threshold: 0.35 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="cycle" ref={ref}>
      <div className="cycle__track">
        {CYCLE.map((n, i) => (
          <div key={n.no} className={`node ${i < lit ? 'lit' : ''}`}>
            <span className="node__no">{n.no}</span>
            <div className="node__name">{n.name}</div>
            <p className="node__txt">{n.text}</p>
          </div>
        ))}
      </div>
      <p className="cycle__loop">
        <span style={{ fontSize: 14 }}>↺</span>
        <span>Improve feeds back into plan — the cycle repeats each term</span>
      </p>
    </div>
  )
}
