import { useEffect, useState } from "react"
import {
  ArrowRight,
  BookOpen,
  Boxes,
  CheckCircle2,
  CircuitBoard,
  FolderOpen,
  Lightbulb,
  MousePointer2,
  Save,
  Sparkles,
  Timer,
  X,
  Zap,
} from "lucide-react"

const STORAGE_KEY = "pixiu-virtual-lab-launchpad-v2"

const TOUR = [
  { title: "Build on the canvas", text: "Choose a part, place it on the board, then connect the pins. Mission steps show you which path to make.", icon: CircuitBoard },
  { title: "Change a sensor", text: "Select a sensor to reveal its control. Move the slider and compare the input reading with the circuit response.", icon: MousePointer2 },
  { title: "Run and investigate", text: "Start the simulation, open the Serial Monitor when a mission asks, and check what changes as you experiment.", icon: Zap },
  { title: "Save your work", text: "Use Projects to save, reopen, import, or download a portable .pixiu project file.", icon: Save },
]

interface Props {
  onOpenProjects: () => void
  onOpenLessons: () => void
  onOpenTemplates: () => void
  onOpenCopilot: () => void
  onStartFeaturedMission: () => void
  onStartFreeBuild: () => void
}

export function WelcomeOverlay({
  onOpenProjects,
  onOpenLessons,
  onOpenTemplates,
  onOpenCopilot,
  onStartFeaturedMission,
  onStartFreeBuild,
}: Props) {
  const [show, setShow] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourIndex, setTourIndex] = useState(0)

  useEffect(() => {
    try {
      setShow(localStorage.getItem(STORAGE_KEY) !== "seen")
    } catch {
      setShow(false)
    }

    const openLabHome = () => {
      setShow(true)
      setTourOpen(false)
      setTourIndex(0)
    }
    window.addEventListener("pixiu-open-guide", openLabHome)
    return () => window.removeEventListener("pixiu-open-guide", openLabHome)
  }, [])

  const dismiss = (remember = true) => {
    setShow(false)
    setTourOpen(false)
    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, "seen")
      } catch {
        // The launch screen still works when browser storage is unavailable.
      }
    }
  }

  const startTour = () => {
    setTourIndex(0)
    setTourOpen(true)
  }

  if (!show && !tourOpen) return null

  const current = TOUR[tourIndex]
  const TourIcon = current.icon

  return (
    <>
      {show && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-md sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pixiu-lab-home-title"
            className="relative max-h-[calc(100dvh-1rem)] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-[26px] border border-slate-700/80 bg-[#08111f] text-white shadow-2xl shadow-black/60 sm:max-h-[calc(100dvh-2rem)]"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />
            <header className="flex items-center justify-between border-b border-slate-800/90 px-4 py-3 sm:px-7 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
                  <CircuitBoard size={19} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.17em] text-slate-100">PIXIU VIRTUAL LAB</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Guided by 8 Square</p>
                </div>
              </div>
              <button
                onClick={() => dismiss()}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                aria-label="Close lab home"
              >
                <X size={18} />
              </button>
            </header>

            <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
              <section className="p-4 sm:p-7 lg:p-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-blue-200">
                  <Sparkles size={12} /> Your next step starts here
                </div>
                <h1 id="pixiu-lab-home-title" className="mt-4 max-w-xl text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                  Build it. Run it. Find out why.
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  Pick a guided experiment, return to saved work, or start with an empty bench. The full lab stays one click away.
                </p>

                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  <button
                    onClick={() => {
                      dismiss()
                      onOpenProjects()
                    }}
                    className="group flex min-h-[154px] flex-col items-start rounded-2xl border border-slate-700 bg-slate-900/75 p-4 text-left transition hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200"><FolderOpen size={17} /></span>
                    <span className="mt-3 text-sm font-bold text-white">Continue building</span>
                    <span className="mt-1 text-[11px] leading-5 text-slate-400">Open Projects to find your saved circuit or pick up a previous build.</span>
                    <span className="mt-auto pt-3 text-[10px] font-bold text-slate-300 group-hover:text-white">Open Projects <ArrowRight size={12} className="ml-1 inline" /></span>
                  </button>

                  <button
                    onClick={() => {
                      dismiss()
                      onStartFeaturedMission()
                    }}
                    className="group relative flex min-h-[154px] flex-col items-start overflow-hidden rounded-2xl border border-cyan-300/50 bg-gradient-to-br from-cyan-950/80 via-blue-950/60 to-slate-900 p-4 text-left shadow-lg shadow-cyan-950/20 transition hover:border-cyan-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    <span className="absolute -right-7 -top-8 h-28 w-28 rounded-full bg-cyan-300/10 blur-2xl" />
                    <span className="relative inline-flex items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-cyan-200">
                      <Lightbulb size={11} /> Featured experiment · 18 min
                    </span>
                    <span className="relative mt-3 text-sm font-black text-white">Automatic Night Lamp</span>
                    <span className="relative mt-1 text-[11px] leading-5 text-slate-300">Wire an LDR and LED, read the sensor, and discover why the threshold matters.</span>
                    <span className="relative mt-auto pt-3 text-[10px] font-black text-cyan-200 group-hover:text-white">Start guided experiment <ArrowRight size={12} className="ml-1 inline" /></span>
                  </button>

                  <button
                    onClick={() => {
                      dismiss()
                      onStartFreeBuild()
                    }}
                    className="group flex min-h-[126px] flex-col items-start rounded-2xl border border-slate-700 bg-slate-900/75 p-4 text-left transition hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200"><Boxes size={17} /></span>
                    <span className="mt-3 text-sm font-bold text-white">Free build</span>
                    <span className="mt-1 text-[11px] leading-5 text-slate-400">Open the blank studio and make your own circuit from the parts library.</span>
                    <span className="mt-auto pt-3 text-[10px] font-bold text-slate-300 group-hover:text-white">Open blank studio <ArrowRight size={12} className="ml-1 inline" /></span>
                  </button>

                  <div className="flex min-h-[126px] flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    <div>
                      <span className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-200"><Sparkles size={17} /></span>
                      <p className="mt-3 text-sm font-bold text-white">Need a hint?</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400">Ask the 8 Square guide about the circuit, wiring, code, or readings.</p>
                    </div>
                    <button
                      onClick={() => {
                        dismiss()
                        onOpenCopilot()
                      }}
                      className="mt-3 self-start text-[10px] font-bold text-violet-200 transition hover:text-white focus-visible:outline-none focus-visible:underline"
                    >
                      Open 8 Square <ArrowRight size={12} className="ml-1 inline" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800 pt-4 text-[10px]">
                  <button
                    onClick={() => {
                      dismiss()
                      onOpenLessons()
                    }}
                    className="font-semibold text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:underline"
                  >
                    Browse all missions
                  </button>
                  <button
                    onClick={() => {
                      dismiss()
                      onOpenTemplates()
                    }}
                    className="font-semibold text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:underline"
                  >
                    Browse starter circuits
                  </button>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-slate-500"><Timer size={12} /> Beginner friendly · no kit required</span>
                </div>

                <button
                  onClick={startTour}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300 transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <BookOpen size={13} /> Take the 1-minute tour
                </button>
              </section>

              <aside className="border-t border-slate-800 bg-gradient-to-br from-blue-500/[0.08] via-cyan-500/[0.035] to-violet-500/[0.07] p-4 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
                <div className="rounded-2xl border border-slate-700/80 bg-[#0a1625]/90 p-3 shadow-xl shadow-black/20 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200">Featured experiment</p>
                      <h2 className="mt-1 text-base font-black">Automatic Night Lamp</h2>
                      <p className="mt-1 text-[10px] text-slate-500">Arduino Uno · photoresistor · LED</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[8px] font-bold text-emerald-200">SIMULATED</span>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-700/80 bg-[#07111d]">
                    <svg viewBox="0 0 560 218" role="img" aria-label="Circuit preview showing an Arduino Uno, an LDR with a 10 kilo-ohm divider, and an LED with a 220 ohm current-limiting resistor" className="block h-auto w-full">
                      <defs>
                        <linearGradient id="labBoard" x1="0" x2="1" y1="0" y2="1">
                          <stop offset="0%" stopColor="#12344a" />
                          <stop offset="100%" stopColor="#0b2333" />
                        </linearGradient>
                        <filter id="lampGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5" /></filter>
                      </defs>
                      <path d="M154 78 H244 M154 139 H244 M316 78 H402 M316 139 H402 M402 139 V177 H154" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.78" />
                      <path d="M154 177 H118 V164 M402 177 H448 V164" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="5 5" />
                      <rect x="24" y="40" width="130" height="140" rx="14" fill="url(#labBoard)" stroke="#38bdf8" strokeOpacity="0.65" />
                      <rect x="42" y="57" width="26" height="26" rx="6" fill="#07111d" stroke="#0ea5e9" />
                      <circle cx="55" cy="70" r="5" fill="#22d3ee" />
                      <text x="80" y="75" fill="#e2e8f0" fontSize="12" fontFamily="monospace" fontWeight="700">UNO</text>
                      <text x="36" y="103" fill="#93c5fd" fontSize="9" fontFamily="monospace">5V · A0 · D13 · GND</text>
                      <text x="40" y="148" fill="#64748b" fontSize="8" fontFamily="monospace">ARDUINO</text>
                      <circle cx="244" cy="78" r="23" fill="#422006" stroke="#fbbf24" strokeWidth="2" />
                      <path d="M235 73 L241 67 L247 73 L253 67 M235 83 L241 77 L247 83 L253 77" fill="none" stroke="#fcd34d" strokeWidth="2" />
                      <text x="225" y="117" fill="#cbd5e1" fontSize="9" fontFamily="monospace">LDR</text>
                      <path d="M226 55 L236 62 M231 48 L241 56" stroke="#fcd34d" strokeWidth="1.5" />
                      <path d="M277 78 l5 -9 8 18 8 -18 8 18 8 -9" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinejoin="round" />
                      <text x="280" y="112" fill="#cbd5e1" fontSize="8" fontFamily="monospace">10 kΩ</text>
                      <path d="M420 139 l5 -9 8 18 8 -18 8 18 8 -9" fill="none" stroke="#fb923c" strokeWidth="2.5" strokeLinejoin="round" />
                      <text x="421" y="174" fill="#cbd5e1" fontSize="8" fontFamily="monospace">220 Ω</text>
                      <circle cx="476" cy="139" r="26" fill="#fbbf24" opacity="0.25" filter="url(#lampGlow)" />
                      <circle cx="476" cy="139" r="18" fill="#f59e0b" stroke="#fde68a" strokeWidth="2" />
                      <path d="M467 139 H485 M476 130 V148" stroke="#fff7ed" strokeWidth="1.5" />
                      <text x="465" y="177" fill="#cbd5e1" fontSize="8" fontFamily="monospace">LED</text>
                      <text x="204" y="26" fill="#64748b" fontSize="8" fontFamily="monospace">LIGHT INPUT</text>
                      <text x="398" y="26" fill="#64748b" fontSize="8" fontFamily="monospace">LAMP OUTPUT</text>
                    </svg>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/75 p-3">
                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">Simulated ADC</p>
                      <p className="mt-1 font-mono text-sm font-bold text-cyan-200">0–1023</p>
                      <p className="mt-1 text-[9px] leading-4 text-slate-500">Dark to bright input</p>
                    </div>
                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">Example threshold</p>
                      <p className="mt-1 font-mono text-sm font-bold text-amber-200">&lt; 400</p>
                      <p className="mt-1 text-[9px] leading-4 text-slate-500">Below it, the LED turns on</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[9px] leading-4 text-slate-500">
                    The slider is a simplified ADC input, not a calibrated lux meter. You will test the bright, dark, and threshold cases yourself.
                  </p>
                </div>

                <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-400/15 bg-blue-400/[0.05] p-3 text-[10px] leading-5 text-slate-400">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-blue-300" />
                  <p>8 Square is available inside the lab when you want a hint about what your circuit is doing.</p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {tourOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
          <div role="dialog" aria-modal="true" aria-labelledby="pixiu-tour-title" className="w-full max-w-lg rounded-3xl border border-cyan-400/20 bg-[#08111e] p-5 text-white shadow-2xl shadow-black/60 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-cyan-300">
                <BookOpen size={13} /> Lab tour · {tourIndex + 1} / {TOUR.length}
              </span>
              <button onClick={() => setTourOpen(false)} aria-label="Close lab tour" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                <X size={16} />
              </button>
            </div>
            <div className="mt-5 flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
                <TourIcon size={22} />
              </div>
              <div>
                <h2 id="pixiu-tour-title" className="text-lg font-black">{current.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{current.text}</p>
              </div>
            </div>
            <div className="mt-5 flex gap-1.5" aria-label={"Tour progress " + (tourIndex + 1) + " of " + TOUR.length}>
              {TOUR.map((_, index) => (
                <span key={index} className={"h-1.5 flex-1 rounded-full " + (index <= tourIndex ? "bg-cyan-400" : "bg-slate-800")} />
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={() => setTourIndex((value) => Math.max(0, value - 1))}
                disabled={tourIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Back
              </button>
              {tourIndex < TOUR.length - 1 ? (
                <button
                  onClick={() => setTourIndex((value) => Math.min(TOUR.length - 1, value + 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  Next <ArrowRight size={14} />
                </button>
              ) : (
                <button onClick={() => setTourOpen(false)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                  Done <CheckCircle2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
