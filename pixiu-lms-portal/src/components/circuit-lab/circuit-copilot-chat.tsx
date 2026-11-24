import { Link } from "react-router-dom"
import { Sparkles } from "lucide-react"

const EIGHT_SQUARE_LOGO = "/img/8square-logo.svg"

export interface CircuitCopilotChatProps {
  isOpen?: boolean
  onToggleOpen?: () => void
  [key: string]: unknown
}

/**
 * The existing CyberLab 8 Square AI launcher now opens the production Xen
 * tutor route. Do not show the old "coming soon" announcement here.
 */
export function CircuitCopilotChat(_props: CircuitCopilotChatProps) {
  return (
    <Link
      to="/xen"
      aria-label="Open 8square AI tutor"
      title="Open 8square AI · Xen Step-700"
      className="fixed bottom-20 right-24 md:bottom-6 md:right-36 z-[78] inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-[#091122]/95 px-4 py-2.5 text-xs font-black text-white shadow-xl shadow-cyan-900/40 backdrop-blur-md transition hover:border-cyan-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-300"
    >
      <img src={EIGHT_SQUARE_LOGO} alt="" className="h-6 w-6 object-contain" />
      <span className="font-extrabold tracking-wide">8 Square AI</span>
      <Sparkles size={14} className="text-cyan-300" />
    </Link>
  )
}
