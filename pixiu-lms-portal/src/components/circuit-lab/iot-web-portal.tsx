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
  GripHorizontal,
  Minimize2,
  Maximize2,
} from "lucide-react"
import { virtualWifiManager, type VirtualWifiState } from "@/lib/virtual-wifi"

interface Props {
  isOpen: boolean
  onClose: () => void
}

function virtualizeHtml(raw: string): string {
  if (!raw) return ""

  let content = raw

  // Extract head styles if full document
  let extractedStyles = ""
  const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi)
  if (styleMatches) {
    extractedStyles = styleMatches.join("\n")
  }

  // If full HTML document, extract inner body content
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) {
    content = bodyMatch[1]
  } else {
    // Strip <!DOCTYPE>, <html>, <head> tags if lingering
    content = content
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<html[^>]*>/gi, "")
      .replace(/<\/html>/gi, "")
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
      .replace(/<body[^>]*>/gi, "")
      .replace(/<\/body>/gi, "")
  }

  // Rewrite all <a href="..."> tags to data-href with preventDefault
  content = content.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
    const hrefMatch = attrs.match(/href=(["'])(.*?)\1/i)
    if (!hrefMatch) return match
    const hrefVal = hrefMatch[2]

    const cleanPath =
      hrefVal.replace(/^https?:\/\/[^\/]+/i, "").replace(/^192\.168\.\d+\.\d+(:\d+)?/i, "") || "/"

    let cleanAttrs = attrs.replace(/href=(["'])(.*?)\1/i, "")
    cleanAttrs = cleanAttrs.replace(/onclick=(["'])(.*?)\1/i, "")

    return `<a${cleanAttrs} href="#" data-href="${cleanPath}">`
  })

  // Rewrite <form action="..."> tags
  content = content.replace(/<form\b([^>]*)>/gi, (match, attrs) => {
    const actionMatch = attrs.match(/action=(["'])(.*?)\1/i)
    const actionVal = actionMatch ? actionMatch[2] : "/"
    const cleanPath =
      actionVal.replace(/^https?:\/\/[^\/]+/i, "").replace(/^192\.168\.\d+\.\d+(:\d+)?/i, "") || "/"

    let cleanAttrs = attrs.replace(/onsubmit=(["'])(.*?)\1/i, "")
    return `<form${cleanAttrs} data-action="${cleanPath}">`
  })

  return extractedStyles ? `${extractedStyles}\n${content}` : content
}

interface VirtualScreenProps {
  html: string
  onNavigate: (path: string) => void
}

function VirtualScreenView({ html, onNavigate }: VirtualScreenProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const shadowRootRef = useRef<ShadowRoot | null>(null)

  useEffect(() => {
    if (!hostRef.current) return

    if (!shadowRootRef.current) {
      shadowRootRef.current = hostRef.current.attachShadow({ mode: "open" })
    }

    const shadow = shadowRootRef.current
    const processedHtml = virtualizeHtml(html)

    const fullDoc = `
      <style>
        * { box-sizing: border-box; }
        :host {
          display: block;
          width: 100%;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          background: #090d16;
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          user-select: text;
        }
        .virtual-viewport {
          margin: 0;
          padding: 16px 12px;
          text-align: center;
          min-height: 100%;
        }
        h1, h2, h3 { color: #38bdf8; margin: 8px 0; }
        p { color: #cbd5e1; font-size: 13px; line-height: 1.5; }
        a, button, input[type="submit"] {
          display: inline-block;
          background: #0284c7;
          color: #ffffff;
          text-decoration: none;
          padding: 9px 16px;
          margin: 6px 4px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 13px;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
          transition: all 0.15s ease-in-out;
        }
        a:hover, button:hover, input[type="submit"]:hover {
          background: #0ea5e9;
          transform: translateY(-1px);
        }
        a:active, button:active, input[type="submit"]:active {
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
      <div class="virtual-viewport">
        ${processedHtml}
      </div>
    `

    shadow.innerHTML = fullDoc

    const handleClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a")
      if (a) {
        e.preventDefault()
        e.stopPropagation()
        const href = a.getAttribute("data-href") || a.getAttribute("href")
        if (href && href !== "#" && !href.startsWith("javascript:")) {
          try {
            window.postMessage({ type: "PIXIU_IOT_NAVIGATE", path: href }, "*")
          } catch {
            /* noop */
          }
          onNavigate(href)
        }
      }
    }

    const handleSubmit = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      const form = e.target as HTMLElement
      const action = form.getAttribute("data-action") || form.getAttribute("action") || "/"
      try {
        window.postMessage({ type: "PIXIU_IOT_NAVIGATE", path: action }, "*")
      } catch {
        /* noop */
      }
      onNavigate(action)
    }

    shadow.addEventListener("click", handleClick)
    shadow.addEventListener("submit", handleSubmit)

    return () => {
      shadow.removeEventListener("click", handleClick)
      shadow.removeEventListener("submit", handleSubmit)
    }
  }, [html, onNavigate])

  return <div ref={hostRef} className="w-full h-full flex-1 overflow-hidden" />
}

export function IotWebPortal({ isOpen, onClose }: Props) {
  const [wifiState, setWifiState] = useState<VirtualWifiState>(() => virtualWifiManager.getState())
  const [currentPath, setCurrentPath] = useState("/")
  const [renderedHtml, setRenderedHtml] = useState("")
  const [statusCode, setStatusCode] = useState(200)
  const [deviceMode, setDeviceMode] = useState<"phone" | "desktop" | "network">("phone")
  const [minimized, setMinimized] = useState(false)

  // Dragging support (movable on canvas just like Multimeter & Oscilloscope)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  })

  useEffect(() => {
    return virtualWifiManager.subscribe((state) => {
      setWifiState(state)
    })
  }, [])

  const navigateTo = async (path: string) => {
    let clean = (path || "/").trim()
    clean = clean.replace(/^https?:\/\/[^\/]+/i, "")
    clean = clean.replace(/^192\.168\.\d+\.\d+(:\d+)?/i, "")
    if (!clean.startsWith("/")) {
      clean = `/${clean}`
    }
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

  if (!isOpen) return null

  // Pointer drag event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return
    const panel = panelRef.current
    if (!panel) return

    const rect = panel.getBoundingClientRect()
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.left,
      startY: rect.top,
    }
    panel.style.left = `${rect.left}px`
    panel.style.top = `${rect.top}px`
    panel.style.right = "auto"
    panel.style.bottom = "auto"
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const panel = panelRef.current
    if (!panel || !(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return

    const dx = e.clientX - dragStartRef.current.mouseX
    const dy = e.clientY - dragStartRef.current.mouseY
    const newX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.startX + dx))
    const newY = Math.max(50, Math.min(window.innerHeight - 100, dragStartRef.current.startY + dy))

    panel.style.left = `${newX}px`
    panel.style.top = `${newY}px`
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const defaultWelcomeBody = `
    <div style="padding: 16px 8px; text-align: center;">
      <div style="font-size: 34px; margin-bottom: 10px;">📱</div>
      <h2 style="margin: 0 0 6px 0; color: #38bdf8; font-size: 17px;">ESP32 Smart Device</h2>
      <p style="color: #94a3b8; font-size: 12px; margin: 0 0 14px 0;">
        ${
          wifiState.status === "connected"
            ? `Connected to <b>${wifiState.ssid}</b> (${wifiState.ipAddress})`
            : "Virtual Wi-Fi not connected yet. Use the Wi-Fi Connect block in Code."
        }
      </p>
      <div style="background: #1e293b; border-radius: 12px; padding: 12px; margin: 12px 0; font-size: 11px; color: #cbd5e1; text-align: left;">
        <div>📡 <b>SSID:</b> ${wifiState.ssid || "Not connected"}</div>
        <div>🌐 <b>IP:</b> ${wifiState.ipAddress}</div>
        <div>🔌 <b>HTTP Port:</b> ${wifiState.port}</div>
      </div>
      <p style="font-size: 11px; color: #64748b;">
        Define web routes in Blockly (IoT category) to display buttons and control LEDs or sensors!
      </p>
    </div>
  `

  const activeHtml = renderedHtml || defaultWelcomeBody
  const routeKeys = Object.keys(wifiState.routes)

  return (
    <div
      ref={panelRef}
      style={{ right: "20px", top: "68px" }}
      className="fixed z-40 pointer-events-auto select-none touch-none shadow-2xl animate-in fade-in zoom-in-95 duration-100"
    >
      {/* ============================================================== */}
      {/* MINIMIZED STATE PILL                                           */}
      {/* ============================================================== */}
      {minimized ? (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-cyan-500/60 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-md cursor-move ring-1 ring-cyan-500/30"
        >
          <GripHorizontal size={13} className="text-slate-500" />
          <div className="flex items-center gap-1.5">
            <Smartphone size={14} className="text-cyan-400" />
            <span className="font-mono text-xs font-bold text-slate-200">ESP32 IoT</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                wifiState.status === "connected"
                  ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                  : "bg-red-950 text-red-300 border-red-700"
              }`}
            >
              {wifiState.status === "connected" ? `🟢 ${wifiState.ipAddress}` : "🔴 Offline"}
            </span>
          </div>
          <div className="flex items-center gap-1 ml-1 border-l border-slate-700 pl-1.5">
            <button
              onClick={() => setMinimized(false)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
              title="Expand ESP32 Device"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition cursor-pointer"
              title="Close ESP32 Device"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* FULL FLOATING INSTRUMENT CHASSIS (CANVAS VISIBLE BEHIND IT)    */
        /* ============================================================== */
        <div className="flex flex-col items-center">
          {/* Draggable Instrument Header */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="flex items-center justify-between w-full max-w-[340px] sm:max-w-md px-3.5 py-2 bg-slate-900/95 border border-slate-700/90 rounded-t-2xl shadow-xl backdrop-blur-md cursor-move mb-1 select-none"
          >
            <div className="flex items-center gap-2">
              <GripHorizontal size={14} className="text-slate-500" />
              <span className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Globe size={13} className="text-cyan-400" />
                ESP32 IoT Browser
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${
                  wifiState.status === "connected"
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                    : "bg-red-950/80 text-red-300 border-red-800"
                }`}
              >
                {wifiState.status === "connected" ? `🟢 ${wifiState.ipAddress}` : "🔴 Offline"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Mode Switcher */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
                <button
                  onClick={() => setDeviceMode("phone")}
                  className={`px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer ${
                    deviceMode === "phone"
                      ? "bg-cyan-600 text-slate-950 font-bold shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Smartphone View"
                >
                  <Smartphone size={12} />
                  <span>Phone</span>
                </button>
                <button
                  onClick={() => setDeviceMode("desktop")}
                  className={`px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer ${
                    deviceMode === "desktop"
                      ? "bg-cyan-600 text-slate-950 font-bold shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Desktop Browser View"
                >
                  <Laptop size={12} />
                  <span>Web</span>
                </button>
                <button
                  onClick={() => setDeviceMode("network")}
                  className={`px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer ${
                    deviceMode === "network"
                      ? "bg-cyan-600 text-slate-950 font-bold shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Network Log"
                >
                  <Activity size={12} />
                  <span>Network ({wifiState.requests.length})</span>
                </button>
              </div>

              <button
                onClick={() => setMinimized(true)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Minimize Device"
              >
                <Minimize2 size={13} />
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
                title="Close Device"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* VIEW 1: SMARTPHONE VIEW                                       */}
          {/* ============================================================== */}
          {deviceMode === "phone" && (
            <div className="relative w-[320px] h-[500px] bg-slate-900 border-[5px] border-slate-700/90 rounded-[48px] shadow-2xl p-2 flex flex-col select-none ring-1 ring-cyan-500/20">
              {/* Left Hardware Volume buttons */}
              <div className="absolute -left-[7px] top-20 w-[3px] h-7 bg-slate-600 rounded-l-sm" />
              <div className="absolute -left-[7px] top-30 w-[3px] h-7 bg-slate-600 rounded-l-sm" />
              {/* Right Hardware Power button */}
              <div className="absolute -right-[7px] top-24 w-[3px] h-10 bg-slate-600 rounded-r-sm" />

              {/* Dynamic Island Notch */}
              <div className="w-24 h-4 bg-black rounded-full mx-auto mb-1 flex items-center justify-between px-2.5 text-[9px] text-slate-500 shadow-md shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 border border-slate-700" />
                <span className="w-1 h-1 rounded-full bg-cyan-900/60" />
              </div>

              {/* iOS Mobile Status Bar */}
              <div className="flex items-center justify-between px-3 py-0.5 text-[10px] font-semibold text-slate-300 shrink-0 font-sans">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <Wifi size={10} className={wifiState.status === "connected" ? "text-cyan-400" : "text-slate-600"} />
                  <span className="text-[9px] text-slate-400">5G</span>
                  <Battery size={11} className="text-emerald-400" />
                </div>
              </div>

              {/* Mobile Safari Address Bar */}
              <div className="mx-1.5 mb-1.5 bg-slate-950/90 border border-slate-800 rounded-full px-2.5 py-1 flex items-center gap-1.5 text-xs text-slate-300 shadow-inner shrink-0">
                <Lock size={9} className="text-slate-400 shrink-0" />
                <span className="text-slate-500 font-mono text-[10px] shrink-0">192.168.1.105</span>
                <input
                  type="text"
                  value={currentPath}
                  onChange={(e) => setCurrentPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigateTo(currentPath)
                  }}
                  className="flex-1 bg-transparent text-cyan-300 outline-none font-mono text-[10px]"
                  placeholder="/"
                />
                <button
                  onClick={() => navigateTo(currentPath)}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer shrink-0"
                  title="Reload"
                >
                  <RefreshCw size={10} />
                </button>
              </div>

              {/* Interactive Phone Screen Content (Isolated Shadow DOM Viewport) */}
              <div className="flex-1 bg-slate-950 rounded-[28px] overflow-hidden border border-slate-800 relative flex flex-col shadow-inner">
                <VirtualScreenView html={activeHtml} onNavigate={navigateTo} />

                {/* Quick 1-Tap Route Shortcuts */}
                {routeKeys.length > 0 && (
                  <div className="px-2 py-1 bg-slate-900/90 border-t border-slate-800/80 flex items-center gap-1 overflow-x-auto text-[10px] font-mono shrink-0">
                    <span className="text-slate-500 shrink-0 text-[9px]">Routes:</span>
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
              <div className="w-24 h-1 bg-slate-400/80 rounded-full mx-auto mt-1.5 shrink-0" />
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 2: DESKTOP BROWSER VIEW                                   */}
          {/* ============================================================== */}
          {deviceMode === "desktop" && (
            <div className="w-[340px] sm:w-[420px] rounded-b-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col h-[460px] ring-1 ring-cyan-500/20">
              {/* Desktop URL Bar */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    onClick={() => navigateTo("/")}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                    title="Home Route"
                  >
                    <ArrowLeft size={12} />
                  </button>
                  <button
                    onClick={() => navigateTo(currentPath)}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                    title="Reload Route"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>

                <div className="flex-1 flex items-center bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-0.5 text-slate-200 font-mono text-[11px] shadow-inner">
                  <span className="text-slate-500 select-none mr-1">http://{wifiState.ipAddress}</span>
                  <input
                    type="text"
                    value={currentPath}
                    onChange={(e) => setCurrentPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigateTo(currentPath)
                    }}
                    className="flex-1 bg-transparent text-cyan-300 outline-none font-bold text-xs"
                    placeholder="/"
                  />
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-bold ${
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
                  className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px]"
                >
                  <Send size={10} />
                  <span>Go</span>
                </button>
              </div>

              {/* Quick Endpoint Pills */}
              {routeKeys.length > 0 && (
                <div className="flex items-center gap-1 px-3 py-1 bg-slate-950/60 border-b border-slate-800/60 overflow-x-auto text-[10px] font-mono">
                  <span className="text-slate-500 shrink-0 text-[9px]">Endpoints:</span>
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

              {/* Desktop Viewport (Isolated Shadow DOM) */}
              <div className="flex-1 bg-slate-950 overflow-hidden relative">
                <VirtualScreenView html={activeHtml} onNavigate={navigateTo} />
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 3: NETWORK TRAFFIC INSPECTOR                              */}
          {/* ============================================================== */}
          {deviceMode === "network" && (
            <div className="w-[340px] sm:w-[420px] rounded-b-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col h-[460px] ring-1 ring-cyan-500/20">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-xs font-mono text-slate-300">
                <span>HTTP Traffic Log</span>
                <span className="text-[10px] text-slate-400">Total: {wifiState.requests.length} requests</span>
              </div>
              <div className="h-full overflow-y-auto p-2.5 font-mono text-xs space-y-1.5 bg-slate-950">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1 text-[10px]">
                  <span>METHOD · PATH</span>
                  <span>STATUS · LATENCY</span>
                </div>
                {wifiState.requests.length === 0 ? (
                  <div className="text-center text-slate-600 py-16 text-xs">
                    No HTTP traffic recorded yet. Open endpoints to record virtual requests.
                  </div>
                ) : (
                  wifiState.requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-cyan-300">
                          {req.method}
                        </span>
                        <span className="text-slate-200 font-semibold">{req.path}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
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
      )}
    </div>
  )
}
