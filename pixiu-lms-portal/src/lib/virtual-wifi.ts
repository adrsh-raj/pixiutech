/**
 * Virtual Wi-Fi & Web Server Simulation Kernel for ESP32 IoT & Smart Home Projects
 * 
 * Provides:
 * 1. Virtual Wi-Fi station/AP connection state (SSID, IP address, RSSI)
 * 2. Virtual HTTP Web Server listening on port 80 (or custom port)
 * 3. Route handler registry (/led/on, /led/off, /sensor, /api, etc.)
 * 4. Virtual HTTP request dispatcher with reactive subscription for IoT UI portal
 */

export interface VirtualHttpRequest {
  id: string
  timestamp: number
  method: "GET" | "POST"
  path: string
  statusCode: number
  durationMs: number
}

export interface VirtualHttpRoute {
  path: string
  statusCode: number
  contentType: string
  responseBody: string
  handler?: () => void | Promise<void>
}

export interface VirtualWifiState {
  status: "idle" | "connecting" | "connected" | "disconnected"
  ssid: string
  ipAddress: string
  rssi: number
  serverRunning: boolean
  port: number
  routes: Record<string, VirtualHttpRoute>
  requests: VirtualHttpRequest[]
}

export const DEFAULT_VIRTUAL_IP = "192.168.1.105"

type Listener = (state: VirtualWifiState) => void

class VirtualWifiManager {
  private state: VirtualWifiState = {
    status: "idle",
    ssid: "",
    ipAddress: "0.0.0.0",
    rssi: -100,
    serverRunning: false,
    port: 80,
    routes: {},
    requests: [],
  }

  private listeners = new Set<Listener>()
  private bodyTransformer?: (body: string) => string

  public setBodyTransformer(fn: ((body: string) => string) | undefined): void {
    this.bodyTransformer = fn
  }

  public getTransformedBody(body: string): string {
    return this.bodyTransformer ? this.bodyTransformer(body) : body
  }

  public getState(): VirtualWifiState {
    const transformedRoutes: Record<string, VirtualHttpRoute> = {}
    for (const [k, r] of Object.entries(this.state.routes)) {
      transformedRoutes[k] = {
        ...r,
        responseBody: this.bodyTransformer ? this.bodyTransformer(r.responseBody) : r.responseBody,
      }
    }
    return { ...this.state, routes: transformedRoutes, requests: [...this.state.requests] }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const s = this.getState()
    for (const l of this.listeners) {
      try {
        l(s)
      } catch (err) {
        console.error("Virtual Wi-Fi subscriber error:", err)
      }
    }
  }

  public connect(ssid: string, _password?: string): void {
    const cleanSsid = ssid.trim() || "Pixiu_Home_IoT"
    this.state.status = "connecting"
    this.state.ssid = cleanSsid
    this.notify()

    // Deterministic mock connection
    this.state.status = "connected"
    this.state.ipAddress = DEFAULT_VIRTUAL_IP
    this.state.rssi = -54 // Good indoor signal
    this.notify()
  }

  public disconnect(): void {
    this.state.status = "disconnected"
    this.state.ipAddress = "0.0.0.0"
    this.state.rssi = -100
    this.state.serverRunning = false
    this.state.routes = {}
    this.notify()
  }

  public reset(): void {
    this.state = {
      status: "idle",
      ssid: "",
      ipAddress: "0.0.0.0",
      rssi: -100,
      serverRunning: false,
      port: 80,
      routes: {},
      requests: [],
    }
    this.notify()
  }

  public startServer(port: number = 80): void {
    this.state.serverRunning = true
    this.state.port = port
    const currentIp = this.state.ipAddress
    // Ensure default root route exists if not registered
    if (!this.state.routes["/"]) {
      this.state.routes["/"] = {
        path: "/",
        statusCode: 200,
        contentType: "text/html",
        responseBody: `<!DOCTYPE html><html><head><title>Pixiu ESP32 IoT Server</title><meta name='viewport' content='width=device-width, initial-scale=1'></head><body style='font-family:sans-serif;text-align:center;padding:20px;background:#090d16;color:#f8fafc'><h1>🌐 ESP32 IoT Node</h1><p>Status: Online (${currentIp})</p><div style='margin-top:20px;'><a href='/led/on' data-href='/led/on' style='display:inline-block;padding:10px 20px;background:#22c55e;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;margin:6px;'>Turn ON LED</a><a href='/led/off' data-href='/led/off' style='display:inline-block;padding:10px 20px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:6px;'>Turn OFF LED</a></div></body></html>`,
      }
    }
    if (!this.state.routes["/led/on"]) {
      this.state.routes["/led/on"] = {
        path: "/led/on",
        statusCode: 200,
        contentType: "text/html",
        responseBody: `<!DOCTYPE html><html><head><title>LED Status: ON</title><meta name='viewport' content='width=device-width, initial-scale=1'></head><body style='font-family:sans-serif;text-align:center;padding:20px;background:#090d16;color:#f8fafc'><div style='font-size:42px;margin-bottom:12px;'>💡</div><h2 style='color:#22c55e;margin:0 0 8px 0;'>LED Status: ON</h2><p style='color:#94a3b8;font-size:13px;'>Virtual Pin D2 set to HIGH</p><div style='margin-top:20px;'><a href='/led/off' data-href='/led/off' style='display:inline-block;padding:10px 20px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:6px;'>Turn OFF LED</a><a href='/' data-href='/' style='display:inline-block;padding:10px 20px;background:#38bdf8;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;margin:6px;'>← Dashboard</a></div></body></html>`,
      }
    }
    if (!this.state.routes["/led/off"]) {
      this.state.routes["/led/off"] = {
        path: "/led/off",
        statusCode: 200,
        contentType: "text/html",
        responseBody: `<!DOCTYPE html><html><head><title>LED Status: OFF</title><meta name='viewport' content='width=device-width, initial-scale=1'></head><body style='font-family:sans-serif;text-align:center;padding:20px;background:#090d16;color:#f8fafc'><div style='font-size:42px;margin-bottom:12px;'>⚫</div><h2 style='color:#94a3b8;margin:0 0 8px 0;'>LED Status: OFF</h2><p style='color:#64748b;font-size:13px;'>Virtual Pin D2 set to LOW</p><div style='margin-top:20px;'><a href='/led/on' data-href='/led/on' style='display:inline-block;padding:10px 20px;background:#22c55e;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;margin:6px;'>Turn ON LED</a><a href='/' data-href='/' style='display:inline-block;padding:10px 20px;background:#38bdf8;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;margin:6px;'>← Dashboard</a></div></body></html>`,
      }
    }
    this.notify()
  }

  private normalizePath(path: string): string {
    let clean = (path || "/").trim()
    clean = clean.split("?")[0].split("#")[0]
    clean = clean.replace(/^https?:\/\/[^\/]+/i, "")
    clean = clean.replace(/^192\.168\.\d+\.\d+(:\d+)?/i, "")
    if (!clean.startsWith("/")) {
      clean = `/${clean}`
    }
    if (clean.length > 1 && clean.endsWith("/")) {
      clean = clean.slice(0, -1)
    }
    return clean
  }

  public registerRoute(
    path: string,
    handler?: () => void,
    statusCode: number = 200,
    contentType: string = "text/html",
    responseBody?: string
  ): void {
    const cleanPath = this.normalizePath(path)
    const isActivating = cleanPath.includes("on")
    const isDeactivating = cleanPath.includes("off")
    const badgeHtml = isActivating
      ? "<div style='display:inline-block;padding:6px 14px;background:#064e3b;border:1px solid #059669;border-radius:9999px;color:#34d399;font-size:11px;font-weight:700;margin-bottom:10px;'>🟢 PIN ACTIVE (HIGH)</div>"
      : isDeactivating
      ? "<div style='display:inline-block;padding:6px 14px;background:#1e293b;border:1px solid #475569;border-radius:9999px;color:#94a3b8;font-size:11px;font-weight:700;margin-bottom:10px;'>⚪ PIN INACTIVE (LOW)</div>"
      : "<div style='display:inline-block;padding:6px 14px;background:#0369a1;border:1px solid #0284c7;border-radius:9999px;color:#bae6fd;font-size:11px;font-weight:700;margin-bottom:10px;'>🌐 HTTP 200 OK</div>"

    const defaultHtml = `<!DOCTYPE html><html><head><title>Route ${cleanPath}</title></head><body style='font-family:system-ui,sans-serif;padding:24px 16px;background:#090d16;color:#f8fafc;text-align:center;'>${badgeHtml}<h2 style='color:#38bdf8;margin:6px 0 12px 0;font-size:18px;'>Route: ${cleanPath} executed!</h2><p style='color:#94a3b8;font-size:13px;line-height:1.5;margin-bottom:18px;'>ESP32 web server handled this endpoint and drove circuit state.</p><div style='display:flex;gap:8px;justify-content:center;flex-wrap:wrap;'><a href='/' data-href='/' style='display:inline-block;padding:8px 16px;background:#0284c7;color:#fff;border-radius:10px;text-decoration:none;font-size:12px;font-weight:600;'>← Dashboard</a>${isActivating ? "<a href='/led/off' data-href='/led/off' style='display:inline-block;padding:8px 16px;background:#334155;color:#f8fafc;border-radius:10px;text-decoration:none;font-size:12px;font-weight:600;'>Turn OFF</a>" : isDeactivating ? "<a href='/led/on' data-href='/led/on' style='display:inline-block;padding:8px 16px;background:#10b981;color:#fff;border-radius:10px;text-decoration:none;font-size:12px;font-weight:600;'>Turn ON</a>" : ""}</div></body></html>`

    this.state.routes[cleanPath] = {
      path: cleanPath,
      statusCode,
      contentType,
      responseBody: responseBody ?? defaultHtml,
      handler,
    }
    this.notify()
  }

  public setRouteResponse(path: string, statusCode: number, contentType: string, responseBody: string): void {
    const cleanPath = this.normalizePath(path)
    if (this.state.routes[cleanPath]) {
      this.state.routes[cleanPath].statusCode = statusCode
      this.state.routes[cleanPath].contentType = contentType
      this.state.routes[cleanPath].responseBody = responseBody
    } else {
      this.state.routes[cleanPath] = {
        path: cleanPath,
        statusCode,
        contentType,
        responseBody,
      }
    }
    this.notify()
  }

  public async dispatchRequest(
    path: string,
    method: "GET" | "POST" = "GET",
  ): Promise<{ statusCode: number; contentType: string; body: string }> {
    const startTime = performance.now()
    const cleanPath = this.normalizePath(path)
    const route = this.state.routes[cleanPath]

    if (!route) {
      const notFoundBody = `<!DOCTYPE html><html><body style='font-family:sans-serif;padding:20px;background:#090d16;color:#f8fafc'><h2>404 Not Found</h2><p>No route registered for: ${cleanPath}</p><a href='/' data-href='/' style='color:#38bdf8'>← Return to Dashboard</a></body></html>`
      this.logRequest(method, cleanPath, 404, Math.round(performance.now() - startTime))
      return { statusCode: 404, contentType: "text/html", body: notFoundBody }
    }

    // Execute route handler callback if registered
    if (route.handler) {
      try {
        await Promise.resolve(route.handler())
      } catch (err) {
        console.error(`Error in route handler for ${cleanPath}:`, err)
      }
    }

    const duration = Math.max(1, Math.round(performance.now() - startTime))
    this.logRequest(method, cleanPath, route.statusCode, duration)

    return {
      statusCode: route.statusCode,
      contentType: route.contentType,
      body: this.getTransformedBody(route.responseBody),
    }
  }

  private logRequest(method: "GET" | "POST", path: string, statusCode: number, durationMs: number): void {
    const req: VirtualHttpRequest = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      method,
      path,
      statusCode,
      durationMs,
    }
    this.state.requests = [req, ...this.state.requests].slice(0, 50)
    this.notify()
  }
}

export const virtualWifiManager = new VirtualWifiManager()
