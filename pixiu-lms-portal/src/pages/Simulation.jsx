import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Cpu, Play, Square, RotateCcw, ShieldAlert, Lock, ArrowLeft, 
  Sparkles, CheckCircle2, Eye, Zap, Plus, Trash2, Code, Puzzle, 
  X, Radio, Clock, Layers, Wrench
} from 'lucide-react';

export default function Simulation() {
  const _navigate = useNavigate();
  const workbenchRef = useRef(null);

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

  // ==================== PLACED COMPONENTS (FREE PLACEMENT ANYWHERE) ====================
  const [resistor, setResistor] = useState({
    isPlaced: true,
    lead1: { row: 10, col: 'c' },
    lead2: { row: 15, col: 'c' }
  });

  const [led, setLed] = useState({
    isPlaced: true,
    anode: { row: 15, col: 'd' },   // Connected to row 15 (shared with resistor!)
    cathode: { row: 16, col: 'd' }  // Connected to row 16
  });

  // Active Placement Interaction Mode
  const [placementMode, setPlacementMode] = useState(null);
  const [tempPlacementData, setTempPlacementData] = useState(null);

  // ==================== FREE PIN-TO-HOLE WIRING ENGINE ====================
  const [wires, setWires] = useState([
    { id: 'w1', fromId: 'ARD_13', toId: 'BB_10_a', fromLabel: 'Arduino Pin 13', toLabel: 'Breadboard Row 10 (a)', color: '#3B82F6' },
    { id: 'w2', fromId: 'BB_16_e', toId: 'ARD_GND', fromLabel: 'Breadboard Row 16 (e)', toLabel: 'Arduino GND', color: '#0F172A' }
  ]);

  const [selectedWireColor, setSelectedWireColor] = useState('#3B82F6');
  const [activeWiringStart, setActiveWiringStart] = useState(null);

  const WIRE_COLORS = [
    { label: 'Blue', hex: '#3B82F6' },
    { label: 'Black (GND)', hex: '#0F172A' },
    { label: 'Red (5V)', hex: '#EF4444' },
    { label: 'Yellow', hex: '#F59E0B' },
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
  }, [wires, resistor, led, mobileTab]);

  // Click any hole or pin
  const handleTerminalClick = (terminalId, terminalLabel, rowNum = null, colName = null) => {
    if (placementMode === 'placing_resistor_1') {
      if (!rowNum || !colName) {
        showToast('Click a breadboard socket hole to plug Resistor Lead 1.', 'Select Hole', 'info');
        return;
      }
      setTempPlacementData({ row: rowNum, col: colName });
      setPlacementMode('placing_resistor_2');
      showToast(`Lead 1 set in Row ${rowNum} (${colName}). Now click hole for Lead 2.`, 'Lead 1 Set', 'info');
      return;
    }

    if (placementMode === 'placing_resistor_2') {
      if (!rowNum || !colName) {
        showToast('Click a breadboard socket hole for Lead 2.', 'Select Hole', 'info');
        return;
      }
      setResistor({
        isPlaced: true,
        lead1: tempPlacementData,
        lead2: { row: rowNum, col: colName }
      });
      setPlacementMode(null);
      setTempPlacementData(null);
      showToast(`220Ω Resistor plugged across Row ${tempPlacementData.row} and Row ${rowNum}!`, 'Resistor Placed', 'success');
      return;
    }

    if (placementMode === 'placing_led_anode') {
      if (!rowNum || !colName) {
        showToast('Click a breadboard hole for LED Anode (+ long leg).', 'Select Hole', 'info');
        return;
      }
      setTempPlacementData({ row: rowNum, col: colName });
      setPlacementMode('placing_led_cathode');
      showToast(`Anode (+) set in Row ${rowNum} (${colName}). Now click hole for Cathode (- short leg).`, 'Anode Placed', 'info');
      return;
    }

    if (placementMode === 'placing_led_cathode') {
      if (!rowNum || !colName) {
        showToast('Click a breadboard hole for LED Cathode (- short leg).', 'Select Hole', 'info');
        return;
      }
      setLed({
        isPlaced: true,
        anode: tempPlacementData,
        cathode: { row: rowNum, col: colName }
      });
      setPlacementMode(null);
      setTempPlacementData(null);
      showToast(`Red LED Bulb plugged: Anode in Row ${tempPlacementData.row}, Cathode in Row ${rowNum}!`, 'LED Placed', 'success');
      return;
    }

    // Wiring Mode
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
    showToast('All wires cleared from workbench.', 'Wires Cleared', 'info');
  };

  const handleAutoWirePreset = () => {
    setResistor({
      isPlaced: true,
      lead1: { row: 10, col: 'c' },
      lead2: { row: 15, col: 'c' }
    });
    setLed({
      isPlaced: true,
      anode: { row: 15, col: 'd' },
      cathode: { row: 16, col: 'd' }
    });
    setWires([
      { id: 'w1', fromId: 'ARD_13', toId: 'BB_10_a', fromLabel: 'Arduino Pin 13', toLabel: 'Breadboard Row 10 (a)', color: '#3B82F6' },
      { id: 'w2', fromId: 'BB_16_e', toId: 'ARD_GND', fromLabel: 'Breadboard Row 16 (e)', toLabel: 'Arduino GND', color: '#0F172A' }
    ]);
    setPlacementMode(null);
    showToast('Standard 220Ω LED Blink circuit auto-configured.', 'Auto-Setup Complete', 'success');
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

  const circuitAnalysis = useMemo(() => {
    if (!resistor.isPlaced && !led.isPlaced) {
      return { isComplete: false, sourcePin: null, message: '⚠️ Both Resistor & LED are in tray. Click "Place" to insert them.', reason: 'no_components' };
    }
    if (!resistor.isPlaced) {
      return { isComplete: false, sourcePin: null, message: '⚠️ 220Ω Resistor missing! Click "Place Resistor" to insert into breadboard.', reason: 'no_resistor' };
    }
    if (!led.isPlaced) {
      return { isComplete: false, sourcePin: null, message: '⚠️ LED Bulb missing! Click "Place LED" to insert into breadboard.', reason: 'no_led' };
    }

    const resNode1 = getElectricalNode(`BB_${resistor.lead1.row}_${resistor.lead1.col}`);
    const resNode2 = getElectricalNode(`BB_${resistor.lead2.row}_${resistor.lead2.col}`);

    const ledAnodeNode = getElectricalNode(`BB_${led.anode.row}_${led.anode.col}`);
    const ledCathodeNode = getElectricalNode(`BB_${led.cathode.row}_${led.cathode.col}`);

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

    // Dynamic Power Source Pins (Pin 0 to 13, 5V, 3.3V)
    const possiblePowerPins = [
      'ARD_13', 'ARD_12', 'ARD_11', 'ARD_10', 'ARD_9', 'ARD_8',
      'ARD_7', 'ARD_6', 'ARD_5', 'ARD_4', 'ARD_3', 'ARD_2', 'ARD_1', 'ARD_0',
      'ARD_5V', 'ARD_3V3'
    ];

    let activeSourcePin = null;
    let resPowerNode = null;
    let resOutputNode = null;

    for (const p of possiblePowerPins) {
      if (isConnected(p, resNode1)) {
        activeSourcePin = p.replace('ARD_', '');
        resPowerNode = resNode1;
        resOutputNode = resNode2;
        break;
      } else if (isConnected(p, resNode2)) {
        activeSourcePin = p.replace('ARD_', '');
        resPowerNode = resNode2;
        resOutputNode = resNode1;
        break;
      }
    }

    if (!activeSourcePin) {
      // Check if user connected directly to LED without resistor!
      for (const p of possiblePowerPins) {
        if (isConnected(p, ledAnodeNode)) {
          return { 
            isComplete: false, 
            sourcePin: p.replace('ARD_', ''), 
            message: `⚠️ Overcurrent Warning! Pin ${p.replace('ARD_', '')} connected directly to LED without 220Ω resistor!`, 
            reason: 'no_resistor_protection' 
          };
        }
      }
      return { isComplete: false, sourcePin: null, message: '⚠️ Missing Power Wire: Connect an Arduino Pin (e.g. Pin 11 or 13) to the Resistor row.', reason: 'no_power_wire' };
    }

    const resToAnode = isConnected(resOutputNode, ledAnodeNode);
    if (!resToAnode) {
      return { isComplete: false, sourcePin: activeSourcePin, message: `⚠️ Resistor does not reach LED! Connect Row ${resistor.lead2.row} to Row ${led.anode.row}.`, reason: 'res_not_to_led' };
    }

    const cathodeToGnd = isConnected(ledCathodeNode, 'ARD_GND') || isConnected(ledCathodeNode, 'ARD_GND2') || isConnected(ledCathodeNode, 'ARD_GND_TOP');
    if (!cathodeToGnd) {
      return { isComplete: false, sourcePin: activeSourcePin, message: `⚠️ Missing Ground Wire: Connect LED Cathode (Row ${led.cathode.row}) to Arduino GND.`, reason: 'no_gnd_wire' };
    }

    return {
      isComplete: true,
      sourcePin: activeSourcePin,
      message: `✅ Closed Loop: Current flows from Pin ${activeSourcePin} ➔ Resistor ➔ LED ➔ GND.`,
      reason: 'ok'
    };
  }, [resistor, led, wires]);

  const isCircuitClosed = circuitAnalysis.isComplete;

  // ==================== VISUAL BLOCK CODING STATE ====================
  const [blocks, setBlocks] = useState([
    { id: 'b1', type: 'set_pin', pin: '11', state: 'HIGH' },
    { id: 'b2', type: 'wait', duration: 1.0 },
    { id: 'b3', type: 'set_pin', pin: '11', state: 'LOW' },
    { id: 'b4', type: 'wait', duration: 1.0 }
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

  // ==================== DYNAMIC PIN OUTPUT STATES ====================
  const [pinStates, setPinStates] = useState({
    '13': false,
    '12': false,
    '11': false,
    '10': false,
    '9': false,
    '8': false,
    '5V': true,
    '3V3': true
  });

  // ==================== SIMULATION RUNNER ====================
  const [isRunning, setIsRunning] = useState(false);
  const [_runTimeSec, setRunTimeSec] = useState(0);
  const [serialLogs, setSerialLogs] = useState([]);

  // Computed: LED only glows if the connected pin is HIGH and circuit loop is closed!
  const activeConnectedPin = circuitAnalysis.sourcePin;
  const isConnectedPinHigh = activeConnectedPin ? Boolean(pinStates[activeConnectedPin]) : false;
  const isLedGlowing = isRunning && isCircuitClosed && isConnectedPinHigh;

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

          if (isHigh && isCircuitClosed && circuitAnalysis.sourcePin === targetPin) {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${targetPin} HIGH ➔ 💡 LED Bulb Glows!`]);
          } else if (isHigh && !isCircuitClosed) {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${targetPin} HIGH, but circuit OPEN (no current)`]);
          } else if (isHigh && isCircuitClosed && circuitAnalysis.sourcePin !== targetPin) {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${targetPin} HIGH (Circuit is wired to Pin ${circuitAnalysis.sourcePin})`]);
          } else {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${targetPin} LOW ➔ 🌑 LED Off`]);
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
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (timerId) clearInterval(timerId);
    };
  }, [isRunning, blocks, repeatLoop, isCircuitClosed, circuitAnalysis.sourcePin]);

  const handleToggleRun = () => {
    if (!isRunning) {
      if (!isCircuitClosed) {
        showToast(circuitAnalysis.message, 'Circuit Incomplete', 'info');
      }
      setIsRunning(true);
      showToast('Simulation running! Executing block sequence.', 'Running', 'success');
    } else {
      setIsRunning(false);
      setActiveBlockIndex(-1);
      setPinStates(prev => ({ ...prev, '13': false, '12': false, '11': false, '10': false, '9': false, '8': false }));
      showToast('Simulation stopped.', 'Stopped', 'info');
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setActiveBlockIndex(-1);
    setRunTimeSec(0);
    setPinStates(prev => ({ ...prev, '13': false, '12': false, '11': false, '10': false, '9': false, '8': false }));
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
const int targetPin = 13;

void setup() {
  pinMode(targetPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Pixiu Cyber-Lab 3D System Ready");
}

void loop() {
${loopCode}}`;
  }, [blocks]);

  // ==================== 403 AUTHORIZATION GUARD ====================
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#070B14] text-white flex flex-col justify-between font-sans selection:bg-pixiu-blue selection:text-white">
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
            className="px-4 py-2 bg-pixiu-blue hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            Sign In to Access ➔
          </Link>
        </header>

        <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-2xl shadow-amber-500/10 animate-pulse">
            <Lock size={38} />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert size={14} /> Institutional Laboratory Security Guard
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Authorized Portal Session Required
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              The <strong>Pixiu Cyber-Lab 3D Virtual Arduino Simulation Workbench</strong> is an enterprise hardware laboratory reserved exclusively for enrolled students, partner schools, certified faculty, and administrators.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/login?redirect=/simulation"
              className="w-full sm:w-auto px-6 py-3 bg-pixiu-blue hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Sign In with Portal Credentials ➔
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowLeft size={14} /> Back to Homepage
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const getBackRoute = () => {
    if (activeRole === 'student') return '/student-portal';
    if (activeRole === 'school') return '/school-portal';
    if (activeRole === 'trainer') return '/trainers';
    return '/';
  };

  const getBackLabel = () => {
    if (activeRole === 'student') return 'Student Space';
    if (activeRole === 'school') return 'School ERP';
    if (activeRole === 'trainer') return 'Trainer Console';
    return 'Admin Console';
  };

  // Coordinates for Resistor & LED
  const resLead1Coord = resistor.isPlaced ? terminalCoords[`BB_${resistor.lead1.row}_${resistor.lead1.col}`] : null;
  const resLead2Coord = resistor.isPlaced ? terminalCoords[`BB_${resistor.lead2.row}_${resistor.lead2.col}`] : null;

  const ledAnodeCoord = led.isPlaced ? terminalCoords[`BB_${led.anode.row}_${led.anode.col}`] : null;
  const ledCathodeCoord = led.isPlaced ? terminalCoords[`BB_${led.cathode.row}_${led.cathode.col}`] : null;

  return (
    <div className="min-h-screen bg-[#060913] text-white flex flex-col font-sans selection:bg-pixiu-blue selection:text-white relative pb-16 lg:pb-0">
      
      {/* Toast Alert */}
      {toastAlert && (
        <div className={`fixed bottom-20 lg:bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
          toastAlert.type === 'success' 
            ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200' 
            : 'bg-slate-900/95 border-blue-500/50 text-slate-200'
        }`}>
          <CheckCircle2 size={16} className={toastAlert.type === 'success' ? 'text-emerald-400' : 'text-blue-400'} />
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
            to={getBackRoute()}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors flex items-center gap-1 text-xs font-bold mr-1 cursor-pointer"
            title={`Return to ${getBackLabel()}`}
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">{getBackLabel()}</span>
          </Link>

          <div className="bg-white px-2 py-0.5 rounded-lg shadow-sm border border-white/20 shrink-0">
            <img src="/img/logo.png" alt="Pixiu Tech" className="h-5 sm:h-6 w-auto object-contain" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                <Cpu size={15} className="text-pixiu-blue" />
                Pixiu Cyber-Lab • Arduino & Breadboard
              </h1>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate max-w-[160px] sm:max-w-none">
              User: <strong className="text-slate-200">{activeUser?.name || 'Student'}</strong> ({activeRole?.toUpperCase()})
            </p>
          </div>
        </div>

        {/* Master Action Controls (Desktop) */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoWirePreset}
            className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Auto-setup 220Ω LED Blink circuit"
          >
            <Sparkles size={13} className="text-amber-400" />
            <span className="hidden md:inline">Auto-Setup</span>
          </button>

          <button
            onClick={handleClearAllWires}
            className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Clear all jumper wires"
          >
            <Trash2 size={13} />
          </button>

          <button
            onClick={handleReset}
            className="hidden sm:flex p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs font-bold transition-colors cursor-pointer items-center gap-1"
            title="Reset simulation counters"
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

      {/* ==================== MOBILE LAB VIEW SWITCHER TABS (< 1024px) ==================== */}
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
        <div className={`flex-1 flex-col bg-[#070C18] relative overflow-y-auto select-none ${
          mobileTab === 'workbench' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          {/* Streamlined Sub-Toolbar: Circuit Status & Wire Spool */}
          <div className="p-2.5 sm:p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs z-20">
            
            {/* Status Pill */}
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border shrink-0 ${
                isCircuitClosed 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isCircuitClosed ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {isCircuitClosed ? 'Closed Loop' : 'Open Circuit'}
              </span>
              <p className="text-[11px] text-slate-300 truncate max-w-xs sm:max-w-md hidden sm:block" title={circuitAnalysis.message}>
                {circuitAnalysis.message}
              </p>
            </div>

            {/* Wire Spool Color Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Wire:</span>
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

              {activeWiringStart && (
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] animate-pulse">
                  Wiring: {activeWiringStart.label}
                </span>
              )}

              {placementMode && (
                <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-mono text-[10px] font-bold border border-yellow-500/30 animate-pulse">
                  {placementMode.includes('resistor') ? 'Click holes to plug Resistor' : 'Click holes to plug LED'}
                </span>
              )}
            </div>
          </div>

          {/* ================= COMPACT FLOATING PARTS DOCK ================= */}
          <div className="px-4 sm:px-6 pt-3 pb-1 z-20">
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-cyan-400" />
                <span className="text-xs font-extrabold text-white">Parts Dock:</span>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                {/* 1. Resistor Mini Badge */}
                <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <div className="w-6 h-3 bg-[#C99C67] rounded-full border border-[#966F3D] flex items-center justify-around px-0.5">
                    <span className="w-0.5 h-full bg-red-600"></span>
                    <span className="w-0.5 h-full bg-red-600"></span>
                    <span className="w-0.5 h-full bg-[#5C3317]"></span>
                    <span className="w-0.5 h-full bg-[#D4AF37]"></span>
                  </div>
                  <span className="text-[11px] font-bold text-white">220Ω Resistor</span>
                  <button
                    onClick={() => {
                      if (resistor.isPlaced) {
                        setResistor({ isPlaced: false, lead1: null, lead2: null });
                        showToast('Pulled Resistor body back to tray.', 'Pulled to Tray', 'info');
                      } else {
                        setPlacementMode('placing_resistor_1');
                        showToast('Click any breadboard hole to insert Resistor Lead 1.', 'Place Resistor', 'info');
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                      resistor.isPlaced 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {resistor.isPlaced ? 'Pull' : 'Plug ➔'}
                  </button>
                  <button
                    onClick={() => setXrayModalComponent('resistor')}
                    className="text-slate-400 hover:text-amber-400 cursor-pointer"
                    title="X-Ray 3D Dissection"
                  >
                    <Eye size={12} />
                  </button>
                </div>

                {/* 2. LED Mini Badge */}
                <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                  <div className={`w-3.5 h-5 rounded-t-full rounded-b-xs border flex items-center justify-center ${
                    isLedGlowing ? 'bg-red-500 border-red-300 shadow-[0_0_8px_#EF4444]' : 'bg-red-900 border-red-800'
                  }`}>
                    <div className="w-1 h-1.5 bg-white/40 rounded-full"></div>
                  </div>
                  <span className="text-[11px] font-bold text-white">5mm Red LED</span>
                  <button
                    onClick={() => {
                      if (led.isPlaced) {
                        setLed({ isPlaced: false, anode: null, cathode: null });
                        showToast('Pulled LED Bulb back to tray.', 'Pulled to Tray', 'info');
                      } else {
                        setPlacementMode('placing_led_anode');
                        showToast('Click any breadboard hole to insert LED Anode (+ long leg).', 'Place LED', 'info');
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                      led.isPlaced 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {led.isPlaced ? 'Pull' : 'Plug ➔'}
                  </button>
                  <button
                    onClick={() => setXrayModalComponent('bulb')}
                    className="text-slate-400 hover:text-red-400 cursor-pointer"
                    title="X-Ray 3D Dissection"
                  >
                    <Eye size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ================= WORKBENCH CANVAS: ARDUINO + BREADBOARD WITH REAL WIRES ================= */}
          <div className="flex-1 p-3 sm:p-6 overflow-x-auto">
            
            {/* Scrollable Canvas Area */}
            <div 
              ref={workbenchRef}
              className="relative min-w-[980px] min-h-[640px] flex items-center justify-around gap-8 p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] rounded-3xl border border-slate-800/80 bg-slate-950/40"
            >
              
              {/* SVG OVERLAY: REAL 3D JUMPER WIRES, 3D RESISTOR BODY, AND 3D LED BULB */}
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
                      <title>Click to pull/remove jumper wire ({wire.fromLabel} ➔ {wire.toLabel})</title>

                      {/* Drop shadow */}
                      <path 
                        d={pathD} 
                        fill="none" 
                        stroke="rgba(0,0,0,0.55)" 
                        strokeWidth="8" 
                        strokeLinecap="round" 
                        transform="translate(0, 8)"
                      />

                      {/* Insulated PVC Cable */}
                      <path 
                        d={pathD} 
                        fill="none" 
                        stroke={wire.color} 
                        strokeWidth="5" 
                        strokeLinecap="round" 
                        className="transition-all group-hover:stroke-white group-hover:stroke-[6px]"
                      />

                      {/* Specular Highlight */}
                      <path 
                        d={pathD} 
                        fill="none" 
                        stroke="rgba(255, 255, 255, 0.4)" 
                        strokeWidth="1.6" 
                        strokeLinecap="round" 
                        transform="translate(0, -1)"
                      />

                      {/* End Terminal Sleeves */}
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
                    <title>220Ω Resistor Body. Click for 3D X-Ray Dissection.</title>

                    {/* Silver Leads */}
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

                          {/* Color Bands (Red-Red-Brown-Gold) */}
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

                          <g transform={`translate(${lx}, ${ly - 32})`}>
                            {isLedGlowing && (
                              <>
                                <circle cx="0" cy="0" r="50" fill="url(#led-bloom-clean)" opacity="0.85" className="animate-pulse" />
                                <ellipse cx="0" cy="36" rx="35" ry="12" fill="rgba(239, 68, 68, 0.45)" />
                              </>
                            )}

                            <ellipse 
                              cx="0" cy="14" rx="12" ry="4" 
                              fill={isLedGlowing ? "#EF4444" : "#7F1D1D"} 
                              stroke={isLedGlowing ? "#FCA5A5" : "#991B1B"} 
                              strokeWidth="1.2" 
                            />

                            <path 
                              d="M -11 14 L -11 0 C -11 -16, 11 -16, 11 0 L 11 14 Z" 
                              fill={isLedGlowing ? "url(#led-glow-clean)" : "url(#led-off-clean)"} 
                              stroke={isLedGlowing ? "#FECACA" : "#991B1B"} 
                              strokeWidth="1.5" 
                            />

                            <path d="M -6 6 L -2 -3 L -6 -3 Z" fill="#E2E8F0" />
                            <circle 
                              cx="-4" cy="-3" 
                              r={isLedGlowing ? "3.5" : "1.5"} 
                              fill={isLedGlowing ? "#FFFFFF" : "#450A0A"} 
                              className={isLedGlowing ? "animate-ping" : ""} 
                            />
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
                          </g>
                        </>
                      );
                    })()}
                  </g>
                )}

              </svg>

              {/* 1. ARDUINO UNO R3 BOARD */}
              <div 
                className="relative w-[280px] h-[390px] bg-[#005B60] rounded-2xl border-[3px] border-[#008184] shadow-[12px_18px_30px_rgba(0,0,0,0.8)] p-4 flex flex-col justify-between shrink-0 group select-none z-10"
                style={{
                  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.2), inset 0 -4px 6px rgba(0, 0, 0, 0.5)'
                }}
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

                {/* Top Pins */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[8px] font-mono text-cyan-200 font-bold px-1 select-none">
                    <span>AREF</span>
                    <span>GND</span>
                    <span className="text-yellow-300 font-extrabold underline">PIN 13</span>
                    <span>12</span>
                    <span>11~</span>
                    <span>10~</span>
                    <span>9~</span>
                    <span>8</span>
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
                    title="Click for 3D Dissection"
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

                {/* Bottom Pins */}
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
                style={{
                  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), inset 0 2px 4px #FFFFFF, inset 0 -3px 6px #D1D5DB'
                }}
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

          {/* Connected Jumper Wires Tag Bar */}
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
                    title="Remove wire"
                  >
                    ×
                  </button>
                </div>
              ))}
              {wires.length === 0 && (
                <span className="text-slate-600 italic text-[11px]">No wires. Click pins & holes to connect.</span>
              )}
            </div>
          </div>

        </div>

        {/* ==================== RIGHT: VISUAL BLOCK CODING STUDIO ==================== */}
        <div className={`w-full lg:w-[460px] bg-[#090E1A] flex-col shrink-0 border-t lg:border-t-0 border-slate-800 z-20 ${
          mobileTab === 'blocks' ? 'flex flex-1' : 'hidden lg:flex'
        }`}>
          
          {/* Header */}
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

          {/* BLOCK CANVAS */}
          {!showCppCode ? (
            <div className="flex-1 p-4 flex flex-col space-y-3.5 overflow-y-auto">
              
              {/* Event Block */}
              <div className="bg-[#EAB308]/20 border-2 border-[#EAB308] rounded-2xl p-3 shadow-md">
                <div className="flex items-center gap-2 font-bold text-xs text-yellow-300">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse"></div>
                  <span>🟢 WHEN SIMULATION STARTS</span>
                </div>
              </div>

              {/* Stack of Blocks */}
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
                          <span>Set Digital Pin</span>
                          
                          <select 
                            value={block.pin}
                            onChange={(e) => updateBlock(block.id, 'pin', e.target.value)}
                            className="bg-blue-900 border border-blue-400 rounded-lg px-2 py-1 text-white font-bold cursor-pointer text-xs"
                          >
                            <option value="13">Pin 13</option>
                            <option value="12">Pin 12</option>
                            <option value="11">Pin 11</option>
                            <option value="10">Pin 10</option>
                            <option value="9">Pin 9</option>
                            <option value="8">Pin 8</option>
                          </select>

                          <span>to</span>

                          <select 
                            value={block.state}
                            onChange={(e) => updateBlock(block.id, 'state', e.target.value)}
                            className="bg-blue-900 border border-blue-400 rounded-lg px-2 py-1 text-white font-bold cursor-pointer text-xs"
                          >
                            <option value="HIGH">HIGH (💡 5V)</option>
                            <option value="LOW">LOW (🌑 0V)</option>
                          </select>
                        </div>

                        <button 
                          onClick={() => deleteBlock(block.id)}
                          className="p-1 text-blue-200 hover:text-white rounded hover:bg-blue-800 transition-colors cursor-pointer"
                          title="Delete Block"
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
                          title="Delete Block"
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

      {/* ==================== MOBILE FLOATING RUN ACTION BAR (< 1024px) ==================== */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 z-40 shadow-2xl">
        <button
          onClick={handleReset}
          className="p-2.5 bg-slate-800 text-slate-300 rounded-xl border border-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          title="Reset"
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
                    {xrayModalComponent === 'breadboard' && '3D Breadboard Internal Spring-Clip Architecture'}
                    {xrayModalComponent === 'resistor' && "3D 220Ω Resistor Spiral Core & Ohm's Law Physics"}
                    {xrayModalComponent === 'arduino' && 'ATmega328P Silicon Micro-Architecture (Die, RAM, ROM, Clock)'}
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
              {/* LED BULB */}
              {xrayModalComponent === 'bulb' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-5">
                    <div className="w-48 sm:w-52 h-40 sm:h-44 bg-gradient-to-b from-red-950 to-slate-900 border border-red-500/40 rounded-xl p-3 relative flex flex-col justify-between overflow-hidden shadow-inner shrink-0">
                      <div className="text-[9px] font-mono font-bold text-red-400 text-center">
                        P-N JUNCTION SEMICONDUCTOR CHIP
                      </div>

                      <div className="flex items-center justify-around my-auto">
                        <div className="text-center">
                          <span className="text-[8px] text-blue-400 block font-bold">N-REGION</span>
                          <div className="w-7 h-7 rounded-full bg-blue-500/30 border border-blue-400 flex items-center justify-center font-mono text-[8px] font-bold text-blue-200 animate-pulse">
                            e⁻ e⁻
                          </div>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-amber-300 font-black text-xs animate-bounce">⚡ hν</span>
                          <span className="text-[7px] text-red-400 font-mono">Photon λ=660nm</span>
                        </div>

                        <div className="text-center">
                          <span className="text-[8px] text-rose-400 block font-bold">P-REGION</span>
                          <div className="w-7 h-7 rounded-full bg-rose-500/30 border border-rose-400 flex items-center justify-center font-mono text-[8px] font-bold text-rose-200 animate-pulse">
                            h⁺ h⁺
                          </div>
                        </div>
                      </div>

                      <div className="text-[8px] font-mono text-center text-slate-400">
                        Electrons drop into holes ➔ Emits light photon!
                      </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <div className="font-bold text-white text-xs">5 Anatomical Layers of an LED:</div>
                      <ul className="space-y-1 text-slate-300 text-[11px]">
                        <li><strong className="text-red-400">1. Epoxy Dome:</strong> Optical lens focusing emitted light.</li>
                        <li><strong className="text-amber-400">2. Anvil (Cathode -):</strong> Reflective cup holding semiconductor die.</li>
                        <li><strong className="text-blue-400">3. Post (Anode +):</strong> Connects longer positive lead.</li>
                        <li><strong className="text-yellow-400">4. Gold Whisker Wire:</strong> Ultra-fine gold wire passing current.</li>
                        <li><strong className="text-emerald-400">5. GaAsP Crystal Die:</strong> Quantum electroluminescence source.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-1.5">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Sparkles size={13} className="text-yellow-400" />
                      How It Actually Glows Behind the Scenes:
                    </h4>
                    <p className="leading-relaxed text-[11px] text-slate-300">
                      Unlike an incandescent bulb that burns a filament with heat, an LED uses <strong>cold solid-state electroluminescence</strong>. When voltage is applied, electrons cross the energy bandgap into the holes of the P-region and release energy as <strong>Photons of Light</strong> (E = h × c / λ).
                    </p>
                  </div>
                </div>
              )}

              {/* BREADBOARD CLIPS */}
              {xrayModalComponent === 'breadboard' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-center space-y-3">
                    <div className="font-bold text-white text-xs">Internal Phosphor-Bronze Spring Clip Matrix</div>
                    
                    <div className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center gap-3">
                      {['a', 'b', 'c', 'd', 'e'].map((col, i) => (
                        <div key={i} className="text-center">
                          <div className="w-7 h-7 rounded-lg bg-amber-400 border border-amber-200 text-black font-mono font-black text-xs flex items-center justify-center shadow-md">
                            {col}
                          </div>
                          <span className="text-[8px] font-mono text-amber-300 mt-0.5 block">Tied</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed max-w-lg mx-auto">
                      Beneath the off-white plastic casing are nickel-plated phosphor-bronze metal spring clips. All 5 socket holes in row 15 (columns a-b-c-d-e) touch the <strong>same single piece of metal</strong>, connecting components together without soldering!
                    </p>
                  </div>
                </div>
              )}

              {/* RESISTOR */}
              {xrayModalComponent === 'resistor' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-5">
                    <div className="w-44 h-24 bg-[#966F3D]/20 border border-amber-600/40 rounded-xl p-3 flex flex-col items-center justify-center">
                      <div className="font-mono text-[9px] text-amber-400 font-bold mb-1">SPIRAL CARBON FILM</div>
                      <div className="font-mono text-base font-black text-white tracking-widest">
                        220 Ω
                      </div>
                      <span className="text-[8px] text-slate-400 font-mono">Laser-cut spiral determines resistance</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-white text-xs">Ohm's Law Calculation:</div>
                      <div className="font-mono text-[11px] bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-amber-300">
                        R = (V_supply - V_led) / I_desired<br />
                        R = (5.0V - 2.0V) / 0.014A = 214Ω ➔ Standard 220Ω
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ARDUINO SILICON DIE */}
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

                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-left space-y-1 text-[11px]">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Radio size={13} className="text-cyan-400 animate-pulse" />
                        16.000 MHz Quartz Clock:
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        Vibrates exactly 16,000,000 times per second to fetch and execute block code instructions in 62.5 nanoseconds!
                      </p>
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
