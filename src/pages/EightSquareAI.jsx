import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LMS_LOGIN_URL } from '../config/runtime.js'
import '../styles/eight-square-ai.css'

// Dots field: on hover, dots flow into an infinity (∞) shape — the "8" of 8 Square.
function InfinityDots() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const host = canvas.parentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let dots = []
    let w = 0
    let h = 0
    let raf = 0
    let morph = false
    const pointer = { x: -9999, y: -9999 }

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = host.clientWidth
      h = host.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const gap = w < 640 ? 20 : 24
      dots = []
      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          dots.push({ hx: x, hy: y, x, y, tx: x, ty: y, inf: false, hue: Math.random() })
        }
      }
      // Assign every 2nd dot a slot on the lemniscate (infinity curve).
      const pick = dots.filter((_, i) => i % 2 === 0)
      const cx = w / 2
      const cy = h * 0.5
      const a = Math.min(w * 0.2, h * 0.32)
      pick.forEach((d, i) => {
        const t = ((i * 0.618034) % 1) * Math.PI * 2
        const s = Math.sin(t)
        const k = 1 + s * s
        const jitter = (Math.random() - 0.5) * 2.5
        d.ix = cx + (a * Math.cos(t)) / k + jitter
        d.iy = cy + (a * s * Math.cos(t)) / k + jitter
        d.inf = true
      })
    }

    const frame = () => {
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        const goInf = morph && d.inf
        d.tx = goInf ? d.ix : d.hx
        d.ty = goInf ? d.iy : d.hy
        const dx = d.x - pointer.x
        const dy = d.y - pointer.y
        const dist = Math.hypot(dx, dy)
        if (!goInf && dist < 90) {
          const f = (90 - dist) / 90
          d.tx += (dx / (dist || 1)) * f * 18
          d.ty += (dy / (dist || 1)) * f * 18
        }
        d.x += (d.tx - d.x) * (goInf ? 0.06 : 0.12)
        d.y += (d.ty - d.y) * (goInf ? 0.06 : 0.12)
        const glow = goInf ? 1 : Math.max(0.18, 1 - dist / 220)
        const r = goInf ? 1.4 : 1.2 + (glow > 0.3 ? glow : 0)
        ctx.fillStyle = goInf
          ? `hsla(${180 + d.hue * 60}, 100%, 68%, 0.4)`
          : `hsla(${200 + d.hue * 30}, 90%, 70%, ${glow * (morph ? 0.18 : 0.6)})`
        ctx.beginPath()
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(frame)
    }

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }
    const onEnter = () => { morph = true }
    const onLeave = () => { morph = false; pointer.x = -9999; pointer.y = -9999 }

    build()
    if (reduce) {
      morph = true
      dots.forEach((d) => { if (d.inf) { d.x = d.ix; d.y = d.iy } })
      frame()
      cancelAnimationFrame(raf)
    } else {
      frame()
    }
    window.addEventListener('resize', build)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerenter', onEnter)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('touchstart', onEnter, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', build)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerenter', onEnter)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('touchstart', onEnter)
    }
  }, [])

  return <canvas ref={canvasRef} className="esq-dots" aria-hidden="true" />
}

function Logo({ className = '' }) {
  return (
    <img className={`esq-logo ${className}`} src="/img/8square-logo.svg" alt="8 Square AI" width="320" height="96" />
  )
}

const LAB_FEATURES = [
  { t: 'Real-time Circuit Solver', d: 'Every wire you place is solved live using Kirchhoff\u2019s current and voltage laws, so node voltages and branch currents behave like real hardware.' },
  { t: 'Instrument-grade Measurement', d: 'A virtual multimeter and oscilloscope sample signals over time, so students read RMS values, frequency, duty cycle and noise, not just on/off.' },
  { t: 'Embedded Firmware Runtime', d: 'Block code and text code run on a simulated microcontroller with timers, PWM, ADC and interrupts, exposing how firmware actually drives hardware.' },
  { t: 'Sensors, Signals & IoT', d: 'Model analog sensors, debounce inputs, filter noisy readings and push data over a virtual network to a live web dashboard.' },
  { t: 'AI Studio', d: 'Collect a dataset from the camera, train a model, then inspect accuracy, confidence and misclassifications to understand how machines learn.' },
  { t: 'Circuit Doctor', d: 'Continuously checks for shorts, floating inputs, reverse polarity and overcurrent, and explains the physics of why a design fails.' },
  { t: 'Guided Engineering Lessons', d: 'Structured lessons and project templates progress from fundamentals to complete systems such as automation, robotics and smart devices.' },
  { t: 'Progress, XP & Badges', d: 'Every build, measurement and fix is recorded, giving students momentum and trainers a clear picture of mastery.' },
]

const SCIENCE = [
  { q: 'Why does this motor stall at startup?', a: 'Explains stall current, back-EMF and why a driver transistor and flyback diode are needed, then shows the current spike on the oscilloscope.' },
  { q: 'Why is my sensor reading jumping around?', a: 'Walks through ADC resolution, sampling rate and electrical noise, and helps the student design a moving-average or RC filter.' },
  { q: 'How does PWM control brightness or speed?', a: 'Connects duty cycle to average voltage and power, and lets the student measure the waveform to prove it.' },
  { q: 'Why did my AI model confuse two objects?', a: 'Uses the confusion matrix and dataset balance to show bias, overfitting and how better data improves results.' },
]

export default function EightSquareAI() {
  return (
    <div className="esq-page">
      <section className="esq-hero">
        <InfinityDots />
        <div className="shell esq-hero__copy">
          <span className="esq-chip"><span className="esq-chip__pulse" /> Launching soon</span>
          <Logo className="esq-logo--hero" />
          <h1>Engineering, <span>understood.</span></h1>
          <p className="esq-lede">8 Square is an engineering intelligence designed and developed in-house by the Pixiu Tech team. It sits inside our Virtual Lab and helps students understand the science behind every circuit, while giving trainers real-time insight into how each learner thinks.</p>
          <div className="esq-actions">
            <Link className="btn btn--primary btn--lg" to="/virtual-lab">Explore the Virtual Lab <span className="arw">→</span></Link>
            <Link className="btn btn--ghost-light" to="/contact#demo-form">Get early access</Link>
          </div>
          <p className="esq-hint">Hover the dots ∞</p>
        </div>
      </section>

      <section className="esq-band">
        <div className="shell">
          <p className="esq-eyebrow">Who it helps</p>
          <h2 className="esq-h2">One AI. Two sides of the classroom.</h2>
          <div className="esq-split">
            <article className="esq-card">
              <h3>For Students</h3>
              <ul>
                <li>Socratic, step-by-step guidance that builds reasoning instead of handing out answers.</li>
                <li>Explains the science behind each result: Ohm&apos;s law, power, signals, timing and data.</li>
                <li>Connects classroom theory to real engineering decisions and trade-offs.</li>
                <li>Recommends the next challenge to stretch creativity and problem-solving.</li>
                <li>Practise anytime, anywhere, without waiting for a physical kit.</li>
              </ul>
            </article>
            <article className="esq-card">
              <h3>For Trainers</h3>
              <ul>
                <li>Live view of where each learner is stuck and the concept behind it.</li>
                <li>Auto-generated lesson plans, viva questions and project briefs.</li>
                <li>Common design errors flagged before they waste lab time.</li>
                <li>Mastery reports built from real builds, measurements and fixes.</li>
                <li>More time mentoring, less time debugging wiring.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="esq-band esq-band--alt">
        <div className="shell esq-about">
          <div>
            <p className="esq-eyebrow">Built by Pixiu Tech</p>
            <h2 className="esq-h2">Designed in-house, for Indian classrooms.</h2>
          </div>
          <div className="esq-about__body">
            <p>8 Square has been dedicatedly developed by the Pixiu Tech engineering and curriculum team, the same people who set up school innovation labs and teach weekly sessions on the ground. Every capability comes from real classroom questions our trainers hear every day.</p>
            <p>It is trained around our own Robotics, AI, IoT and electronics curriculum, aligned to CBSE, ICSE and State boards, and tightly integrated with the Pixiu Virtual Lab and Learning Portal, so guidance is always grounded in what the student is actually building.</p>
            <div className="esq-stats">
              <div><strong>In-house</strong><span>Engineering &amp; AI</span></div>
              <div><strong>Curriculum</strong><span>Mapped to boards</span></div>
              <div><strong>Lab-native</strong><span>Sees the live circuit</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="esq-band">
        <div className="shell">
          <p className="esq-eyebrow">The science behind the build</p>
          <h2 className="esq-h2">Questions real engineers ask. Answered with reasoning.</h2>
          <div className="esq-qa">
            {SCIENCE.map((x) => (
              <article className="esq-card" key={x.q}>
                <h3>{x.q}</h3>
                <p>{x.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="esq-band esq-band--alt">
        <div className="shell">
          <p className="esq-eyebrow">Inside the Virtual Lab</p>
          <h2 className="esq-h2">A complete engineering lab, with 8 Square inside.</h2>
          <div className="esq-grid">
            {LAB_FEATURES.map((f) => (
              <article className="esq-feature" key={f.t}>
                <span className="esq-feature__dot" aria-hidden="true" />
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="esq-band esq-cta">
        <div className="shell esq-cta__inner">
          <Logo />
          <h2 className="esq-h2">Be first in line when 8 Square goes live.</h2>
          <div className="esq-actions">
            <Link className="btn btn--primary btn--lg" to="/contact#demo-form">Talk to Pixiu Tech <span className="arw">→</span></Link>
            <a className="btn btn--ghost-light" href={LMS_LOGIN_URL}>Student Login</a>
          </div>
        </div>
      </section>
    </div>
  )
}
