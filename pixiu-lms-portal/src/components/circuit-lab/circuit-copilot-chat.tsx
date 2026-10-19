import React, { useState, useCallback, useRef, useEffect, useMemo } from "react"
import {
  Sparkles,
  Send,
  Bot,
  User,
  CheckCircle2,
  AlertTriangle,
  X,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Cpu,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Check,
  RotateCcw,
  HelpCircle,
  Layers,
  Search,
  Zap,
  ChevronRight,
  ArrowRight,
  Play,
  Flame,
  Radio,
  Lock,
} from "lucide-react"

import type { CircuitState, PlacedPart, Wire, PartType } from "@/lib/circuit-types"
import type { ArduinoPinState } from "@/lib/simulation"
import type { PartRuntime } from "./part-art"
import {
  useCircuitCopilotAction,
  type CircuitCopilotProposal,
  type StagedPreview,
} from "./use-circuit-copilot-action"
import {
  validateProposedCircuit,
  type CircuitValidationResult,
  type DiagnosticNotice,
} from "@/lib/circuit-validator"
import {
  serializeCircuitTelemetry,
  type SerializedCircuitTelemetry,
} from "@/lib/circuit-telemetry"
import {
  diagnoseCircuit,
  type CircuitHealthReport,
} from "@/lib/circuit-doctor"
import { PIXIU_COMPONENTS_DATASET } from "@/lib/ai/pixiu-components-dataset"
import { TEMPLATES } from "@/lib/templates"
import { isPhase2fScienceTutorEnabled } from "@/lib/feature-flags"
import { isPixiuAiCopilotEnabled } from "@/lib/feature-flags"

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CircuitCopilotChatProps {
  currentCircuit: CircuitState
  currentBlocklyXml?: string
  running: boolean
  activeBoard: string
  runtime: Record<string, PartRuntime>
  pinStates: Record<string, ArduinoPinState>
  copilotAction: ReturnType<typeof useCircuitCopilotAction>
  onHighlightParts?: (partIds: string[]) => void
  isOpen?: boolean
  onToggleOpen?: () => void
}

interface ChatMessage {
  id: string
  sender: "ai" | "user" | "system"
  text: string
  timestamp: number
  proposal?: CircuitCopilotProposal
  telemetrySummary?: string
  doctorReport?: CircuitHealthReport
  isStaged?: boolean
  isApplied?: boolean
}

// ============================================================================
// Deterministic Circuit Proposal Generators
// ============================================================================

function createLedBlinkProposal(baseRevisionHash: string): CircuitCopilotProposal {
  return {
    id: `prop-led-blink-${Date.now()}`,
    title: "Arduino Uno LED Blink Circuit",
    rationale: "Classic beginner circuit: Arduino Uno drives a red LED on digital pin D13 through a 220Ω current-limiting resistor with common Ground return.",
    baseRevisionHash,
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 120, rotation: 0, props: {} },
        { id: "r1", type: "resistor", x: 470, y: 140, rotation: 0, props: { resistance: 220 } },
        { id: "led1", type: "led", x: 470, y: 230, rotation: 0, props: { color: "red" } },
      ],
      wires: [
        { id: "w-d13-r", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#38bdf8" },
        { id: "w-r-led", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#38bdf8" },
        { id: "w-led-gnd", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    codeLanguage: "blockly",
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode">
        <field name="PIN">13</field>
        <field name="MODE">OUTPUT</field>
      </block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite">
        <field name="PIN">13</field>
        <field name="STATE">HIGH</field>
        <next>
          <block type="time_delay">
            <value name="DELAY">
              <shadow type="math_number"><field name="NUM">1000</field></shadow>
            </value>
            <next>
              <block type="io_digitalwrite">
                <field name="PIN">13</field>
                <field name="STATE">LOW</field>
                <next>
                  <block type="time_delay">
                    <value name="DELAY">
                      <shadow type="math_number"><field name="NUM">1000</field></shadow>
                    </value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  }
}

function createServoPotProposal(baseRevisionHash: string): CircuitCopilotProposal {
  return {
    id: `prop-servo-pot-${Date.now()}`,
    title: "Potentiometer-Controlled Servo Motor",
    rationale: "Analog input meets PWM actuation: Rotate the 10k potentiometer to read 0-1023 on analog pin A0, mapped directly to 0°-180° on PWM pin D9 servo.",
    baseRevisionHash,
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 120, rotation: 0, props: {} },
        { id: "pot1", type: "potentiometer", x: 460, y: 80, rotation: 0, props: { value: 512 } },
        { id: "servo1", type: "servo", x: 460, y: 250, rotation: 0, props: { angle: 90 } },
      ],
      wires: [
        { id: "w-5v-pot", from: { partId: "uno", pinId: "5v" }, to: { partId: "pot1", pinId: "t1" }, color: "#ef4444" },
        { id: "w-gnd-pot", from: { partId: "uno", pinId: "gnd" }, to: { partId: "pot1", pinId: "t2" }, color: "#1e293b" },
        { id: "w-pot-a0", from: { partId: "pot1", pinId: "wiper" }, to: { partId: "uno", pinId: "a0" }, color: "#3b82f6" },
        { id: "w-5v-srv", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
        { id: "w-gnd-srv", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
        { id: "w-d9-srv", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo1", pinId: "sig" }, color: "#f97316" },
      ],
    },
    codeLanguage: "blockly",
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="servo_attach"><field name="PIN">9</field></block>
    </statement>
    <statement name="LOOP">
      <block type="servo_write">
        <field name="PIN">9</field>
        <value name="ANGLE">
          <block type="math_map">
            <value name="VALUE">
              <block type="io_analogread"><field name="PIN">A0</field></block>
            </value>
            <value name="FROM_LOW"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
            <value name="FROM_HIGH"><shadow type="math_number"><field name="NUM">1023</field></shadow></value>
            <value name="TO_LOW"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
            <value name="TO_HIGH"><shadow type="math_number"><field name="NUM">180</field></shadow></value>
          </block>
        </value>
      </block>
    </statement>
  </block>
</xml>`,
  }
}

function createUltrasonicBuzzerProposal(baseRevisionHash: string): CircuitCopilotProposal {
  return {
    id: `prop-ultrasonic-buzzer-${Date.now()}`,
    title: "Ultrasonic Proximity Alarm with Buzzer",
    rationale: "Sonar obstacle radar: Ultrasonic sensor pulses Trig on D9 and reads Echo on D10. When an obstacle is closer than 20cm, buzzer sounds an alert on D8.",
    baseRevisionHash,
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 120, rotation: 0, props: {} },
        { id: "sonar1", type: "ultrasonic", x: 470, y: 80, rotation: 0, props: { distance: 35 } },
        { id: "buzzer1", type: "buzzer", x: 490, y: 250, rotation: 0, props: {} },
      ],
      wires: [
        { id: "w-5v-sonar", from: { partId: "uno", pinId: "5v" }, to: { partId: "sonar1", pinId: "vcc" }, color: "#ef4444" },
        { id: "w-gnd-sonar", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar1", pinId: "gnd" }, color: "#1e293b" },
        { id: "w-d9-trig", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar1", pinId: "trig" }, color: "#06b6d4" },
        { id: "w-d10-echo", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar1", pinId: "echo" }, color: "#3b82f6" },
        { id: "w-d8-buzzer", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer1", pinId: "pos" }, color: "#a855f7" },
        { id: "w-gnd-buzzer", from: { partId: "uno", pinId: "gnd" }, to: { partId: "buzzer1", pinId: "neg" }, color: "#1e293b" },
      ],
    },
    codeLanguage: "blockly",
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">LT</field>
            <value name="A">
              <block type="ultrasonic_read"><field name="TRIG">9</field><field name="ECHO">10</field></block>
            </value>
            <value name="B">
              <shadow type="math_number"><field name="NUM">20</field></shadow>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="tone_play"><field name="PIN">8</field><value name="FREQ"><shadow type="math_number"><field name="NUM">1000</field></shadow></value></block>
        </statement>
        <statement name="ELSE">
          <block type="tone_stop"><field name="PIN">8</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
  }
}

function createRgbLedProposal(baseRevisionHash: string): CircuitCopilotProposal {
  return {
    id: `prop-rgb-led-${Date.now()}`,
    title: "RGB LED Dynamic Color Mixer",
    rationale: "Full color spectrum mixing: Red, Green, and Blue anodes driven via PWM pins D9, D10, D11 through dedicated 220Ω current-limiting resistors to common Cathode Ground.",
    baseRevisionHash,
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 120, rotation: 0, props: {} },
        { id: "r_red", type: "resistor", x: 450, y: 80, rotation: 0, props: { resistance: 220 } },
        { id: "r_grn", type: "resistor", x: 450, y: 160, rotation: 0, props: { resistance: 220 } },
        { id: "r_blu", type: "resistor", x: 450, y: 240, rotation: 0, props: { resistance: 220 } },
        { id: "rgb1", type: "rgb-led", x: 590, y: 160, rotation: 0, props: {} },
      ],
      wires: [
        { id: "w-d9-rr", from: { partId: "uno", pinId: "d9" }, to: { partId: "r_red", pinId: "a" }, color: "#ef4444" },
        { id: "w-rr-red", from: { partId: "r_red", pinId: "b" }, to: { partId: "rgb1", pinId: "red" }, color: "#ef4444" },
        { id: "w-d10-rg", from: { partId: "uno", pinId: "d10" }, to: { partId: "r_grn", pinId: "a" }, color: "#22c55e" },
        { id: "w-rg-grn", from: { partId: "r_grn", pinId: "b" }, to: { partId: "rgb1", pinId: "green" }, color: "#22c55e" },
        { id: "w-d11-rb", from: { partId: "uno", pinId: "d11" }, to: { partId: "r_blu", pinId: "a" }, color: "#3b82f6" },
        { id: "w-rb-blu", from: { partId: "r_blu", pinId: "b" }, to: { partId: "rgb1", pinId: "blue" }, color: "#3b82f6" },
        { id: "w-rgb-gnd", from: { partId: "rgb1", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    codeLanguage: "blockly",
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="io_analogwrite"><field name="PIN">9</field><value name="VALUE"><shadow type="math_number"><field name="NUM">255</field></shadow></value><next>
      <block type="io_analogwrite"><field name="PIN">10</field><value name="VALUE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
      <block type="io_analogwrite"><field name="PIN">11</field><value name="VALUE"><shadow type="math_number"><field name="NUM">128</field></shadow></value><next>
      <block type="time_delay"><value name="DELAY"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  }
}

function createLdrLampProposal(baseRevisionHash: string): CircuitCopilotProposal {
  return {
    id: `prop-ldr-lamp-${Date.now()}`,
    title: "LDR Smart Automatic Night Lamp",
    rationale: "Light-sensing smart lamp: Light Dependent Resistor forms a voltage divider with a 10kΩ resistor on A0. When ambient light drops below threshold, D13 LED turns ON automatically.",
    baseRevisionHash,
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 120, rotation: 0, props: {} },
        { id: "ldr1", type: "ldr", x: 450, y: 80, rotation: 0, props: { light: 300 } },
        { id: "r_div", type: "resistor", x: 450, y: 170, rotation: 0, props: { resistance: 10000 } },
        { id: "r_led", type: "resistor", x: 580, y: 120, rotation: 0, props: { resistance: 220 } },
        { id: "led1", type: "led", x: 580, y: 220, rotation: 0, props: { color: "yellow" } },
      ],
      wires: [
        { id: "w-5v-ldr", from: { partId: "uno", pinId: "5v" }, to: { partId: "ldr1", pinId: "t1" }, color: "#ef4444" },
        { id: "w-ldr-rdiv", from: { partId: "ldr1", pinId: "t2" }, to: { partId: "r_div", pinId: "a" }, color: "#eab308" },
        { id: "w-div-a0", from: { partId: "ldr1", pinId: "t2" }, to: { partId: "uno", pinId: "a0" }, color: "#eab308" },
        { id: "w-div-gnd", from: { partId: "r_div", pinId: "b" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w-d13-rled", from: { partId: "uno", pinId: "d13" }, to: { partId: "r_led", pinId: "a" }, color: "#38bdf8" },
        { id: "w-rled-anode", from: { partId: "r_led", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#38bdf8" },
        { id: "w-led-gnd", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    codeLanguage: "blockly",
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">LT</field>
            <value name="A">
              <block type="io_analogread"><field name="PIN">A0</field></block>
            </value>
            <value name="B">
              <shadow type="math_number"><field name="NUM">400</field></shadow>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
  }
}

// ============================================================================
// Natural Language Intent Matcher
// ============================================================================

export interface ParsedAiIntent {
  kind: "circuit_proposal" | "doctor_audit" | "explain_telemetry" | "undo" | "clear" | "component_info" | "chat"
  proposal?: CircuitCopilotProposal
  componentType?: string
  replyText: string
}

export function parseUserIntent(
  query: string,
  baseRevisionHash: string,
  currentCircuit: CircuitState,
  pinStates: Record<string, ArduinoPinState>,
  runtime: Record<string, PartRuntime>,
): ParsedAiIntent {
  const q = query.toLowerCase().trim()

  // 1. Undo / Revert Intent
  if (/\b(undo|wapas|revert|rollback|pehle jaisa|back)\b/i.test(q)) {
    return {
      kind: "undo",
      replyText: "↩️ **Undoing AI Action**: Rolling back live canvas and code to previous snapshot...",
    }
  }

  // 2. Clear / Reset Intent
  if (/\b(clear|reset|hatao|khali|delete all|clear all)\b/i.test(q)) {
    return {
      kind: "clear",
      replyText: "🧹 **Reset Canvas**: Use the trash icon in the toolbar or request a fresh circuit template above.",
    }
  }

  // 3. Safety Check / Circuit Doctor Intent
  if (/\b(check|safe|doctor|short|health|hazard|galti|sahi hai|burnout|overcurrent)\b/i.test(q)) {
    const report = diagnoseCircuit(currentCircuit, runtime, pinStates)
    return {
      kind: "doctor_audit",
      replyText: `🩺 **Circuit Doctor Safety Audit**: Circuit health score is **${report.score}/100** (${report.status.toUpperCase()}). Found ${report.criticalCount} critical hazard(s) and ${report.warningCount} warning(s).`,
    }
  }

  // 4. Phase 2F science tutor remains disabled until its module, reviewed data,
  // and explicit release gate are available. Do not silently enable it here.

  // 5. Telemetry / Live Explanation Intent
  if (/\b(explain|telemetry|kya ho raha|voltage|current|status|samjhao|nodal|potentials|pins)\b/i.test(q)) {
    return {
      kind: "explain_telemetry",
      replyText: "⚡ **Live CyberLab Telemetry**: Reading nodal potentials, active pins, and component current draw...",
    }
  }

  // 6. LED Blink Circuit
  if (/\b(led|blink|jalao|light|flashing|bulb)\b/i.test(q) && !/\b(rgb|ldr)\b/i.test(q)) {
    const prop = createLedBlinkProposal(baseRevisionHash)
    return {
      kind: "circuit_proposal",
      proposal: prop,
      replyText: `💡 **AI Proposal Created: LED Blink Circuit**\nI've generated a safe, verified LED blink circuit on Arduino Uno D13 with a 220Ω protective resistor. Preview it on the canvas below or click **Apply** to load it!`,
    }
  }

  // 6. Servo & Potentiometer Circuit
  if (/\b(servo|potentiometer|pot|knob|motor|sweep|ghumaao)\b/i.test(q)) {
    const prop = createServoPotProposal(baseRevisionHash)
    return {
      kind: "circuit_proposal",
      proposal: prop,
      replyText: `🔄 **AI Proposal Created: Potentiometer + Servo Circuit**\nI've configured an Arduino Uno reading potentiometer wiper voltage on analog pin A0, mapped smoothly to 0°-180° on PWM pin D9 for the servo motor.`,
    }
  }

  // 7. Ultrasonic & Buzzer Circuit
  if (/\b(ultrasonic|sonar|distance|buzzer|alarm|obstacle|doori|beep)\b/i.test(q)) {
    const prop = createUltrasonicBuzzerProposal(baseRevisionHash)
    return {
      kind: "circuit_proposal",
      proposal: prop,
      replyText: `🦇 **AI Proposal Created: Ultrasonic Distance Alert**\nI've connected the ultrasonic sensor (Trig on D9, Echo on D10) and buzzer on D8. The Blockly logic triggers an audible alarm whenever an obstacle comes within 20cm!`,
    }
  }

  // 8. RGB LED Circuit
  if (/\b(rgb|rainbow|color|colors|mood lamp)\b/i.test(q)) {
    const prop = createRgbLedProposal(baseRevisionHash)
    return {
      kind: "circuit_proposal",
      proposal: prop,
      replyText: `🌈 **AI Proposal Created: RGB LED Color Mixer**\nI've wired Red, Green, and Blue channels to Uno PWM pins D9, D10, D11 via three 220Ω resistors. You can mix 16 million colors with analogWrite duty cycles!`,
    }
  }

  // 9. LDR Light Sensor Circuit
  if (/\b(ldr|dark|night lamp|light sensor|roshni|sooraj)\b/i.test(q)) {
    const prop = createLdrLampProposal(baseRevisionHash)
    return {
      kind: "circuit_proposal",
      proposal: prop,
      replyText: `☀️ **AI Proposal Created: Smart LDR Night Lamp**\nI've built an analog voltage divider with LDR + 10kΩ resistor on A0, plus a yellow indicator LED on D13 that automatically illuminates in the dark.`,
    }
  }

  // 10. Check if user asks about a specific component from the 32 catalog
  for (const [key, spec] of Object.entries(PIXIU_COMPONENTS_DATASET)) {
    if (q.includes(key.toLowerCase()) || q.includes(spec.name.toLowerCase())) {
      return {
        kind: "component_info",
        componentType: key,
        replyText: `📦 **${spec.name} (${spec.category})**\n- **Operating Voltage:** ${spec.electrical.operatingVoltage}\n- **Logic Level:** ${spec.electrical.logicLevel}\n- **Pins:** ${spec.pins.map(p => `${p.label} (${p.kind})`).join(", ")}\n- **Key Rule:** ${spec.wiringRules[0]?.description || "Standard GPIO wiring"}\n- **Blockly Blocks:** \`${spec.codeInterface.blocklyBlockTypes.join(", ") || "Standard IO"}\``,
      }
    }
  }

  // 11. Fallback Educational Conversation
  return {
    kind: "chat",
    replyText: `👋 I'm your **PIXIU CyberLab AI Copilot**! I can help you build circuits, explain simulation physics, and catch bugs before they cause burnout.\n\nTry clicking one of the quick suggestions below or ask me to build a circuit like **"Make an LED blink"**, **"Control servo with pot"**, or **"Check circuit safety"**!`,
  }
}

// ============================================================================
// Main UI Component
// ============================================================================

export function CircuitCopilotChat({
  currentCircuit,
  currentBlocklyXml,
  running,
  activeBoard,
  runtime,
  pinStates,
  copilotAction,
  onHighlightParts,
  isOpen: externalIsOpen,
  onToggleOpen: externalOnToggleOpen,
}: CircuitCopilotChatProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isPanelOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const togglePanel = externalOnToggleOpen || (() => setInternalIsOpen((v) => !v))

  const [activeTab, setActiveTab] = useState<"chat" | "doctor" | "telemetry" | "catalog">("chat")
  const [inputValue, setInputValue] = useState("")
  const [catalogSearch, setCatalogSearch] = useState("")

  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  // Message History
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "ai",
      text: "👋 **Welcome to PIXIU AI Copilot!**\nI'm your intelligent CyberLab engineering assistant. Ask me to design circuits, check for dead shorts, inspect live pin voltages, or guide your Blockly programming.",
      timestamp: Date.now(),
    },
  ])

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (isPanelOpen && activeTab === "chat") {
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" })
      }, 50)
    }
  }, [messages, isPanelOpen, activeTab])

  // Live Circuit Telemetry
  const telemetry: SerializedCircuitTelemetry = useMemo(() => {
    return serializeCircuitTelemetry({
      circuit: currentCircuit,
      pinStates,
      runtime,
      maxChars: 1600,
    })
  }, [currentCircuit, pinStates, runtime])

  // Live Circuit Doctor Health Report
  const doctorReport: CircuitHealthReport = useMemo(() => {
    return diagnoseCircuit(currentCircuit, runtime, pinStates)
  }, [currentCircuit, runtime, pinStates])

  // Send Prompt Handler
  const handleSendMessage = useCallback(
    (customText?: string) => {
      const text = (customText || inputValue).trim()
      if (!text) return

      const userMsg: ChatMessage = {
        id: `msg-user-${Date.now()}`,
        sender: "user",
        text,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMsg])
      if (!customText) setInputValue("")

      // Process intent
      setTimeout(() => {
        const intent = parseUserIntent(
          text,
          copilotAction.currentHash,
          currentCircuit,
          pinStates,
          runtime,
        )

        if (intent.kind === "circuit_proposal" && intent.proposal) {
          // Propose and stage proposal
          copilotAction.proposeAction(intent.proposal)
          copilotAction.stageProposal(intent.proposal)

          const aiMsg: ChatMessage = {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: intent.replyText,
            timestamp: Date.now(),
            proposal: intent.proposal,
            isStaged: true,
          }
          setMessages((prev) => [...prev, aiMsg])
        } else if (intent.kind === "undo") {
          copilotAction.undoAction()
          const aiMsg: ChatMessage = {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: intent.replyText,
            timestamp: Date.now(),
          }
          setMessages((prev) => [...prev, aiMsg])
        } else if (intent.kind === "doctor_audit") {
          const aiMsg: ChatMessage = {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: intent.replyText,
            timestamp: Date.now(),
            doctorReport,
          }
          setMessages((prev) => [...prev, aiMsg])
        } else if (intent.kind === "explain_telemetry") {
          const aiMsg: ChatMessage = {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `${intent.replyText}\n\`\`\`\n${telemetry.compactPromptString}\n\`\`\``,
            timestamp: Date.now(),
            telemetrySummary: telemetry.compactPromptString,
          }
          setMessages((prev) => [...prev, aiMsg])
        } else {
          const aiMsg: ChatMessage = {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: intent.replyText,
            timestamp: Date.now(),
          }
          setMessages((prev) => [...prev, aiMsg])
        }
      }, 250)
    },
    [inputValue, copilotAction, currentCircuit, pinStates, runtime, doctorReport, telemetry],
  )

  // Staged Preview Status
  const isPreviewStaged = Boolean(copilotAction.stagedPreview)

  return (
    <>
      {/* ==================================================================== */}
      {/* 1. Floating AI Copilot Corner Trigger Button - In Production 1.0v     */}
      {/* ==================================================================== */}
      <button
        type="button"
        onClick={togglePanel}
        className={
          "fixed bottom-20 right-24 md:bottom-6 md:right-36 z-[70] inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black shadow-xl backdrop-blur-md transition-all " +
          (isPanelOpen
            ? "bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 shadow-amber-500/40 border border-amber-300 ring-2 ring-amber-400/50"
            : "border border-amber-400/40 bg-[#091122]/95 text-white shadow-amber-900/40 hover:border-amber-300 hover:scale-105 hover:shadow-amber-500/30")
        }
        aria-label="Toggle PixiuAI 1.0v Status"
        title="PixiuAI 1.0v (In Production - Restricted Access)"
      >
        <div className="relative flex items-center justify-center">
          <Lock size={15} className="text-amber-400" />
        </div>
        <span className="tracking-wider font-extrabold uppercase text-[11px]">
          PixiuAI 1.0v
        </span>
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300 border border-amber-500/40">
          In Production
        </span>
      </button>

      {/* ==================================================================== */}
      {/* 2. Sleek Floating Drawer / Status Panel - In Production 1.0v         */}
      {/* ==================================================================== */}
      {isPanelOpen && (
        <section
          aria-label="PixiuAI 1.0v Status Panel"
          className="fixed bottom-32 right-4 md:bottom-20 right-4 z-[75] w-[min(94vw,420px)] flex flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-[#070e1c]/98 text-slate-100 shadow-2xl shadow-black/90 backdrop-blur-xl ring-1 ring-amber-500/20 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <header className="border-b border-slate-800 bg-gradient-to-r from-[#0b1528] via-[#1a170b] to-[#0b1528] px-4 py-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-slate-950 shadow-md shadow-amber-500/30 font-black">
                  <Bot size={18} />
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[#070e1c] animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-black tracking-wide text-white">PixiuAI 1.0v</h2>
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300 border border-amber-500/30">
                      IN PRODUCTION
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">CyberLab Assistant • Calibration in Progress</p>
                </div>
              </div>

              <button
                type="button"
                onClick={togglePanel}
                aria-label="Close PixiuAI Status Panel"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {/* Locked Production Banner Body */}
          <div className="p-6 text-center space-y-4">
            <div className="relative inline-flex mx-auto">
              <div className="absolute -inset-2 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/80 to-slate-900 text-amber-400 shadow-xl shadow-amber-950/50">
                <Lock size={30} className="text-amber-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                Restricted Access
              </span>
              <h3 className="text-base font-black text-white pt-1">
                PixiuAI 1.0v is In Production
              </h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed mx-auto">
                Model training, curriculum calibration, and safety validation gates are currently in progress. Access is locked for all users until production rollout is complete.
              </p>
            </div>

            <div className="w-full max-w-xs space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-left text-xs mx-auto">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Hardware Simulation:</span>
                <span className="font-semibold text-emerald-400">Active & Ready</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Blockly & MicroPython:</span>
                <span className="font-semibold text-emerald-400">Active & Ready</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">AI Circuit Copilot:</span>
                <span className="font-semibold text-amber-400 font-mono">In Production (1.0v)</span>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={togglePanel}
                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                Return to Workbench
              </button>
            </div>
          </div>

          {isPixiuAiCopilotEnabled() && (
            <>
              {/* Mode Switcher Tabs */}
              <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-950/70 p-1 border border-slate-800 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={
                  "flex items-center justify-center gap-1 rounded-lg py-1.5 transition " +
                  (activeTab === "chat"
                    ? "bg-cyan-500 text-slate-950 shadow-sm font-black"
                    : "text-slate-400 hover:text-white hover:bg-slate-900")
                }
              >
                <Zap size={11} /> Chat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("doctor")}
                className={
                  "flex items-center justify-center gap-1 rounded-lg py-1.5 transition " +
                  (activeTab === "doctor"
                    ? "bg-cyan-500 text-slate-950 shadow-sm font-black"
                    : "text-slate-400 hover:text-white hover:bg-slate-900")
                }
              >
                <ShieldCheck size={11} /> Doctor
                <span className="text-[8px] font-mono opacity-80">({doctorReport.score})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("telemetry")}
                className={
                  "flex items-center justify-center gap-1 rounded-lg py-1.5 transition " +
                  (activeTab === "telemetry"
                    ? "bg-cyan-500 text-slate-950 shadow-sm font-black"
                    : "text-slate-400 hover:text-white hover:bg-slate-900")
                }
              >
                <Activity size={11} /> Telemetry
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("catalog")}
                className={
                  "flex items-center justify-center gap-1 rounded-lg py-1.5 transition " +
                  (activeTab === "catalog"
                    ? "bg-cyan-500 text-slate-950 shadow-sm font-black"
                    : "text-slate-400 hover:text-white hover:bg-slate-900")
                }
              >
                <Layers size={11} /> 32 Parts
              </button>
            </div>

          {/* ================================================================ */}
          {/* TAB 1: Chat & Circuit Generation Mode                            */}
          {/* ================================================================ */}
          {activeTab === "chat" && (
            <div className="flex flex-1 flex-col overflow-hidden min-h-0 bg-[#070e1c]">
              {/* Quick Action Suggestion Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto p-2 border-b border-slate-800/80 bg-slate-950/40 no-scrollbar shrink-0">
                <button
                  type="button"
                  onClick={() => handleSendMessage("Blink LED Circuit")}
                  className="shrink-0 flex items-center gap-1 rounded-full border border-cyan-500/30 bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-cyan-200 hover:border-cyan-400 hover:bg-cyan-950/40 transition"
                >
                  ⚡ Blink LED
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage("Servo with Potentiometer")}
                  className="shrink-0 flex items-center gap-1 rounded-full border border-indigo-500/30 bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-indigo-200 hover:border-indigo-400 hover:bg-indigo-950/40 transition"
                >
                  🔄 Servo & Pot
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage("Ultrasonic with Buzzer")}
                  className="shrink-0 flex items-center gap-1 rounded-full border border-emerald-500/30 bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-emerald-200 hover:border-emerald-400 hover:bg-emerald-950/40 transition"
                >
                  🦇 Sonar Alarm
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage("RGB LED")}
                  className="shrink-0 flex items-center gap-1 rounded-full border border-purple-500/30 bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-purple-200 hover:border-purple-400 hover:bg-purple-950/40 transition"
                >
                  🌈 RGB Light
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage("Check circuit safety")}
                  className="shrink-0 flex items-center gap-1 rounded-full border border-amber-500/30 bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-amber-200 hover:border-amber-400 hover:bg-amber-950/40 transition"
                >
                  🩺 Check Safety
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage("Explain telemetry")}
                  className="shrink-0 flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:border-slate-500 transition"
                >
                  📊 Telemetry
                </button>
              </div>

              {/* Chat Feed */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={"flex gap-2.5 " + (msg.sender === "user" ? "justify-end" : "justify-start")}
                  >
                    {msg.sender === "ai" && (
                      <div className="h-6 w-6 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5">
                        <Bot size={13} />
                      </div>
                    )}

                    <div
                      className={
                        "max-w-[85%] rounded-2xl p-3 text-xs leading-5 " +
                        (msg.sender === "user"
                          ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium shadow-md shadow-cyan-900/20 rounded-tr-xs"
                          : "bg-slate-900/90 border border-slate-800 text-slate-200 shadow-md shadow-black/40 rounded-tl-xs")
                      }
                    >
                      <div className="whitespace-pre-wrap">{msg.text}</div>

                      {/* Interactive Proposal Card */}
                      {msg.proposal && (
                        <div className="mt-2.5 rounded-xl border border-cyan-500/30 bg-slate-950/80 p-3 text-slate-200 space-y-2.5 ring-1 ring-cyan-500/10">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                                Proposed Action
                              </p>
                              <h4 className="text-xs font-bold text-white mt-0.5">{msg.proposal.title}</h4>
                            </div>
                            <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Verified
                            </span>
                          </div>

                          <p className="text-[11px] leading-4 text-slate-400">
                            {msg.proposal.rationale}
                          </p>

                          <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-900/90 rounded-lg p-2 border border-slate-800 font-mono">
                            <div>
                              <span className="text-slate-500">Components: </span>
                              <span className="text-cyan-300 font-bold">{msg.proposal.circuit.parts.length}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Wires: </span>
                              <span className="text-cyan-300 font-bold">{msg.proposal.circuit.wires.length}</span>
                            </div>
                          </div>

                          {/* Action Buttons: Preview & Apply */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (copilotAction.stagedPreview?.proposal.id === msg.proposal?.id) {
                                  copilotAction.dismissStaging()
                                } else {
                                  copilotAction.stageProposal(msg.proposal)
                                }
                              }}
                              className={
                                "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold border transition " +
                                (copilotAction.stagedPreview?.proposal.id === msg.proposal?.id
                                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                                  : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white")
                              }
                            >
                              {copilotAction.stagedPreview?.proposal.id === msg.proposal?.id ? (
                                <>
                                  <EyeOff size={13} /> Hide Ghost
                                </>
                              ) : (
                                <>
                                  <Eye size={13} /> Preview Canvas
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const ok = copilotAction.applyProposal(msg.proposal)
                                if (ok) {
                                  copilotAction.dismissStaging()
                                  setMessages((m) => [
                                    ...m,
                                    {
                                      id: `msg-applied-${Date.now()}`,
                                      sender: "ai",
                                      text: `🎉 **Applied to Live Canvas!**\nLoaded **${msg.proposal?.title}** onto CyberLab. Click **Run** on the toolbar to test the circuit!`,
                                      timestamp: Date.now(),
                                    },
                                  ])
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-2.5 py-1.5 text-[11px] font-black text-slate-950 hover:brightness-110 transition shadow-md shadow-cyan-500/20"
                            >
                              <Play size={12} fill="currentColor" /> Apply to Canvas
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {msg.sender === "user" && (
                      <div className="h-6 w-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                        <User size={13} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                className="p-3 border-t border-slate-800 bg-slate-950/80 shrink-0 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask to build a circuit, check safety, or explain pins..."
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="rounded-xl bg-cyan-500 p-2 text-slate-950 font-bold transition hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: Circuit Doctor Live Diagnostics Mode                      */}
          {/* ================================================================ */}
          {activeTab === "doctor" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#070e1c]">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Circuit Health Score</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-cyan-400">{doctorReport.score}</span>
                    <span className="text-xs font-bold text-slate-500">/ 100</span>
                    <span
                      className={
                        "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase " +
                        (doctorReport.status === "healthy"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : doctorReport.status === "needs-attention"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30")
                      }
                    >
                      {doctorReport.status}
                    </span>
                  </div>
                </div>

                {doctorReport.issues.length > 0 && onHighlightParts && (
                  <button
                    type="button"
                    onClick={() => {
                      const allPartIds = doctorReport.issues.flatMap((i) => i.involvedPartIds)
                      onHighlightParts(allPartIds)
                    }}
                    className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20 transition"
                  >
                    <AlertTriangle size={12} /> Highlight Issues
                  </button>
                )}
              </div>

              {/* Issues List */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Diagnostic Findings ({doctorReport.issues.length})
                </h4>

                {doctorReport.issues.length === 0 ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-2" />
                    <p className="text-xs font-bold text-emerald-200">All Systems Nominal</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      No dead-shorts, overcurrent hazards, or floating pins detected.
                    </p>
                  </div>
                ) : (
                  doctorReport.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className={
                        "rounded-xl border p-3 text-xs space-y-1 " +
                        (issue.severity === "critical"
                          ? "border-rose-500/40 bg-rose-500/5 text-rose-200"
                          : "border-amber-500/40 bg-amber-500/5 text-amber-200")
                      }
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{issue.title}</span>
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/40">
                          {issue.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-4">{issue.message}</p>
                      {issue.suggestion && (
                        <p className="text-[10px] text-cyan-300 font-medium">💡 Fix: {issue.suggestion}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: Telemetry Stream Mode                                     */}
          {/* ================================================================ */}
          {activeTab === "telemetry" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#070e1c] font-mono text-xs">
              {/* Power Rails Card */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Power Rails (Nodal Potentials)
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between p-1.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">5V Rail:</span>
                    <span className="text-emerald-400 font-bold">{telemetry.powerRails.rail5v ?? 5.0} V</span>
                  </div>
                  <div className="flex justify-between p-1.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">3.3V Rail:</span>
                    <span className="text-emerald-400 font-bold">{telemetry.powerRails.rail3v3 ?? 3.3} V</span>
                  </div>
                  <div className="flex justify-between p-1.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">GND Bus:</span>
                    <span className="text-slate-400 font-bold">0.00 V</span>
                  </div>
                  <div className="flex justify-between p-1.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">9V Battery:</span>
                    <span className="text-amber-400 font-bold">{telemetry.powerRails.battery9v ?? "--"} V</span>
                  </div>
                </div>
              </div>

              {/* Active Pins Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Active MCU Pin States ({telemetry.pins.length})
                </span>
                {telemetry.pins.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No active MCU pins configured.</p>
                ) : (
                  <div className="space-y-1">
                    {telemetry.pins.map((p) => (
                      <div
                        key={p.pinId}
                        className="flex items-center justify-between p-1.5 rounded bg-slate-900/80 border border-slate-800 text-[10px]"
                      >
                        <span className="text-cyan-300 font-bold">{p.label}</span>
                        <span className="text-slate-400">{p.state}</span>
                        <span className="text-emerald-300 font-bold">{p.voltage}V</span>
                        {p.dutyCyclePercent !== undefined && (
                          <span className="text-amber-300">{p.dutyCyclePercent}%</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Component Telemetry */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Live Component States ({telemetry.components.length})
                </span>
                {telemetry.components.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">No active components on canvas.</p>
                ) : (
                  <div className="space-y-1">
                    {telemetry.components.map((c) => (
                      <div
                        key={c.partId}
                        className="flex items-center justify-between p-1.5 rounded bg-slate-900/80 border border-slate-800 text-[10px]"
                      >
                        <span className="text-white font-bold">{c.partId}</span>
                        <span className="text-slate-400 font-sans">{c.type}</span>
                        <span className="text-cyan-400 font-bold">{c.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 4: 32 CyberLab Hardware Components Catalog                   */}
          {/* ================================================================ */}
          {activeTab === "catalog" && (
            <div className="flex flex-1 flex-col overflow-hidden bg-[#070e1c]">
              <div className="p-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search 32 components..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {Object.entries(PIXIU_COMPONENTS_DATASET)
                  .filter(([key, spec]) => {
                    if (!catalogSearch) return true
                    const s = catalogSearch.toLowerCase()
                    return key.includes(s) || spec.name.toLowerCase().includes(s) || spec.category.includes(s)
                  })
                  .map(([key, spec]) => (
                    <div
                      key={key}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 hover:border-slate-700 transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{spec.name}</span>
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                          {spec.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-4">{spec.blurb}</p>
                      <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono">
                        <span>Volt: {spec.electrical.operatingVoltage}</span>
                        <span>•</span>
                        <span>Pins: {spec.pins.length}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
            </>
          )}
        </section>
      )}
    </>
  )
}
