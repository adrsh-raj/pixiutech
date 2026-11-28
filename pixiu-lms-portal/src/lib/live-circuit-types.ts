import type { PinRef } from "./circuit-types"
import type { CandidateCompatibilityStatus } from "./circuit-validator"

export const LIVE_CIRCUIT_SCHEMA_VERSION = "3.0" as const

export type LiveInteractionEventType =
  | "wire_start"
  | "target_hover_enter"
  | "target_hover_leave"
  | "target_validation"
  | "wire_complete"
  | "wire_cancel"
  | "wire_delete"
  | "connection_replace"
  | "session_reset"
  | "circuit_snapshot"
  | "hovered_component"
  | "selected_component"

export interface LiveCandidateValidationSummary {
  placement_allowed: boolean
  compatibility_status: CandidateCompatibilityStatus
  is_same_pin: boolean
  is_duplicate_wire: boolean
  is_already_same_net: boolean
  reasons: Array<{
    rule_id: string
    severity: "critical" | "warning" | "advisory"
    title: string
    message: string
    suggestion: string
  }>
}

export interface InProgressConnectionState {
  draft_id: string
  status: "draft" | "valid" | "warning" | "invalid" | "complete" | "cancelled"
  source_part_id: string
  source_pin_id: string
  source_pin_canonical: string
  color: string
  started_at: string
  updated_at: string
  cursor: { x: number; y: number } | null
  candidate_target: {
    part_id: string
    pin_id: string
    canonical_pin_id: string
    currently_hovered: true
  } | null
  recent_target: {
    part_id: string
    pin_id: string
    canonical_pin_id: string
    currently_hovered: false
    left_at: string
  } | null
  validation: LiveCandidateValidationSummary | null
}

export interface RecentTargetPin {
  partId: string
  pinId: string
  leftAt: string
}

export interface LiveMultimeterTelemetry {
  isOpen: boolean
  mode: string
  value: string
  unit: string
  explanation: string
  isContinuityBeep: boolean
}

export interface LiveOscilloscopeChannelTelemetry {
  currentV: number
  vMax: number
  vMin: number
  vpp: number
  frequencyHz: number
  dutyCyclePct: number
  isConnected: boolean
}

export interface LiveOscilloscopeTelemetry {
  isOpen: boolean
  isHold: boolean
  timebaseLabel: string
  windowMs: number
  ch1: LiveOscilloscopeChannelTelemetry | null
  ch2: LiveOscilloscopeChannelTelemetry | null
}

export interface LiveLifecycleEvent {
  event_id: string
  event_seq: number
  event_type: LiveInteractionEventType
  session_id: string
  circuit_revision: number
  interaction_revision: number
  occurred_at: string
  payload: Record<string, unknown>
}

export interface CanonicalCircuitContextV3 {
  schema_version: typeof LIVE_CIRCUIT_SCHEMA_VERSION
  session_id: string
  circuit_revision: number
  interaction_revision: number
  state_revision: number
  event_seq: number
  event_id: string
  captured_at: string
  board: {
    id: string
    part_id: string
    name: string
    architecture?: string
    logic_voltage: number
    adc_resolution_bits?: number
    capabilities?: Record<string, boolean>
  } | null
  components: Array<{
    id: string
    type: string
    name: string
    category: string
    x: number
    y: number
    rotation: number
    props: Record<string, unknown>
    state_summary?: string
  }>
  component_catalogue_metadata: Record<
    string,
    {
      type: string
      name: string
      category: string
      electrical_contract?: { fidelity: string; note: string }
      pin_count: number
      pins: Array<{ id: string; label: string; kind: string }>
    }
  >
  pins: Array<{
    id: string
    part_id: string
    pin_id: string
    label: string
    kind: string
    capabilities?: Record<string, unknown>
    net_id?: number
    voltage?: number
    is_driven?: boolean
    is_gnd?: boolean
    is_floating?: boolean
    is_conflicted?: boolean
    wired: boolean
  }>
  connections: Array<{
    id: string
    from_part_id: string
    from_pin_id: string
    to_part_id: string
    to_pin_id: string
    from: string
    to: string
    color: string
    net_id?: number
    net_name?: string
    status: "complete"
  }>
  in_progress_connection: InProgressConnectionState | null
  selected_component: {
    id: string
    type: string
    name: string
    props: Record<string, unknown>
  } | null
  selected_wire: {
    id: string
    from: string
    to: string
    color: string
    net_id?: number
  } | null
  hovered_component: {
    id: string
    type: string
    name: string
  } | null
  hovered_pin: {
    part_id: string
    pin_id: string
    canonical_pin_id: string
    label?: string
    kind?: string
    net_id?: number
    voltage?: number
    currently_hovered: true
  } | null
  recent_target_pin: {
    part_id: string
    pin_id: string
    canonical_pin_id: string
    currently_hovered: false
    left_at: string
  } | null
  netlist: Array<{
    net_id: number
    name: string
    is_power_rail: boolean
    is_ground_rail: boolean
    is_floating: boolean
    is_conflicted: boolean
    nominal_voltage?: number
    solved_voltage?: number
    pin_keys: string[]
  }>
  simulation: {
    running: boolean
    paused: boolean
    status: "running" | "paused" | "ready"
    run_time_s: number
    pressed_parts: string[]
    active_board_id: string | null
    serial_tail: string[]
  }
  pin_states: Record<
    string,
    {
      state?: string
      output_mode?: string
      value?: number
      angle?: number
      tone_hz?: number
    }
  >
  meter: {
    is_open: boolean
    mode: string
    red_probe: string | null
    black_probe: string | null
    value: string | number | null
    state?: "available" | "unavailable" | "invalid" | "not_configured"
    source?: "simulated" | "unknown"
    unit: string
    explanation?: string
    is_continuity_beep?: boolean
  }
  scope: {
    is_open: boolean
    is_hold: boolean
    timebase_label: string
    window_ms: number
    ch1_probe: string | null
    ch2_probe: string | null
    ch1: LiveOscilloscopeChannelTelemetry | null
    ch2: LiveOscilloscopeChannelTelemetry | null
  }
  diagnostics: {
    health_status: "empty" | "unwired" | "healthy" | "needs-attention" | "danger"
    health_score: number | null
    critical_count: number
    warning_count: number
    tip_count: number
    issues: Array<{
      id: string
      severity: "critical" | "warning" | "tip" | "success"
      category: string
      title: string
      message: string
      suggestion: string
      involved_part_ids: string[]
      involved_pin_ids?: string[]
    }>
    solver_diagnostics: Array<{
      code: string
      severity: string
      message: string
      net_id?: number
    }>
  }
  blockly_context: {
    has_program: boolean
    xml?: string
    code?: string
    pin_bindings: Array<{ pin_id: string; mode: string; snippet: string }>
    active_step_label?: string | null
  }
  runtime_status: {
    circuit_rev_hash: string
    component_count: number
    wire_count: number
    is_empty: boolean
    total_current_ma: number
    outputs: Array<{
      part_id: string
      type: string
      state: string
      current_ma?: number
      burnt?: boolean
    }>
  }
  endpoint_net_lookup?: Record<
    string,
    {
      part_id: string
      part_type: string
      pin_id: string
      net_id: number | null
      net_name: string | null
      is_connected: boolean
      is_power_rail: boolean
      is_ground_rail: boolean
      voltage_v: number | null
      direct_peers: string[]
      same_net_endpoints: string[]
      board_pins: string[]
    }
  >
  resistor_terminals?: Array<{
    part_id: string
    resistance_ohm: number
    terminal_a: {
      pin_id: string
      net_id: number | null
      net_name: string | null
      is_connected: boolean
      direct_peers: string[]
      same_net_peers: string[]
      board_pins: string[]
      voltage_v: number | null
    }
    terminal_b: {
      pin_id: string
      net_id: number | null
      net_name: string | null
      is_connected: boolean
      direct_peers: string[]
      same_net_peers: string[]
      board_pins: string[]
      voltage_v: number | null
    }
    current_ma: number | null
    path_summary: string
  }>
  cross_layer_led?: Array<{
    led_id: string
    topology_ok: boolean
    safety_ok: boolean
    pin_compatibility_ok: boolean
    matches_physical_pin: boolean
    simulation_status: "ready" | "running" | "paused" | "stopped"
    observed_state: string
    physical_pins: string[]
    code_pins: string[]
    series_resistors: string[]
    has_ground_return: boolean
    reversed_polarity: boolean
    shorted: boolean
    mismatch_reason: string | null
    current_ma?: number
    summary: string
  }>
  last_event?: LiveLifecycleEvent | null
}

export type DraftWireEndpoints = {
  from: PinRef
  to: PinRef | null
}
