import React, { useState } from "react"
import { X } from "lucide-react"

const COMING_SOON_MESSAGE =
  "8 Square AI is coming soon. We’re developing a thoughtful, student-focused learning guide to help you explore, understand, and build with confidence. Please check back soon."

const EIGHT_SQUARE_LOGO = "/img/8square-logo.svg"

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
        aria-label="Open 8 Square AI announcement"
        aria-expanded={isOpen}
        title="8 Square AI — coming soon"
      >
        <img src={EIGHT_SQUARE_LOGO} alt="" className="h-5 w-5 object-contain" />
        <span className="font-extrabold tracking-wide">8 Square AI</span>
      </button>

      {isOpen && (
        <section
          aria-label="8 Square AI announcement"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 md:bottom-20 md:right-10 z-[75] flex w-[min(440px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-cyan-500/40 bg-slate-950 text-white shadow-2xl shadow-cyan-950/40"
        >
          <header className="flex items-center justify-between border-b border-slate-800 p-4">
            <img src={EIGHT_SQUARE_LOGO} alt="8 Square AI — Engineering Learning Guide" className="h-10 w-auto max-w-[220px] object-contain object-left" />
            <button
              type="button"
              onClick={close}
              aria-label="Close 8 Square AI announcement"
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
