import { Link } from "react-router-dom"
import { Sparkles } from "lucide-react"

const PILOT_ROLES = new Set(["admin", "superadmin", "trainer", "student"])

export function XenLauncher({ userRole }: { userRole?: string }) {
  const role = String(userRole || "").trim().toLowerCase()
  if (!PILOT_ROLES.has(role)) return null

  return (
    <Link
      to="/xen"
      aria-label="Open 8 Square AI PixiuMind Xen tutor"
      title="Open 8 Square AI · PixiuMind Step-700"
      className="fixed bottom-[5.5rem] right-4 z-[78] flex items-center gap-3 rounded-2xl border border-cyan-500/40 bg-[#07111f]/95 px-3.5 py-3 text-white shadow-2xl shadow-cyan-950/40 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-cyan-900/50 focus:outline-none focus:ring-2 focus:ring-cyan-300"
    >
      <img src="/img/8square-logo.svg" alt="" className="h-10 w-auto max-w-[148px] object-contain" />
      <span className="flex flex-col text-left">
        <span className="flex items-center gap-1.5 text-xs font-black tracking-wide">
          <Sparkles size={13} className="text-cyan-300" />
          Open Tutor
        </span>
        <span className="mt-0.5 text-[9px] font-mono uppercase tracking-wider text-cyan-200/70">
          PixiuMind · Step-700
        </span>
      </span>
    </Link>
  )
}
