"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  Globe,
  X,
  RefreshCw,
  ArrowLeft,
  Activity,
  Send,
  Smartphone,
  Laptop,
  Lock,
  Wifi,
  Battery,
} from "lucide-react"
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
  const [deviceMode, setDeviceMode] = useState<"phone" | "desktop" | "network">("phone")
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

  // Inject link click interceptor script & styling into simulated HTML
  const displayBody =
    renderedHtml ||
    `
    <div style="padding: 20px 8px; text-align: center;">
      <div style="font-size: 36px; margin-bottom: 12px;">📱</div>
      <h2 style="margin: 0 0 6px 0; color: #38bdf8; font-size: 18px;">ESP32 Smart Device</h2>
      <p style="color: #94a3b8; font-size: 12px; margin: 0 0 16px 0;">
        ${
          wifiState.status === "connected"
            ? `Connected to <b>${wifiState.ssid}</b> (${wifiState.ipAddress})`
            : "Virtual Wi-Fi not connected yet. Use the Wi-Fi Connect block in Code."
        }
      </p>
      <div style="background: #1e293b; border-radius: 12px; padding: 12px; margin: 12px 0; font-size: 12px; color: #cbd5e1; text-align: left;">
        <div>📡 <b>SSID:</b> ${wifiState.ssid || "Not connected"}</div>
        <div>🌐 <b>IP:</b> ${wifiState.ipAddress}</div>
        <div>🔌 <b>HTTP Port:</b> ${wifiState.port}</div>
      </div>
      <p style="font-size: 12px; color: #64748b;">
        Define web routes in Blockly (IoT category) to display buttons and control LEDs or sensors!
      </p>
    </div>
  `

  const injectedHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #090d16;
            color: #f1f5f9;
            margin: 0;
            padding: 16px 12px;
            text-align: center;
          }
          h1, h2, h3 { color: #38bdf8; margin: 8px 0; }
          p { color: #cbd5e1; font-size: 14px; }
          a, button {
            display: inline-block;
            background: #0284c7;
            color: #ffffff;
            text-decoration: none;
            padding: 10px 18px;
            margin: 6px 4px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
            transition: all 0.15s ease-in-out;
          }
          a:hover, button:hover {
            background: #0ea5e9;
            transform: translateY(-1px);
            box-shadow: 0 6px 10px -1px rgba(0, 0, 0, 0.4);
          }
          a:active, button:active {
            transform: translateY(1px);
          }
          .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 14px;
            padding: 14px;
            margin: 12px 0;
            text-align: left;
          }
        </style>
      </head>
      <body>
        ${displayBody}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="flex flex-col items-center max-h-[92vh] w-full">
        {/* Device Switcher & Window Control Header */}
        <div className="flex items-center justify-between w-full max-w-2xl px-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-t-2xl shadow-xl backdrop-blur-md mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Globe size={14} className="text-cyan-400" />
              ESP32 IoT Browser
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                wifiState.status === "connected"
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                  : "bg-red-950/80 text-red-300 border-red-800"
              }`}
            >
              {wifiState.status === "connected" ? `🟢 Online (${wifiState.ipAddress})` : "🔴 Offline"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher Segmented Control */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setDeviceMode("phone")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  deviceMode === "phone"
                    ? "bg-cyan-600 text-slate-950 font-bold shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Smartphone View"
              >
                <Smartphone size={13} />
                <span>Phone</span>
              </button>
              <button
                onClick={() => setDeviceMode("desktop")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  deviceMode === "desktop"
                    ? "bg-cyan-600 text-slate-950 font-bold shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Desktop Browser View"
              >
                <Laptop size={13} />
                <span>Browser</span>
              </button>
              <button
                onClick={() => setDeviceMode("network")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  deviceMode === "network"
                    ? "bg-cyan-600 text-slate-950 font-bold shadow"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Network Requests"
              >
                <Activity size={13} />
                <span>Network ({wifiState.requests.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* VIEW 1: SMARTPHONE VIEW                                       */}
        {/* ============================================================== */}
        {deviceMode === "phone" && (
          <div className="relative flex flex-col items-center">
            {/* Phone Outer Chassis with hardware buttons */}
            <div className="relative w-[340px] h-[580px] bg-slate-900 border-[6px] border-slate-700/90 rounded-[52px] shadow-2xl p-2.5 flex flex-col select-none">
              {/* Left Hardware Volume buttons */}
              <div className="absolute -left-[9px] top-24 w-[3px] h-9 bg-slate-600 rounded-l-sm" />
              <div className="absolute -left-[9px] top-36 w-[3px] h-9 bg-slate-600 rounded-l-sm" />
              {/* Right Hardware Power button */}
              <div className="absolute -right-[9px] top-28 w-[3px] h-12 bg-slate-600 rounded-r-sm" />

              {/* Top Dynamic Island / Camera Notch */}
              <div className="w-28 h-5 bg-black rounded-full mx-auto mb-1 flex items-center justify-between px-3 text-[10px] text-slate-500 shadow-md shrink-0">
                <span className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-900/60" />
              </div>

              {/* iOS Mobile Status Bar */}
              <div className="flex items-center justify-between px-4 py-1 text-[11px] font-semibold text-slate-300 shrink-0 font-sans">
                <span>9:41</span>
                <div className="flex items-center gap-1.5">
                  <Wifi size={11} className={wifiState.status === "connected" ? "text-cyan-400" : "text-slate-600"} />
                  <span className="text-[10px] text-slate-400">5G</span>
                  <Battery size={13} className="text-emerald-400" />
                </div>
              </div>

              {/* Mobile Safari Address Bar */}
              <div className="mx-2 mb-2 bg-slate-950/90 border border-slate-800 rounded-full px-3 py-1 flex items-center gap-1.5 text-xs text-slate-300 shadow-inner shrink-0">
                <Lock size={10} className="text-slate-400 shrink-0" />
                <span className="text-slate-500 font-mono text-[11px] shrink-0">192.168.1.105</span>
                <input
                  type="text"
                  value={currentPath}
                  onChange={(e) => setCurrentPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigateTo(currentPath)
                  }}
                  className="flex-1 bg-transparent text-cyan-300 outline-none font-mono text-[11px]"
                  placeholder="/"
                />
                <button
                  onClick={() => navigateTo(currentPath)}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                  title="Reload"
                >
                  <RefreshCw size={11} />
                </button>
              </div>

              {/* Interactive Phone Screen Content */}
              <div className="flex-1 bg-slate-950 rounded-[32px] overflow-hidden border border-slate-800 relative flex flex-col shadow-inner">
                <iframe
                  ref={iframeRef}
                  srcDoc={injectedHtml}
                  title="ESP32 Smartphone View"
                  className="w-full flex-1 border-none bg-slate-950"
                  sandbox="allow-scripts"
                />

                {/* Quick 1-Tap Route Shortcuts on Mobile Screen */}
                {routeKeys.length > 0 && (
                  <div className="px-2 py-1.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center gap-1 overflow-x-auto text-[10px] font-mono shrink-0">
                    <span className="text-slate-500 shrink-0">Routes:</span>
                    {routeKeys.map((r) => (
                      <button
                        key={r}
                        onClick={() => navigateTo(r)}
                        className={`px-2 py-0.5 rounded-full border transition shrink-0 cursor-pointer ${
                          currentPath === r
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500 font-bold"
                            : "bg-slate-800 text-slate-300 hover:text-white border-slate-700"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Home Indicator Bar */}
              <div className="w-28 h-1 bg-slate-400/80 rounded-full mx-auto mt-2 shrink-0" />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: DESKTOP BROWSER VIEW                                   */}
        {/* ============================================================== */}
        {deviceMode === "desktop" && (
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col h-[520px]">
            {/* Desktop URL Bar */}
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

            {/* Desktop Viewport */}
            <div className="flex-1 bg-slate-950 overflow-hidden relative">
              <iframe
                ref={iframeRef}
                srcDoc={injectedHtml}
                title="Virtual ESP32 Page"
                className="w-full h-full border-none bg-slate-950"
                sandbox="allow-scripts"
              />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 3: NETWORK TRAFFIC INSPECTOR                              */}
        {/* ============================================================== */}
        {deviceMode === "network" && (
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col h-[520px]">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 text-xs font-mono text-slate-300">
              <span>HTTP Traffic Log</span>
              <span>Total: {wifiState.requests.length} requests</span>
            </div>
            <div className="h-full overflow-y-auto p-3 font-mono text-xs space-y-2 bg-slate-950">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5 text-[11px]">
                <span>METHOD · PATH</span>
                <span>STATUS · LATENCY</span>
              </div>
              {wifiState.requests.length === 0 ? (
                <div className="text-center text-slate-600 py-16">
                  No HTTP traffic recorded yet. Connect to Wi-Fi and open endpoints to record requests.
                </div>
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
          </div>
        )}
      </div>
    </div>
  )
}
