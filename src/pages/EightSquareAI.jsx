import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LMS_LOGIN_URL } from '../config/runtime.js'
import '../styles/eight-square-aconst PREVIEW_CASES = {
  led: {
    id: 'led',
    tabLabel: 'Circuit fault',
    kind: 'led',
    snapshotTitle: 'LED circuit',
    question: 'Why isn’t my LED turning on?',
    status: ['Reading your circuit…', 'Checking polarity…', 'Preparing a repair hint…'],
    answer: 'The sample has a 5 V supply and a 220 Ω series resistor, but the LED is reversed: its cathode faces the positive side. Flip it so the anode faces the resistor and the cathode returns to GND. Then run the circuit again; if it still stays dark, check the breadboard row and resistor connection.',
    formula: 'Current path: +5 V → 220 Ω → LED anode → cathode → GND',
    observation: 'Sample finding: LED polarity is reversed.',
    readouts: [
      { label: 'Supply', value: '5.0 V' },
      { label: 'Series resistor', value: '220 Ω' },
      { label: 'LED polarity', value: 'Reversed', alert: true },
    ],
  },
  physics: {
    id: 'physics',
    tabLabel: 'Physics',
    kind: 'physics',
    snapshotTitle: 'Motion experiment',
    question: 'A cart travels 0.80 m in 0.80 s from rest. What is its acceleration?',
    status: ['Reading the measurements…', 'Choosing the equation…', 'Checking the units…'],
    answer: 'Assuming uniform acceleration, use s = ut + ½at². Since u = 0, a = 2s/t² = 2 × 0.80 m / (0.80 s)² = 2.50 m/s². Then v = u + at = 2.00 m/s. Check: average velocity is 1.00 m/s, so 1.00 × 0.80 s = 0.80 m. If acceleration varies, start and end measurements alone cannot prove this value.',
    formula: 's = ut + ½at²\nu = 0 m/s,  s = 0.80 m,  t = 0.80 s\na = 2s/t² = 2.50 m/s²',
    observation: 'Model assumption: acceleration stays constant during the run.',
    readouts: [
      { label: 'Displacement', value: '0.80 m' },
      { label: 'Elapsed time', value: '0.80 s' },
      { label: 'Initial velocity', value: '0 m/s' },
      { label: 'Model', value: 'Constant a', alert: true },
    ],
  },
  arduino: {
    id: 'arduino',
    tabLabel: 'Arduino PWM',
    kind: 'arduino',
    snapshotTitle: 'Uno R3 · LED on D9',
    question: 'Why does analogWrite(9, 128) dim my LED? Is D9 outputting 2.5 V?',
    status: ['Reading the sketch…', 'Checking PWM timing…', 'Calculating LED current…'],
    answer: 'No: D9 switches between LOW and HIGH; it does not hold a steady 2.5 V. On an Uno R3, analogWrite uses a 0–255 duty value and D9 runs at about 490 Hz. At 128, the duty is 128/255 = 50.2% (about 1.02 ms HIGH in each 2.04 ms cycle). With a red LED assumed to drop 2.0 V and a 220 Ω resistor, the ON current is about 13.6 mA and the time-averaged current about 6.8 mA. Wire D9 → resistor → LED anode; cathode → GND. A motor needs a driver and flyback protection, not a direct pin connection.',
    formula: 'Duty = 128/255 = 50.2%\nI_ON ≈ (5.0 − 2.0) V / 220 Ω = 13.6 mA\nI_AVG ≈ 0.502 × 13.6 mA = 6.8 mA',
    code: 'const byte ledPin = 9;\\n\\nvoid setup() {\\n  pinMode(ledPin, OUTPUT);\\n}\\n\\nvoid loop() {\\n  analogWrite(ledPin, 128);\\n}',
    observation: 'D9 carries PWM pulses. The 220 Ω resistor limits LED current.',
    readouts: [
      { label: 'PWM pin', value: 'D9 · ~490 Hz' },
      { label: 'Duty command', value: '128 / 255' },
      { label: 'LED + resistor', value: 'Red · 220 Ω' },
      { label: 'Signal', value: '0–5 V pulses', alert: true },
    ],
  },
}

const PREVIEW_STEPS = ['Read the sample', 'Check the model', 'Explain the result']

function SquareMark({ small = false }) {
  return (
    <span className={small ? 'esq-mark esq-mark--small' : 'esq-mark'} aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
    </span>
  )
}

function InteractiveDotField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const hero = canvas?.parentElement
    const context = canvas?.getContext('2d')
    if (!canvas || !hero || !context) return undefined

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer: fine)').matches
    const spacing = 34
    const pointerRadius = 190
    const points = []
    let width = 0
    let height = 0
    let ratio = 1
    let pointerX = -1000
    let pointerY = -1000
    let pointerActive = false
    let lastPointerMove = 0
    let frame = 0

    const resize = () => {
      width = hero.clientWidth
      height = hero.clientHeight
      ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      points.length = 0
      for (let y = 16; y < height; y += spacing) {
        for (let x = 16; x < width; x += spacing) {
          points.push({ x, y, drawX: x, drawY: y })
        }
      }
      if (!frame) frame = window.requestAnimationFrame(draw)
    }

    const draw = (time = 0) => {
      frame = 0
      context.clearRect(0, 0, width, height)
      if (pointerActive && finePointer && !reducedMotion) {
        const glow = context.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, pointerRadius)
        glow.addColorStop(0, 'rgba(48, 137, 207, 0.10)')
        glow.addColorStop(1, 'rgba(48, 137, 207, 0)')
        context.fillStyle = glow
        context.fillRect(0, 0, width, height)
      }

      let settling = false
      for (const point of points) {
        const dx = pointerX - point.x
        const dy = pointerY - point.y
        const distance = Math.hypot(dx, dy)
        const influence = pointerActive && finePointer && !reducedMotion && distance < pointerRadius
          ? Math.pow(1 - distance / pointerRadius, 2)
          : 0
        const shift = influence * 11
        const targetX = point.x + (distance ? dx / distance * shift : 0)
        const targetY = point.y + (distance ? dy / distance * shift : 0)
        point.drawX += (targetX - point.drawX) * 0.18
        point.drawY += (targetY - point.drawY) * 0.18
        if (Math.abs(targetX - point.drawX) > 0.15 || Math.abs(targetY - point.drawY) > 0.15) settling = true

        context.beginPath()
        context.fillStyle = 'rgba(146, 191, 225, ' + (0.14 + influence * 0.52) + ')'
        context.arc(point.drawX, point.drawY, 1.05 + influence * 1.05, 0, Math.PI * 2)
        context.fill()

        if (influence > 0.58 && distance < 88) {
          context.beginPath()
          context.moveTo(point.drawX, point.drawY)
          context.lineTo(pointerX, pointerY)
          context.strokeStyle = 'rgba(93, 181, 232, ' + influence * 0.10 + ')'
          context.lineWidth = 0.7
          context.stroke()
        }
      }

      if ((pointerActive && time - lastPointerMove < 180) || settling) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const onPointerMove = (event) => {
      const bounds = hero.getBoundingClientRect()
      pointerX = event.clientX - bounds.left
      pointerY = event.clientY - bounds.top
      pointerActive = true
      lastPointerMove = performance.now()
      if (!frame) frame = window.requestAnimationFrame(draw)
    }

    const onPointerLeave = () => {
      pointerActive = false
      if (!frame) frame = window.requestAnimationFrame(draw)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(hero)
    hero.addEventListener('pointermove', onPointerMove, { passive: true })
    hero.addEventListener('pointerleave', onPointerLeave)
    resize()

    return () => {
      observer.disconnect()
      hero.removeEventListener('pointermove', onPointerMove)
      hero.removeEventListener('pointerleave', onPointerLeave)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return <canvas ref={canvasRef} className="esq-dot-field" aria-hidden="true" />
}

function LedDiagram({ stageIndex }) {
  return (
    <svg className="esq-circuit__svg" viewBox="0 0 260 150" role="img" aria-labelledby="esq-circuit-title">
      <title id="esq-circuit-title">Sample circuit with a 5 volt supply, a 220 ohm resistor, and an LED</title>
      <path className="esq-circuit__wire" d="M57 60H69M127 60H151M195 60H227V126H57V94" />
      <rect className="esq-circuit__supply" x="13" y="43" width="44" height="52" rx="8" />
      <text className="esq-circuit__label" x="35" y="63" textAnchor="middle">5 V</text>
      <text className="esq-circuit__micro" x="35" y="78" textAnchor="middle">SUPPLY</text>
      <text className="esq-circuit__terminal" x="57" y="52" textAnchor="middle">+</text>
      <text className="esq-circuit__terminal" x="57" y="108" textAnchor="middle">−</text>
      <rect className="esq-circuit__resistor" x="69" y="47" width="58" height="26" rx="6" />
      <text className="esq-circuit__label" x="98" y="64" textAnchor="middle">220 Ω</text>
      <circle className={stageIndex >= 1 ? 'esq-circuit__led-ring is-checked' : 'esq-circuit__led-ring'} cx="173" cy="60" r="18" />
      <circle className={stageIndex >= 1 ? 'esq-circuit__led-core is-checked' : 'esq-circuit__led-core'} cx="173" cy="60" r="7" />
      <text className="esq-circuit__micro" x="173" y="98" textAnchor="middle">LED</text>
      <text className="esq-circuit__ground" x="227" y="140" textAnchor="middle">GND</text>
      <circle className="esq-circuit__node" cx="57" cy="60" r="3" />
      <circle className="esq-circuit__node" cx="227" cy="126" r="3" />
    </svg>
  )
}

function PhysicsDiagram() {
  return (
    <svg className="esq-circuit__svg esq-physics-diagram" viewBox="0 0 260 150" role="img" aria-labelledby="esq-physics-title">
      <title id="esq-physics-title">Position versus time sample for a cart moving 0.80 metres in 0.80 seconds from rest</title>
      <path className="esq-physics__grid" d="M37 28V120H235M37 90H235M37 60H235" />
      <path className="esq-physics__curve" d="M38 119 Q86 115 130 91 T228 36" />
      <circle className="esq-physics__point" cx="38" cy="119" r="3" />
      <circle className="esq-physics__point" cx="130" cy="91" r="3" />
      <circle className="esq-physics__point" cx="228" cy="36" r="4" />
      <text className="esq-circuit__micro" x="38" y="137" textAnchor="middle">0 s</text>
      <text className="esq-circuit__micro" x="228" y="137" textAnchor="middle">0.80 s</text>
      <text className="esq-circuit__micro" x="216" y="25" textAnchor="end">0.80 m</text>
      <text className="esq-circuit__micro" x="18" y="34">s(t)</text>
      <text className="esq-circuit__micro" x="221" y="148">TIME</text>
    </svg>
  )
}

function ArduinoDiagram() {
  return (
    <svg className="esq-circuit__svg esq-arduino-diagram" viewBox="0 0 260 150" role="img" aria-labelledby="esq-arduino-title">
      <title id="esq-arduino-title">Arduino Uno R3 pin D9 PWM output, about 490 hertz at 50 percent duty cycle</title>
      <text className="esq-circuit__micro" x="20" y="25">UNO R3 · D9 PWM</text>
      <path className="esq-arduino__trace" d="M30 112V48H78V112H126V48H174V112H222V48H240" />
      <text className="esq-circuit__micro" x="18" y="46">5 V</text>
      <text className="esq-circuit__micro" x="18" y="116">0 V</text>
      <path className="esq-arduino__measure" d="M30 130H78M78 130H126M126 130H174" />
      <text className="esq-circuit__micro" x="150" y="145" textAnchor="middle">≈490 Hz · ≈50% duty</text>
    </svg>
  )
}

function CircuitChatPreview() {
  const [selectedCase, setSelectedCase] = useState('led')
  const [phase, setPhase] = useState('reading')
  const [answer, setAnswer] = useState('')
  const [run, setRun] = useState(0)
  const activeCase = PREVIEW_CASES[selectedCase]

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('done')
      setAnswer(activeCase.answer)
      return undefined
    }
    setPhase('reading')
    setAnswer('')
    const timers = []
    timers.push(window.setTimeout(() => setPhase('checking'), 1000))
    timers.push(window.setTimeout(() => setPhase('preparing'), 2050))
    timers.push(window.setTimeout(() => {
      setPhase('typing')
      let index = 0
      const interval = window.setInterval(() => {
        index = Math.min(index + 5, activeCase.answer.length)
        setAnswer(activeCase.answer.slice(0, index))
        if (index >= activeCase.answer.length) {
          window.clearInterval(interval)
          setPhase('done')
        }
      }, 22)
      timers.push(interval)
    }, 2850))
    return () => timers.forEach((timer) => {
      window.clearTimeout(timer)
      window.clearInterval(timer)
    })
  }, [run, selectedCase])

  const stageIndex = phase === 'reading' ? 0 : phase === 'checking' ? 1 : phase === 'done' ? 3 : 2
  const phaseLabel = phase === 'reading'
    ? activeCase.status[0]
    : phase === 'checking'
      ? activeCase.status[1]
      : phase === 'preparing'
        ? activeCase.status[2]
        : phase === 'typing'
          ? 'Writing a worked answer…'
          : 'Explanation ready'

  const renderDiagram = () => {
    if (activeCase.kind === 'physics') return <PhysicsDiagram />
    if (activeCase.kind === 'arduino') return <ArduinoDiagram />
    return <LedDiagram stageIndex={stageIndex} />
  }

  return (
    <section className="esq-demo" aria-label="Interactive 8 Square AI sample preview">
      <header className="esq-demo__top">
        <div className="esq-demo__brand"><SquareMark small /><div><strong>8 Square</strong><span>AI learning guide</span></div></div>
        <span className="esq-demo__badge"><i /> Guided preview</span>
      </header>
      <div className="esq-demo__samples" role="group" aria-label="Choose a worked sample">
        {Object.values(PREVIEW_CASES).map((sample, index) => (
          <button
            className={selectedCase === sample.id ? 'esq-demo__sample is-active' : 'esq-demo__sample'}
            type="button"
            aria-pressed={selectedCase === sample.id}
            onClick={() => setSelectedCase(sample.id)}
            key={sample.id}
          >
            <span>0{index + 1}</span>{sample.tabLabel}
          </button>
        ))}
      </div>
      <div className="esq-demo__columns">
        <div className="esq-circuit">
          <div className="esq-demo__section-head"><span>LAB SNAPSHOT</span><strong>{activeCase.snapshotTitle}</strong></div>
          <div className="esq-circuit__board">{renderDiagram()}</div>
          <div className="esq-readouts">
            {activeCase.readouts.map((item) => (
              <div
                className={item.alert ? 'esq-readouts__alert' + (phase === 'done' ? ' is-active' : '') : ''}
                key={item.label}
              >
                <span>{item.label}</span><strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="esq-chat">
          <p className="esq-chat__context">STUDENT QUESTION</p>
          <div className="esq-chat__question">{activeCase.question}</div>
          <div className="esq-chat__assistant">
            <div className="esq-chat__assistant-head"><SquareMark small /><strong>8 Square</strong><span>•</span><span>Lab guide</span></div>
            <div className="esq-progress">
              <p className="esq-progress__status" role="status" aria-live="polite">{phaseLabel}</p>
              <div className="esq-progress__steps" aria-hidden="true">
                {PREVIEW_STEPS.map((step, index) => <span className={index < stageIndex ? 'is-complete' : index === stageIndex ? 'is-current' : ''} key={step} />)}
              </div>
            </div>
            <p className="esq-chat__answer">{answer}{phase === 'typing' && <span className="esq-chat__cursor" aria-hidden="true" />}</p>
            {phase === 'done' && activeCase.formula && (
              <div className="esq-chat__equation">
                <span>{activeCase.kind === 'arduino' ? 'CHECK THE NUMBERS' : 'WORKED EQUATION'}</span>
                <code>{activeCase.formula}</code>
              </div>
            )}
            {phase === 'done' && activeCase.code && (
              <div className="esq-chat__code">
                <div><span>MINIMAL SKETCH</span><span>Arduino C++</span></div>
                <pre><code>{activeCase.code}</code></pre>
              </div>
            )}
            {phase === 'done' && <div className="esq-chat__observation"><span />{activeCase.observation}</div>}
          </div>
        </div>
      </div>
      <footer className="esq-demo__footer">
        <span>Illustrative sample interaction · lab values shown for learning</span>
        <button type="button" onClick={() => setRun((value) => value + 1)}><span aria-hidden="true">↻</span> Replay sample</button>
      </footer>
    </section>
  )
}
>
  )
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
        <InteractiveDotField />
        <div className="shell esq-hero__grid">
          <div className="esq-hero__copy">
            <Logo className="esq-logo--hero" />
            <span className="esq-chip"><span className="esq-chip__pulse" /> Private preview · Built by Pixiu Tech</span>
            <h1>Build with 8 Square AI.<br /><span>Understand every step.</span></h1>
            <p className="esq-lede">An AI learning companion inside the Pixiu Virtual Lab. Students can explore circuits, ask why something happened, and get step-by-step hints grounded in the build they are working on.</p>
            <div className="esq-actions">
              <Link className="btn btn--primary btn--lg" to="/contact#demo-form">Request early access <span className="arw">→</span></Link>
              <Link className="btn btn--ghost-light" to="/virtual-lab">Explore the Virtual Lab</Link>
            </div>
            <dl className="esq-meta">
              <div><dt>Designed for</dt><dd>Hands-on learning</dd></div>
              <div><dt>Built by</dt><dd>Pixiu Tech</dd></div>
              <div><dt>Access</dt><dd>Private preview</dd></div>
            </dl>
          </div>
          <CircuitChatPreview />
        </div>
      </section>

      <section className="esq-loop">
        <div className="shell">
          <p className="esq-eyebrow">A learning loop that works</p>
          <h2 className="esq-loop__title">From first build to a better next question.</h2>
          <div className="esq-loop__grid">
            <article><span>01</span><h3>Build</h3><p>Start with a lesson or bring a circuit idea into the browser-based Virtual Lab.</p></article>
            <article><span>02</span><h3>Ask 8 Square</h3><p>Ask what happened. Get a hint connected to the circuit and the concept behind it.</p></article>
            <article><span>03</span><h3>Try again</h3><p>Make a change, run the circuit, and see how your next experiment behaves.</p></article>
          </div>
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
            <p>8 Square has been developed by Pixiu Tech’s engineering and curriculum team, the same people who set up school innovation labs and teach weekly sessions. Its capabilities are shaped by real classroom questions our trainers hear every day.</p>
            <p>It is trained around Pixiu Tech’s Robotics, AI, IoT and electronics curriculum, aligned with CBSE, ICSE and State boards, and integrated with the Pixiu Virtual Lab and Learning Portal, so guidance stays connected to what the student is building.</p>
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
