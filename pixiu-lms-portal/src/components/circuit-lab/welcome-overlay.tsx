import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, CheckCircle2, CircuitBoard, MousePointer2, Sparkles, Zap, X } from "lucide-react"

const STORAGE_KEY = "pixiu-circuit-studio-welcome-v1"

const TOUR = [
  {
    title: "Build on the canvas",
    text: "Drag parts from the grouped library, drop them on the board, then click two pins to connect them.",
    icon: CircuitBoard,
  },
  {
    title: "Make inputs interactive",
    text: "Select a sensor, joystick, encoder or keypad. The Inspector gives you a live control for the virtual hardware.",
    icon: MousePointer2,
  },
  {
    title: "Run + observe",
    text: "Run the circuit, open the multimeter or oscilloscope, and watch the simulation respond in real time.",
    icon: Zap,
  },
  {
    title: "Save a real project",
    text: "Projects autosave locally. Use Projects to name, reopen, import or download a portable .pixiu file.",
    icon: Sparkles,
  },
]

export function WelcomeOverlay({ onOpenProjects }: { onOpenProjects: () => void }) {
  const [show, setShow] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourIndex, setTourIndex] = useState(0)

  useEffect(() => {
    try {
      setShow(localStorage.getItem(STORAGE_KEY) !== "seen")
    } catch {
      setShow(false)
    }

    const openGuide = () => {
      setShow(true)
      setTourOpen(true)
      setTourIndex(0)
    }
    window.addEventListener("pixiu-open-guide", openGuide)
    return () => window.removeEventListener("pixiu-open-guide", openGuide)
  }, [])

  const dismiss = (remember = true) => {
    setShow(false)
    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, "seen")
      } catch {
        // Ignore storage failures; the welcome screen can simply reappear.
      }
    }
  }

  if (!show) return null

  const current = TOUR[tourIndex]
  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-blue-400/20 bg-[#0b1220] text-white shadow-2xl shadow-black/50">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500" />
        <button
          onClick={() => dismiss()}
          className="absolute right-3 top-3 rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          aria-label="Close welcome"
        >
          <X size={18} />
        </button>

        <div className="grid md:grid-cols-[1.05fr_0.95fr]">
          <div className="p-6 sm:p-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200">
              <Sparkles size={12} /> Pixiu Virtual Arduino Lab
            </div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Build. Simulate. Learn.</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
              A kid-friendly circuit studio where your wiring, Blockly code and virtual hardware stay connected.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => {
                  dismiss()
                  setTourIndex(0)
                  setTourOpen(true)
                }}
                className="rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white transition hover:bg-blue-500"
              >
                Take the 1-minute tour
              </button>
              <button
                onClick={() => {
                  dismiss()
                  onOpenProjects()
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-200 transition hover:bg-slate-800"
              >
                Open Projects
              </button>
            </div>
            <button
              onClick={() => dismiss()}
              className="mt-3 w-full rounded-xl px-4 py-2.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-900 hover:text-slate-300"
            >
              Start building now
            </button>
          </div>

          <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600/15 via-cyan-500/5 to-violet-500/10 p-8 md:flex md:items-center md:justify-center">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #60a5fa 1px, transparent 0)", backgroundSize: "22px 22px" }} />
            <div className="relative grid w-full max-w-xs gap-3">
              {["Palette → Canvas", "Interactive Inspector", "Run + Scope", "Projects + .pixiu"].map((label, i) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/65 p-3 backdrop-blur">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/15 text-blue-300">{[CircuitBoard, MousePointer2, Zap, CheckCircle2][i]({ size: 16 })}</div>
                  <div>
                    <p className="text-xs font-bold">{label}</p>
                    <p className="text-[10px] text-slate-500">{["Wire without fear.", "Touch the controls.", "See the physics.", "Carry your work."][i]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {tourOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-cyan-400/20 bg-[#08101d] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-cyan-300">
                Guide {tourIndex + 1} / {TOUR.length}
              </span>
              <button onClick={() => setTourOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"><X size={16} /></button>
            </div>
            <div className="mt-5 flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20">
                <Icon size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black">{current.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{current.text}</p>
              </div>
            </div>
            <div className="mt-5 flex gap-1.5">
              {TOUR.map((_, i) => (
                <span key={i} className={"h-1.5 flex-1 rounded-full " + (i <= tourIndex ? "bg-cyan-400" : "bg-slate-800")} />
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={() => setTourIndex((value) => Math.max(0, value - 1))}
                disabled={tourIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-30"
              >
                <ArrowLeft size={14} /> Back
              </button>
              {tourIndex < TOUR.length - 1 ? (
                <button
                  onClick={() => setTourIndex((value) => Math.min(TOUR.length - 1, value + 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950"
                >
                  Next <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={() => setTourOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950"
                >
                  Start building <CheckCircle2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
