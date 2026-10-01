import { useEffect, useState } from "react"
import { Award, Flame, Sparkles, Trophy, X, Zap } from "lucide-react"
import { getXpSummary, XP_UPDATE_EVENT, type XpSummary } from "@/lib/xp-engine"

interface Props {
  className?: string
}

export function XpBadgeButton({ className = "" }: Props) {
  const [summary, setSummary] = useState<XpSummary>(() => getXpSummary())
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleUpdate = () => {
      setSummary(getXpSummary())
    }

    window.addEventListener(XP_UPDATE_EVENT, handleUpdate)
    window.addEventListener("storage", handleUpdate)

    return () => {
      window.removeEventListener(XP_UPDATE_EVENT, handleUpdate)
      window.removeEventListener("storage", handleUpdate)
    }
  }, [])

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 px-2 sm:px-2.5 py-1 text-xs font-bold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/20 shadow-sm cursor-pointer ${className}`}
        title="View your Creator XP, Level & School Leaderboard"
      >
        <Zap size={13} className="text-amber-400 fill-amber-400 animate-pulse" />
        <span className="font-mono">{summary.totalXp} XP</span>
        <span className="hidden sm:inline-block rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-mono text-amber-300">
          Lv {summary.level}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-5">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-amber-500/25 bg-[#090f1d] text-white shadow-2xl shadow-black/80 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="relative border-b border-slate-800 bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-900/40 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-2xl ring-1 ring-amber-400/40 shadow-inner">
                    {summary.levelInfo.icon}
                  </div>
                  <div>
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-300 ring-1 ring-amber-400/30">
                      LEVEL {summary.level} · {summary.levelInfo.badge}
                    </span>
                    <h2 className="mt-1 text-base font-black sm:text-lg text-white">
                      {summary.levelInfo.title}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Progress to next level */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>{summary.totalXp} Total XP</span>
                  <span>{summary.nextLevelXp} XP for next title</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-500"
                    style={{ width: `${summary.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2 border-b border-slate-800 bg-slate-950/40 p-4">
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
                  <Flame size={11} className="text-orange-400" /> Streak
                </div>
                <p className="mt-1 font-mono text-base font-black text-orange-300">{summary.streakDays} Days</p>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
                  <Trophy size={11} className="text-amber-400" /> Missions
                </div>
                <p className="mt-1 font-mono text-base font-black text-amber-300">{summary.totalMissionsCompleted} / 19</p>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-slate-500">
                  <Sparkles size={11} className="text-cyan-400" /> Created
                </div>
                <p className="mt-1 font-mono text-base font-black text-cyan-300">{summary.totalCreationsSaved}</p>
              </div>
            </div>

            {/* Badges and Activity Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Badges Section */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-400 mb-2">Unlocked Badges</p>
                <div className="flex flex-wrap gap-1.5">
                  {summary.badges.length === 0 ? (
                    <span className="text-xs text-slate-600">Complete missions or save custom circuits to unlock badges!</span>
                  ) : (
                    summary.badges.map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-200"
                      >
                        <Award size={12} className="text-amber-400" /> {b}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Anti-Cheat & Daily Cap Indicator */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Today&apos;s XP Earned</span>
                  <span className="font-mono font-bold text-amber-300">{summary.todayXp} / 500 XP</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${Math.min(100, (summary.todayXp / 500) * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[9px] text-slate-500">
                  🛡️ Protected by anti-spam verification & daily fair-play caps.
                </p>
              </div>

              {/* Activity Log */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-400 mb-2">Recent Accomplishments</p>
                <div className="space-y-1.5">
                  {summary.events.slice(0, 5).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="truncate font-semibold text-slate-300">{e.title}</p>
                        <p className="text-[9px] text-slate-500">{new Date(e.timestamp).toLocaleDateString()}</p>
                      </div>
                      <span className="font-mono font-black text-amber-400">+{e.xp} XP</span>
                    </div>
                  ))}
                  {summary.events.length === 0 && (
                    <p className="text-xs text-slate-600">No activity yet. Start by passing Mission 1!</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-800 bg-slate-950/60 p-3.5 text-center text-[10px] text-slate-500">
              Your XP is synced with your school profile & inter-school rank.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
