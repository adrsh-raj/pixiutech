import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Cpu, Play, Square, RotateCcw, ShieldAlert, Lock, ArrowLeft, 
  CheckCircle2, Eye, Zap, Plus, Trash2, Code, Puzzle, 
  X, Clock, Layers, Wrench, Volume2, VolumeX, Hand,
  Crosshair, BellRing, Sun, Moon, Copy, Check
} from 'lucide-react';

export default function Simulation() {
  const _navigate = useNavigate();
  const workbenchRef = useRef(null);

  // ==================== RELIABLE WEB AUDIO ENGINE ====================
  const audioCtxRef = useRef(null);
  const buzzerOscRef = useRef(null);
  const [isSoundMuted, setIsSoundMuted] = useState(false);

  const getAudioContext = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  // Test Beep (2400Hz Piezo Tone)
  const testBuzzerBeep = () => {
    if (isSoundMuted) {
      showToast('Sound is muted! Unmute in top bar to hear beep.', 'Audio Muted', 'info');
      return;
    }
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(2400, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      showToast('Piezo Buzzer tested: 2,400 Hz Square-Wave Beep!', 'Buzzer OK', 'success');
    } catch {
      // audio error
    }
  };

  const startBuzzerContinuous = () => {
    if (isSoundMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      if (!buzzerOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(2400, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        buzzerOscRef.current = osc;
      }
    } catch {
      // audio error
    }
  };

  const stopBuzzerContinuous = () => {
    try {
      if (buzzerOscRef.current) {
        buzzerOscRef.current.stop();
        buzzerOscRef.current.disconnect();
        buzzerOscRef.current = null;
      }
    } catch {
      // ignore
    }
  };

  // Overcurrent Pop/Blast Sound
  const playBlastSound = () => {
    if (isSoundMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // audio error
    }
  };

  // 1. Direct Portal Session & Role Resolution via localStorage
  const [activeUser] = useState(() => {
    try {
      const u = localStorage.getItem('pixiu_auth_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  const activeRole = activeUser?.role;
  const isAuthorized = Boolean(
    activeUser && 
    (activeRole === 'student' || activeRole === 'trainer' || activeRole === 'school' || activeRole === 'admin')
  );

  // Mobile Screen Tab Switcher ('workbench' | 'blocks')
  const [mobileTab, setMobileTab] = useState('workbench');

  // Room Light Ambient Mode (Day / Night Dark Lab)
  const [isRoomLightOn, setIsRoomLightOn] = useState(true);

  // In-page Toast Notification state
  const [toastAlert, setToastAlert] = useState(null);
  const showToast = (msg, title, type = 'info') => {
    setToastAlert({ msg, title, type });
    setTimeout(() => setToastAlert(null), 3500);
  };

  // ==================== BREADBOARD DATA (1:1 with Real 400-Point Board) ====================
  const ROWS = useMemo(() => Array.from({ length: 30 }, (_, i) => i + 1), []);
  const TOP_COLS = useMemo(() => ['a', 'b', 'c', 'd', 'e'], []);
  const BOT_COLS = useMemo(() => ['f', 'g', 'h', 'i', 'j'], []);
  const POWER_GROUPS = useMemo(() => Array.from({ length: 25 }, (_, i) => i + 1), []);

  // ==================== MULTI-COMPONENT PLUGGABLE INVENTORY ====================
  // All components possess TRUE 2-LEG SOCKETS (lead1 and lead2 plugged into distinct holes)
  const [components, setComponents] = useState([
    // 1. 220Ω Resistor
    { id: 'res_1', type: 'resistor', name: '220Ω Resistor', lead1: { row: 10, col: 'c' }, lead2: { row: 15, col: 'c' } },
    // 2. 5mm Red LED Bulb
    { id: 'led_1', type: 'led', name: '5mm Red LED', color: 'red', lead1: { row: 15, col: 'd' }, lead2: { row: 16, col: 'd' }, isBlown: false },
    // 3. KY-008 Laser Diode Emitter (2 Legs: Anode & Cathode)
    { id: 'laser_1', type: 'laser', name: 'KY-008 Laser', lead1: { row: 6, col: 'b' }, lead2: { row: 7, col: 'b' } },
    // 4. CdS Photodetector LDR (2 Legs: Lead 1 & Lead 2)
    { id: 'ldr_1', type: 'ldr', name: 'CdS LDR Sensor', lead1: { row: 6, col: 'i' }, lead2: { row: 7, col: 'i' } },
    // 5. Piezo Buzzer Transducer (2 Legs: Positive & Negative)
    { id: 'buzzer_1', type: 'buzzer', name: 'Piezo Buzzer', lead1: { row: 22, col: 'c' }, lead2: { row: 24, col: 'c' } }
  ]);

  // Tripwire Obstacle State (Virtual Hand Blocking Beam)
  const [isBeamBlocked, setIsBeamBlocked] = useState(false);

  // Active Placement Interaction
  const [placementPending, setPlacementPending] = useState(null); // { type, name, color, step: 1 | 2, tempLead1 }

  // Overcurrent blast animation active flag
  const [isBlasting, setIsBlasting] = useState(false);

  // ==================== FREE PIN-TO-HOLE WIRING ENGINE ====================
  const [wires, setWires] = useState([
    // LED circuit (Pin 11 -> Resistor Row 10, LED Cathode Row 16 -> GND)
    { id: 'w1', fromId: 'ARD_11', toId: 'BB_10_a', fromLabel: 'Pin 11', toLabel: 'Row 10 (a)', color: '#3B82F6' },
    { id: 'w2', fromId: 'BB_16_e', toId: 'ARD_GND', fromLabel: 'Row 16 (e)', toLabel: 'GND', color: '#0F172A' },
    // Laser circuit (Pin 9 -> Laser Row 6, GND -> Row 7)
    { id: 'w3', fromId: 'ARD_9', toId: 'BB_6_a', fromLabel: 'Pin 9', toLabel: 'Row 6 (a)', color: '#EF4444' },
    { id: 'w4', fromId: 'BB_7_a', toId: 'ARD_GND', fromLabel: 'Row 7 (a)', toLabel: 'GND', color: '#0F172A' },
    // Buzzer circuit (Pin 8 -> Buzzer Row 22, GND -> Row 24)
    { id: 'w5', fromId: 'ARD_8', toId: 'BB_22_b', fromLabel: 'Pin 8', toLabel: 'Row 22 (b)', color: '#F59E0B' },
    { id: 'w6', fromId: 'BB_24_b', toId: 'ARD_GND', fromLabel: 'Row 24 (b)', toLabel: 'GND', color: '#0F172A' }
  ]);

  const [selectedWireColor, setSelectedWireColor] = useState('#3B82F6');
  const [activeWiringStart, setActiveWiringStart] = useState(null);

  const WIRE_COLORS = [
    { label: 'Blue', hex: '#3B82F6' },
    { label: 'Black (GND)', hex: '#0F172A' },
    { label: 'Red (5V/Laser)', hex: '#EF4444' },
    { label: 'Yellow (Buzzer)', hex: '#F59E0B' },
    { label: 'Green (LED 2)', hex: '#10B981' },
    { label: 'Orange', hex: '#F97316' }
  ];

  // ==================== DYNAMIC COORDINATE TRACKER ====================
  const [terminalCoords, setTerminalCoords] = useState({});

  const updateCoordinates = () => {
    if (!workbenchRef.current) return;
    const wbRect = workbenchRef.current.getBoundingClientRect();
    const coords = {};
    const elements = workbenchRef.current.querySelectorAll('[id^="term-"]');

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const id = el.id.replace('term-', '');
      coords[id] = {
        x: rect.left - wbRect.left + rect.width / 2,
        y: rect.top - wbRect.top + rect.height / 2
      };
    });

    setTerminalCoords(coords);
  };

  useLayoutEffect(() => {
    updateCoordinates();
    const timer1 = setTimeout(updateCoordinates, 50);
    const timer2 = setTimeout(updateCoordinates, 200);
    const timer3 = setTimeout(updateCoordinates, 500);

    window.addEventListener('resize', updateCoordinates);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener('resize', updateCoordinates);
    };
  }, [wires, components, mobileTab]);

  // Click any hole or pin
  const handleTerminalClick = (terminalId, terminalLabel, rowNum = null, colName = null) => {
    getAudioContext(); // Ensure audio context is unlocked by user gesture

    // If placing a 2-legged component
    if (placementPending) {
      if (!rowNum || !colName) {
        showToast('Please click a breadboard socket hole (columns a-j).', 'Select Socket Hole', 'info');
        return;
      }

      if (placementPending.step === 1) {
        setPlacementPending(prev => ({
          ...prev,
          step: 2,
          tempLead1: { row: rowNum, col: colName }
        }));
        showToast(`Leg 1 placed at Row ${rowNum} (${colName}). Now click socket for Leg 2.`, 'Leg 1 Connected', 'info');
        return;
      }

      if (placementPending.step === 2) {
        const newComp = {
          id: `${placementPending.type}_${Date.now()}`,
          type: placementPending.type,
          name: placementPending.name || placementPending.type.toUpperCase(),
          color: placementPending.color || 'red',
          lead1: placementPending.tempLead1,
          lead2: { row: rowNum, col: colName },
          isBlown: false
        };

        setComponents(prev => [...prev, newComp]);
        setPlacementPending(null);
        showToast(`${newComp.name} installed across Row ${newComp.lead1.row} and Row ${newComp.lead2.row}!`, 'Component Installed', 'success');
        return;
      }
    }

    // Wiring Mode
    if (!activeWiringStart) {
      setActiveWiringStart({ id: terminalId, label: terminalLabel });
      showToast(`Wiring started from ${terminalLabel}. Click destination terminal.`, 'Wiring Active', 'info');
    } else {
      if (activeWiringStart.id === terminalId) {
        setActiveWiringStart(null);
        return;
      }

      const exists = wires.some(w => 
        (w.fromId === activeWiringStart.id && w.toId === terminalId) || 
        (w.fromId === terminalId && w.toId === activeWiringStart.id)
      );

      if (exists) {
        showToast('A jumper wire already connects these two terminals.', 'Already Connected', 'info');
        setActiveWiringStart(null);
        return;
      }

      const newWire = {
        id: 'w_' + Date.now(),
        fromId: activeWiringStart.id,
        toId: terminalId,
        fromLabel: activeWiringStart.label,
        toLabel: terminalLabel,
        color: selectedWireColor
      };

      setWires(prev => [...prev, newWire]);
      showToast(`Connected ${activeWiringStart.label} ➔ ${terminalLabel}`, 'Wire Connected', 'success');
      setActiveWiringStart(null);
    }
  };

  const removeWire = (wireId) => {
    setWires(prev => prev.filter(w => w.id !== wireId));
    showToast('Jumper wire removed.', 'Wire Removed', 'info');
  };

  const removeComponent = (compId) => {
    setComponents(prev => prev.filter(c => c.id !== compId));
    showToast('Component pulled back to tray.', 'Component Removed', 'info');
  };

  const handleClearAllWires = () => {
    setWires([]);
    setActiveWiringStart(null);
    setIsRunning(false);
    stopBuzzerContinuous();
    showToast('All wires cleared from workbench.', 'Wires Cleared', 'info');
  };

  // Add Component Helpers
  const handleAddNewComponent = (type, color = 'red') => {
    const names = {
      led: `5mm ${color.toUpperCase()} LED`,
      resistor: '220Ω Resistor',
      buzzer: 'Piezo Buzzer',
      laser: 'KY-008 Laser Diode',
      ldr: 'CdS Photodetector'
    };

    setPlacementPending({
      type,
      name: names[type],
      color,
      step: 1,
      tempLead1: null
    });

    showToast(`Click any breadboard hole to plug in Leg 1 of ${names[type]}.`, `Place ${names[type]}`, 'info');
  };

  // Preset: Laser Tripwire Security System
  const handleLoadLaserTripwirePreset = () => {
    getAudioContext();
    setComponents([
      { id: 'res_1', type: 'resistor', name: '220Ω Resistor', lead1: { row: 10, col: 'c' }, lead2: { row: 15, col: 'c' } },
      { id: 'led_1', type: 'led', name: '5mm Red LED', color: 'red', lead1: { row: 15, col: 'd' }, lead2: { row: 16, col: 'd' }, isBlown: false },
      { id: 'laser_1', type: 'laser', name: 'KY-008 Laser', lead1: { row: 6, col: 'b' }, lead2: { row: 7, col: 'b' } },
      { id: 'ldr_1', type: 'ldr', name: 'CdS LDR Sensor', lead1: { row: 6, col: 'i' }, lead2: { row: 7, col: 'i' } },
      { id: 'buzzer_1', type: 'buzzer', name: 'Piezo Buzzer', lead1: { row: 22, col: 'c' }, lead2: { row: 24, col: 'c' } }
    ]);

    setWires([
      { id: 'w1', fromId: 'ARD_11', toId: 'BB_10_a', fromLabel: 'Pin 11', toLabel: 'Row 10', color: '#3B82F6' },
      { id: 'w2', fromId: 'BB_16_e', toId: 'ARD_GND', fromLabel: 'Row 16', toLabel: 'GND', color: '#0F172A' },
      { id: 'w3', fromId: 'ARD_9', toId: 'BB_6_a', fromLabel: 'Pin 9', toLabel: 'Row 6', color: '#EF4444' },
      { id: 'w4', fromId: 'BB_7_a', toId: 'ARD_GND', fromLabel: 'Row 7', toLabel: 'GND', color: '#0F172A' },
      { id: 'w5', fromId: 'ARD_8', toId: 'BB_22_b', fromLabel: 'Pin 8', toLabel: 'Row 22', color: '#F59E0B' },
      { id: 'w6', fromId: 'BB_24_b', toId: 'ARD_GND', fromLabel: 'Row 24', toLabel: 'GND', color: '#0F172A' }
    ]);

    setBlocks([
      { id: 'b1', type: 'set_pin', pin: '9', state: 'HIGH' },  // Laser ON (Arm Tripwire)
      { id: 'b2', type: 'wait', duration: 1.0 }
    ]);

    setIsBeamBlocked(false);
    showToast('Laser Security Tripwire System loaded! Click Run Simulation, then Wave Hand to test.', 'Preset Loaded', 'success');
  };

  // ==================== UNIVERSAL GRAPH CIRCUIT SOLVER ====================
  const getElectricalNode = (termId) => {
    if (termId.startsWith('ARD_')) return termId;
    if (termId.startsWith('PWR_TOP_POS_')) return 'NODE_PWR_TOP_POS';
    if (termId.startsWith('PWR_TOP_NEG_')) return 'NODE_PWR_TOP_NEG';
    if (termId.startsWith('PWR_BOT_POS_')) return 'NODE_PWR_BOT_POS';
    if (termId.startsWith('PWR_BOT_NEG_')) return 'NODE_PWR_BOT_NEG';

    const match = termId.match(/^BB_(\d+)_([a-j])$/);
    if (match) {
      const row = match[1];
      const col = match[2];
      if (['a', 'b', 'c', 'd', 'e'].includes(col)) {
        return `NODE_ROW_${row}_TOP`;
      } else {
        return `NODE_ROW_${row}_BOT`;
      }
    }
    return termId;
  };

  // Dynamic Pin Output States
  const [pinStates, setPinStates] = useState({
    '13': false,
    '12': false,
    '11': false,
    '10': false,
    '9': false, // Laser pin default
    '8': false, // Buzzer pin default
    '5V': true,
    '3V3': true
  });

  const circuitAnalysis = useMemo(() => {
    const adj = {};
    const addEdge = (u, v) => {
      if (!adj[u]) adj[u] = [];
      if (!adj[v]) adj[v] = [];
      adj[u].push(v);
      adj[v].push(u);
    };

    wires.forEach(w => {
      const u = getElectricalNode(w.fromId);
      const v = getElectricalNode(w.toId);
      addEdge(u, v);
    });

    const isConnected = (startNode, targetNode) => {
      if (startNode === targetNode) return true;
      const visited = new Set();
      const queue = [startNode];
      visited.add(startNode);

      while (queue.length > 0) {
        const curr = queue.shift();
        if (curr === targetNode) return true;
        const neighbors = adj[curr] || [];
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
      return false;
    };

    const powerPins = ['ARD_13', 'ARD_12', 'ARD_11', 'ARD_10', 'ARD_9', 'ARD_8', 'ARD_5V', 'ARD_3V3'];
    const gndPins = ['ARD_GND', 'ARD_GND2', 'ARD_GND_TOP'];
    const isToGnd = (node) => gndPins.some(g => isConnected(node, g));

    const componentsStatus = {};

    components.forEach(comp => {
      const node1 = getElectricalNode(`BB_${comp.lead1.row}_${comp.lead1.col}`);
      const node2 = getElectricalNode(`BB_${comp.lead2.row}_${comp.lead2.col}`);

      let connectedPin = null;
      for (const p of powerPins) {
        if (isConnected(p, node1)) {
          connectedPin = p.replace('ARD_', '');
          break;
        }
      }

      // Check LED overcurrent vs protected
      if (comp.type === 'led') {
        let isDirect = false;
        let isProtected = false;
        let pPin = null;

        for (const p of powerPins) {
          if (isConnected(p, node1)) {
            isDirect = true;
            pPin = p.replace('ARD_', '');
            break;
          }
        }

        // Check through any resistor
        if (!isDirect) {
          components.filter(c => c.type === 'resistor').forEach(res => {
            const rN1 = getElectricalNode(`BB_${res.lead1.row}_${res.lead1.col}`);
            const rN2 = getElectricalNode(`BB_${res.lead2.row}_${res.lead2.col}`);
            for (const p of powerPins) {
              if (isConnected(p, rN1) && isConnected(rN2, node1)) {
                isProtected = true;
                pPin = p.replace('ARD_', '');
              } else if (isConnected(p, rN2) && isConnected(rN1, node1)) {
                isProtected = true;
                pPin = p.replace('ARD_', '');
              }
            }
          });
        }

        const closed = isToGnd(node2);
        componentsStatus[comp.id] = {
          isComplete: (isDirect || isProtected) && closed,
          sourcePin: pPin,
          isOvercurrent: isDirect && closed
        };
      } 
      // Laser Module
      else if (comp.type === 'laser') {
        const closed = isToGnd(node2);
        componentsStatus[comp.id] = {
          isComplete: Boolean(connectedPin && closed),
          sourcePin: connectedPin
        };
      }
      // Piezo Buzzer
      else if (comp.type === 'buzzer') {
        const closed = isToGnd(node2);
        componentsStatus[comp.id] = {
          isComplete: Boolean(connectedPin && closed),
          sourcePin: connectedPin
        };
      }
      // Resistor / LDR
      else {
        componentsStatus[comp.id] = {
          isComplete: Boolean(connectedPin)
        };
      }
    });

    // Optical Grid Alignment Check
    const lasers = components.filter(c => c.type === 'laser');
    const ldrs = components.filter(c => c.type === 'ldr');

    let opticalAligned = false;
    let alignedLaserId = null;
    let alignedLdrId = null;

    lasers.forEach(las => {
      ldrs.forEach(ldr => {
        if (las.lead1.row === ldr.lead1.row) {
          opticalAligned = true;
          alignedLaserId = las.id;
          alignedLdrId = ldr.id;
        }
      });
    });

    // Overall summary message
    const hasOvercurrent = Object.values(componentsStatus).some(s => s.isOvercurrent);
    let message = 'Ready to simulate.';
    if (hasOvercurrent) {
      message = '💥 OVERCURRENT HAZARD: An LED is directly connected without a 220Ω resistor (~125mA will blow it)!';
    } else if (opticalAligned) {
      if (isBeamBlocked) {
        message = '🚨 TRIPWIRE BREACH! Obstacle in laser beam! Red Light ON & Buzzer Alarm BEEPING!';
      } else {
        message = '🎯 Laser pointing directly to LDR (Row 6) • Perimeter Secure • Click "Wave Hand (Block)" to test obstacle!';
      }
    } else if (lasers.length > 0 && ldrs.length > 0) {
      message = '⚠️ Laser and LDR on different rows. Move them to the same row to align optical beam!';
    } else {
      message = '✅ Circuit graph ready. Wire your components and press Run Simulation.';
    }

    return {
      componentsStatus,
      opticalAligned,
      alignedLaserId,
      alignedLdrId,
      hasOvercurrent,
      message
    };
  }, [wires, components, isBeamBlocked]);

  const DEFAULT_TRIPWIRE_SKETCH = `// ================================================================
// Pixiu Cyber-Lab: Laser Security Tripwire Alarm System
// Microcontroller: ATmega328P @ 16 MHz (Arduino Uno R3)
// ================================================================

const int PIN_LASER  = 9;   // KY-008 Laser Diode Emitter
const int PIN_LDR    = A0;  // CdS Photoresistor Sensor
const int PIN_LED    = 11;  // Red Warning Light (with 220Ω Resistor)
const int PIN_BUZZER = 8;   // Piezo Buzzer Transducer (2400Hz)

const int LIGHT_THRESHOLD = 400; // Threshold between light and shadow

void setup() {
  pinMode(PIN_LASER, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LDR, INPUT);

  // Turn ON Laser Diode, aiming directly at the Photoresistor
  digitalWrite(PIN_LASER, HIGH);

  Serial.begin(9600);
  Serial.println("=========================================");
  Serial.println("   PIXIU LASER SECURITY SYSTEM ARMED    ");
  Serial.println("=========================================");
}

void loop() {
  // Read analog light level from CdS Photoresistor (0 to 1023)
  int ldrValue = analogRead(PIN_LDR);

  // IF an obstacle/intruder blocks the laser beam:
  if (ldrValue < LIGHT_THRESHOLD) {
    digitalWrite(PIN_LED, HIGH);  // Turn ON Red Light
    tone(PIN_BUZZER, 2400);       // Sound Piezo Buzzer Alarm (2400Hz BEEP)
    Serial.print("[🚨 ALARM] Obstacle Detected! LDR: ");
    Serial.println(ldrValue);
  } 
  // ELSE (Laser beam is intact and pointing into Photoresistor):
  else {
    digitalWrite(PIN_LED, LOW);   // Turn OFF Red Light
    noTone(PIN_BUZZER);           // Silence Buzzer
    Serial.print("[🟢 SECURE] Beam Intact. LDR: ");
    Serial.println(ldrValue);
  }

  delay(100);
}`;

  // ==================== VISUAL BLOCK CODING STATE ====================
  const [blocks, setBlocks] = useState([
    { id: 'b1', type: 'set_pin', pin: '9', state: 'HIGH' },   // Laser ON (Arm Tripwire)
    { id: 'b_tripwire', type: 'tripwire_logic', laserPin: '9', ldrPin: 'A0', ledPin: '11', buzzerPin: '8' }
  ]);
  const [repeatLoop, setRepeatLoop] = useState(true);
  const [activeBlockIndex, setActiveBlockIndex] = useState(-1);
  const [showCppCode, setShowCppCode] = useState(false);
  const [editableCppCode, setEditableCppCode] = useState(DEFAULT_TRIPWIRE_SKETCH);
  const [isCopied, setIsCopied] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  const addBlock = (type) => {
    if (type === 'set_pin') {
      setBlocks(prev => [...prev, { id: 'b_' + Date.now(), type: 'set_pin', pin: '11', state: 'HIGH' }]);
    } else if (type === 'wait') {
      setBlocks(prev => [...prev, { id: 'b_' + Date.now(), type: 'wait', duration: 1.0 }]);
    } else if (type === 'tripwire_logic') {
      setBlocks(prev => [...prev, { id: 'b_tripwire_' + Date.now(), type: 'tripwire_logic', laserPin: '9', ldrPin: 'A0', ledPin: '11', buzzerPin: '8' }]);
    }
  };

  const deleteBlock = (id) => {
    if (blocks.length <= 1) {
      showToast('Keep at least 1 block in the program.', 'Cannot Delete', 'info');
      return;
    }
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const updateBlock = (id, field, val) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: val } : b));
  };

  // ==================== SIMULATION RUNNER ====================
  const [isRunning, setIsRunning] = useState(false);
  const [_runTimeSec, setRunTimeSec] = useState(0);
  const [serialLogs, setSerialLogs] = useState([]);

  // Check which components are active
  const isComponentEmitting = (comp) => {
    if (!isRunning) return false;
    const stat = circuitAnalysis.componentsStatus[comp.id];
    if (!stat || !stat.isComplete) return false;

    // 1. LED (Red Light)
    if (comp.type === 'led') {
      // In laser security tripwire mode: if beam is blocked, RED LIGHT TURNS ON!
      if (isBeamBlocked && comp.color === 'red') {
        return true;
      }
      // If beam is not blocked, Red Light stays OFF (Perimeter secure)
      if (!isBeamBlocked && comp.color === 'red') {
        return false;
      }
      return Boolean(pinStates[stat.sourcePin]) && !comp.isBlown && !stat.isOvercurrent;
    }

    // 2. KY-008 Laser Diode
    if (comp.type === 'laser') {
      return Boolean(pinStates[stat.sourcePin]) || true; // Laser emits while simulation is active
    }

    // 3. Piezo Buzzer
    if (comp.type === 'buzzer') {
      // If tripwire beam is blocked: BUZZER BEEPS!
      if (isBeamBlocked) {
        return true;
      }
      // If tripwire beam is NOT blocked: Buzzer stays silent
      if (!isBeamBlocked) {
        return false;
      }
      return Boolean(pinStates[stat.sourcePin]);
    }
    return false;
  };

  // Sound Engine Sync: If ANY buzzer is active, sound continuous tone
  const anyBuzzerActive = useMemo(() => {
    return components.some(c => c.type === 'buzzer' && isComponentEmitting(c));
  }, [components, isRunning, pinStates, circuitAnalysis, isBeamBlocked]);

  useEffect(() => {
    if (anyBuzzerActive) {
      startBuzzerContinuous();
    } else {
      stopBuzzerContinuous();
    }
    return () => {
      stopBuzzerContinuous();
    };
  }, [anyBuzzerActive, isSoundMuted]);

  // Simulation execution loop
  useEffect(() => {
    let timeoutId = null;
    let timerId = null;

    if (isRunning) {
      timerId = setInterval(() => setRunTimeSec(prev => prev + 1), 1000);
      let currentStep = 0;

      const executeNextBlock = () => {
        if (!isRunning) return;
        if (blocks.length === 0) return;

        if (currentStep >= blocks.length) {
          if (repeatLoop) {
            currentStep = 0;
          } else {
            setIsRunning(false);
            setActiveBlockIndex(-1);
            setPinStates(prev => ({ ...prev, '13': false, '12': false, '11': false, '10': false, '9': false, '8': false }));
            setSerialLogs(prev => [...prev.slice(-30), `[Program Complete] Reached end of sequence.`]);
            return;
          }
        }

        const block = blocks[currentStep];
        setActiveBlockIndex(currentStep);

        if (block.type === 'set_pin') {
          const isHigh = block.state === 'HIGH';
          const targetPin = String(block.pin);

          setPinStates(prev => ({
            ...prev,
            [targetPin]: isHigh
          }));

          // Check if targetPin causes an LED overcurrent blast!
          components.forEach(c => {
            if (c.type === 'led') {
              const stat = circuitAnalysis.componentsStatus[c.id];
              if (stat && stat.sourcePin === targetPin && isHigh && stat.isOvercurrent) {
                if (!c.isBlown) {
                  c.isBlown = true;
                  setIsBlasting(true);
                  playBlastSound();
                  setTimeout(() => setIsBlasting(false), 900);
                  setSerialLogs(prev => [
                    ...prev.slice(-30),
                    `[💥 BURNOUT BLAST!] Pin ${targetPin} HIGH ➔ 125mA surged without 220Ω resistor! ${c.name} EXPLODED!`
                  ]);
                  showToast(`💥 BURNOUT! ${c.name} blown due to 125mA overcurrent! Add a 220Ω resistor.`, 'LED Blown!', 'error');
                }
              }
            }
          });

          setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${targetPin} set to ${block.state}`]);

          currentStep++;
          timeoutId = setTimeout(executeNextBlock, 300);
        } 
        else if (block.type === 'wait') {
          const ms = Math.max(200, block.duration * 1000);
          setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Wait ${block.duration}s...`]);
          currentStep++;
          timeoutId = setTimeout(executeNextBlock, ms);
        }
        else if (block.type === 'tripwire_logic') {
          if (isBeamBlocked) {
            setSerialLogs(prev => [...prev.slice(-30), `[🚨 TRIPWIRE ALARM] Obstacle detected! Red Light ON, Piezo Buzzer BEEPING at 2400Hz!`]);
          } else {
            setSerialLogs(prev => [...prev.slice(-30), `[🟢 PERIMETER SECURE] Laser beam intact on LDR (100Ω). Red Light OFF, Buzzer Silent.`]);
          }
          currentStep++;
          timeoutId = setTimeout(executeNextBlock, 500);
        }
      };

      executeNextBlock();
    } else {
      setActiveBlockIndex(-1);
      setPinStates(prev => ({ ...prev, '13': false, '12': false, '11': false, '10': false, '9': false, '8': false }));
      stopBuzzerContinuous();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (timerId) clearInterval(timerId);
    };
  }, [isRunning, blocks, repeatLoop, circuitAnalysis, isBeamBlocked]);

  const handleToggleRun = () => {
    getAudioContext();
    if (!isRunning) {
      setIsRunning(true);
      showToast('Simulation running! Executing block sequence.', 'Running', 'success');
    } else {
      setIsRunning(false);
      setActiveBlockIndex(-1);
      setPinStates(prev => ({ ...prev, '13': false, '12': false, '11': false, '10': false, '9': false, '8': false }));
      stopBuzzerContinuous();
      showToast('Simulation stopped.', 'Stopped', 'info');
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setActiveBlockIndex(-1);
    setRunTimeSec(0);
    setPinStates(prev => ({ ...prev, '13': false, '12': false, '11': false, '10': false, '9': false, '8': false }));
    stopBuzzerContinuous();
    setSerialLogs([`[System] Reset to idle.`]);
    showToast('Simulation counters reset.', 'Reset Complete', 'info');
  };

  // 3D X-Ray Anatomy Modal State
  const [xrayModalComponent, setXrayModalComponent] = useState(null);

  // Generated C++ Sketch
  const _generatedCppCode = useMemo(() => {
    const hasTripwireBlock = blocks.some(b => b.type === 'tripwire_logic');

    if (hasTripwireBlock) {
      return `// ================================================================
// Pixiu Cyber-Lab: Laser Security Tripwire Alarm System
// Microcontroller: ATmega328P @ 16 MHz (Arduino Uno R3)
// ================================================================

const int PIN_LASER = 9;   // KY-008 Laser Diode Emitter
const int PIN_LDR   = A0;  // CdS Photoresistor Sensor
const int PIN_LED   = 11;  // Red Warning Light (with 220Ω Resistor)
const int PIN_BUZZER = 8;  // Piezo Buzzer Transducer (2400Hz)

const int LIGHT_THRESHOLD = 400; // Threshold between light and shadow

void setup() {
  pinMode(PIN_LASER, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LDR, INPUT);

  // Turn ON Laser Diode, aiming directly at the Photoresistor
  digitalWrite(PIN_LASER, HIGH);

  Serial.begin(9600);
  Serial.println("=========================================");
  Serial.println("   PIXIU LASER SECURITY SYSTEM ARMED    ");
  Serial.println("=========================================");
}

void loop() {
  // Read analog light level from CdS Photoresistor (0 to 1023)
  int ldrValue = analogRead(PIN_LDR);

  // IF an obstacle/intruder blocks the laser beam:
  if (ldrValue < LIGHT_THRESHOLD) {
    digitalWrite(PIN_LED, HIGH);  // Turn ON Red Light
    tone(PIN_BUZZER, 2400);       // Sound Piezo Buzzer Alarm (2400Hz BEEP)
    Serial.print("[🚨 ALARM] Obstacle Detected! LDR: ");
    Serial.println(ldrValue);
  } 
  // ELSE (Laser beam is intact and pointing into Photoresistor):
  else {
    digitalWrite(PIN_LED, LOW);   // Turn OFF Red Light
    noTone(PIN_BUZZER);           // Silence Buzzer
    Serial.print("[🟢 SECURE] Beam Intact. LDR: ");
    Serial.println(ldrValue);
  }

  delay(100);
}`;
    }

    let loopCode = '';
    blocks.forEach(b => {
      if (b.type === 'set_pin') {
        loopCode += `  digitalWrite(${b.pin}, ${b.state});\n`;
      } else if (b.type === 'wait') {
        loopCode += `  delay(${Math.round(b.duration * 1000)});\n`;
      }
    });

    return `// Pixiu Cyber-Lab Auto-Generated Arduino C++ Sketch
void setup() {
  pinMode(13, OUTPUT);
  pinMode(11, OUTPUT);
  pinMode(9, OUTPUT);  // KY-008 Laser Diode
  pinMode(8, OUTPUT);  // Piezo Buzzer
  digitalWrite(9, HIGH);
  Serial.begin(9600);
}

void loop() {
${loopCode}}`;
  }, [blocks]);

  // ==================== 403 AUTHORIZATION GUARD ====================
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#070B14] text-white flex flex-col justify-between font-sans">
        <header className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2.5 py-1 rounded-xl shadow-md border border-white/20">
              <img src="/img/logo.png" alt="Pixiu Tech Logo" className="h-6 w-auto object-contain" />
            </div>
            <div>
              <span className="text-xs font-black tracking-wider text-white">PIXIU TECH</span>
              <span className="text-[9px] text-pixiu-blue font-bold block uppercase tracking-widest leading-none">Cyber-Lab OS</span>
            </div>
          </div>
          <Link 
            to="/login?redirect=/simulation" 
            className="px-4 py-2 bg-pixiu-blue hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
          >
            Sign In to Access ➔
          </Link>
        </header>

        <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-2xl animate-pulse">
            <Lock size={38} />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert size={14} /> Laboratory Security Guard
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Authorized Portal Session Required
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              The <strong>Pixiu Cyber-Lab Virtual Simulation Workbench</strong> is reserved exclusively for enrolled students, partner schools, and instructors.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/login?redirect=/simulation"
              className="w-full sm:w-auto px-6 py-3 bg-pixiu-blue hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
            >
              Sign In with Credentials ➔
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5"
            >
              <ArrowLeft size={14} /> Back to Homepage
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen text-white flex flex-col font-sans select-none relative pb-16 lg:pb-0 transition-colors duration-500 ${
      isRoomLightOn ? 'bg-[#060913]' : 'bg-[#020408]'
    }`}>
      
      {/* Toast Alert */}
      {toastAlert && (
        <div className={`fixed bottom-20 lg:bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
          toastAlert.type === 'error'
            ? 'bg-rose-950/95 border-rose-500/50 text-rose-200'
            : toastAlert.type === 'success' 
            ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200' 
            : 'bg-slate-900/95 border-blue-500/50 text-slate-200'
        }`}>
          <CheckCircle2 size={16} className={toastAlert.type === 'error' ? 'text-rose-400' : toastAlert.type === 'success' ? 'text-emerald-400' : 'text-blue-400'} />
          <div>
            <div className="font-bold">{toastAlert.title}</div>
            <div className="text-[11px] opacity-80">{toastAlert.msg}</div>
          </div>
        </div>
      )}

      {/* ==================== CLEAN TOP NAVIGATION NAVBAR ==================== */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <Link 
            to={activeRole === 'student' ? '/student-portal' : activeRole === 'school' ? '/school-portal' : activeRole === 'trainer' ? '/trainers' : '/'}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors flex items-center gap-1 text-xs font-bold mr-1 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Portal</span>
          </Link>

          <div className="bg-white px-2 py-0.5 rounded-lg shadow-sm border border-white/20 shrink-0">
            <img src="/img/logo.png" alt="Pixiu Tech" className="h-5 sm:h-6 w-auto object-contain" />
          </div>

          <div>
            <h1 className="text-xs sm:text-sm font-black text-white tracking-tight flex items-center gap-1.5">
              <Cpu size={15} className="text-pixiu-blue" />
              Pixiu Cyber-Lab • Multi-Component Studio
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate max-w-[160px] sm:max-w-none">
              Laser Tripwire • Piezo Buzzer • Dual-Lead Sockets
            </p>
          </div>
        </div>

        {/* Master Action Controls */}
        <div className="flex items-center gap-2">
          
          {/* 💡 ROOM LIGHT SWITCH (DAY / DARK ROOM) */}
          <button
            onClick={() => {
              setIsRoomLightOn(!isRoomLightOn);
              showToast(!isRoomLightOn ? 'Room light turned ON (Daylight Lux).' : 'Room light turned OFF! Dark Lab mode active.', 'Room Light', 'info');
            }}
            className={`p-1.5 sm:p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              isRoomLightOn 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm' 
                : 'bg-indigo-950/80 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
            }`}
            title={isRoomLightOn ? 'Switch to Dark Room (Enhances Laser & LED Glow)' : 'Turn Room Lights ON'}
          >
            {isRoomLightOn ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-cyan-400 animate-pulse" />}
            <span className="hidden md:inline text-[11px]">{isRoomLightOn ? 'Light: ON' : 'Dark Lab'}</span>
          </button>

          {/* 🔔 TEST BUZZER BEEP BUTTON */}
          <button
            onClick={testBuzzerBeep}
            className="px-2.5 sm:px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-xl border border-yellow-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Click to test 2,400 Hz Piezo Buzzer sound directly"
          >
            <BellRing size={13} className="text-yellow-400" />
            <span className="text-[11px]">Test Beep</span>
          </button>

          {/* Sound Mute / Unmute Toggle */}
          <button
            onClick={() => {
              setIsSoundMuted(!isSoundMuted);
              if (!isSoundMuted) stopBuzzerContinuous();
              showToast(!isSoundMuted ? 'Audio muted.' : 'Audio unmuted.', 'Sound Setting', 'info');
            }}
            className={`p-1.5 sm:p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              isSoundMuted 
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
            title={isSoundMuted ? 'Unmute Audio Beeps' : 'Mute Audio Beeps'}
          >
            {isSoundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Preset Switcher */}
          <button
            onClick={handleLoadLaserTripwirePreset}
            className="px-2 sm:px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 rounded-xl border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Load Laser Security Tripwire System (Laser + LDR + Buzzer)"
          >
            <Crosshair size={13} className="text-cyan-400" />
            <span className="hidden md:inline text-[11px]">Preset</span>
          </button>

          <button
            onClick={handleClearAllWires}
            className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Clear all wires"
          >
            <Trash2 size={13} />
          </button>

          <button
            onClick={handleReset}
            className="hidden sm:flex p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
            title="Reset simulation"
          >
            <RotateCcw size={13} />
          </button>

          {/* Top Bar Obstacle Trigger Button */}
          <button
            onClick={() => {
              getAudioContext();
              const nextBlocked = !isBeamBlocked;
              setIsBeamBlocked(nextBlocked);
              if (nextBlocked) {
                showToast('🚨 OBSTACLE DETECTED! Laser beam cut ➔ Red Light ON & Buzzer Alarm BEEPING!', 'Tripwire Breach!', 'error');
                setSerialLogs(prev => [...prev.slice(-30), `[🚨 ALARM TRIGGERED] Obstacle placed! Beam broken ➔ Red Light ON, Piezo Buzzer BEEPING (2400Hz)!`]);
              } else {
                showToast('Perimeter restored: Obstacle removed. Red Light OFF & Buzzer silent.', 'Perimeter Secure', 'success');
                setSerialLogs(prev => [...prev.slice(-30), `[🟢 PERIMETER RESTORED] Obstacle removed ➔ Laser beam intact on LDR (100Ω). Alarm Armed.`]);
              }
            }}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
              isBeamBlocked 
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-600/40 animate-pulse' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400 shadow-indigo-600/30'
            }`}
            title="Click to place/remove an obstacle in front of the laser beam"
          >
            <Hand size={14} className={isBeamBlocked ? 'animate-bounce' : ''} />
            <span>{isBeamBlocked ? '🚨 Remove Obstacle' : '🖐️ Place Obstacle'}</span>
          </button>

          {/* Desktop Run Button */}
          <button
            onClick={handleToggleRun}
            className={`hidden lg:flex px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider items-center gap-1.5 transition-all shadow-lg cursor-pointer ${
              isRunning 
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {isRunning ? (
              <>
                <Square size={13} fill="currentColor" /> Stop
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" /> Run Simulation
              </>
            )}
          </button>
        </div>
      </header>

      {/* ==================== MOBILE SCREEN SWITCHER TABS (< 1024px) ==================== */}
      <div className="lg:hidden bg-slate-950 border-b border-slate-800 px-3 py-2 flex items-center justify-center gap-2 sticky top-[49px] z-30">
        <button
          onClick={() => setMobileTab('workbench')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'workbench'
              ? 'bg-pixiu-blue text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Wrench size={13} />
          <span>3D Hardware Workbench</span>
        </button>

        <button
          onClick={() => setMobileTab('blocks')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'blocks'
              ? 'bg-pixiu-blue text-white shadow-md shadow-blue-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Puzzle size={13} />
          <span>Visual Block Studio</span>
        </button>
      </div>

      {/* ==================== MAIN WORKSPACE ==================== */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        {/* ==================== LEFT: INTERACTIVE 3D WORKBENCH ==================== */}
        <div className={`flex-1 flex-col relative overflow-y-auto ${
          mobileTab === 'workbench' ? 'flex' : 'hidden lg:flex'
        } ${isRoomLightOn ? 'bg-[#070C18]' : 'bg-[#030611]'}`}>
          
          {/* Sub-Toolbar: Status & Wire Spool */}
          <div className="p-2.5 sm:p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs z-20">
            
            {/* Status Pill */}
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border shrink-0 ${
                circuitAnalysis.hasOvercurrent
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse'
                  : circuitAnalysis.opticalAligned
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  circuitAnalysis.hasOvercurrent ? 'bg-rose-500' : circuitAnalysis.opticalAligned ? 'bg-cyan-400' : 'bg-emerald-400'
                }`}></span>
                {circuitAnalysis.hasOvercurrent ? 'Overcurrent Hazard' : circuitAnalysis.opticalAligned ? 'Laser Aligned' : 'Circuit Active'}
              </span>
              <p className="text-[11px] text-slate-300 truncate max-w-xs sm:max-w-md hidden sm:block" title={circuitAnalysis.message}>
                {circuitAnalysis.message}
              </p>
            </div>

            {/* Wire Spool & Wave Hand Button */}
            <div className="flex items-center gap-2">
              {/* Wave Hand / Break Laser Beam Button */}
              {circuitAnalysis.opticalAligned && (
                <button
                  onClick={() => {
                    getAudioContext();
                    const nextBlocked = !isBeamBlocked;
                    setIsBeamBlocked(nextBlocked);
                    if (nextBlocked) {
                      showToast('🚨 OBSTACLE DETECTED! Laser beam broken ➔ Red Light ON & Buzzer Alarm BEEPING!', 'Tripwire Breach!', 'error');
                      setSerialLogs(prev => [...prev.slice(-30), `[🚨 ALARM TRIGGERED] Obstacle detected! Beam broken ➔ Red Light ON, Piezo Buzzer BEEPING (2400Hz)!`]);
                    } else {
                      showToast('Perimeter restored: Obstacle removed. Red Light OFF & Buzzer silent.', 'Perimeter Secure', 'success');
                      setSerialLogs(prev => [...prev.slice(-30), `[🟢 PERIMETER RESTORED] Obstacle removed ➔ Laser beam intact on LDR (100Ω). Alarm Armed.`]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                    isBeamBlocked 
                      ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-600/40 animate-pulse' 
                      : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-cyan-300 border-indigo-500/40'
                  }`}
                  title="Simulate obstacle (e.g. hand or intruder) blocking the laser beam"
                >
                  <Hand size={14} className={isBeamBlocked ? 'animate-bounce' : ''} />
                  <span>{isBeamBlocked ? '🚨 Remove Obstacle' : '🖐️ Place Obstacle (Cut Beam)'}</span>
                </button>
              )}

              {/* Wire Spool */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {WIRE_COLORS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setSelectedWireColor(c.hex)}
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 transition-transform cursor-pointer ${
                      selectedWireColor === c.hex ? 'scale-125 border-white shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={`Select ${c.label} Jumper Wire`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ================= COMPACT FLOATING PARTS TRAY (MULTI-COMPONENT ADDER) ================= */}
          <div className="px-4 sm:px-6 pt-3 pb-1 z-20">
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-cyan-400" />
                <span className="text-xs font-extrabold text-white">Add Components:</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* + Add Red LED */}
                <button
                  onClick={() => handleAddNewComponent('led', 'red')}
                  className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus size={12} /> Red LED
                </button>

                {/* + Add Green LED */}
                <button
                  onClick={() => handleAddNewComponent('led', 'green')}
                  className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus size={12} /> Green LED
                </button>

                {/* + Add 220Ω Resistor */}
                <button
                  onClick={() => handleAddNewComponent('resistor')}
                  className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus size={12} /> 220Ω Resistor
                </button>

                {/* + Add KY-008 Laser */}
                <button
                  onClick={() => handleAddNewComponent('laser')}
                  className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus size={12} /> Laser Diode
                </button>

                {/* + Add CdS LDR */}
                <button
                  onClick={() => handleAddNewComponent('ldr')}
                  className="px-2 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus size={12} /> Photoresistor (LDR)
                </button>

                {/* + Add Piezo Buzzer */}
                <button
                  onClick={() => handleAddNewComponent('buzzer')}
                  className="px-2 py-1 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 border border-yellow-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus size={12} /> Piezo Buzzer
                </button>

                {/* Obstacle Barrier Placement Toggle */}
                <button
                  onClick={() => {
                    getAudioContext();
                    const nextBlocked = !isBeamBlocked;
                    setIsBeamBlocked(nextBlocked);
                    if (nextBlocked) {
                      showToast('🚨 OBSTACLE DETECTED! Laser beam cut ➔ Red Light ON & Buzzer Alarm BEEPING!', 'Tripwire Breach!', 'error');
                      setSerialLogs(prev => [...prev.slice(-30), `[🚨 ALARM TRIGGERED] Obstacle placed! Beam broken ➔ Red Light ON, Piezo Buzzer BEEPING (2400Hz)!`]);
                    } else {
                      showToast('Perimeter restored: Obstacle removed. Red Light OFF & Buzzer silent.', 'Perimeter Secure', 'success');
                      setSerialLogs(prev => [...prev.slice(-30), `[🟢 PERIMETER RESTORED] Obstacle removed ➔ Laser beam intact on LDR (100Ω). Alarm Armed.`]);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all ${
                    isBeamBlocked
                      ? 'bg-rose-600 text-white border-rose-400 shadow-md animate-pulse'
                      : 'bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 border-indigo-500/50'
                  }`}
                  title="Simulate obstacle placed right in front of the laser beam"
                >
                  <Hand size={12} className={isBeamBlocked ? 'animate-bounce' : ''} />
                  <span>{isBeamBlocked ? '🚨 Remove Obstacle' : '🖐️ Place Obstacle (Cut Beam)'}</span>
                </button>
              </div>
            </div>

            {/* Active Placement Banner */}
            {placementPending && (
              <div className="mt-2 bg-blue-600/20 border border-blue-500/50 p-2.5 rounded-xl flex items-center justify-between text-xs text-blue-200 animate-pulse">
                <span>
                  <strong>Placing {placementPending.name} (Leg {placementPending.step} of 2):</strong> Click socket hole on breadboard.
                </span>
                <button 
                  onClick={() => setPlacementPending(null)}
                  className="px-2 py-0.5 bg-blue-900 hover:bg-blue-800 text-white rounded text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* ================= WORKBENCH CANVAS ================= */}
          <div className="flex-1 p-3 sm:p-6 overflow-x-auto">
            <div 
              ref={workbenchRef}
              className={`relative min-w-[980px] min-h-[640px] flex items-center justify-around gap-8 p-6 rounded-3xl border transition-all duration-500 ${
                isRoomLightOn 
                  ? 'border-slate-800/80 bg-slate-950/40 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]' 
                  : 'border-cyan-900/40 bg-[#02050E] shadow-[inset_0_0_80px_rgba(0,0,0,0.9)] bg-[radial-gradient(#0f172a_1px,transparent_1px)] [background-size:24px_24px]'
              }`}
            >
              
              {/* SVG OVERLAY: REAL 3D WIRES, 2-LEGGED COMPONENTS, AND VOLUMETRIC LASER */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible">
                <defs>
                  {/* Resistor ceramic body */}
                  <linearGradient id="resistor-ceramic-clean" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#E2B788" />
                    <stop offset="35%" stopColor="#C99C67" />
                    <stop offset="70%" stopColor="#AF804D" />
                    <stop offset="100%" stopColor="#825C30" />
                  </linearGradient>

                  {/* Laser Beam Volumetric Gradient */}
                  <linearGradient id="laser-beam-volumetric" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF4444" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#EF4444" stopOpacity="1" />
                    <stop offset="100%" stopColor="#FF2222" stopOpacity="0.9" />
                  </linearGradient>

                  {/* Blown LED Charred Gradient */}
                  <linearGradient id="led-blown-clean" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3F3F46" />
                    <stop offset="50%" stopColor="#27272A" />
                    <stop offset="100%" stopColor="#18181B" />
                  </linearGradient>
                </defs>

                {/* ---------------- 1. REAL DUPONT JUMPER WIRES ---------------- */}
                {wires.map((wire) => {
                  const p1 = terminalCoords[wire.fromId];
                  const p2 = terminalCoords[wire.toId];

                  if (!p1 || !p2) return null;

                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  const dist = Math.hypot(dx, dy);
                  const sag = Math.min(90, Math.max(35, dist * 0.22));

                  const cx1 = p1.x + dx * 0.25;
                  const cy1 = p1.y - sag;
                  const cx2 = p1.x + dx * 0.75;
                  const cy2 = p2.y - sag;

                  const pathD = `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`;

                  return (
                    <g key={wire.id} className="pointer-events-auto cursor-pointer group" onClick={() => removeWire(wire.id)}>
                      <title>Click to pull wire ({wire.fromLabel} ➔ {wire.toLabel})</title>

                      <path 
                        d={pathD} 
                        fill="none" 
                        stroke="rgba(0,0,0,0.55)" 
                        strokeWidth="8" 
                        strokeLinecap="round" 
                        transform="translate(0, 8)"
                      />

                      <path 
                        d={pathD} 
                        fill="none" 
                        stroke={wire.color} 
                        strokeWidth="5" 
                        strokeLinecap="round" 
                        className="transition-all group-hover:stroke-white group-hover:stroke-[6px]"
                      />

                      <path 
                        d={pathD} 
                        fill="none" 
                        stroke="rgba(255, 255, 255, 0.4)" 
                        strokeWidth="1.6" 
                        strokeLinecap="round" 
                        transform="translate(0, -1)"
                      />

                      <circle cx={p1.x} cy={p1.y} r="5" fill="#0F172A" stroke="#64748B" strokeWidth="1.5" />
                      <circle cx={p1.x} cy={p1.y} r="2" fill="#E2E8F0" />
                      <circle cx={p2.x} cy={p2.y} r="5" fill="#0F172A" stroke="#64748B" strokeWidth="1.5" />
                      <circle cx={p2.x} cy={p2.y} r="2" fill="#E2E8F0" />
                    </g>
                  );
                })}

                {/* ---------------- 2. RENDER ALL PLACED 2-LEGGED COMPONENTS ---------------- */}
                {components.map((comp) => {
                  const p1 = terminalCoords[`BB_${comp.lead1.row}_${comp.lead1.col}`];
                  const p2 = terminalCoords[`BB_${comp.lead2.row}_${comp.lead2.col}`];

                  if (!p1 || !p2) return null;

                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;
                  const isEmitting = isComponentEmitting(comp);

                  // ==================== COMPONENT: 220Ω RESISTOR ====================
                  if (comp.type === 'resistor') {
                    const deg = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
                    return (
                      <g key={comp.id} className="pointer-events-auto cursor-pointer group" onClick={() => removeComponent(comp.id)}>
                        <title>220Ω Resistor. Click to pull back to tray.</title>

                        {/* Physical Silver Leads */}
                        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

                        {/* Ceramic Body */}
                        <g transform={`translate(${midX}, ${midY}) rotate(${deg})`}>
                          <rect x="-24" y="-7" width="48" height="18" rx="8" fill="rgba(0,0,0,0.4)" transform="translate(0, 5)" />
                          <rect x="-24" y="-8" width="48" height="16" rx="6" fill="url(#resistor-ceramic-clean)" stroke="#966F3D" strokeWidth="1" />
                          <circle cx="-20" cy="0" r="7.5" fill="#C99C67" />
                          <circle cx="20" cy="0" r="7.5" fill="#C99C67" />

                          {/* Bands: Red, Red, Brown, Gold */}
                          <rect x="-14" y="-8" width="4" height="16" fill="#DC2626" />
                          <rect x="-6" y="-8" width="4" height="16" fill="#DC2626" />
                          <rect x="2" y="-8" width="4" height="16" fill="#78350F" />
                          <rect x="12" y="-8" width="3.5" height="16" fill="#F59E0B" stroke="#D4AF37" strokeWidth="0.5" />
                          <rect x="-22" y="-6" width="44" height="2" fill="white" opacity="0.45" rx="1" />
                        </g>
                      </g>
                    );
                  }

                  // ==================== COMPONENT: 5mm LED BULB (2 LEGS) ====================
                  if (comp.type === 'led') {
                    const ledColor = comp.color === 'green' ? '#10B981' : '#EF4444';
                    const glowColor = comp.color === 'green' ? '#34D399' : '#F87171';

                    return (
                      <g key={comp.id} className="pointer-events-auto cursor-pointer group" onClick={() => removeComponent(comp.id)}>
                        <title>{comp.name} (Anode Row {comp.lead1.row}, Cathode Row {comp.lead2.row}). Click to pull.</title>

                        {/* Physical Silver Leads (2 Legs) */}
                        <path d={`M ${p1.x} ${p1.y} L ${midX - 4} ${midY - 12}`} stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
                        <path d={`M ${p2.x} ${p2.y} L ${midX + 4} ${midY - 12}`} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

                        {comp.isBlown && (
                          <ellipse cx={midX} cy={midY - 2} rx="18" ry="7" fill="rgba(0,0,0,0.65)" />
                        )}

                        <g transform={`translate(${midX}, ${midY - 34})`}>
                          {/* Volumetric Photon Glow (Extremely rich in Dark Lab Mode) */}
                          {isEmitting && (
                            <>
                              <circle 
                                cx="0" cy="0" 
                                r={isRoomLightOn ? "55" : "85"} 
                                fill={glowColor} 
                                opacity={isRoomLightOn ? "0.4" : "0.75"} 
                                className="animate-pulse" 
                              />
                              <ellipse cx="0" cy="38" rx="40" ry="14" fill={glowColor} opacity="0.5" />
                            </>
                          )}

                          {/* Overcurrent Blast Shockwave */}
                          {isBlasting && comp.isBlown && (
                            <g className="animate-ping pointer-events-none">
                              <circle cx="0" cy="0" r="60" fill="#EF4444" opacity="0.9" />
                              <circle cx="0" cy="0" r="35" fill="#F59E0B" />
                              <circle cx="0" cy="0" r="18" fill="#FFFFFF" />
                            </g>
                          )}

                          {/* Smoke Particles if blown */}
                          {comp.isBlown && (
                            <g className="pointer-events-none">
                              <circle cx="-12" cy="-22" r="11" fill="rgba(100, 116, 139, 0.7)" className="animate-pulse" />
                              <circle cx="12" cy="-30" r="14" fill="rgba(71, 85, 105, 0.8)" className="animate-bounce" />
                              <text x="0" y="-46" textAnchor="middle" fontSize="12" fill="#F87171" fontWeight="900">💥 BURNOUT!</text>
                            </g>
                          )}

                          {/* Rim Flange */}
                          <ellipse 
                            cx="0" cy="14" rx="12" ry="4" 
                            fill={comp.isBlown ? "#1C1917" : isEmitting ? ledColor : "#7F1D1D"} 
                            stroke={comp.isBlown ? "#44403C" : isEmitting ? "#FCA5A5" : "#991B1B"} 
                            strokeWidth="1.2" 
                          />

                          {/* Epoxy Dome */}
                          <path 
                            d="M -11 14 L -11 0 C -11 -16, 11 -16, 11 0 L 11 14 Z" 
                            fill={comp.isBlown ? "url(#led-blown-clean)" : isEmitting ? ledColor : "#7F1D1D"} 
                            stroke={comp.isBlown ? "#57534E" : isEmitting ? "#FECACA" : "#991B1B"} 
                            strokeWidth="1.5" 
                          />

                          {/* Internal Leadframe & Whisker Wire */}
                          <path d="M -6 6 L -2 -3 L -6 -3 Z" fill={comp.isBlown ? "#52525B" : "#E2E8F0"} />
                          <circle cx="-4" cy="-3" r={isEmitting ? "3.5" : "1.5"} fill={comp.isBlown ? "#000" : isEmitting ? "#FFF" : "#450A0A"} />

                          {!comp.isBlown ? (
                            <>
                              <line x1="4" y1="6" x2="4" y2="-1" stroke="#CBD5E1" strokeWidth="1.5" />
                              <path d="M 4 -1 Q 0 -5 -3 -3" fill="none" stroke="#FDE047" strokeWidth="0.8" />
                              <path d="M -8 -8 C -8 -13, -3 -15, 0 -15" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
                            </>
                          ) : (
                            <>
                              <line x1="4" y1="6" x2="4" y2="1" stroke="#52525B" strokeWidth="1.5" />
                              <circle cx="-2" cy="-4" r="5" fill="#000000" opacity="0.9" />
                              <path d="M -7 4 L -2 -5 L 3 -2 L 7 -10" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
                            </>
                          )}
                        </g>
                      </g>
                    );
                  }

                  // ==================== COMPONENT: PIEZO BUZZER (TRUE 2 PHYSICAL LEGS!) ====================
                  if (comp.type === 'buzzer') {
                    return (
                      <g key={comp.id} className="pointer-events-auto cursor-pointer group" onClick={() => removeComponent(comp.id)}>
                        <title>Piezoelectric Buzzer (Positive Leg Row {comp.lead1.row}, Negative Leg Row {comp.lead2.row}). Click to pull.</title>

                        {/* TRUE 2 PHYSICAL SILVER WIRE LEGS EXTENDING INTO SOCKETS */}
                        <path d={`M ${p1.x} ${p1.y} L ${midX - 10} ${midY - 14}`} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
                        <path d={`M ${p2.x} ${p2.y} L ${midX + 10} ${midY - 14}`} stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />

                        <g transform={`translate(${midX}, ${midY - 26})`}>
                          {/* Concentric Sonic Shockwave Rings (Animated when beeping) */}
                          {isEmitting && (
                            <>
                              <circle cx="0" cy="0" r="38" fill="none" stroke="#FBBF24" strokeWidth="2" opacity="0.8" className="animate-ping" />
                              <circle cx="0" cy="0" r="56" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6" className="animate-ping" />
                              <circle cx="0" cy="0" r="75" fill="none" stroke="#D97706" strokeWidth="1" opacity="0.4" className="animate-ping" />
                              <text x="0" y="-36" textAnchor="middle" fontSize="11" fill="#FBBF24" fontWeight="bold">🔊 BEEP! (2.4 kHz)</text>
                            </>
                          )}

                          {/* Cylindrical Casing */}
                          <circle cx="0" cy="0" r="22" fill="#090D16" stroke="#475569" strokeWidth="2.5" />
                          <circle cx="0" cy="0" r="18" fill="#1E293B" />
                          
                          {/* Center Acoustic Port with Bronze Piezo Diaphragm Inside */}
                          <circle cx="0" cy="0" r="9" fill="#B45309" stroke="#78350F" strokeWidth="1" />
                          <circle cx="0" cy="0" r="4" fill="#020617" />

                          {/* Polarity silkscreen marking (+) on Lead 1 side */}
                          <text x="-14" y="-8" fontSize="12" fill="#F8FAFC" fontWeight="black">+</text>
                        </g>
                      </g>
                    );
                  }

                  // ==================== COMPONENT: PHOTORESISTOR LDR (TRUE 2 PHYSICAL LEGS!) ====================
                  if (comp.type === 'ldr') {
                    // Check if aligned with an emitting laser
                    const isHitByLaser = components.some(las => las.type === 'laser' && isComponentEmitting(las) && las.lead1.row === comp.lead1.row && !isBeamBlocked);

                    return (
                      <g key={comp.id} className="pointer-events-auto cursor-pointer group" onClick={() => removeComponent(comp.id)}>
                        <title>CdS Photoresistor LDR (Row {comp.lead1.row} & {comp.lead2.row}). Click to pull.</title>

                        {/* TRUE 2 PHYSICAL SILVER WIRE LEGS EXTENDING INTO SOCKETS */}
                        <path d={`M ${p1.x} ${p1.y} L ${midX - 7} ${midY - 14}`} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
                        <path d={`M ${p2.x} ${p2.y} L ${midX + 7} ${midY - 14}`} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

                        <g transform={`translate(${midX}, ${midY - 24})`}>
                          {/* Ceramic Disc Sensor Head */}
                          <circle cx="0" cy="0" r="15" fill="#E4E4E7" stroke="#71717A" strokeWidth="2" />
                          <circle cx="0" cy="0" r="13" fill="#FAFAFA" />

                          {/* Serpentine Copper-Cadmium Zig-Zag Track */}
                          <path 
                            d="M -9 -7 Q -3 -10 3 -7 T 9 -2 Q 3 3 -3 1 T -9 7" 
                            fill="none" 
                            stroke={isHitByLaser ? "#EF4444" : isRoomLightOn ? "#D97706" : "#451A03"} 
                            strokeWidth="2.2" 
                            strokeLinecap="round" 
                          />

                          {/* Optical Laser Target Spot if Hit by Laser */}
                          {isHitByLaser && (
                            <>
                              <circle cx="0" cy="0" r="8" fill="rgba(239, 68, 68, 0.7)" className="animate-ping" />
                              <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
                              <text x="0" y="-18" textAnchor="middle" fontSize="10" fill="#EF4444" fontWeight="bold">100 Ω</text>
                            </>
                          )}

                          {!isHitByLaser && (
                            <text x="0" y="-18" textAnchor="middle" fontSize="9" fill={isRoomLightOn ? "#94A3B8" : "#475569"} fontWeight="bold">
                              {isRoomLightOn ? '10 kΩ' : '1.2 MΩ'}
                            </text>
                          )}
                        </g>
                      </g>
                    );
                  }

                  // ==================== COMPONENT: KY-008 LASER DIODE (2 PHYSICAL LEGS!) ====================
                  if (comp.type === 'laser') {
                    // Calculate aim angle directly pointing to LDR
                    const targetLdr = components.find(c => c.type === 'ldr');
                    const tLdrP1 = targetLdr ? terminalCoords[`BB_${targetLdr.lead1.row}_${targetLdr.lead1.col}`] : null;
                    const tLdrP2 = targetLdr ? terminalCoords[`BB_${targetLdr.lead2.row}_${targetLdr.lead2.col}`] : null;
                    const tLdrX = tLdrP1 && tLdrP2 ? (tLdrP1.x + tLdrP2.x) / 2 : tLdrP1 ? tLdrP1.x : midX + 150;
                    const tLdrY = tLdrP1 && tLdrP2 ? (tLdrP1.y + tLdrP2.y) / 2 - 24 : tLdrP1 ? tLdrP1.y - 24 : midY - 22;

                    const aimAngleDeg = Math.atan2(tLdrY - (midY - 22), tLdrX - midX) * (180 / Math.PI);

                    return (
                      <g key={comp.id} className="pointer-events-auto cursor-pointer group" onClick={() => removeComponent(comp.id)}>
                        <title>KY-008 Laser Diode (Pointing directly to LDR). Click to pull.</title>

                        {/* TRUE 2 PHYSICAL SILVER LEADS */}
                        <path d={`M ${p1.x} ${p1.y} L ${midX - 8} ${midY - 12}`} stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
                        <path d={`M ${p2.x} ${p2.y} L ${midX + 8} ${midY - 12}`} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

                        {/* Oriented Barrel Pointing directly towards LDR! */}
                        <g transform={`translate(${midX}, ${midY - 22}) rotate(${aimAngleDeg})`}>
                          {/* Brass Cylindrical Barrel */}
                          <rect x="-16" y="-10" width="32" height="20" rx="5" fill="#92400E" stroke="#78350F" strokeWidth="1.5" />
                          <circle cx="16" cy="0" r="9" fill="#B45309" stroke="#78350F" strokeWidth="1.5" />

                          {/* Optical Collimator Lens & Aperture */}
                          <circle cx="16" cy="0" r="4.5" fill="#18181B" />
                          {isEmitting && (
                            <circle cx="16" cy="0" r="5" fill="#EF4444" className="animate-pulse" />
                          )}

                          <text x="0" y="3.5" textAnchor="middle" fontSize="7" fill="#FDE68A" fontWeight="black" fontFamily="monospace">650nm</text>
                        </g>
                      </g>
                    );
                  }

                  return null;
                })}

                {/* ---------------- 3. PHOTOREALISTIC VOLUMETRIC LASER RAY-CASTING ---------------- */}
                {components.filter(c => c.type === 'laser' && isComponentEmitting(c)).map(laserComp => {
                  const p1 = terminalCoords[`BB_${laserComp.lead1.row}_${laserComp.lead1.col}`];
                  const p2 = terminalCoords[`BB_${laserComp.lead2.row}_${laserComp.lead2.col}`];
                  if (!p1 || !p2) return null;

                  const laserMidX = (p1.x + p2.x) / 2;
                  const laserMidY = (p1.y + p2.y) / 2;

                  // Find LDR on board
                  const targetLdr = components.find(c => c.type === 'ldr');
                  const tLdrP1 = targetLdr ? terminalCoords[`BB_${targetLdr.lead1.row}_${targetLdr.lead1.col}`] : null;
                  const tLdrP2 = targetLdr ? terminalCoords[`BB_${targetLdr.lead2.row}_${targetLdr.lead2.col}`] : null;

                  const ldrCenterX = tLdrP1 && tLdrP2 ? (tLdrP1.x + tLdrP2.x) / 2 : tLdrP1 ? tLdrP1.x : laserMidX + 350;
                  const ldrCenterY = tLdrP1 && tLdrP2 ? (tLdrP1.y + tLdrP2.y) / 2 - 24 : tLdrP1 ? tLdrP1.y - 24 : laserMidY - 22;

                  const dx = ldrCenterX - laserMidX;
                  const dy = ldrCenterY - (laserMidY - 22);
                  const angleRad = Math.atan2(dy, dx);

                  const startX = laserMidX + 16 * Math.cos(angleRad);
                  const startY = (laserMidY - 22) + 16 * Math.sin(angleRad);

                  const endX = ldrCenterX - 10 * Math.cos(angleRad);
                  const endY = ldrCenterY - 10 * Math.sin(angleRad);

                  const blockX = (startX + endX) / 2;
                  const blockY = (startY + endY) / 2;

                  const targetEndX = isBeamBlocked ? blockX : endX;
                  const targetEndY = isBeamBlocked ? blockY : endY;

                  return (
                    <g key={`beam_${laserComp.id}`} className="pointer-events-none">
                      {/* Volumetric Radial Glow (Amplified in Dark Lab Mode) */}
                      <line 
                        x1={startX} y1={startY} 
                        x2={targetEndX} y2={targetEndY} 
                        stroke={isRoomLightOn ? "rgba(239, 68, 68, 0.45)" : "rgba(239, 68, 68, 0.85)"} 
                        strokeWidth={isRoomLightOn ? "9" : "16"} 
                        strokeLinecap="round" 
                      />

                      {/* Intense Coherent Laser Core */}
                      <line 
                        x1={startX} y1={startY} 
                        x2={targetEndX} y2={targetEndY} 
                        stroke="url(#laser-beam-volumetric)" 
                        strokeWidth="4" 
                        strokeLinecap="round" 
                      />

                      {/* Razor-sharp White Centerline */}
                      <line 
                        x1={startX} y1={startY} 
                        x2={targetEndX} y2={targetEndY} 
                        stroke="#FFFFFF" 
                        strokeWidth="1.2" 
                        strokeLinecap="round" 
                      />

                      {/* Emitter Lens Flare */}
                      <circle cx={startX} cy={startY} r="10" fill="#EF4444" opacity="0.85" className="animate-pulse" />
                      <circle cx={startX} cy={startY} r="3.5" fill="#FFFFFF" />

                      {/* Interactive 3D Physical Obstacle Barrier (when beam is blocked) */}
                      {isBeamBlocked && (
                        <g transform={`translate(${blockX}, ${blockY - 26})`} className="pointer-events-auto cursor-pointer" onClick={() => setIsBeamBlocked(false)}>
                          <title>Obstacle Barrier in Laser Path. Click to remove.</title>
                          {/* Drop shadow */}
                          <rect x="-24" y="-18" width="48" height="52" rx="8" fill="rgba(0,0,0,0.7)" transform="translate(0, 6)" />
                          {/* Barrier Body */}
                          <rect x="-24" y="-18" width="48" height="52" rx="8" fill="#1E293B" stroke="#F59E0B" strokeWidth="2" />
                          {/* Hazard caution bar */}
                          <rect x="-20" y="-14" width="40" height="8" rx="2" fill="#F59E0B" />
                          {/* Laser hit spark on barrier left face */}
                          <circle cx="-16" cy="26" r="6" fill="#EF4444" className="animate-ping" />
                          <circle cx="-16" cy="26" r="2.5" fill="#FFFFFF" />
                          {/* Hand icon */}
                          <text x="0" y="10" textAnchor="middle" fontSize="18">✋</text>
                          <text x="0" y="26" textAnchor="middle" fontSize="8" fill="#EF4444" fontWeight="black" fontFamily="monospace">BLOCKED</text>
                        </g>
                      )}
                    </g>
                  );
                })}

              </svg>

              {/* 1. ARDUINO UNO R3 BOARD */}
              <div 
                className="relative w-[280px] h-[390px] bg-[#005B60] rounded-2xl border-[3px] border-[#008184] shadow-[12px_18px_30px_rgba(0,0,0,0.8)] p-4 flex flex-col justify-between shrink-0 select-none z-10"
              >
                <div className="absolute inset-0 rounded-2xl border-b-4 border-r-4 border-[#00383B] pointer-events-none"></div>

                <div className="absolute -top-3.5 left-5 w-14 h-9 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 rounded-t-md border border-slate-400 shadow-md flex items-center justify-center">
                  <div className="w-8 h-4 bg-slate-800 rounded-xs border border-slate-600"></div>
                </div>

                <div className="absolute -bottom-4 left-5 w-12 h-10 bg-gradient-to-b from-slate-900 to-black rounded-b-md border border-slate-700 shadow-lg flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-500"></div>
                </div>

                <button 
                  onClick={handleReset}
                  className="absolute top-4 left-22 w-5 h-5 rounded-full bg-gradient-to-b from-red-500 to-red-700 border-2 border-red-300 shadow-md active:scale-90 transition-transform cursor-pointer"
                  title="Hardware Reset"
                />

                {/* Top Digital Pins */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[8px] font-mono text-cyan-200 font-bold px-1 select-none">
                    <span>AREF</span>
                    <span>GND</span>
                    <span className="text-yellow-300 font-extrabold underline">13</span>
                    <span>12</span>
                    <span className="text-blue-300 font-bold">11</span>
                    <span>10</span>
                    <span className="text-red-400 font-bold">9~</span>
                    <span className="text-amber-400 font-bold">8</span>
                  </div>
                  
                  <div className="h-7 bg-[#111] border-2 border-slate-800 rounded-md px-1.5 flex items-center justify-between shadow-inner">
                    {[
                      { id: 'ARD_AREF', label: 'AREF' },
                      { id: 'ARD_GND_TOP', label: 'GND' },
                      { id: 'ARD_13', label: '13', active: pinStates['13'] },
                      { id: 'ARD_12', label: '12', active: pinStates['12'] },
                      { id: 'ARD_11', label: '11', active: pinStates['11'] },
                      { id: 'ARD_10', label: '10', active: pinStates['10'] },
                      { id: 'ARD_9', label: '9', active: pinStates['9'] },
                      { id: 'ARD_8', label: '8', active: pinStates['8'] }
                    ].map((pin, i) => (
                      <div 
                        key={i} 
                        id={`term-${pin.id}`}
                        onClick={() => handleTerminalClick(pin.id, `Arduino Pin ${pin.label}`)}
                        className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                          activeWiringStart?.id === pin.id
                            ? 'ring-2 ring-white scale-125 bg-blue-500'
                            : pin.active 
                            ? 'bg-amber-400 shadow-[0_0_10px_#F59E0B] scale-110' 
                            : 'bg-black border border-slate-700 hover:border-cyan-400'
                        }`}
                        title={`Click to connect wire to Pin ${pin.label}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-xs bg-slate-900 pointer-events-none"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Middle Board */}
                <div className="my-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black tracking-wider text-white block">PIXIU UNO</span>
                      <span className="text-[8px] font-mono text-cyan-200">STANDALONE R3</span>
                    </div>

                    <div className="w-10 h-5 bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400 rounded-full border border-slate-400 shadow-md flex items-center justify-center font-mono text-[6px] font-bold text-slate-700">
                      16.000
                    </div>

                    <div className="flex flex-col gap-1 text-[8px] font-mono font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full transition-all ${
                          pinStates['13'] ? 'bg-amber-400 shadow-[0_0_10px_#F59E0B] scale-125' : 'bg-amber-950/60 border border-amber-900'
                        }`}></span>
                        <span className="text-cyan-100">L (Pin 13)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399] animate-pulse"></span>
                        <span className="text-cyan-100">ON (5V)</span>
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => setXrayModalComponent('arduino')}
                    className="w-full bg-[#161616] border-2 border-slate-700 rounded-lg p-2 flex flex-col justify-between shadow-[0_6px_12px_rgba(0,0,0,0.8)] cursor-pointer hover:border-cyan-400 transition-colors"
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="w-2 h-2 rounded-full border border-slate-600 bg-slate-900"></div>
                      <span className="font-mono text-[8px] font-bold tracking-widest text-slate-400">
                        ATMEGA328P-PU
                      </span>
                      <span className="text-[7px] font-mono text-slate-600">AVR 8-BIT</span>
                    </div>
                    <div className="flex justify-between px-2 pt-1 font-mono text-[7px] text-slate-500">
                      <span>||||||||||||||</span>
                      <span className="text-cyan-400 font-bold flex items-center gap-0.5">
                        <Eye size={9} /> 3D Die
                      </span>
                      <span>||||||||||||||</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Power Pins */}
                <div className="space-y-1">
                  <div className="h-7 bg-[#111] border-2 border-slate-800 rounded-md px-1.5 flex items-center justify-between shadow-inner">
                    {[
                      { id: 'ARD_3V3', label: '3.3V' },
                      { id: 'ARD_5V', label: '5V' },
                      { id: 'ARD_GND', label: 'GND' },
                      { id: 'ARD_GND2', label: 'GND' },
                      { id: 'ARD_VIN', label: 'VIN' },
                      { id: 'ARD_A0', label: 'A0' },
                      { id: 'ARD_A1', label: 'A1' },
                      { id: 'ARD_A2', label: 'A2' }
                    ].map((pin, i) => (
                      <div 
                        key={i} 
                        id={`term-${pin.id}`}
                        onClick={() => handleTerminalClick(pin.id, `Arduino ${pin.label}`)}
                        className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                          activeWiringStart?.id === pin.id
                            ? 'ring-2 ring-white scale-125 bg-emerald-500'
                            : 'bg-black border border-slate-700 hover:border-emerald-400'
                        }`}
                        title={`Click to connect wire to ${pin.label}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-xs bg-slate-800 pointer-events-none"></div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[8px] font-mono text-cyan-200 font-bold px-1 select-none">
                    <span className="text-emerald-300 font-extrabold underline">POWER (5V / GND)</span>
                    <span>ANALOG IN</span>
                  </div>
                </div>
              </div>

              {/* 2. 1:1 REAL 30-ROW BREADBOARD */}
              <div 
                className="relative w-full max-w-[680px] bg-[#F7F7F8] rounded-xl border-4 border-[#E2E4E8] p-4 shadow-[0_25px_50px_rgba(0,0,0,0.85)] flex flex-col justify-between select-none z-10"
              >
                {/* Dovetail Tabs */}
                <div className="absolute -left-2.5 top-12 w-2.5 h-6 bg-[#E5E7EB] rounded-l-xs border-y border-l border-slate-300"></div>
                <div className="absolute -left-2.5 bottom-12 w-2.5 h-6 bg-[#E5E7EB] rounded-l-xs border-y border-l border-slate-300"></div>
                <div className="absolute -right-2.5 top-12 w-2.5 h-6 bg-[#E5E7EB] rounded-r-xs border-y border-r border-slate-300"></div>
                <div className="absolute -right-2.5 bottom-12 w-2.5 h-6 bg-[#E5E7EB] rounded-r-xs border-y border-r border-slate-300"></div>

                {/* Top Power Rails */}
                <div className="space-y-1 pb-2 border-b border-slate-300">
                  <div className="flex items-center gap-1">
                    <span className="text-rose-600 font-black text-xs w-4 text-center select-none">+</span>
                    <div className="flex-1 flex justify-between items-center bg-rose-50/50 py-0.5 px-2 rounded-xs border-y border-rose-200">
                      {POWER_GROUPS.map(num => (
                        <div 
                          key={`tp_${num}`}
                          id={`term-PWR_TOP_POS_${num}`}
                          onClick={() => handleTerminalClick(`PWR_TOP_POS_${num}`, `Top (+) Rail [${num}]`)}
                          className={`w-2.5 h-2.5 rounded-xs border cursor-pointer transition-all ${
                            activeWiringStart?.id === `PWR_TOP_POS_${num}`
                              ? 'bg-rose-500 ring-2 ring-white scale-125'
                              : 'bg-slate-900/90 border-slate-600 hover:bg-rose-500'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-blue-600 font-black text-xs w-4 text-center select-none">-</span>
                    <div className="flex-1 flex justify-between items-center bg-blue-50/50 py-0.5 px-2 rounded-xs border-y border-blue-200">
                      {POWER_GROUPS.map(num => (
                        <div 
                          key={`tn_${num}`}
                          id={`term-PWR_TOP_NEG_${num}`}
                          onClick={() => handleTerminalClick(`PWR_TOP_NEG_${num}`, `Top (-) Rail [${num}]`)}
                          className={`w-2.5 h-2.5 rounded-xs border cursor-pointer transition-all ${
                            activeWiringStart?.id === `PWR_TOP_NEG_${num}`
                              ? 'bg-blue-500 ring-2 ring-white scale-125'
                              : 'bg-slate-900/90 border-slate-600 hover:bg-blue-500'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main 30-Row Grid */}
                <div className="py-2 space-y-1 relative">
                  
                  {/* Top Numbers */}
                  <div className="flex items-center pl-6 pr-2 justify-between text-[8px] font-mono font-bold text-slate-500 select-none pb-0.5">
                    {ROWS.map(r => (
                      <span key={`rt_${r}`} className={`w-3.5 text-center ${r % 5 === 0 ? 'text-slate-800 font-black' : 'text-slate-400'}`}>
                        {r % 5 === 0 || r === 1 ? r : '·'}
                      </span>
                    ))}
                  </div>

                  {/* Top Columns a-e */}
                  <div className="space-y-1">
                    {TOP_COLS.map(col => (
                      <div key={col} className="flex items-center gap-1">
                        <span className="text-[9px] font-mono font-bold text-slate-400 w-4 text-center uppercase">{col}</span>
                        <div className="flex-1 flex justify-between items-center px-1">
                          {ROWS.map(row => {
                            const holeId = `BB_${row}_${col}`;
                            const isWireStart = activeWiringStart?.id === holeId;
                            const hasWire = wires.some(w => w.fromId === holeId || w.toId === holeId);

                            return (
                              <div 
                                key={holeId}
                                id={`term-${holeId}`}
                                onClick={() => handleTerminalClick(holeId, `Row ${row} (${col})`, row, col)}
                                className={`relative w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                                  isWireStart
                                    ? 'bg-blue-500 ring-2 ring-white scale-125 z-20'
                                    : hasWire
                                    ? 'bg-blue-600 ring-1 ring-blue-300'
                                    : 'bg-[#1E293B]/90 border border-slate-500 hover:border-blue-400 hover:scale-110'
                                }`}
                                title={`Breadboard Row ${row} (${col})`}
                              >
                                <div className="w-1.5 h-1.5 rounded-xs bg-[#0F172A] shadow-inner pointer-events-none"></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Center Trench */}
                  <div className="h-3 bg-[#D9DCE2] my-1 rounded-xs border-y border-slate-400 shadow-inner flex items-center justify-center">
                    <div className="w-full h-0.5 bg-slate-400/60"></div>
                  </div>

                  {/* Bottom Columns f-j */}
                  <div className="space-y-1">
                    {BOT_COLS.map(col => (
                      <div key={col} className="flex items-center gap-1">
                        <span className="text-[9px] font-mono font-bold text-slate-400 w-4 text-center uppercase">{col}</span>
                        <div className="flex-1 flex justify-between items-center px-1">
                          {ROWS.map(row => {
                            const holeId = `BB_${row}_${col}`;
                            const isWireStart = activeWiringStart?.id === holeId;
                            const hasWire = wires.some(w => w.fromId === holeId || w.toId === holeId);

                            return (
                              <div 
                                key={holeId}
                                id={`term-${holeId}`}
                                onClick={() => handleTerminalClick(holeId, `Row ${row} (${col})`, row, col)}
                                className={`relative w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                                  isWireStart
                                    ? 'bg-blue-500 ring-2 ring-white scale-125 z-20'
                                    : hasWire
                                    ? 'bg-blue-600 ring-1 ring-blue-300'
                                    : 'bg-[#1E293B]/90 border border-slate-500 hover:border-blue-400 hover:scale-110'
                                }`}
                                title={`Breadboard Row ${row} (${col})`}
                              >
                                <div className="w-1.5 h-1.5 rounded-xs bg-[#0F172A] shadow-inner pointer-events-none"></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Numbers */}
                  <div className="flex items-center pl-6 pr-2 justify-between text-[8px] font-mono font-bold text-slate-500 select-none pt-0.5">
                    {ROWS.map(r => (
                      <span key={`rb_${r}`} className={`w-3.5 text-center ${r % 5 === 0 ? 'text-slate-800 font-black' : 'text-slate-400'}`}>
                        {r % 5 === 0 || r === 1 ? r : '·'}
                      </span>
                    ))}
                  </div>

                </div>

                {/* Bottom Power Rails */}
                <div className="space-y-1 pt-2 border-t border-slate-300">
                  <div className="flex items-center gap-1">
                    <span className="text-blue-600 font-black text-xs w-4 text-center select-none">-</span>
                    <div className="flex-1 flex justify-between items-center bg-blue-50/50 py-0.5 px-2 rounded-xs border-y border-blue-200">
                      {POWER_GROUPS.map(num => (
                        <div 
                          key={`bn_${num}`}
                          id={`term-PWR_BOT_NEG_${num}`}
                          onClick={() => handleTerminalClick(`PWR_BOT_NEG_${num}`, `Bottom (-) Rail [${num}]`)}
                          className={`w-2.5 h-2.5 rounded-xs border cursor-pointer transition-all ${
                            activeWiringStart?.id === `PWR_BOT_NEG_${num}`
                              ? 'bg-blue-500 ring-2 ring-white scale-125'
                              : 'bg-slate-900/90 border-slate-600 hover:bg-blue-500'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-rose-600 font-black text-xs w-4 text-center select-none">+</span>
                    <div className="flex-1 flex justify-between items-center bg-rose-50/50 py-0.5 px-2 rounded-xs border-y border-rose-200">
                      {POWER_GROUPS.map(num => (
                        <div 
                          key={`bp_${num}`}
                          id={`term-PWR_BOT_POS_${num}`}
                          onClick={() => handleTerminalClick(`PWR_BOT_POS_${num}`, `Bottom (+) Rail [${num}]`)}
                          className={`w-2.5 h-2.5 rounded-xs border cursor-pointer transition-all ${
                            activeWiringStart?.id === `PWR_BOT_POS_${num}`
                              ? 'bg-rose-500 ring-2 ring-white scale-125'
                              : 'bg-slate-900/90 border-slate-600 hover:bg-rose-500'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>

          {/* Connected Wires & Active Components Bar */}
          <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-4 text-xs font-mono overflow-x-auto z-20">
            <div className="flex items-center gap-1.5 shrink-0 text-slate-400 font-bold text-[10px] uppercase">
              <span>Wires ({wires.length}):</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {wires.map(w => (
                <div 
                  key={w.id} 
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px]"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: w.color }}></span>
                  <span className="text-slate-300">{w.fromLabel} ➔ {w.toLabel}</span>
                  <button 
                    onClick={() => removeWire(w.id)}
                    className="text-slate-500 hover:text-red-400 cursor-pointer ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ==================== RIGHT: VISUAL BLOCK CODING STUDIO ==================== */}
        <div className={`w-full lg:w-[460px] bg-[#090E1A] flex-col shrink-0 border-t lg:border-t-0 border-slate-800 z-20 ${
          mobileTab === 'blocks' ? 'flex flex-1' : 'hidden lg:flex'
        }`}>
          
          <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center justify-between text-xs">
            {/* Dual Tabs: Visual Blocks vs C++ sketch.ino */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setShowCppCode(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  !showCppCode
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Puzzle size={14} />
                <span>Visual Blocks</span>
              </button>

              <button
                onClick={() => setShowCppCode(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showCppCode
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Code size={14} />
                <span>Arduino C++ (sketch.ino)</span>
              </button>
            </div>

            {/* If in C++ mode: Copy & Reset tools */}
            {showCppCode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(editableCppCode);
                    setIsCopied(true);
                    showToast('Arduino sketch copied to clipboard!', 'Code Copied', 'success');
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                  title="Copy full Arduino C++ sketch"
                >
                  {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={() => {
                    setEditableCppCode(DEFAULT_TRIPWIRE_SKETCH);
                    showToast('Reset code to Laser Tripwire Security System template.', 'Template Restored', 'info');
                  }}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-700 transition-all cursor-pointer"
                  title="Reset to default Laser Tripwire sketch"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            )}
          </div>

          {!showCppCode ? (
            <div className="flex-1 p-4 flex flex-col space-y-3.5 overflow-y-auto">
              
              <div className="bg-[#EAB308]/20 border-2 border-[#EAB308] rounded-2xl p-3 shadow-md">
                <div className="flex items-center gap-2 font-bold text-xs text-yellow-300">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse"></div>
                  <span>🟢 WHEN SIMULATION STARTS</span>
                </div>
              </div>

              <div className="space-y-2.5 pl-3 border-l-2 border-yellow-500/40">
                {blocks.map((block, idx) => {
                  const isActive = activeBlockIndex === idx;

                  if (block.type === 'set_pin') {
                    return (
                      <div 
                        key={block.id}
                        className={`rounded-2xl p-2.5 sm:p-3 text-xs font-bold border-2 transition-all flex items-center justify-between gap-2 shadow-md ${
                          isActive 
                            ? 'bg-blue-600 border-cyan-300 text-white shadow-[0_0_20px_#38BDF8] scale-[1.02]' 
                            : 'bg-blue-600/90 hover:bg-blue-600 border-blue-400/80 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <Zap size={14} className={isActive ? 'text-yellow-300 animate-bounce' : 'text-white'} />
                          <span>Set Pin</span>
                          
                          <select 
                            value={block.pin}
                            onChange={(e) => updateBlock(block.id, 'pin', e.target.value)}
                            className="bg-blue-900 border border-blue-400 rounded-lg px-2 py-1 text-white font-bold cursor-pointer text-xs"
                          >
                            <option value="13">Pin 13 (Built-in LED)</option>
                            <option value="11">Pin 11 (LED Bulb)</option>
                            <option value="9">Pin 9 (KY-008 Laser)</option>
                            <option value="8">Pin 8 (Piezo Buzzer)</option>
                            <option value="12">Pin 12 (LED 2)</option>
                            <option value="10">Pin 10</option>
                          </select>

                          <span>to</span>

                          <select 
                            value={block.state}
                            onChange={(e) => updateBlock(block.id, 'state', e.target.value)}
                            className="bg-blue-900 border border-blue-400 rounded-lg px-2 py-1 text-white font-bold cursor-pointer text-xs"
                          >
                            <option value="HIGH">HIGH (💡 ON / BEEP)</option>
                            <option value="LOW">LOW (🌑 OFF / SILENT)</option>
                          </select>
                        </div>

                        <button 
                          onClick={() => deleteBlock(block.id)}
                          className="p-1 text-blue-200 hover:text-white rounded hover:bg-blue-800 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  }

                  if (block.type === 'wait') {
                    return (
                      <div 
                        key={block.id}
                        className={`rounded-2xl p-2.5 sm:p-3 text-xs font-bold border-2 transition-all flex items-center justify-between gap-2 shadow-md ${
                          isActive 
                            ? 'bg-amber-600 border-yellow-300 text-white shadow-[0_0_20px_#F59E0B] scale-[1.02]' 
                            : 'bg-amber-600/90 hover:bg-amber-600 border-amber-400/80 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock size={14} className={isActive ? 'text-white animate-spin' : 'text-white'} />
                          <span>Wait</span>

                          <input 
                            type="number"
                            min="0.1"
                            max="10"
                            step="0.5"
                            value={block.duration}
                            onChange={(e) => updateBlock(block.id, 'duration', parseFloat(e.target.value) || 1)}
                            className="w-14 sm:w-16 bg-amber-900 border border-amber-400 rounded-lg px-2 py-1 text-white text-center font-bold text-xs"
                          />

                          <span>Seconds</span>
                        </div>

                        <button 
                          onClick={() => deleteBlock(block.id)}
                          className="p-1 text-amber-200 hover:text-white rounded hover:bg-amber-800 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  }

                  if (block.type === 'tripwire_logic') {
                    return (
                      <div 
                        key={block.id}
                        className={`rounded-2xl p-3.5 text-xs font-bold border-2 transition-all shadow-xl space-y-2.5 ${
                          isBeamBlocked 
                            ? 'bg-gradient-to-br from-rose-950/95 to-slate-950 border-rose-500 shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-pulse' 
                            : 'bg-gradient-to-br from-indigo-950/90 to-purple-950/90 border-indigo-500/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-black text-xs text-yellow-300">
                            <Zap size={15} className={isBeamBlocked ? 'text-rose-400 animate-bounce' : 'text-yellow-400'} />
                            <span>⚡ IF Obstacle Cuts Laser Beam (LDR &lt; 400):</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            isBeamBlocked ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-500/20 text-indigo-300'
                          }`}>
                            {isBeamBlocked ? '🚨 BREACH ACTIVE' : '🛡️ MONITORING'}
                          </span>
                        </div>

                        <div className={`pl-3.5 border-l-2 space-y-1.5 py-1 text-xs transition-colors ${
                          isBeamBlocked ? 'border-rose-400 bg-rose-950/40 rounded-r-xl pr-2' : 'border-rose-500/50'
                        }`}>
                          <div className="flex items-center justify-between text-rose-200 font-bold">
                            <span>💡 Turn ON Red Light (Pin 11)</span>
                            <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-mono shadow-sm">HIGH (ON)</span>
                          </div>
                          <div className="flex items-center justify-between text-yellow-200 font-bold">
                            <span>🔊 Sound Piezo Buzzer (Pin 8)</span>
                            <span className="px-2 py-0.5 bg-amber-500 text-slate-950 rounded text-[10px] font-mono shadow-sm font-black">2400Hz BEEP</span>
                          </div>
                        </div>

                        <div className="font-black text-xs text-emerald-400 pt-1 flex items-center justify-between">
                          <span>🛡️ ELSE (Laser Beam Intact on LDR):</span>
                          <span className="text-[10px] text-slate-400 font-mono">Analog: 980</span>
                        </div>

                        <div className={`pl-3.5 border-l-2 space-y-1 py-1 text-xs transition-colors ${
                          !isBeamBlocked ? 'border-emerald-400 bg-emerald-950/20 rounded-r-xl pr-2' : 'border-emerald-500/40'
                        }`}>
                          <div className="text-slate-300 font-medium flex items-center justify-between">
                            <span>🌑 Turn OFF Red Light (Pin 11)</span>
                            <span className="text-[10px] text-slate-400 font-mono">LOW (OFF)</span>
                          </div>
                          <div className="text-slate-300 font-medium flex items-center justify-between">
                            <span>🔇 Silence Piezo Buzzer (Pin 8)</span>
                            <span className="text-[10px] text-slate-400 font-mono">LOW (SILENT)</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>

              {/* Loop Repeat Toggle */}
              <div className="p-2.5 sm:p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <RotateCcw size={13} className="text-cyan-400" />
                  <span className="font-bold text-slate-300">Repeat in Infinite Loop</span>
                </div>
                <input 
                  type="checkbox"
                  checked={repeatLoop}
                  onChange={(e) => setRepeatLoop(e.target.checked)}
                  className="w-4 h-4 accent-pixiu-blue cursor-pointer"
                />
              </div>

              {/* Add Blocks Toolbar */}
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => addBlock('set_pin')}
                  className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={13} /> + Pin Block
                </button>
                <button
                  onClick={() => addBlock('wait')}
                  className="flex-1 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={13} /> + Wait Block
                </button>
                <button
                  onClick={() => addBlock('tripwire_logic')}
                  className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Zap size={13} className="text-yellow-400" /> + Tripwire IF/ELSE Logic Block
                </button>
              </div>

              {/* Serial Output */}
              <div className="mt-auto pt-2 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">Serial Telemetry (16MHz):</span>
                <div className="h-24 sm:h-28 bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-[10px] text-emerald-400 overflow-y-auto space-y-0.5 shadow-inner">
                  {serialLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                  {serialLogs.length === 0 && (
                    <div className="text-slate-600 italic">Ready. Click 'Run Simulation'...</div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 p-3 sm:p-4 flex flex-col space-y-2.5 overflow-hidden">
              {/* Editor Sub-Header */}
              <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-mono text-[11px] font-bold text-white">sketch.ino (Editable)</span>
                  <span className="text-[10px] bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300 font-mono">C++</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">ATmega328P @ 16MHz</span>
                  <button
                    onClick={() => {
                      setIsFlashing(true);
                      showToast('Compiling sketch with avr-gcc...', 'Compiling...', 'info');
                      setTimeout(() => {
                        setIsFlashing(false);
                        showToast('✓ Binary sketch verified: 2,148 bytes (6% of flash memory). Flashed to ATmega328P!', 'Upload Complete', 'success');
                        setSerialLogs(prev => [...prev.slice(-30), `[AVR-GCC] Compilation successful: 2148 bytes ROM, 184 bytes RAM.`]);
                      }, 1000);
                    }}
                    disabled={isFlashing}
                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/50 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                    title="Simulate verifying & compiling sketch"
                  >
                    <Zap size={12} className={isFlashing ? 'animate-spin' : 'text-emerald-400'} />
                    <span>{isFlashing ? 'Compiling...' : '⚡ Verify & Flash'}</span>
                  </button>
                </div>
              </div>

              {/* IDE Code Editor */}
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner flex flex-col relative group">
                <textarea
                  value={editableCppCode}
                  onChange={(e) => setEditableCppCode(e.target.value)}
                  spellCheck={false}
                  className="flex-1 w-full p-4 bg-slate-950/90 font-mono text-[11px] sm:text-xs text-emerald-300 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 select-text overflow-auto"
                  placeholder="// Enter Arduino C++ sketch here..."
                />
              </div>

              {/* Serial Output Console */}
              <div className="pt-1 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                  <span>Serial Monitor (9600 Baud):</span>
                  <span className="text-emerald-400 lowercase">connected /dev/ttyACM0</span>
                </div>
                <div className="h-20 sm:h-24 bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-[10px] text-emerald-400 overflow-y-auto space-y-0.5 shadow-inner">
                  {serialLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                  {serialLogs.length === 0 && (
                    <div className="text-slate-600 italic">Serial monitor active. Press 'Run Simulation' or 'Place Obstacle'...</div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* ==================== MOBILE FLOATING ACTION BAR (< 1024px) ==================== */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 z-40 shadow-2xl">
        <button
          onClick={handleReset}
          className="p-2.5 bg-slate-800 text-slate-300 rounded-xl border border-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
        >
          <RotateCcw size={14} />
          <span className="text-[11px]">Reset</span>
        </button>

        <button
          onClick={handleToggleRun}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer ${
            isRunning 
              ? 'bg-rose-600 text-white shadow-rose-600/30 animate-pulse' 
              : 'bg-emerald-600 text-white shadow-emerald-600/30'
          }`}
        >
          {isRunning ? (
            <>
              <Square size={14} fill="currentColor" /> Stop Simulation
            </>
          ) : (
            <>
              <Play size={14} fill="currentColor" /> Run Simulation
            </>
          )}
        </button>
      </div>

      {/* ==================== 3D X-RAY ANATOMY MODAL ==================== */}
      {xrayModalComponent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-gradient-to-b from-[#0e1628] to-[#070b14] border-2 border-cyan-500/40 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 sm:p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                  <Eye size={16} />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    {xrayModalComponent === 'arduino' && 'ATmega328P Silicon Micro-Architecture (Die, RAM, ROM)'}
                  </h3>
                  <span className="text-[9px] sm:text-[10px] font-mono text-cyan-300 uppercase tracking-widest">
                    Interactive Deep-Dive Dissection
                  </span>
                </div>
              </div>

              <button
                onClick={() => setXrayModalComponent(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 sm:py-5 space-y-5 text-xs text-slate-300">
              <div className="space-y-4">
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-white text-xs">Inside the ATmega328P Silicon Die</span>
                    <span className="font-mono text-[10px] text-cyan-400 font-bold">16 MIPS @ 16 MHz</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                    <div className="p-2 bg-blue-950/60 border border-blue-500/40 rounded-xl">
                      <div className="text-[9px] text-blue-300 font-bold">FLASH ROM</div>
                      <div className="text-sm font-black text-white">32 KB</div>
                    </div>

                    <div className="p-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl">
                      <div className="text-[9px] text-emerald-300 font-bold">SRAM</div>
                      <div className="text-sm font-black text-white">2 KB</div>
                    </div>

                    <div className="p-2 bg-purple-950/60 border border-purple-500/40 rounded-xl">
                      <div className="text-[9px] text-purple-300 font-bold">EEPROM</div>
                      <div className="text-sm font-black text-white">1 KB</div>
                    </div>

                    <div className="p-2 bg-amber-950/60 border border-amber-500/40 rounded-xl">
                      <div className="text-[9px] text-amber-300 font-bold">RISC ALU</div>
                      <div className="text-sm font-black text-white">8-BIT</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-700/80 flex justify-end">
              <button
                onClick={() => setXrayModalComponent(null)}
                className="px-4 py-1.5 bg-pixiu-blue hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Dissection ➔
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
