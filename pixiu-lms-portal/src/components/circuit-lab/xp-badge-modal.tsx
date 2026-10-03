import { useEffect, useState } from "react"
import { Award, Cloud, Flame, RefreshCw, Sparkles, Trophy, X, Zap, ShieldCheck, CheckCircle2, ShieldAlert } from "lucide-react"
import { getXpSummary, syncXpWithServer, XP_UPDATE_EVENT, XP_SYNC_EVENT, type XpSummary } from "@/lib/xp-engine"

interface Props {
  className?: string
}

export function XpBadgeButton({ className = "" }: Props) {
  const [summary, setSummary] = useState<XpSummary>(() => getXpSummary())
  const [isOpen, setIsOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const handleUpdate = () => {
      setSummary(getXpSummary())
    }

    window.addEventListener(XP_UPDATE_EVENT, handleUpdate)
    window.addEventListener(XP_SYNC_EVENT, handleUpdate)
    window.addEventListener("storage", handleUpdate)

    return () => {
      window.removeEventListener(XP_UPDATE_EVENT, handleUpdate)
      window.removeEventListener(XP_SYNC_EVENT, handleUpdate)
      window.removeEventListener("storage", handleUpdate)
    }
  }, [])

  const handleManualSync = async () => {
    if (summary.isSandbox) return
    setIsSyncing(true)
    try {
      const updated = await syncXpWithServer(null, { forceFetch: true })
      if (updated) {
        setSummary(updated)
      }
    } finally {
      setIsSyncing(false)
    }
  }

  const isTrainer = summary.userRole === "trainer"
  const roleLabel = isTrainer ? "Trainer" : "Admin"

  return (
    <>
      {summary.isSandbox ? (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-gradient-to-r from-purple-500/15 to-indigo-500/10 px-2 sm:px-2.5 py-1 text-xs font-bold text-purple-200 transition hover:border-purple-400 hover:bg-purple-500/20 shadow-sm cursor-pointer ${className}`}
          title={`${roleLabel} Sandbox Mode — Student XP & Leaderboard Disabled`}
        >
          <ShieldCheck size={13} className="text-purple-400" />
          <span className="font-mono text-[11px]">{roleLabel} Sandbox</span>
          <span className="hidden sm:inline-block rounded bg-purple-500/20 px-1 py-0.2 text-[9px] font-mono text-purple-300">
            XP Off
          </span>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 px-2 sm:px-2.5 py-1 text-xs font-bold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/20 shadow-sm cursor-pointer ${className}`}
          title="View your Creator XP, Level & Cloud Sync"
        >
          <Zap size={13} className="text-amber-400 fill-amber-400 animate-pulse" />
          <span className="font-mono">{summary.totalXp} XP</span>
          <span className="hidden sm:inline-block rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-mono text-amber-300">
            Lv {summary.level}
          </span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-5">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-700/60 bg-[#090f1d] text-white shadow-2xl shadow-black/80 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className={`relative border-b border-slate-800 p-5 ${
              summary.isSandbox
                ? "bg-gradient-to-r from-purple-950/50 via-slate-900/60 to-slate-900/40 border-purple-500/30"
                : "bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-900/40 border-amber-500/30"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ring-1 shadow-inner ${
                    summary.isSandbox
                      ? "bg-purple-500/20 ring-purple-400/40 text-purple-300"
                      : "bg-amber-500/20 ring-amber-400/40"
                  }`}>
                    {summary.isSandbox ? (isTrainer ? "🎓" : "🛠️") : summary.levelInfo.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-mono font-bold ring-1 ${
                        summary.isSandbox
                          ? "bg-purple-500/20 text-purple-300 ring-purple-400/30"
                          : "bg-amber-500/20 text-amber-300 ring-amber-400/30"
                      }`}>
                        {summary.isSandbox ? `${roleLabel.toUpperCase()} SANDBOX` : `LEVEL ${summary.level} · ${summary.levelInfo.badge}`}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <Cloud size={10} /> {summary.isSandbox ? "Leaderboard Protected" : "Cloud-Synced"}
                      </span>
                    </div>
                    <h2 className="mt-1 text-base font-black sm:text-lg text-white">
                      {summary.isSandbox
                        ? `${roleLabel} Simulation Sandbox`
                        : summary.levelInfo.title}
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

              {/* Progress to next level (Only for students) */}
              {!summary.isSandbox && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>{summary.totalXp} Total XP</span>
                    <span>{summary.isMaxLevel ? "Max Tier Achieved 🏆" : `${summary.nextLevelXp} XP for next title`}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-500"
                      style={{ width: `${summary.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Body */}
            {summary.isSandbox ? (
              /* INSTRUCTOR / ADMIN SANDBOX MODE VIEW */
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                    <ShieldCheck size={16} className="text-purple-400" />
                    <span>Leaderboard & Fair-Play Isolation Active</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    As an {roleLabel.toLowerCase()}, you have full freedom to test, demo, and experiment with all circuit components, Blockly AI models, and lessons.
                  </p>
                  <div className="rounded-xl bg-slate-950/60 p-3 border border-white/5 text-[11px] space-y-1.5 text-slate-300">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <CheckCircle2 size={13} />
                      <span>Staff activity does NOT award student XP</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <CheckCircle2 size={13} />
                      <span>School rankings remain 100% student-driven</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <CheckCircle2 size={13} />
                      <span>Unrestricted circuit simulation & lesson access</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-400">Student Gamification Model</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Students using this lab earn XP across 4 verified pillars:
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800">
                      <p className="font-bold text-amber-300">📚 19 Missions</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">50 - 200 XP per lesson</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800">
                      <p className="font-bold text-cyan-300">⚡ Custom Circuits</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">75 - 225 XP for verified builds</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800">
                      <p className="font-bold text-emerald-300">🔥 Consistency</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Daily streaks & active tinkering</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800">
                      <p className="font-bold text-purple-300">🧠 AI Hardware</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Vision & gesture blockly bonuses</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* STUDENT GAMIFIED VIEW */
              <>
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
                    <p className="mt-1 font-mono text-base font-black text-amber-300">{summary.totalMissionsCompleted} Finished</p>
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

                  {/* Cloud Sync & Anti-Cheat Indicator */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-emerald-400" /> Cloud Backup Status
                      </span>
                      <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40 transition disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw size={10} className={isSyncing ? "animate-spin" : ""} />
                        {isSyncing ? "Syncing..." : "Sync / Restore"}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Your XP, Level & Badges are safely backed up to your Pixiu Student Profile. Even if your browser storage or cache is cleared, all your creations and points are permanently saved in the database.
                    </p>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                      <span className="text-slate-400">Today&apos;s XP Earned</span>
                      <span className="font-mono font-bold text-amber-300">{summary.todayXp} / 500 XP</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{ width: `${Math.min(100, (summary.todayXp / 500) * 100)}%` }}
                      />
                    </div>
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
              </>
            )}

            {/* Footer */}
            <div className="border-t border-slate-800 bg-slate-950/60 p-3.5 text-center text-[10px] text-slate-500">
              {summary.isSandbox
                ? `${roleLabel} Mode: Leaderboard isolation active. Testing does not alter student scores.`
                : "Synced with your student profile & inter-school leaderboard."}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
