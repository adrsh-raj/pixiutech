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

  public getState(): VirtualWifiState {
    return { ...this.state, routes: { ...this.state.routes }, requests: [...this.state.requests] }
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
    this.state.ipAddress = "192.168.1.105"
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
    // Ensure default root route exists if not registered
    if (!this.state.routes["/"]) {
      this.state.routes["/"] = {
        path: "/",
        statusCode: 200,
        contentType: "text/html",
        responseBody: `<!DOCTYPE html><html><head><title>Pixiu ESP32 IoT Server</title><meta name='viewport' content='width=device-width, initial-scale=1'></head><body style='font-family:sans-serif;text-align:center;padding:20px;background:#090d16;color:#f8fafc'><h1>🌐 ESP32 IoT Node</h1><p>Status: Online (192.168.1.105)</p><div style='margin-top:20px;'><a href='/led/on' style='display:inline-block;padding:10px 20px;background:#22c55e;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;margin:6px;'>Turn ON LED</a><a href='/led/off' style='display:inline-block;padding:10px 20px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:6px;'>Turn OFF LED</a></div></body></html>`,
      }
    }
    this.notify()
  }

  public registerRoute(
    path: string,
    handler?: () => void,
    statusCode: number = 200,
    contentType: string = "text/html",
    responseBody?: string
  ): void {
    const cleanPath = path.startsWith("/") ? path : `/${path}`
    this.state.routes[cleanPath] = {
      path: cleanPath,
      statusCode,
      contentType,
      responseBody:
        responseBody ??
        `<!DOCTYPE html><html><head><title>Route ${cleanPath}</title></head><body style='font-family:sans-serif;padding:20px;background:#090d16;color:#f8fafc'><h2>Route: ${cleanPath} executed!</h2><p><a href='/' style='color:#38bdf8'>← Return to Dashboard</a></p></body></html>`,
      handler,
    }
    this.notify()
  }

  public setRouteResponse(path: string, statusCode: number, contentType: string, responseBody: string): void {
    const cleanPath = path.startsWith("/") ? path : `/${path}`
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
    const cleanPath = path.startsWith("/") ? path : `/${path}`
    const route = this.state.routes[cleanPath]

    if (!route) {
      const notFoundBody = `<!DOCTYPE html><html><body style='font-family:sans-serif;padding:20px;background:#090d16;color:#f8fafc'><h2>404 Not Found</h2><p>No route registered for: ${cleanPath}</p></body></html>`
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
      body: route.responseBody,
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
