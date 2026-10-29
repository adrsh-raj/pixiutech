import { useState } from "react"
import { AlertTriangle, CheckCircle, Info, Sparkles, X, ChevronRight, Eye, ShieldAlert, Cpu } from "lucide-react"
import type { CircuitHealthReport, DiagnosticIssue } from "@/lib/circuit-doctor"

interface CircuitDoctorHudProps {
  report: CircuitHealthReport
  onHighlightParts?: (partIds: string[]) => void
  isOpen?: boolean
  onClose?: () => void
}

export function CircuitDoctorHud({
  report,
  onHighlightParts,
  isOpen = false,
  onClose,
}: CircuitDoctorHudProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "critical" | "warning" | "tip">("all")

  if (!isOpen) return null

  const filteredIssues = report.issues.filter((issue) => {
    if (activeTab === "all") return true
    return issue.severity === activeTab
  })

  const getSeverityBadge = (severity: DiagnosticIssue["severity"]) => {
    switch (severity) {
      case "critical":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">CRITICAL</span>
      case "warning":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">WARNING</span>
      case "tip":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">TIP</span>
      case "success":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">OPTIMAL</span>
    }
  }

  const getSeverityIcon = (severity: DiagnosticIssue["severity"]) => {
    switch (severity) {
      case "critical":
        return <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      case "tip":
        return <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
    }
  }

  return (
    <div className="fixed inset-y-14 bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col pointer-events-auto">
      <div className="bg-slate-950/95 border border-cyan-500/40 shadow-2xl rounded-2xl flex min-h-0 flex-col max-h-[85dvh] overflow-hidden backdrop-blur-xl ring-1 ring-cyan-500/20 text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <Cpu className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-cyan-200">AI Circuit Doctor</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  LIVE V2
                </span>
              </div>
              <p className="text-[11px] leading-4 text-slate-400">Electrical safety & wiring intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Health Score Banner */}
        <div className="p-3.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400">Circuit Integrity Score</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-2xl font-black font-mono tracking-tight ${
                report.score >= 90 ? "text-emerald-400" : report.score >= 60 ? "text-amber-400" : "text-rose-400"
              }`}>
                {report.score}%
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {report.status === "healthy" ? "All Clear" : report.status === "needs-attention" ? "Action Needed" : "Safety Alert"}
              </span>
            </div>
          </div>

          <div className="flex gap-1.5 text-xs font-mono">
            {report.criticalCount > 0 && (
              <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {report.criticalCount} 🔴
              </span>
            )}
            {report.warningCount > 0 && (
              <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {report.warningCount} 🟡
              </span>
            )}
            {report.tipCount > 0 && (
              <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {report.tipCount} 💡
              </span>
            )}
          </div>
        </div>

        {/* Severity Tabs */}
        <div className="flex border-b border-slate-800/80 bg-slate-950/50 p-1 gap-1 text-xs">
          {(["all", "critical", "warning", "tip"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1 px-2 rounded-lg font-medium capitalize text-[11px] transition-all ${
                activeTab === tab
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Issues List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredIssues.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-emerald-500/50" />
              <span>No {activeTab !== "all" ? activeTab : ""} issues found in current circuit!</span>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const isSelected = selectedIssueId === issue.id
              return (
                <div
                  key={issue.id}
                  onClick={() => {
                    setSelectedIssueId(isSelected ? null : issue.id)
                    if (issue.involvedPartIds.length > 0) {
                      onHighlightParts?.(issue.involvedPartIds)
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    issue.severity === "critical"
                      ? "bg-rose-950/20 border-rose-500/40 hover:border-rose-400"
                      : issue.severity === "warning"
                      ? "bg-amber-950/20 border-amber-500/40 hover:border-amber-400"
                      : issue.severity === "tip"
                      ? "bg-cyan-950/20 border-cyan-500/40 hover:border-cyan-400"
                      : "bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400"
                  } ${isSelected ? "ring-2 ring-cyan-400/50 shadow-lg" : ""}`}
                >
                  <div className="flex items-start gap-2.5">
                    {getSeverityIcon(issue.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-xs text-white truncate">{issue.title}</span>
                        {getSeverityBadge(issue.severity)}
                      </div>
                      <p className="break-words text-[11px] text-slate-300 leading-relaxed">{issue.message}</p>
                    </div>
                  </div>

                  {/* Suggestion Box */}
                  <div className="mt-2.5 p-2 rounded-lg bg-slate-900/90 border border-slate-700/60 text-[11px] text-cyan-200/90 flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold text-cyan-300">Suggestion: </span>
                      <span>{issue.suggestion}</span>
                    </div>
                  </div>

                  {/* Action row */}
                  {issue.involvedPartIds.length > 0 && (
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onHighlightParts?.(issue.involvedPartIds)
                        }}
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono hover:underline"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Highlight Affected Parts ({issue.involvedPartIds.length})</span>
                      </button>
                      <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between text-[11px] text-slate-400">
          <span>Real-time nodal & loop continuity analysis</span>
          <span className="font-mono text-cyan-400">Pixiu Tech</span>
        </div>
      </div>
    </div>
  )
}
