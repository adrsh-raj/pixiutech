#!/usr/bin/env node

/**
 * Phase 4 Automated QA Gate: Virtual Wi-Fi & Web Server Simulation Kernel Verification
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

console.log("=== Pixiu CyberLab Phase 4: Virtual Wi-Fi & Web Server QA Gate ===")

const readSource = (relativePath) => {
  const fullPath = path.join(rootDir, relativePath)
  assert.ok(fs.existsSync(fullPath), `File must exist: ${relativePath}`)
  return fs.readFileSync(fullPath, "utf8")
}

const virtualWifiSrc = readSource("pixiu-lms-portal/src/lib/virtual-wifi.ts")
const arduinoBlocksSrc = readSource("pixiu-lms-portal/src/lib/arduino-blocks.ts")
const blocklyRunnerSrc = readSource("pixiu-lms-portal/src/lib/blockly-runner.ts")
const blocklyEditorSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/blockly-editor.tsx")
const iotWebPortalSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/iot-web-portal.tsx")
const workbenchSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
const paletteSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/palette.tsx")

// ---------------------------------------------------------------------------
// Step 1: Virtual Wi-Fi Manager Kernel Architecture
// ---------------------------------------------------------------------------
console.log("\n[Test 1] Verifying Virtual Wi-Fi & HTTP Server Kernel Architecture...")

assert.ok(virtualWifiSrc.includes("interface VirtualHttpRequest"), "VirtualHttpRequest interface must be defined")
assert.ok(virtualWifiSrc.includes("interface VirtualHttpRoute"), "VirtualHttpRoute interface must be defined")
assert.ok(virtualWifiSrc.includes("interface VirtualWifiState"), "VirtualWifiState interface must be defined")
assert.ok(virtualWifiSrc.includes("class VirtualWifiManager"), "VirtualWifiManager class must be defined")

// Verify deterministic Wi-Fi connection parameters
assert.ok(virtualWifiSrc.includes('"192.168.1.105"'), "Wi-Fi manager must assign standard 192.168.1.105 station IP")
assert.ok(virtualWifiSrc.includes("rssi = -54"), "Wi-Fi manager must set realistic indoor RSSI (-54 dBm)")

// Verify Web Server lifecycle & routes
assert.ok(virtualWifiSrc.includes("startServer(port: number = 80)"), "Web server must start on port 80 by default")
assert.ok(virtualWifiSrc.includes("registerRoute("), "Route registration must be supported")
assert.ok(virtualWifiSrc.includes("setRouteResponse("), "Route response updating must be supported")
assert.ok(virtualWifiSrc.includes("async dispatchRequest("), "HTTP dispatcher must support async route execution")
assert.ok(virtualWifiSrc.includes("virtualWifiManager = new VirtualWifiManager()"), "Singleton virtualWifiManager must be exported")
console.log("✔ Step 1 Passed: Virtual Wi-Fi & HTTP Server Kernel verified.")

// ---------------------------------------------------------------------------
// Step 2: Blockly Wi-Fi Block Definitions & C++ Generators
// ---------------------------------------------------------------------------
console.log("\n[Test 2] Verifying Blockly Wi-Fi Blocks & Code Generators...")

// Verify block definitions
assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['wifi_connect']"), "wifi_connect block must be defined")
assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['wifi_is_connected']"), "wifi_is_connected block must be defined")
assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['wifi_local_ip']"), "wifi_local_ip block must be defined")
assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['wifi_server_begin']"), "wifi_server_begin block must be defined")
assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['wifi_server_on']"), "wifi_server_on block must be defined")
assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['wifi_server_send']"), "wifi_server_send block must be defined")

// Verify C++ generators
assert.ok(arduinoBlocksSrc.includes("WiFi.begin("), "C++ generator must emit WiFi.begin")
assert.ok(arduinoBlocksSrc.includes("WiFi.status() == WL_CONNECTED"), "C++ generator must emit WiFi.status check")
assert.ok(arduinoBlocksSrc.includes("WiFi.localIP().toString()"), "C++ generator must emit WiFi.localIP string conversion")
assert.ok(arduinoBlocksSrc.includes("server.begin("), "C++ generator must emit server.begin(port)")
assert.ok(arduinoBlocksSrc.includes('server.on('), "C++ generator must emit server.on route registration")
assert.ok(arduinoBlocksSrc.includes('server.send('), "C++ generator must emit server.send HTTP response")
console.log("✔ Step 2 Passed: All 6 Wi-Fi blocks and Arduino C++ generators verified.")

// ---------------------------------------------------------------------------
// Step 3: Blockly Editor Toolbox Category
// ---------------------------------------------------------------------------
console.log("\n[Test 3] Verifying Blockly Editor Toolbox Category...")

assert.ok(blocklyEditorSrc.includes("'📡 IoT & Wi-Fi'"), "Blockly toolbox must include IoT & Wi-Fi category")
assert.ok(blocklyEditorSrc.includes("'#0284c7'"), "IoT category must use sky/cyan accent color")
assert.ok(blocklyEditorSrc.includes("'wifi_connect'"), "Toolbox must contain wifi_connect block")
assert.ok(blocklyEditorSrc.includes("'wifi_server_begin'"), "Toolbox must contain wifi_server_begin block")
assert.ok(blocklyEditorSrc.includes("'wifi_server_on'"), "Toolbox must contain wifi_server_on block")
assert.ok(blocklyEditorSrc.includes("'wifi_server_send'"), "Toolbox must contain wifi_server_send block")
console.log("✔ Step 3 Passed: Blockly Toolbox IoT category and block presets verified.")

// ---------------------------------------------------------------------------
// Step 4: Blockly Execution Runner Integration
// ---------------------------------------------------------------------------
console.log("\n[Test 4] Verifying Blockly Runner Wi-Fi Hooks & Execution Engine...")

assert.ok(blocklyRunnerSrc.includes("wifiConnect?:"), "ExecutionEnvironment must declare wifiConnect")
assert.ok(blocklyRunnerSrc.includes("wifiIsConnected?:"), "ExecutionEnvironment must declare wifiIsConnected")
assert.ok(blocklyRunnerSrc.includes("wifiGetIp?:"), "ExecutionEnvironment must declare wifiGetIp")
assert.ok(blocklyRunnerSrc.includes("wifiServerBegin?:"), "ExecutionEnvironment must declare wifiServerBegin")
assert.ok(blocklyRunnerSrc.includes("wifiServerOn?:"), "ExecutionEnvironment must declare wifiServerOn")
assert.ok(blocklyRunnerSrc.includes("wifiServerSend?:"), "ExecutionEnvironment must declare wifiServerSend")

assert.ok(blocklyRunnerSrc.includes('case "wifi_connect":'), "Runner must handle wifi_connect statement")
assert.ok(blocklyRunnerSrc.includes('case "wifi_server_begin":'), "Runner must handle wifi_server_begin statement")
assert.ok(blocklyRunnerSrc.includes('case "wifi_server_on":'), "Runner must handle wifi_server_on statement")
assert.ok(blocklyRunnerSrc.includes('case "wifi_server_send":'), "Runner must handle wifi_server_send statement")
assert.ok(blocklyRunnerSrc.includes("export async function executeStatement"), "Runner must export executeStatement for route execution")
console.log("✔ Step 4 Passed: Blockly Execution Environment and statement hooks verified.")

// ---------------------------------------------------------------------------
// Step 5: IoT Web Browser & Traffic Inspector Component
// ---------------------------------------------------------------------------
console.log("\n[Test 5] Verifying Simulated IoT Web Browser UI...")

assert.ok(iotWebPortalSrc.includes("export function IotWebPortal"), "IotWebPortal component must be exported")
assert.ok(iotWebPortalSrc.includes("ESP32 IoT Browser"), "Modal must display ESP32 IoT Browser title")
assert.ok(iotWebPortalSrc.includes("virtualWifiManager.dispatchRequest("), "Browser must dispatch requests via virtualWifiManager")
assert.ok(iotWebPortalSrc.includes("PIXIU_IOT_NAVIGATE"), "Browser must handle internal iframe link navigation")
assert.ok(iotWebPortalSrc.includes("Network ("), "Browser must contain network traffic tab")
console.log("✔ Step 5 Passed: IotWebPortal simulated browser component verified.")

// ---------------------------------------------------------------------------
// Step 6: Workbench Integration & Live Status Badge
// ---------------------------------------------------------------------------
console.log("\n[Test 6] Verifying Workbench Integration & Live Web Server Pill...")

assert.ok(workbenchSrc.includes("import { virtualWifiManager"), "workbench must import virtualWifiManager")
assert.ok(workbenchSrc.includes("import { IotWebPortal }"), "workbench must import IotWebPortal")
assert.ok(workbenchSrc.includes("isIotPortalOpen"), "workbench must track isIotPortalOpen state")
assert.ok(workbenchSrc.includes("<IotWebPortal"), "workbench must render IotWebPortal modal")
assert.ok(workbenchSrc.includes("wifiState.serverRunning"), "workbench must track serverRunning status")
assert.ok(workbenchSrc.includes("Web Server:"), "workbench must render live Web Server pill button when running")
assert.ok(paletteSrc.includes("IoT Web Browser"), "palette must contain IoT Web Browser tool")
console.log("✔ Step 6 Passed: Workbench live server controls and palette integration verified.")

console.log("\n=======================================================")
console.log("🎉 ALL PHASE 4 VIRTUAL WI-FI & WEB SERVER CHECKS PASSED!")
console.log("=======================================================")
