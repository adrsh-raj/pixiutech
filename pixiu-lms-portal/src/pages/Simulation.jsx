import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Cpu, Play, Square, RotateCcw, ShieldAlert, Lock, ArrowLeft, 
  Sparkles, CheckCircle2, Eye, Zap, Plus, Trash2, Code, Puzzle, 
  X, Clock, Layers, Wrench, Volume2, VolumeX, Hand,
  Crosshair, BellRing
} from 'lucide-react';

export default function Simulation() {
  const _navigate = useNavigate();
  const workbenchRef = useRef(null);

  // Audio Context references for Piezo Buzzer & Overcurrent Blast
  const audioCtxRef = useRef(null);
  const buzzerOscRef = useRef(null);
  const [isSoundMuted, setIsSoundMuted] = useState(false);

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

  // ==================== HARDWARE COMPONENTS ====================
  // 1. Resistor
  const [resistor, setResistor] = useState({
    isPlaced: true,
    lead1: { row: 10, col: 'c' },
    lead2: { row: 15, col: 'c' }
  });

  // 2. 5mm Red LED Bulb
  const [led, setLed] = useState({
    isPlaced: true,
    anode: { row: 15, col: 'd' },
    cathode: { row: 16, col: 'd' }
  });

  // 3. KY-008 Red Laser Diode Module
  const [laser, setLaser] = useState({
    isPlaced: true,
    pos: { row: 6, col: 'b' }, // Row 6 top
    gnd: { row: 7, col: 'b' }
  });

  // 4. CdS Photodetector / LDR (Photoresistor)
  const [ldr, setLdr] = useState({
    isPlaced: true,
    lead1: { row: 6, col: 'i' }, // Row 6 bottom (Aligned with Laser!)
    lead2: { row: 7, col: 'i' }
  });

  // 5. Piezo Buzzer (Active Transducer)
  const [buzzer, setBuzzer] = useState({
    isPlaced: true,
    pos: { row: 22, col: 'c' },
    neg: { row: 22, col: 'd' }
  });

  // Laser Tripwire Obstacle State (Human Hand / Beam Break)
  const [isBeamBlocked, setIsBeamBlocked] = useState(false);

  // Active Placement Mode
  const [placementMode, setPlacementMode] = useState(null);
  const [tempPlacementData, setTempPlacementData] = useState(null);

  // ==================== OVERCURRENT BURNOUT & BLAST STATE ====================
  const [isLedBlown, setIsLedBlown] = useState(false);
  const [isBlasting, setIsBlasting] = useState(false);

  // Web Audio Pop Sound
  const playBlastSound = () => {
    if (isSoundMuted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(360, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio suppressed
    }
  };

  // Web Audio Piezo Buzzer Tone (2400Hz resonant frequency)
  const startBuzzerBeep = () => {
    if (isSoundMuted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      if (!buzzerOscRef.current) {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(2400, audioCtxRef.current.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtxRef.current.currentTime);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        buzzerOscRef.current = osc;
      }
    } catch {
      // Audio suppressed
    }
  };

  const stopBuzzerBeep = () => {
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

  // ==================== FREE PIN-TO-HOLE WIRING ENGINE ====================
  const [wires, setWires] = useState([
    // LED circuit wires
    { id: 'w1', fromId: 'ARD_11', toId: 'BB_10_a', fromLabel: 'Arduino Pin 11', toLabel: 'Breadboard Row 10 (a)', color: '#3B82F6' },
    { id: 'w2', fromId: 'BB_16_e', toId: 'ARD_GND', fromLabel: 'Breadboard Row 16 (e)', toLabel: 'Arduino GND', color: '#0F172A' },
    // Laser wires (Pin 9 -> Laser Row 6, GND -> Row 7)
    { id: 'w3', fromId: 'ARD_9', toId: 'BB_6_a', fromLabel: 'Arduino Pin 9', toLabel: 'Laser Row 6 (a)', color: '#EF4444' },
    { id: 'w4', fromId: 'BB_7_a', toId: 'ARD_GND', fromLabel: 'Laser GND Row 7 (a)', toLabel: 'Arduino GND', color: '#0F172A' },
    // Buzzer wires (Pin 8 -> Buzzer Row 22, GND -> Row 22)
    { id: 'w5', fromId: 'ARD_8', toId: 'BB_22_b', fromLabel: 'Arduino Pin 8', toLabel: 'Buzzer (+) Row 22 (b)', color: '#F59E0B' },
    { id: 'w6', fromId: 'BB_22_f', toId: 'ARD_GND', fromLabel: 'Buzzer (-) Row 22 (f)', toLabel: 'Arduino GND', color: '#0F172A' }
  ]);

  const [selectedWireColor, setSelectedWireColor] = useState('#3B82F6');
  const [activeWiringStart, setActiveWiringStart] = useState(null);

  const WIRE_COLORS = [
    { label: 'Blue', hex: '#3B82F6' },
    { label: 'Black (GND)', hex: '#0F172A' },
    { label: 'Red (5V/Laser)', hex: '#EF4444' },
    { label: 'Yellow (Buzzer)', hex: '#F59E0B' },
    { label: 'Green', hex: '#10B981' },
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
  }, [wires, resistor, led, laser, ldr, buzzer, mobileTab]);

  // Click any hole or pin
  const handleTerminalClick = (terminalId, terminalLabel, rowNum = null, colName = null) => {
    // 1. Resistor placement
    if (placementMode === 'placing_resistor_1') {
      if (!rowNum || !colName) {
        showToast('Click a breadboard hole for Resistor Lead 1.', 'Select Hole', 'info');
        return;
      }
      setTempPlacementData({ row: rowNum, col: colName });
      setPlacementMode('placing_resistor_2');
      showToast(`Lead 1 placed at Row ${rowNum} (${colName}). Now click hole for Lead 2.`, 'Lead 1 Set', 'info');
      return;
    }

    if (placementMode === 'placing_resistor_2') {
      if (!rowNum || !colName) {
        showToast('Click a breadboard hole for Lead 2.', 'Select Hole', 'info');
        return;
      }
      setResistor({
        isPlaced: true,
        lead1: tempPlacementData,
        lead2: { row: rowNum, col: colName }
      });
      setPlacementMode(null);
      setTempPlacementData(null);
      showToast(`220Ω Resistor placed across Row ${tempPlacementData.row} and Row ${rowNum}!`, 'Resistor Placed', 'success');
      return;
    }

    // 2. LED placement
    if (placementMode === 'placing_led_anode') {
      if (!rowNum || !colName) {
        showToast('Click a breadboard hole for LED Anode (+).', 'Select Hole', 'info');
        return;
      }
      setTempPlacementData({ row: rowNum, col: colName });
      setPlacementMode('placing_led_cathode');
      showToast(`Anode (+) set in Row ${rowNum}. Click hole for Cathode (-).`, 'Anode Set', 'info');
      return;
    }

    if (placementMode === 'placing_led_cathode') {
      if (!rowNum || !colName) {
        showToast('Click a breadboard hole for LED Cathode (-).', 'Select Hole', 'info');
        return;
      }
      setLed({
        isPlaced: true,
        anode: tempPlacementData,
        cathode: { row: rowNum, col: colName }
      });
      setIsLedBlown(false);
      setPlacementMode(null);
      setTempPlacementData(null);
      showToast(`LED plugged across Row ${tempPlacementData.row} and Row ${rowNum}!`, 'LED Placed', 'success');
      return;
    }

    // 3. Laser placement
    if (placementMode === 'placing_laser_pos') {
      if (!rowNum || !colName) {
        showToast('Click hole for Laser (+/Signal).', 'Select Hole', 'info');
        return;
      }
      setTempPlacementData({ row: rowNum, col: colName });
      setPlacementMode('placing_laser_gnd');
      showToast(`Laser (+) placed at Row ${rowNum}. Click hole for GND pin.`, 'Laser Signal Set', 'info');
      return;
    }

    if (placementMode === 'placing_laser_gnd') {
      if (!rowNum || !colName) return;
      setLaser({
        isPlaced: true,
        pos: tempPlacementData,
        gnd: { row: rowNum, col: colName }
      });
      setPlacementMode(null);
      setTempPlacementData(null);
      showToast(`Laser Module placed at Row ${tempPlacementData.row}!`, 'Laser Placed', 'success');
      return;
    }

    // 4. LDR placement
    if (placementMode === 'placing_ldr_1') {
      if (!rowNum || !colName) {
        showToast('Click hole for LDR Lead 1.', 'Select Hole', 'info');
        return;
      }
      setTempPlacementData({ row: rowNum, col: colName });
      setPlacementMode('placing_ldr_2');
      showToast(`LDR Lead 1 at Row ${rowNum}. Click hole for Lead 2 (Match row with Laser for alignment!).`, 'LDR Lead 1 Set', 'info');
      return;
    }

    if (placementMode === 'placing_ldr_2') {
      if (!rowNum || !colName) return;
      setLdr({
        isPlaced: true,
        lead1: tempPlacementData,
        lead2: { row: rowNum, col: colName }
      });
      setPlacementMode(null);
      setTempPlacementData(null);
      showToast(`Photodetector placed at Row ${tempPlacementData.row}!`, 'LDR Placed', 'success');
      return;
    }

    // 5. Buzzer placement
    if (placementMode === 'placing_buzzer_pos') {
      if (!rowNum || !colName) return;
      setTempPlacementData({ row: rowNum, col: colName });
      setPlacementMode('placing_buzzer_neg');
      showToast(`Buzzer (+) at Row ${rowNum}. Click hole for GND.`, 'Buzzer (+) Set', 'info');
      return;
    }

    if (placementMode === 'placing_buzzer_neg') {
      if (!rowNum || !colName) return;
      setBuzzer({
        isPlaced: true,
        pos: tempPlacementData,
        neg: { row: rowNum, col: colName }
      });
      setPlacementMode(null);
      setTempPlacementData(null);
      showToast(`Piezo Buzzer placed at Row ${tempPlacementData.row}!`, 'Buzzer Placed', 'success');
      return;
    }

    // Standard Wiring Mode
    if (!activeWiringStart) {
      setActiveWiringStart({ id: terminalId, label: terminalLabel });
      showToast(`Wiring from ${terminalLabel}. Click destination terminal.`, 'Wiring Active', 'info');
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

  const handleClearAllWires = () => {
    setWires([]);
    setActiveWiringStart(null);
    setIsRunning(false);
    stopBuzzerBeep();
    showToast('All wires cleared from workbench.', 'Wires Cleared', 'info');
  };

  // Presets
  const handleLoadLaserTripwirePreset = () => {
    setResistor({ isPlaced: true, lead1: { row: 10, col: 'c' }, lead2: { row: 15, col: 'c' } });
    setLed({ isPlaced: true, anode: { row: 15, col: 'd' }, cathode: { row: 16, col: 'd' } });
    setLaser({ isPlaced: true, pos: { row: 6, col: 'b' }, gnd: { row: 7, col: 'b' } });
    setLdr({ isPlaced: true, lead1: { row: 6, col: 'i' }, lead2: { row: 7, col: 'i' } });
    setBuzzer({ isPlaced: true, pos: { row: 22, col: 'c' }, neg: { row: 22, col: 'd' } });

    setWires([
      { id: 'w1', fromId: 'ARD_11', toId: 'BB_10_a', fromLabel: 'Arduino Pin 11', toLabel: 'Resistor Row 10', color: '#3B82F6' },
      { id: 'w2', fromId: 'BB_16_e', toId: 'ARD_GND', fromLabel: 'LED Cathode Row 16', toLabel: 'Arduino GND', color: '#0F172A' },
      { id: 'w3', fromId: 'ARD_9', toId: 'BB_6_a', fromLabel: 'Arduino Pin 9', toLabel: 'Laser (+) Row 6', color: '#EF4444' },
      { id: 'w4', fromId: 'BB_7_a', toId: 'ARD_GND', fromLabel: 'Laser (-) Row 7', toLabel: 'Arduino GND', color: '#0F172A' },
      { id: 'w5', fromId: 'ARD_8', toId: 'BB_22_b', fromLabel: 'Arduino Pin 8', toLabel: 'Buzzer (+) Row 22', color: '#F59E0B' },
      { id: 'w6', fromId: 'BB_22_f', toId: 'ARD_GND', fromLabel: 'Buzzer (-) Row 22', toLabel: 'Arduino GND', color: '#0F172A' }
    ]);

    setBlocks([
      { id: 'b1', type: 'set_pin', pin: '9', state: 'HIGH' },  // Laser ON
      { id: 'b2', type: 'set_pin', pin: '11', state: 'HIGH' }, // LED ON
      { id: 'b3', type: 'wait', duration: 1.0 },
      { id: 'b4', type: 'set_pin', pin: '8', state: 'HIGH' },  // Buzzer BEEP
      { id: 'b5', type: 'wait', duration: 0.5 },
      { id: 'b6', type: 'set_pin', pin: '8', state: 'LOW' },   // Buzzer OFF
      { id: 'b7', type: 'wait', duration: 1.0 }
    ]);

    setIsBeamBlocked(false);
    setIsLedBlown(false);
    showToast('Laser Security Tripwire System loaded (Laser + LDR + Buzzer + LED).', 'Preset Loaded', 'success');
  };

  // ==================== UNIVERSAL BREADBOARD GRAPH CIRCUIT SOLVER ====================
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

    // 1. LED Circuit Analysis
    let ledConnectedPin = null;
    let isLedOvercurrent = false;
    let isLedLoopClosed = false;

    if (led.isPlaced) {
      const ledAnodeNode = getElectricalNode(`BB_${led.anode.row}_${led.anode.col}`);
      const ledCathodeNode = getElectricalNode(`BB_${led.cathode.row}_${led.cathode.col}`);
      const cathodeToGnd = isConnected(ledCathodeNode, 'ARD_GND') || isConnected(ledCathodeNode, 'ARD_GND2') || isConnected(ledCathodeNode, 'ARD_GND_TOP');

      // Check Direct connection (No resistor)
      for (const p of powerPins) {
        if (isConnected(p, ledAnodeNode)) {
          ledConnectedPin = p.replace('ARD_', '');
          isLedOvercurrent = true;
          if (cathodeToGnd) isLedLoopClosed = true;
          break;
        }
      }

      // Check Protected connection via Resistor
      if (!ledConnectedPin && resistor.isPlaced) {
        const resNode1 = getElectricalNode(`BB_${resistor.lead1.row}_${resistor.lead1.col}`);
        const resNode2 = getElectricalNode(`BB_${resistor.lead2.row}_${resistor.lead2.col}`);

        let resPowerPin = null;
        let resOutNode = null;

        for (const p of powerPins) {
          if (isConnected(p, resNode1)) {
            resPowerPin = p.replace('ARD_', '');
            resOutNode = resNode2;
            break;
          } else if (isConnected(p, resNode2)) {
            resPowerPin = p.replace('ARD_', '');
            resOutNode = resNode1;
            break;
          }
        }

        if (resPowerPin && isConnected(resOutNode, ledAnodeNode) && cathodeToGnd) {
          ledConnectedPin = resPowerPin;
          isLedLoopClosed = true;
          isLedOvercurrent = false;
        }
      }
    }

    // 2. Laser Module Circuit Analysis
    let laserConnectedPin = null;
    let isLaserLoopClosed = false;
    if (laser.isPlaced) {
      const laserPosNode = getElectricalNode(`BB_${laser.pos.row}_${laser.pos.col}`);
      const laserGndNode = getElectricalNode(`BB_${laser.gnd.row}_${laser.gnd.col}`);
      const gndToArduino = isConnected(laserGndNode, 'ARD_GND') || isConnected(laserGndNode, 'ARD_GND2') || isConnected(laserGndNode, 'ARD_GND_TOP');

      for (const p of powerPins) {
        if (isConnected(p, laserPosNode)) {
          laserConnectedPin = p.replace('ARD_', '');
          if (gndToArduino) isLaserLoopClosed = true;
          break;
        }
      }
    }

    // 3. Buzzer Circuit Analysis
    let buzzerConnectedPin = null;
    let isBuzzerLoopClosed = false;
    if (buzzer.isPlaced) {
      const buzPosNode = getElectricalNode(`BB_${buzzer.pos.row}_${buzzer.pos.col}`);
      const buzNegNode = getElectricalNode(`BB_${buzzer.neg.row}_${buzzer.neg.col}`);
      const buzGndToArduino = isConnected(buzNegNode, 'ARD_GND') || isConnected(buzNegNode, 'ARD_GND2') || isConnected(buzNegNode, 'ARD_GND_TOP');

      for (const p of powerPins) {
        if (isConnected(p, buzPosNode)) {
          buzzerConnectedPin = p.replace('ARD_', '');
          if (buzGndToArduino) isBuzzerLoopClosed = true;
          break;
        }
      }
    }

    // 4. Optical Alignment Check (Grid Alignment: Same Row)
    const isLaserLdrAligned = laser.isPlaced && ldr.isPlaced && laser.pos.row === ldr.lead1.row;

    // Overall status message
    let message = 'Ready to simulate.';
    if (isLedOvercurrent && isLedLoopClosed) {
      message = `💥 OVERCURRENT HAZARD! Pin ${ledConnectedPin} (5V) directly on LED without 220Ω resistor (~125mA will blow LED)!`;
    } else if (isLedLoopClosed && isLaserLoopClosed && isBuzzerLoopClosed) {
      message = `✅ Multi-Circuit Ready: LED on Pin ${ledConnectedPin}, Laser on Pin ${laserConnectedPin}, Buzzer on Pin ${buzzerConnectedPin}.`;
    } else if (isLaserLoopClosed && isLaserLdrAligned) {
      message = `🎯 Laser Aligned with LDR (Row ${laser.pos.row})! Tripwire security active.`;
    } else if (isLaserLoopClosed && !isLaserLdrAligned) {
      message = `⚠️ Laser Unaligned: Laser at Row ${laser.pos.row}, LDR at Row ${ldr.lead1.row}. Put both in same row to align beam!`;
    } else if (isLedLoopClosed) {
      message = `✅ Closed Loop (Safe ~14mA): Pin ${ledConnectedPin} ➔ Resistor ➔ LED ➔ GND.`;
    }

    return {
      isComplete: isLedLoopClosed || isLaserLoopClosed || isBuzzerLoopClosed,
      ledPin: ledConnectedPin,
      isLedLoopClosed,
      isLedOvercurrent,
      laserPin: laserConnectedPin,
      isLaserLoopClosed,
      buzzerPin: buzzerConnectedPin,
      isBuzzerLoopClosed,
      isLaserLdrAligned,
      message
    };
  }, [resistor, led, laser, ldr, buzzer, wires]);

  const isCircuitClosed = circuitAnalysis.isComplete;

  // ==================== VISUAL BLOCK CODING STATE ====================
  const [blocks, setBlocks] = useState([
    { id: 'b1', type: 'set_pin', pin: '9', state: 'HIGH' },   // Laser ON
    { id: 'b2', type: 'set_pin', pin: '11', state: 'HIGH' },  // LED ON
    { id: 'b3', type: 'wait', duration: 1.0 },
    { id: 'b4', type: 'set_pin', pin: '8', state: 'HIGH' },   // Buzzer ON
    { id: 'b5', type: 'wait', duration: 0.5 },
    { id: 'b6', type: 'set_pin', pin: '8', state: 'LOW' },    // Buzzer OFF
    { id: 'b7', type: 'wait', duration: 1.0 }
  ]);
  const [repeatLoop, setRepeatLoop] = useState(true);
  const [activeBlockIndex, setActiveBlockIndex] = useState(-1);
  const [showCppCode, setShowCppCode] = useState(false);

  const addBlock = (type) => {
    if (type === 'set_pin') {
      setBlocks(prev => [...prev, { id: 'b_' + Date.now(), type: 'set_pin', pin: '11', state: 'HIGH' }]);
    } else {
      setBlocks(prev => [...prev, { id: 'b_' + Date.now(), type: 'wait', duration: 1.0 }]);
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

  // Computed Component States
  const isLaserActive = isRunning && circuitAnalysis.isLaserLoopClosed && Boolean(pinStates[circuitAnalysis.laserPin]);
  const isBuzzerActive = isRunning && (
    (circuitAnalysis.isBuzzerLoopClosed && Boolean(pinStates[circuitAnalysis.buzzerPin])) ||
    (isLaserActive && isBeamBlocked && circuitAnalysis.isBuzzerLoopClosed) // Tripwire alarm trigger!
  );

  const isLedPinHigh = circuitAnalysis.ledPin ? Boolean(pinStates[circuitAnalysis.ledPin]) : false;
  const isLedGlowing = isRunning && circuitAnalysis.isLedLoopClosed && isLedPinHigh && !isLedBlown && !circuitAnalysis.isLedOvercurrent;

  // Sound Engine Synchronization
  useEffect(() => {
    if (isBuzzerActive) {
      startBuzzerBeep();
    } else {
      stopBuzzerBeep();
    }
    return () => {
      stopBuzzerBeep();
    };
  }, [isBuzzerActive, isSoundMuted]);

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

          // 1. LED check
          if (circuitAnalysis.ledPin === targetPin && isHigh && circuitAnalysis.isLedLoopClosed) {
            if (circuitAnalysis.isLedOvercurrent) {
              if (!isLedBlown) {
                setIsBlasting(true);
                setIsLedBlown(true);
                playBlastSound();
                setTimeout(() => setIsBlasting(false), 900);
                setSerialLogs(prev => [
                  ...prev.slice(-30),
                  `[💥 BURNOUT BLAST!] Pin ${targetPin} HIGH ➔ 125mA surged without 220Ω resistor! LED DIE EXPLODED!`
                ]);
                showToast('💥 BURNOUT! LED blown due to 125mA overcurrent! Add 220Ω resistor.', 'LED Burnout Blast!', 'error');
              }
            } else {
              setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${targetPin} HIGH ➔ 💡 LED Bulb Glows!`]);
            }
          } 
          // 2. Laser check
          else if (circuitAnalysis.laserPin === targetPin && isHigh && circuitAnalysis.isLaserLoopClosed) {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${targetPin} HIGH ➔ 🔴 Red Laser Beam Active (650nm)!`]);
          } 
          // 3. Buzzer check
          else if (circuitAnalysis.buzzerPin === targetPin && isHigh && circuitAnalysis.isBuzzerLoopClosed) {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${targetPin} HIGH ➔ 🔊 Piezo Buzzer Sounding BEEP!`]);
          } else {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${targetPin} set to ${block.state}`]);
          }

          currentStep++;
          timeoutId = setTimeout(executeNextBlock, 300);
        } 
        else if (block.type === 'wait') {
          const ms = Math.max(200, block.duration * 1000);
          setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Wait ${block.duration}s...`]);
          currentStep++;
          timeoutId = setTimeout(executeNextBlock, ms);
        }
      };

      executeNextBlock();
    } else {
      setActiveBlockIndex(-1);
      setPinStates(prev => ({ ...prev, '13': false, '12': false, '11': false, '10': false, '9': false, '8': false }));
      stopBuzzerBeep();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (timerId) clearInterval(timerId);
    };
  }, [isRunning, blocks, repeatLoop, isCircuitClosed, circuitAnalysis, isLedBlown]);

  const handleToggleRun = () => {
    if (!isRunning) {
      setIsRunning(true);
      showToast('Simulation running! Executing block sequence.', 'Running', 'success');
    } else {
      setIsRunning(false);
      setActiveBlockIndex(-1);
      setPinStates(prev => ({ ...prev, '13': false, '12': false, '11': false, '10': false, '9': false, '8': false }));
      stopBuzzerBeep();
      showToast('Simulation stopped.', 'Stopped', 'info');
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setActiveBlockIndex(-1);
    setRunTimeSec(0);
    setPinStates(prev => ({ ...prev, '13': false, '12': false, '11': false, '10': false, '9': false, '8': false }));
    stopBuzzerBeep();
    setSerialLogs([`[System] Reset to idle.`]);
    showToast('Simulation counters reset.', 'Reset Complete', 'info');
  };

  // 3D X-Ray Anatomy Modal State
  const [xrayModalComponent, setXrayModalComponent] = useState(null);

  // Generated C++ Sketch
  const generatedCppCode = useMemo(() => {
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
  Serial.begin(9600);
}

void loop() {
${loopCode}}`;
  }, [blocks]);

  // Coordinates for Components
  const resLead1Coord = resistor.isPlaced ? terminalCoords[`BB_${resistor.lead1.row}_${resistor.lead1.col}`] : null;
  const resLead2Coord = resistor.isPlaced ? terminalCoords[`BB_${resistor.lead2.row}_${resistor.lead2.col}`] : null;

  const ledAnodeCoord = led.isPlaced ? terminalCoords[`BB_${led.anode.row}_${led.anode.col}`] : null;
  const ledCathodeCoord = led.isPlaced ? terminalCoords[`BB_${led.cathode.row}_${led.cathode.col}`] : null;

  const laserPosCoord = laser.isPlaced ? terminalCoords[`BB_${laser.pos.row}_${laser.pos.col}`] : null;
  const _laserGndCoord = laser.isPlaced ? terminalCoords[`BB_${laser.gnd.row}_${laser.gnd.col}`] : null;

  const ldrLead1Coord = ldr.isPlaced ? terminalCoords[`BB_${ldr.lead1.row}_${ldr.lead1.col}`] : null;
  const _ldrLead2Coord = ldr.isPlaced ? terminalCoords[`BB_${ldr.lead2.row}_${ldr.lead2.col}`] : null;

  const buzzerPosCoord = buzzer.isPlaced ? terminalCoords[`BB_${buzzer.pos.row}_${buzzer.pos.col}`] : null;
  const _buzzerNegCoord = buzzer.isPlaced ? terminalCoords[`BB_${buzzer.neg.row}_${buzzer.neg.col}`] : null;

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
    <div className="min-h-screen bg-[#060913] text-white flex flex-col font-sans select-none relative pb-16 lg:pb-0">
      
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
              Pixiu Cyber-Lab • Advanced Robotics
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate max-w-[160px] sm:max-w-none">
              Laser Tripwire & Piezo Buzzer Studio
            </p>
          </div>
        </div>

        {/* Master Action Controls */}
        <div className="flex items-center gap-2">
          {/* Sound Mute / Unmute Toggle */}
          <button
            onClick={() => {
              setIsSoundMuted(!isSoundMuted);
              if (!isSoundMuted) stopBuzzerBeep();
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
            <span className="hidden md:inline text-[11px]">{isSoundMuted ? 'Muted' : 'Sound On'}</span>
          </button>

          {/* Preset Switcher */}
          <button
            onClick={handleLoadLaserTripwirePreset}
            className="px-2.5 sm:px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 rounded-xl border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Load Laser Security Tripwire System (Laser + LDR + Buzzer)"
          >
            <Crosshair size={13} className="text-cyan-400" />
            <span className="hidden md:inline">Laser Preset</span>
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
        <div className={`flex-1 flex-col bg-[#070C18] relative overflow-y-auto ${
          mobileTab === 'workbench' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          {/* Sub-Toolbar: Status & Wire Spool */}
          <div className="p-2.5 sm:p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs z-20">
            
            {/* Status Pill */}
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border shrink-0 ${
                circuitAnalysis.isLedOvercurrent
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse'
                  : isCircuitClosed 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
              }`}>
                <span className={`w-2 h-2 rounded-full ${circuitAnalysis.isLedOvercurrent ? 'bg-rose-500' : isCircuitClosed ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {circuitAnalysis.isLedOvercurrent ? 'Overcurrent Hazard' : isCircuitClosed ? 'Circuit Active' : 'Circuit Open'}
              </span>
              <p className="text-[11px] text-slate-300 truncate max-w-xs sm:max-w-md hidden sm:block" title={circuitAnalysis.message}>
                {circuitAnalysis.message}
              </p>
            </div>

            {/* Wire Spool & Wave Hand Button */}
            <div className="flex items-center gap-2">
              {/* Wave Hand / Break Laser Beam Button */}
              {laser.isPlaced && ldr.isPlaced && (
                <button
                  onClick={() => {
                    setIsBeamBlocked(!isBeamBlocked);
                    showToast(!isBeamBlocked ? 'Hand placed in front of Laser: BEAM BROKEN!' : 'Hand removed: Beam restored.', 'Laser Tripwire', 'info');
                  }}
                  className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isBeamBlocked 
                      ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-500/30 animate-pulse' 
                      : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                  }`}
                  title="Simulate object/hand blocking the laser beam to test security alarm"
                >
                  <Hand size={13} />
                  <span>{isBeamBlocked ? 'Beam Broken!' : 'Wave Hand (Block)'}</span>
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

          {/* ================= COMPACT FLOATING PARTS DOCK ================= */}
          <div className="px-4 sm:px-6 pt-3 pb-1 z-20">
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-cyan-400" />
                <span className="text-xs font-extrabold text-white">Parts Tray:</span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {/* 1. 220Ω Resistor */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <div className="w-5 h-2.5 bg-[#C99C67] rounded-full border border-[#966F3D]"></div>
                  <span className="text-[11px] font-bold text-white">220Ω</span>
                  <button
                    onClick={() => {
                      if (resistor.isPlaced) {
                        setResistor({ isPlaced: false, lead1: null, lead2: null });
                      } else {
                        setPlacementMode('placing_resistor_1');
                        showToast('Click hole for Resistor Lead 1.', 'Place Resistor', 'info');
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      resistor.isPlaced ? 'bg-slate-800 text-slate-300' : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {resistor.isPlaced ? 'Pull' : 'Plug ➔'}
                  </button>
                  <button onClick={() => setXrayModalComponent('resistor')} className="text-slate-400 hover:text-amber-400 cursor-pointer">
                    <Eye size={12} />
                  </button>
                </div>

                {/* 2. 5mm Red LED */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <div className={`w-3 h-4 rounded-t-full rounded-b-xs border ${
                    isLedBlown ? 'bg-stone-800 border-stone-700' : isLedGlowing ? 'bg-red-500 shadow-[0_0_8px_#EF4444]' : 'bg-red-900 border-red-800'
                  }`}></div>
                  <span className="text-[11px] font-bold text-white">LED</span>
                  <button
                    onClick={() => {
                      if (led.isPlaced) {
                        setLed({ isPlaced: false, anode: null, cathode: null });
                      } else {
                        setPlacementMode('placing_led_anode');
                        showToast('Click hole for LED Anode (+).', 'Place LED', 'info');
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      led.isPlaced ? 'bg-slate-800 text-slate-300' : 'bg-red-600 text-white'
                    }`}
                  >
                    {led.isPlaced ? 'Pull' : 'Plug ➔'}
                  </button>

                  {isLedBlown && (
                    <button
                      onClick={() => {
                        setIsLedBlown(false);
                        setIsBlasting(false);
                        showToast('Burnt LED replaced with fresh 5mm Red LED!', 'Bulb Replaced', 'success');
                      }}
                      className="px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black uppercase flex items-center gap-1 shadow-md animate-pulse cursor-pointer"
                      title="Replace Blown Bulb"
                    >
                      <Sparkles size={10} /> Replace
                    </button>
                  )}
                  <button onClick={() => setXrayModalComponent('bulb')} className="text-slate-400 hover:text-red-400 cursor-pointer">
                    <Eye size={12} />
                  </button>
                </div>

                {/* 3. KY-008 Laser Diode */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <div className={`w-4 h-3 bg-amber-700 rounded-sm border border-amber-500 ${isLaserActive ? 'shadow-[0_0_8px_#EF4444]' : ''}`}></div>
                  <span className="text-[11px] font-bold text-white">KY-008 Laser</span>
                  <button
                    onClick={() => {
                      if (laser.isPlaced) {
                        setLaser({ isPlaced: false, pos: null, gnd: null });
                      } else {
                        setPlacementMode('placing_laser_pos');
                        showToast('Click hole for Laser (+).', 'Place Laser', 'info');
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      laser.isPlaced ? 'bg-slate-800 text-slate-300' : 'bg-red-600 text-white'
                    }`}
                  >
                    {laser.isPlaced ? 'Pull' : 'Plug ➔'}
                  </button>
                  <button onClick={() => setXrayModalComponent('laser')} className="text-slate-400 hover:text-red-400 cursor-pointer">
                    <Eye size={12} />
                  </button>
                </div>

                {/* 4. Photodetector (LDR) */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#D4D4D8] border border-amber-600 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-amber-700 rounded-full"></div>
                  </div>
                  <span className="text-[11px] font-bold text-white">LDR Sensor</span>
                  <button
                    onClick={() => {
                      if (ldr.isPlaced) {
                        setLdr({ isPlaced: false, lead1: null, lead2: null });
                      } else {
                        setPlacementMode('placing_ldr_1');
                        showToast('Click hole for LDR Lead 1 (Match Laser row!).', 'Place LDR', 'info');
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      ldr.isPlaced ? 'bg-slate-800 text-slate-300' : 'bg-cyan-600 text-white'
                    }`}
                  >
                    {ldr.isPlaced ? 'Pull' : 'Plug ➔'}
                  </button>
                  <button onClick={() => setXrayModalComponent('ldr')} className="text-slate-400 hover:text-cyan-400 cursor-pointer">
                    <Eye size={12} />
                  </button>
                </div>

                {/* 5. Piezo Buzzer */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <div className={`w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center ${
                    isBuzzerActive ? 'ring-2 ring-yellow-400 animate-pulse' : ''
                  }`}>
                    <div className="w-1 h-1 bg-black rounded-full"></div>
                  </div>
                  <span className="text-[11px] font-bold text-white">Piezo Buzzer</span>
                  <button
                    onClick={() => {
                      if (buzzer.isPlaced) {
                        setBuzzer({ isPlaced: false, pos: null, neg: null });
                      } else {
                        setPlacementMode('placing_buzzer_pos');
                        showToast('Click hole for Buzzer (+).', 'Place Buzzer', 'info');
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      buzzer.isPlaced ? 'bg-slate-800 text-slate-300' : 'bg-yellow-500 text-slate-950'
                    }`}
                  >
                    {buzzer.isPlaced ? 'Pull' : 'Plug ➔'}
                  </button>
                  <button onClick={() => setXrayModalComponent('buzzer')} className="text-slate-400 hover:text-yellow-400 cursor-pointer">
                    <Eye size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ================= WORKBENCH CANVAS ================= */}
          <div className="flex-1 p-3 sm:p-6 overflow-x-auto">
            <div 
              ref={workbenchRef}
              className="relative min-w-[980px] min-h-[640px] flex items-center justify-around gap-8 p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] rounded-3xl border border-slate-800/80 bg-slate-950/40"
            >
              
              {/* SVG OVERLAY: REAL 3D WIRES, COMPONENTS, AND OPTICAL LASER BEAM */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible">
                <defs>
                  {/* Resistor ceramic body gradient */}
                  <linearGradient id="resistor-ceramic-clean" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#E2B788" />
                    <stop offset="35%" stopColor="#C99C67" />
                    <stop offset="70%" stopColor="#AF804D" />
                    <stop offset="100%" stopColor="#825C30" />
                  </linearGradient>
                  {/* LED Off gradient */}
                  <linearGradient id="led-off-clean" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#991B1B" stopOpacity="0.8" />
                    <stop offset="70%" stopColor="#7F1D1D" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#450A0A" />
                  </linearGradient>
                  {/* LED Glowing gradient */}
                  <linearGradient id="led-glow-clean" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FCA5A5" />
                    <stop offset="30%" stopColor="#EF4444" />
                    <stop offset="100%" stopColor="#DC2626" />
                  </linearGradient>
                  {/* Radial Bloom */}
                  <radialGradient id="led-bloom-clean" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                    <stop offset="25%" stopColor="#F87171" stopOpacity="0.9" />
                    <stop offset="60%" stopColor="#EF4444" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                  </radialGradient>
                  {/* Blown/Burnt LED Charred Gradient */}
                  <linearGradient id="led-blown-clean" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3F3F46" />
                    <stop offset="50%" stopColor="#27272A" />
                    <stop offset="100%" stopColor="#18181B" />
                  </linearGradient>
                  {/* Laser Beam Glow */}
                  <linearGradient id="laser-beam-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FF4D4D" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#EF4444" stopOpacity="1" />
                    <stop offset="100%" stopColor="#FF1E1E" stopOpacity="0.9" />
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
                      <title>Click to remove wire ({wire.fromLabel} ➔ {wire.toLabel})</title>

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

                {/* ---------------- 2. 3D 220Ω RESISTOR BODY ---------------- */}
                {resistor.isPlaced && resLead1Coord && resLead2Coord && (
                  <g className="pointer-events-auto cursor-pointer group" onClick={() => setXrayModalComponent('resistor')}>
                    <title>220Ω Resistor Body. Click for 3D Dissection.</title>

                    <line 
                      x1={resLead1Coord.x} y1={resLead1Coord.y} 
                      x2={resLead2Coord.x} y2={resLead2Coord.y} 
                      stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" 
                    />

                    {(() => {
                      const mx = (resLead1Coord.x + resLead2Coord.x) / 2;
                      const my = (resLead1Coord.y + resLead2Coord.y) / 2;
                      const deg = Math.atan2(resLead2Coord.y - resLead1Coord.y, resLead2Coord.x - resLead1Coord.x) * (180 / Math.PI);

                      return (
                        <g transform={`translate(${mx}, ${my}) rotate(${deg})`}>
                          <rect x="-24" y="-7" width="48" height="18" rx="8" fill="rgba(0,0,0,0.4)" transform="translate(0, 5)" />
                          <rect x="-24" y="-8" width="48" height="16" rx="6" fill="url(#resistor-ceramic-clean)" stroke="#966F3D" strokeWidth="1" />
                          <circle cx="-20" cy="0" r="7.5" fill="#C99C67" />
                          <circle cx="20" cy="0" r="7.5" fill="#C99C67" />

                          <rect x="-14" y="-8" width="4" height="16" fill="#DC2626" />
                          <rect x="-6" y="-8" width="4" height="16" fill="#DC2626" />
                          <rect x="2" y="-8" width="4" height="16" fill="#78350F" />
                          <rect x="12" y="-8" width="3.5" height="16" fill="#F59E0B" stroke="#D4AF37" strokeWidth="0.5" />
                          <rect x="-22" y="-6" width="44" height="2" fill="white" opacity="0.45" rx="1" />
                        </g>
                      );
                    })()}
                  </g>
                )}

                {/* ---------------- 3. 3D 5mm RED LED BULB ---------------- */}
                {led.isPlaced && ledAnodeCoord && ledCathodeCoord && (
                  <g className="pointer-events-auto cursor-pointer group" onClick={() => setXrayModalComponent('bulb')}>
                    <title>5mm Red LED Bulb. Click for 3D Dissection.</title>

                    {(() => {
                      const lx = (ledAnodeCoord.x + ledCathodeCoord.x) / 2;
                      const ly = (ledAnodeCoord.y + ledCathodeCoord.y) / 2;

                      return (
                        <>
                          <path d={`M ${ledAnodeCoord.x} ${ledAnodeCoord.y} L ${lx - 4} ${ly - 10}`} stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
                          <path d={`M ${ledCathodeCoord.x} ${ledCathodeCoord.y} L ${lx + 4} ${ly - 10}`} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />

                          {isLedBlown && (
                            <ellipse cx={lx} cy={ly - 2} rx="18" ry="7" fill="rgba(0,0,0,0.65)" />
                          )}

                          <g transform={`translate(${lx}, ${ly - 32})`}>
                            {/* Healthy Photon Bloom */}
                            {isLedGlowing && (
                              <>
                                <circle cx="0" cy="0" r="50" fill="url(#led-bloom-clean)" opacity="0.85" className="animate-pulse" />
                                <ellipse cx="0" cy="36" rx="35" ry="12" fill="rgba(239, 68, 68, 0.45)" />
                              </>
                            )}

                            {/* BLAST SHOCKWAVE ANIMATION */}
                            {isBlasting && (
                              <g className="animate-ping pointer-events-none">
                                <circle cx="0" cy="0" r="55" fill="rgba(239, 68, 68, 0.9)" />
                                <circle cx="0" cy="0" r="35" fill="#F59E0B" />
                                <circle cx="0" cy="0" r="18" fill="#FFFFFF" />
                              </g>
                            )}

                            {/* Smoke Particles */}
                            {(isBlasting || isLedBlown) && (
                              <g className="pointer-events-none">
                                <circle cx="-12" cy="-22" r="11" fill="rgba(100, 116, 139, 0.7)" className="animate-pulse" />
                                <circle cx="12" cy="-30" r="14" fill="rgba(71, 85, 105, 0.8)" className="animate-bounce" />
                                <circle cx="0" cy="-42" r="16" fill="rgba(39, 39, 42, 0.9)" />
                                <text x="0" y="-48" textAnchor="middle" fontSize="13" fill="#F87171" fontWeight="900">💥 BURNOUT!</text>
                              </g>
                            )}

                            {/* Base Rim Flange */}
                            <ellipse 
                              cx="0" cy="14" rx="12" ry="4" 
                              fill={isLedBlown ? "#1C1917" : isLedGlowing ? "#EF4444" : "#7F1D1D"} 
                              stroke={isLedBlown ? "#44403C" : isLedGlowing ? "#FCA5A5" : "#991B1B"} 
                              strokeWidth="1.2" 
                            />

                            {/* Epoxy Dome Body */}
                            <path 
                              d="M -11 14 L -11 0 C -11 -16, 11 -16, 11 0 L 11 14 Z" 
                              fill={isLedBlown ? "url(#led-blown-clean)" : isLedGlowing ? "url(#led-glow-clean)" : "url(#led-off-clean)"} 
                              stroke={isLedBlown ? "#57534E" : isLedGlowing ? "#FECACA" : "#991B1B"} 
                              strokeWidth="1.5" 
                            />

                            {/* Internal Leadframe & Die */}
                            <path d="M -6 6 L -2 -3 L -6 -3 Z" fill={isLedBlown ? "#52525B" : "#E2E8F0"} />
                            <circle 
                              cx="-4" cy="-3" 
                              r={isLedGlowing ? "3.5" : "1.5"} 
                              fill={isLedBlown ? "#000000" : isLedGlowing ? "#FFFFFF" : "#450A0A"} 
                              className={isLedGlowing ? "animate-ping" : ""} 
                            />

                            {!isLedBlown ? (
                              <>
                                <line x1="4" y1="6" x2="4" y2="-1" stroke="#CBD5E1" strokeWidth="1.5" />
                                <path d="M 4 -1 Q 0 -5 -3 -3" fill="none" stroke="#FDE047" strokeWidth="0.8" />
                                <path 
                                  d="M -8 -8 C -8 -13, -3 -15, 0 -15" 
                                  fill="none" 
                                  stroke="white" 
                                  strokeWidth="2" 
                                  strokeLinecap="round" 
                                  opacity="0.75" 
                                />
                              </>
                            ) : (
                              <>
                                <line x1="4" y1="6" x2="4" y2="1" stroke="#52525B" strokeWidth="1.5" />
                                <circle cx="-2" cy="-4" r="5" fill="#000000" opacity="0.9" />
                                <path d="M -7 4 L -2 -5 L 3 -2 L 7 -10" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
                                <path d="M 1 -3 L 6 7" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
                              </>
                            )}
                          </g>
                        </>
                      );
                    })()}
                  </g>
                )}

                {/* ---------------- 4. 3D KY-008 LASER MODULE ---------------- */}
                {laser.isPlaced && laserPosCoord && (
                  <g className="pointer-events-auto cursor-pointer group" onClick={() => setXrayModalComponent('laser')}>
                    <title>KY-008 Red Laser Diode. Click for 3D Dissection.</title>
                    {(() => {
                      const lx = laserPosCoord.x;
                      const ly = laserPosCoord.y;

                      return (
                        <g transform={`translate(${lx}, ${ly - 16})`}>
                          {/* Cylindrical Brass Housing */}
                          <rect x="-14" y="-8" width="28" height="16" rx="4" fill="#B45309" stroke="#78350F" strokeWidth="1" />
                          <circle cx="14" cy="0" r="7" fill="#D97706" stroke="#92400E" strokeWidth="1" />
                          {/* Laser Aperture */}
                          <circle cx="14" cy="0" r="3" fill="#18181B" />
                          {isLaserActive && (
                            <circle cx="14" cy="0" r="3.5" fill="#EF4444" className="animate-pulse" />
                          )}
                          <text x="0" y="3" textAnchor="middle" fontSize="6" fill="#FDE68A" fontWeight="bold" fontFamily="monospace">LASER</text>
                        </g>
                      );
                    })()}
                  </g>
                )}

                {/* ---------------- 5. 3D CdS PHOTODETECTOR (LDR) ---------------- */}
                {ldr.isPlaced && ldrLead1Coord && (
                  <g className="pointer-events-auto cursor-pointer group" onClick={() => setXrayModalComponent('ldr')}>
                    <title>CdS Photodetector (LDR). Click for 3D Dissection.</title>
                    {(() => {
                      const dx = ldrLead1Coord.x;
                      const dy = ldrLead1Coord.y;

                      return (
                        <g transform={`translate(${dx}, ${dy - 16})`}>
                          <circle cx="0" cy="0" r="11" fill="#E4E4E7" stroke="#71717A" strokeWidth="1.5" />
                          {/* Serpentine CdS track */}
                          <path 
                            d="M -6 -5 Q -2 -7 2 -5 T 6 -1 Q 2 3 -2 1 T -6 5" 
                            fill="none" 
                            stroke="#D97706" 
                            strokeWidth="1.8" 
                            strokeLinecap="round" 
                          />
                          {/* Target focal spot if laser hits */}
                          {isLaserActive && circuitAnalysis.isLaserLdrAligned && !isBeamBlocked && (
                            <circle cx="0" cy="0" r="4.5" fill="#EF4444" className="animate-ping" />
                          )}
                        </g>
                      );
                    })()}
                  </g>
                )}

                {/* ---------------- 6. ACTIVE LASER BEAM RAY-CASTING ---------------- */}
                {laser.isPlaced && ldr.isPlaced && laserPosCoord && ldrLead1Coord && isLaserActive && (
                  <g className="pointer-events-none">
                    {(() => {
                      const startX = laserPosCoord.x + 14;
                      const startY = laserPosCoord.y - 16;
                      
                      // End point: If aligned, hits LDR! If unaligned, shoots across the board!
                      const endX = circuitAnalysis.isLaserLdrAligned ? ldrLead1Coord.x : startX + 450;
                      const endY = circuitAnalysis.isLaserLdrAligned ? ldrLead1Coord.y - 16 : startY;

                      const midX = (startX + endX) / 2;

                      // If beam blocked by hand, stop beam at obstacle!
                      const targetEndX = isBeamBlocked ? midX : endX;

                      return (
                        <>
                          {/* Diffused outer red glow halo */}
                          <line 
                            x1={startX} y1={startY} 
                            x2={targetEndX} y2={endY} 
                            stroke="rgba(239, 68, 68, 0.4)" 
                            strokeWidth="8" 
                            strokeLinecap="round" 
                          />
                          {/* Intense red laser beam core */}
                          <line 
                            x1={startX} y1={startY} 
                            x2={targetEndX} y2={endY} 
                            stroke="url(#laser-beam-grad)" 
                            strokeWidth="3.5" 
                            strokeLinecap="round" 
                          />
                          {/* White hot beam center */}
                          <line 
                            x1={startX} y1={startY} 
                            x2={targetEndX} y2={endY} 
                            stroke="#FFFFFF" 
                            strokeWidth="1.2" 
                            strokeLinecap="round" 
                          />

                          {/* Optical Emitter Lens Flare */}
                          <circle cx={startX} cy={startY} r="8" fill="#EF4444" opacity="0.8" className="animate-pulse" />
                          <circle cx={startX} cy={startY} r="3" fill="#FFFFFF" />

                          {/* Target Focal Spot on LDR when unblocked */}
                          {circuitAnalysis.isLaserLdrAligned && !isBeamBlocked && (
                            <>
                              <circle cx={endX} cy={endY} r="12" fill="rgba(239, 68, 68, 0.5)" className="animate-ping" />
                              <circle cx={endX} cy={endY} r="4" fill="#FFFFFF" />
                            </>
                          )}

                          {/* Hand Obstacle Barrier Icon */}
                          {isBeamBlocked && (
                            <g transform={`translate(${midX}, ${endY - 20})`} className="pointer-events-auto cursor-pointer" onClick={() => setIsBeamBlocked(false)}>
                              <rect x="-18" y="-12" width="36" height="24" rx="6" fill="#DC2626" stroke="#FECACA" strokeWidth="1" />
                              <text x="0" y="4" textAnchor="middle" fontSize="12" fill="white">✋</text>
                            </g>
                          )}
                        </>
                      );
                    })()}
                  </g>
                )}

                {/* ---------------- 7. 3D PIEZO BUZZER TRANSDUCER ---------------- */}
                {buzzer.isPlaced && buzzerPosCoord && (
                  <g className="pointer-events-auto cursor-pointer group" onClick={() => setXrayModalComponent('buzzer')}>
                    <title>Piezoelectric Buzzer Transducer. Click for 3D Dissection.</title>
                    {(() => {
                      const bx = buzzerPosCoord.x;
                      const by = buzzerPosCoord.y;

                      return (
                        <g transform={`translate(${bx}, ${by - 18})`}>
                          {/* Animated Acoustic Sound Waves when beeping */}
                          {isBuzzerActive && (
                            <>
                              <circle cx="0" cy="0" r="35" fill="none" stroke="#FBBF24" strokeWidth="2" opacity="0.8" className="animate-ping" />
                              <circle cx="0" cy="0" r="50" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6" className="animate-ping" />
                            </>
                          )}

                          {/* Cylindrical Buzzer Body */}
                          <circle cx="0" cy="0" r="16" fill="#0F172A" stroke="#475569" strokeWidth="2" />
                          <circle cx="0" cy="0" r="6" fill="#020617" />
                          <text x="9" y="-6" fontSize="9" fill="#F8FAFC" fontWeight="bold">+</text>
                        </g>
                      );
                    })()}
                  </g>
                )}

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

          {/* Connected Wires List Bar */}
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
          
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Puzzle size={16} className="text-pixiu-blue" />
              <span className="font-extrabold text-white text-sm">Visual Block Studio</span>
            </div>

            <button
              onClick={() => setShowCppCode(!showCppCode)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
            >
              <Code size={13} />
              <span>{showCppCode ? 'Blocks' : 'C++ Code'}</span>
            </button>
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
                            <option value="12">Pin 12</option>
                            <option value="10">Pin 10</option>
                          </select>

                          <span>to</span>

                          <select 
                            value={block.state}
                            onChange={(e) => updateBlock(block.id, 'state', e.target.value)}
                            className="bg-blue-900 border border-blue-400 rounded-lg px-2 py-1 text-white font-bold cursor-pointer text-xs"
                          >
                            <option value="HIGH">HIGH (💡 ON)</option>
                            <option value="LOW">LOW (🌑 OFF)</option>
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
              <div className="pt-1 flex items-center gap-2">
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
            <div className="flex-1 p-4 flex flex-col space-y-3 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px] font-bold text-emerald-400">Auto-Generated sketch.ino</span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono">16MHz AVR GCC</span>
              </div>
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-3 font-mono text-xs text-slate-200 overflow-auto shadow-inner leading-relaxed">
                <pre>{generatedCppCode}</pre>
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
                    {xrayModalComponent === 'bulb' && '3D LED Bulb Anatomy & Quantum Electroluminescence'}
                    {xrayModalComponent === 'resistor' && "3D 220Ω Resistor Spiral Core & Ohm's Law Physics"}
                    {xrayModalComponent === 'laser' && 'KY-008 Laser Diode Stimulated Emission Cavity (650nm)'}
                    {xrayModalComponent === 'ldr' && 'CdS Photodetector Photo-Conductivity & Bandgap Physics'}
                    {xrayModalComponent === 'buzzer' && 'Piezoelectric Ceramic Crystal Acoustic Resonance (2.4kHz)'}
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
              {/* LASER MODAL */}
              {xrayModalComponent === 'laser' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-5">
                    <div className="w-48 h-36 bg-gradient-to-r from-amber-950 to-red-950 border border-red-500/40 rounded-xl p-3 flex flex-col justify-between items-center shadow-inner">
                      <span className="text-[9px] font-mono text-amber-300 font-bold">STIMULATED EMISSION CAVITY</span>
                      <div className="w-full h-1 bg-red-500 shadow-[0_0_12px_#EF4444] animate-pulse my-auto"></div>
                      <span className="text-[8px] font-mono text-red-400">Coherent Photons λ = 650nm</span>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <div className="font-bold text-white text-xs">How the KY-008 Laser Works:</div>
                      <ul className="space-y-1 text-slate-300 text-[11px]">
                        <li><strong className="text-red-400">1. Optical Resonator:</strong> High-reflectivity mirrors amplify photons.</li>
                        <li><strong className="text-amber-400">2. Population Inversion:</strong> Electrons pumped to excited state by 5V.</li>
                        <li><strong className="text-cyan-400">3. Collimating Lens:</strong> Focuses beam into a razor-sharp parallel ray.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* LDR MODAL */}
              {xrayModalComponent === 'ldr' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-5">
                    <div className="w-44 h-32 bg-slate-900 border border-amber-500/40 rounded-xl p-3 flex flex-col justify-between items-center">
                      <span className="text-[9px] font-mono text-amber-400 font-bold">Cadmium Sulfide (CdS)</span>
                      <div className="text-center">
                        <div className="text-lg font-black text-white">100 Ω ➔ 1 MΩ</div>
                        <span className="text-[8px] text-slate-400 font-mono">Resistance drops when laser hits</span>
                      </div>
                      <span className="text-[8px] text-emerald-400 font-mono">Photon-generated charge carriers</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-white text-xs">Photoelectric Conduction:</div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        In the dark, few free electrons exist, so resistance is high (~1,000,000Ω). When the laser beam hits the CdS track, photons knock electrons into the conduction band, slashing resistance to ~100Ω!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* BUZZER MODAL */}
              {xrayModalComponent === 'buzzer' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-5">
                    <div className="w-44 h-32 bg-slate-900 border border-yellow-500/40 rounded-xl p-3 flex flex-col justify-between items-center">
                      <span className="text-[9px] font-mono text-yellow-400 font-bold">PIEZO CERAMIC DISC</span>
                      <div className="flex items-center gap-1">
                        <BellRing size={20} className="text-yellow-400 animate-bounce" />
                        <span className="text-lg font-black text-white">2.400 kHz</span>
                      </div>
                      <span className="text-[8px] text-slate-400 font-mono">Inverse Piezoelectric Effect</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-white text-xs">Acoustic Sound Wave Physics:</div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        When voltage is applied to the piezoelectric crystal (PZT disc), it expands and contracts mechanically 2,400 times per second, vibrating the metal diaphragm to create an audible, high-pitch square-wave BEEP!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* RESISTOR */}
              {xrayModalComponent === 'resistor' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-5">
                    <div className="w-44 h-24 bg-[#966F3D]/20 border border-amber-600/40 rounded-xl p-3 flex flex-col items-center justify-center">
                      <div className="font-mono text-[9px] text-amber-400 font-bold mb-1">SPIRAL CARBON FILM</div>
                      <div className="font-mono text-base font-black text-white tracking-widest">220 Ω</div>
                      <span className="text-[8px] text-slate-400 font-mono">Drops 3V to protect 20mA LED</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-white text-xs">Ohm's Law Calculation:</div>
                      <div className="font-mono text-[11px] bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-amber-300">
                        R = (5.0V - 2.0V) / 0.014A = 214Ω ➔ Standard 220Ω
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BULB */}
              {xrayModalComponent === 'bulb' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-5">
                    <div className="w-48 h-36 bg-gradient-to-b from-red-950 to-slate-900 border border-red-500/40 rounded-xl p-3 flex flex-col justify-between items-center shadow-inner">
                      <span className="text-[9px] font-mono text-red-400 font-bold">P-N JUNCTION SEMICONDUCTOR</span>
                      <span className="text-amber-300 font-black text-xs animate-bounce">⚡ hν Photon</span>
                      <span className="text-[8px] font-mono text-slate-400">Electroluminescence @ 20mA max</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-white text-xs">5 Anatomical Parts of an LED:</div>
                      <ul className="space-y-1 text-slate-300 text-[11px]">
                        <li><strong className="text-red-400">1. Epoxy Dome:</strong> Optical lens focusing light.</li>
                        <li><strong className="text-amber-400">2. Anvil (Cathode -):</strong> Holds semiconductor die.</li>
                        <li><strong className="text-blue-400">3. Post (Anode +):</strong> Connects positive lead.</li>
                        <li><strong className="text-yellow-400">4. Whisker Wire:</strong> Passes current into die.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* ARDUINO */}
              {xrayModalComponent === 'arduino' && (
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
              )}
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
