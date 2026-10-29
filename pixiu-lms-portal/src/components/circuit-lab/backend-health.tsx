import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, Wifi, WifiOff } from "lucide-react"
import { API_BASE } from "@/config/api"

type HealthState = "checking" | "online" | "offline"

export function BackendHealth() {
  const [status, setStatus] = useState<HealthState>("checking")
  const [databaseReportedHealthy, setDatabaseReportedHealthy] = useState(false)
  const [checking, setChecking] = useState(false)
  const requestId = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  const checkBackend = useCallback(async () => {
    const currentRequestId = ++requestId.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    setChecking(true)

    try {
      const response = await fetch(`${API_BASE}/health/`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      })
      const health: unknown = await response.json()
      if (!response.ok || !health || typeof health !== "object" || !("status" in health) || health.status !== "ok") {
        throw new Error("Backend health check failed.")
      }
      if (currentRequestId === requestId.current) {
        setStatus("online")
        setDatabaseReportedHealthy("database" in health && health.database === "ok")
      }
    } catch {
      if (currentRequestId === requestId.current) {
        setStatus("offline")
        setDatabaseReportedHealthy(false)
      }
    } finally {
      window.clearTimeout(timeout)
      if (currentRequestId === requestId.current) setChecking(false)
    }
  }, [])

  useEffect(() => {
    void checkBackend()
    const interval = window.setInterval(() => void checkBackend(), 60_000)
    return () => {
      requestId.current += 1
      controllerRef.current?.abort()
      window.clearInterval(interval)
    }
  }, [checkBackend])

  const description = status === "online"
    ? databaseReportedHealthy
      ? "Backend API and database are healthy."
      : "Backend API is reachable; its health response does not report database status."
    : status === "offline"
      ? "Backend API could not be reached. Circuit simulation and local projects remain available."
      : "Checking backend API connectivity."

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {checking
          ? <RefreshCw size={14} className="shrink-0 animate-spin text-cyan-300" />
          : status === "online"
            ? <Wifi size={14} className="shrink-0 text-emerald-400" />
            : <WifiOff size={14} className={`shrink-0 ${status === "offline" ? "text-rose-400" : "text-slate-500"}`} />}
        <div className="min-w-0">
          <p className={`text-[11px] font-bold ${status === "online" ? "text-emerald-300" : status === "offline" ? "text-rose-300" : "text-slate-400"}`}>
            {status === "online"
              ? databaseReportedHealthy ? "Backend API + database connected" : "Backend API connected · database unverified"
              : status === "offline" ? "Backend API unreachable" : "Checking backend connection"}
          </p>
          <p className="break-words text-[10px] leading-4 text-slate-400">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void checkBackend()}
        disabled={checking}
        className="shrink-0 rounded-lg border border-slate-700 p-1.5 text-slate-400 transition hover:border-cyan-500/50 hover:text-cyan-300 disabled:cursor-wait disabled:opacity-50"
        aria-label="Check backend connection again"
        title="Check backend connection again"
      >
        <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
      </button>
    </div>
  )
}
