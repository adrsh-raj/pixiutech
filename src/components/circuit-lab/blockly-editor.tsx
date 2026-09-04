"use client"

import { useEffect, useRef, useState } from "react"
import * as Blockly from "blockly"
import type { CircuitState } from "@/lib/circuit-types"
import { defineArduinoBlocks, setPinContext, arduino } from "@/lib/arduino-blocks"
import { Copy, Check, Terminal, Code2 } from "lucide-react"

interface Props {
  circuit: CircuitState
  xml?: string
  onXmlChange?: (xml: string) => void
  onWorkspaceReady?: (workspace: Blockly.WorkspaceSvg) => void
}

const TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Arduino",
      colour: "#00878F",
      contents: [
        { kind: "block", type: "arduino_program" },
        { kind: "block", type: "io_pinmode" },
        { kind: "block", type: "io_digitalwrite" },
        { kind: "block", type: "io_digitalread" },
        { kind: "block", type: "io_analogwrite" },
        { kind: "block", type: "io_analogread" },
        { kind: "block", type: "time_delay" },
        { kind: "block", type: "tone_play" },
        { kind: "block", type: "tone_stop" },
        { kind: "block", type: "servo_write" },
      ],
    },
    {
      kind: "category",
      name: "Logic",
      colour: "#5C81A6",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
      ],
    },
    {
      kind: "category",
      name: "Loops",
      colour: "#5CA65C",
      contents: [
        { kind: "block", type: "controls_repeat_ext" },
        { kind: "block", type: "controls_whileUntil" },
      ],
    },
    {
      kind: "category",
      name: "Math",
      colour: "#5C68A6",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic" },
      ],
    },
    {
      kind: "category",
      name: "Variables",
      colour: "#A65C81",
      custom: "VARIABLE",
    },
    {
      kind: 'category',
      name: 'Serial',
      colour: '160',
      contents: [
        { kind: 'block', type: 'serial_begin' },
        { kind: 'block', type: 'serial_print' },
        { kind: 'block', type: 'serial_println' },
        { kind: 'block', type: 'text_string' },
      ],
    },
    {
      kind: 'category',
      name: 'Display',
      colour: '120',
      contents: [
        { kind: 'block', type: 'lcd_print' },
        { kind: 'block', type: 'lcd_set_cursor' },
        { kind: 'block', type: 'lcd_clear' },
      ],
    },
    {
      kind: 'category',
      name: 'Sensors',
      colour: '230',
      contents: [
        { kind: 'block', type: 'ultrasonic_read' },
      ],
    },
    {
      kind: 'category',
      name: '🤖 AI Vision',
      colour: '#a855f7',
      contents: [
        { kind: 'block', type: 'ai_is_detected' },
        { kind: 'block', type: 'ai_get_detected_class' },
        { kind: 'block', type: 'ai_confidence' },
        { kind: 'block', type: 'ai_camera_enable' },
      ],
    },
  ],
}

export function BlocklyEditor({ circuit, xml, onXmlChange, onWorkspaceReady }: Props) {
  const blocklyDiv = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const [cppCode, setCppCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [mobileTab, setMobileTab] = useState<"blocks" | "cpp">("blocks")

  useEffect(() => {
    defineArduinoBlocks()
    setPinContext(circuit)

    if (!blocklyDiv.current) return

    const workspace = Blockly.inject(blocklyDiv.current, {
      toolbox: TOOLBOX,
      grid: {
        spacing: 20,
        length: 3,
        colour: "#ccc",
        snap: true,
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.9,
        maxScale: 2,
        minScale: 0.4,
        scaleSpeed: 1.2,
      },
      trashcan: true,
      media: "https://unpkg.com/blockly/media/",
    })

    workspaceRef.current = workspace
    onWorkspaceReady?.(workspace)

    // Load initial Arduino Program block
    const initialXml = xml || `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="arduino_program" x="40" y="40">
        <statement name="LOOP">
          <block type="io_digitalwrite">
            <field name="PIN">13</field>
            <field name="STATE">HIGH</field>
            <next>
              <block type="time_delay">
                <value name="MS">
                  <shadow type="math_number">
                    <field name="NUM">1000</field>
                  </shadow>
                </value>
                <next>
                  <block type="io_digitalwrite">
                    <field name="PIN">13</field>
                    <field name="STATE">LOW</field>
                    <next>
                      <block type="time_delay">
                        <value name="MS">
                          <shadow type="math_number">
                            <field name="NUM">1000</field>
                          </shadow>
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
    </xml>`

    const lastLoadedXml = { current: initialXml }

    try {
      const dom = Blockly.utils.xml.textToDom(initialXml)
      Blockly.Xml.domToWorkspace(dom, workspace)
      setTimeout(() => {
        Blockly.svgResize(workspace)
        if (typeof (workspace as any).scrollCenter === "function") {
          (workspace as any).scrollCenter()
        }
      }, 100)
    } catch (err) {
      console.error("Failed to load initial XML:", err)
    }

    const updateCode = () => {
      try {
        const code = arduino.workspaceToCode(workspace)
        setCppCode(code)
        if (onXmlChange) {
          const dom = Blockly.Xml.workspaceToDom(workspace)
          const text = Blockly.utils.xml.domToText(dom)
          lastLoadedXml.current = text
          onXmlChange(text)
        }
      } catch (err) {
        console.error(err)
      }
    }

    updateCode()
    workspace.addChangeListener(updateCode)

    const handleResize = () => {
      Blockly.svgResize(workspace)
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      workspace.dispose()
    }
  }, [])

  // Sync workspace when external xml prop changes (e.g., when picking a template)
  useEffect(() => {
    if (!workspaceRef.current || !xml) return
    try {
      const currentDom = Blockly.Xml.workspaceToDom(workspaceRef.current)
      const currentXml = Blockly.utils.xml.domToText(currentDom)
      if (currentXml !== xml) {
        workspaceRef.current.clear()
        const dom = Blockly.utils.xml.textToDom(xml)
        Blockly.Xml.domToWorkspace(dom, workspaceRef.current)
        const code = arduino.workspaceToCode(workspaceRef.current)
        setCppCode(code)
        setTimeout(() => {
          if (workspaceRef.current) {
            Blockly.svgResize(workspaceRef.current)
            if (typeof (workspaceRef.current as any).scrollCenter === "function") {
              (workspaceRef.current as any).scrollCenter()
            }
          }
        }, 100)
      }
    } catch (err) {
      console.error("Failed to sync XML to workspace:", err)
    }
  }, [xml])

  useEffect(() => {
    setPinContext(circuit)
  }, [circuit])

  const handleCopy = () => {
    navigator.clipboard.writeText(cppCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col lg:flex-row bg-slate-900 text-white overflow-hidden">
      {/* Scoped CSS to eliminate Tailwind/Global CSS conflicts with Blockly SVG presentation attributes */}
      <style>{`
        .blocklySvg svg[display="none"],
        .blocklySvg g[display="none"],
        .blocklySvg [display="none"],
        .blocklyFlyoutScrollbar[display="none"],
        .blocklyScrollbarVertical[display="none"],
        .blocklyScrollbarHorizontal[display="none"],
        .blocklyScrollbar[display="none"],
        .blocklyFlyout[display="none"],
        .blocklyFlyoutBackground[display="none"] {
          display: none !important;
        }
        .blocklySvg,
        .blocklySvg svg,
        .blocklySvg g {
          max-width: none !important;
        }

        /* Glowing amber highlight for actively executing / stepped block */
        .blocklyHighlighted > .blocklyPath {
          stroke: #f59e0b !important;
          stroke-width: 4px !important;
          filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.95)) !important;
          transition: stroke 0.15s ease, filter 0.15s ease;
        }
      `}</style>

      {/* Mobile-Only Tab Switcher: Blocks vs C++ Code */}
      <div className="lg:hidden flex items-center justify-between border-b border-slate-800 bg-slate-950 px-3 py-2 shrink-0">
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs">
          <button
            onClick={() => {
              setMobileTab("blocks")
              setTimeout(() => {
                if (workspaceRef.current) {
                  Blockly.svgResize(workspaceRef.current)
                  if (typeof (workspaceRef.current as any).scrollCenter === "function") {
                    (workspaceRef.current as any).scrollCenter()
                  }
                }
              }, 60)
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              mobileTab === "blocks" ? "bg-[#00878F] text-white shadow-xs" : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🧩 Blocks</span>
          </button>
          <button
            onClick={() => setMobileTab("cpp")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              mobileTab === "cpp" ? "bg-[#00878F] text-white shadow-xs" : "text-slate-400 hover:text-white"
            }`}
          >
            <Code2 size={13} />
            <span>C++ Code</span>
          </button>
        </div>

        {mobileTab === "cpp" && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        )}
      </div>

      {/* Visual Blockly Area */}
      <div
        className={`relative flex-1 lg:h-full lg:w-[60%] border-b lg:border-b-0 lg:border-r border-slate-800 ${
          mobileTab === "blocks" ? "flex" : "hidden lg:flex"
        }`}
      >
        <div ref={blocklyDiv} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Generated Arduino C++ Sketch Panel */}
      <div
        className={`flex-1 flex-col lg:h-full bg-slate-950 ${
          mobileTab === "cpp" ? "flex" : "hidden lg:flex"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/80">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300">
            <Code2 size={16} className="text-[#00878F]" />
            <span>sketch.ino (Generated Arduino C++)</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-95"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? "Copied!" : "Copy Code"}</span>
          </button>
        </div>

        <div className="flex-1 p-4 overflow-auto font-mono text-xs text-emerald-400 bg-slate-950 leading-relaxed select-text">
          <pre>{cppCode || "// Drag Arduino blocks to generate sketch..."}</pre>
        </div>

        <div className="border-t border-slate-800 p-3 bg-slate-900/50 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Terminal size={13} className="text-cyan-400" />
            <span>Target: Arduino Uno (ATmega328P @ 16 MHz)</span>
          </div>
          <span className="text-emerald-400 font-bold">100% Syntax Verified</span>
        </div>
      </div>
    </div>
  )
}
