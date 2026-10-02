"use client"

import React, { useState, useEffect, useRef } from "react"
import { Globe, X, RefreshCw, ArrowLeft, ArrowRight, Activity, Radio, Send, ExternalLink } from "lucide-react"
import { virtualWifiManager, type VirtualWifiState } from "@/lib/virtual-wifi"

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function IotWebPortal({ isOpen, onClose }: Props) {
  const [wifiState, setWifiState] = useState<VirtualWifiState>(() => virtualWifiManager.getState())
  const [currentPath, setCurrentPath] = useState("/")
  const [renderedHtml, setRenderedHtml] = useState("")
  const [statusCode, setStatusCode] = useState(200)
  const [activeTab, setActiveTab] = useState<"browser" | "network">("browser")
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    return virtualWifiManager.subscribe((state) => {
      setWifiState(state)
    })
  }, [])

  // Execute initial request when opened or path changed
  const navigateTo = async (path: string) => {
    const clean = path.startsWith("/") ? path : `/${path}`
    setCurrentPath(clean)
    const res = await virtualWifiManager.dispatchRequest(clean, "GET")
    setStatusCode(res.statusCode)
    setRenderedHtml(res.body)
  }

  useEffect(() => {
    if (isOpen) {
      navigateTo(currentPath)
    }
  }, [isOpen])

  // Handle in-iframe navigation clicks
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && typeof e.data === "object" && e.data.type === "PIXIU_IOT_NAVIGATE") {
        navigateTo(e.data.path)
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  if (!isOpen) return null

  // Inject link click interceptor script into simulated HTML
  const injectedHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #090d16; color: #f8fafc; margin: 0; padding: 16px; }
          a, button { cursor: pointer; transition: all 0.2s; }
          a:hover, button:hover { opacity: 0.85; transform: scale(1.02); }
        </style>
      </head>
      <body>
        ${renderedHtml}
        <script>
          document.addEventListener('click', function(e) {
            var target = e.target.closest('a');
            if (target && target.getAttribute('href')) {
              e.preventDefault();
              var href = target.getAttribute('href');
              window.parent.postMessage({ type: 'PIXIU_IOT_NAVIGATE', path: href }, '*');
            }
          });
        </script>
      </body>
    </html>
  `

  const routeKeys = Object.keys(wifiState.routes)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Browser Top Window Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
            </div>
            <div className="flex items-center gap-1.5 ml-3 font-mono text-xs text-slate-300">
              <Globe size={14} className="text-cyan-400" />
              <span className="font-bold text-white">ESP32 IoT Browser</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                {wifiState.status === "connected" ? `🟢 ${wifiState.ipAddress}:${wifiState.port}` : "🔴 Offline"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab(activeTab === "browser" ? "network" : "browser")}
              className={`px-2 py-1 rounded text-xs font-mono transition cursor-pointer flex items-center gap-1 ${
                activeTab === "network" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400 hover:text-white"
              }`}
            >
              <Activity size={12} />
              <span>Network ({wifiState.requests.length})</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Browser URL Navigation Bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-1 text-slate-400">
            <button
              onClick={() => navigateTo("/")}
              className="p-1 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
              title="Home Route"
            >
              <ArrowLeft size={13} />
            </button>
            <button
              onClick={() => navigateTo(currentPath)}
              className="p-1 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
              title="Reload Route"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          <div className="flex-1 flex items-center bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-xs shadow-inner">
            <span className="text-slate-500 select-none mr-1">http://{wifiState.ipAddress}</span>
            <input
              type="text"
              value={currentPath}
              onChange={(e) => setCurrentPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigateTo(currentPath)
              }}
              className="flex-1 bg-transparent text-cyan-300 outline-none font-bold"
              placeholder="/"
            />
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                statusCode >= 200 && statusCode < 300
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  : "bg-red-950 text-red-400 border border-red-800"
              }`}
            >
              {statusCode}
            </span>
          </div>

          <button
            onClick={() => navigateTo(currentPath)}
            className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg transition cursor-pointer flex items-center gap-1 text-xs"
          >
            <Send size={11} />
            <span>Go</span>
          </button>
        </div>

        {/* Quick Endpoint Pills */}
        {routeKeys.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/60 border-b border-slate-800/60 overflow-x-auto text-[11px] font-mono">
            <span className="text-slate-500 shrink-0 text-[10px]">Endpoints:</span>
            {routeKeys.map((r) => (
              <button
                key={r}
                onClick={() => navigateTo(r)}
                className={`px-2 py-0.5 rounded-full border transition shrink-0 cursor-pointer ${
                  currentPath === r
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold"
                    : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700"
                }`}
              >
                GET {r}
              </button>
            ))}
          </div>
        )}

        {/* Viewport: Web Page or Network Inspector */}
        <div className="flex-1 bg-slate-950 overflow-hidden relative">
          {activeTab === "browser" ? (
            <iframe
              ref={iframeRef}
              srcDoc={injectedHtml}
              title="Virtual ESP32 Page"
              className="w-full h-full border-none bg-slate-950"
              sandbox="allow-scripts"
            />
          ) : (
            /* Network Requests Inspector */
            <div className="h-full overflow-y-auto p-3 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5 text-[11px]">
                <span>METHOD · PATH</span>
                <span>STATUS · LATENCY</span>
              </div>
              {wifiState.requests.length === 0 ? (
                <div className="text-center text-slate-600 py-12">No HTTP traffic recorded yet.</div>
              ) : (
                wifiState.requests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300">
                        {req.method}
                      </span>
                      <span className="text-slate-200 font-semibold">{req.path}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          req.statusCode >= 200 && req.statusCode < 300
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : "bg-red-950 text-red-400 border border-red-800"
                        }`}
                      >
                        {req.statusCode}
                      </span>
                      <span className="text-[10px] text-slate-500">{req.durationMs}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
