import React, { useState } from "react"
import { Sparkles, X } from "lucide-react"

const COMING_SOON_MESSAGE =
  "PIXIU TECH’s Self-Hosted AI Copilot is coming soon. We’re building a safe, student-focused assistant to support your learning. Please check back soon."

export interface CircuitCopilotChatProps {
  isOpen?: boolean
  onToggleOpen?: () => void
  [key: string]: unknown
}

export function CircuitCopilotChat({
  isOpen: externalIsOpen,
  onToggleOpen: externalOnToggleOpen,
}: CircuitCopilotChatProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = externalIsOpen ?? internalIsOpen
  const toggle = externalOnToggleOpen ?? (() => setInternalIsOpen((open) => !open))
  const close = () => {
    if (externalOnToggleOpen) externalOnToggleOpen()
    else setInternalIsOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-20 right-24 md:bottom-6 md:right-36 z-[70] inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-[#091122]/95 px-4 py-2.5 text-xs font-black text-white shadow-xl shadow-cyan-900/40 backdrop-blur-md transition hover:border-cyan-300 hover:scale-105"
        aria-label="Open PIXIU AI Copilot announcement"
        aria-expanded={isOpen}
        title="PIXIU AI Copilot — coming soon"
      >
        <Sparkles size={16} className="text-cyan-400" />
        <span className="font-extrabold tracking-wide">AI Copilot</span>
      </button>

      {isOpen && (
        <section
          aria-label="PIXIU AI Copilot announcement"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 md:bottom-20 md:right-10 z-[75] flex w-[min(440px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-cyan-500/40 bg-slate-950 text-white shadow-2xl shadow-cyan-950/40"
        >
          <header className="flex items-center justify-between border-b border-slate-800 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 text-slate-950">
                <Sparkles size={17} />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-wide">PIXIU AI Copilot</h2>
                <p className="text-[10px] text-slate-400">A student-focused learning assistant</p>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close AI Copilot announcement"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <X size={16} />
            </button>
          </header>
          <div className="p-5" role="status" aria-live="polite">
            <p className="text-sm leading-6 text-slate-200">{COMING_SOON_MESSAGE}</p>
          </div>
        </section>
      )}
    </>
  )
}
