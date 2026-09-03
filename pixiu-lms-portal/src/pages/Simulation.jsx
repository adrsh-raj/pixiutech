import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Cpu, Play, Square, RotateCcw, ShieldAlert, Lock, ArrowLeft, 
  Sparkles, CheckCircle2, Eye, Zap, Plus, Trash2, Code, Puzzle, 
  X, Radio, Clock, Layers, Move, Check, AlertTriangle
} from 'lucide-react';

export default function Simulation() {
  const _navigate = useNavigate();

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

  // In-page Toast Notification state
  const [toastAlert, setToastAlert] = useState(null);
  const showToast = (msg, title, type = 'info') => {
    setToastAlert({ msg, title, type });
    setTimeout(() => setToastAlert(null), 3500);
  };

  // ==================== BREADBOARD DATA (1:1 with Real 400-Point Board) ====================
  // 30 numbered rows, Columns a,b,c,d,e (Top) and f,g,h,i,j (Bottom)
  const ROWS = Array.from({ length: 30 }, (_, i) => i + 1);
  const TOP_COLS = ['a', 'b', 'c', 'd', 'e'];
  const BOT_COLS = ['f', 'g', 'h', 'i', 'j'];
  const POWER_GROUPS = Array.from({ length: 25 }, (_, i) => i + 1);

  // ==================== PLACED COMPONENTS (FREE PLACEMENT ANYWHERE) ====================
  // Resistor: spans lead1 to lead2
  const [resistor, setResistor] = useState({
    isPlaced: true,
    lead1: { row: 10, col: 'c' },
    lead2: { row: 15, col: 'c' }
  });

  // 5mm Red LED Bulb: sits at anode & cathode
  const [led, setLed] = useState({
    isPlaced: true,
    anode: { row: 15, col: 'd' },   // Connected to same row 15 as resistor!
    cathode: { row: 16, col: 'd' }  // Next row 16
  });

  // Active Placement Interaction Mode: null | 'placing_resistor_1' | 'placing_resistor_2' | 'placing_led_anode' | 'placing_led_cathode'
  const [placementMode, setPlacementMode] = useState(null);
  const [tempPlacementData, setTempPlacementData] = useState(null);

  // ==================== FREE PIN-TO-HOLE WIRING ENGINE ====================
  // Wires array: [{ id, fromId, toId, fromLabel, toLabel, color }]
  const [wires, setWires] = useState([
    { id: 'w1', fromId: 'ARD_13', toId: 'BB_10_a', fromLabel: 'Arduino Pin 13', toLabel: 'Breadboard Row 10 (a)', color: '#3B82F6' },
    { id: 'w2', fromId: 'BB_16_e', toId: 'ARD_GND', fromLabel: 'Breadboard Row 16 (e)', toLabel: 'Arduino GND', color: '#0F172A' }
  ]);

  const [selectedWireColor, setSelectedWireColor] = useState('#3B82F6');
  const [activeWiringStart, setActiveWiringStart] = useState(null); // { id, label }

  const WIRE_COLORS = [
    { label: 'Blue', hex: '#3B82F6' },
    { label: 'Black (GND)', hex: '#0F172A' },
    { label: 'Red (5V)', hex: '#EF4444' },
    { label: 'Yellow', hex: '#F59E0B' },
    { label: 'Green', hex: '#10B981' },
    { label: 'Orange', hex: '#F97316' }
  ];

  // Click any hole or pin
  const handleTerminalClick = (terminalId, terminalLabel, rowNum = null, colName = null) => {
    // 1. If currently in component placement mode:
    if (placementMode === 'placing_resistor_1') {
      if (!rowNum || !colName) {
        showToast('Please click a breadboard socket hole to plug the first lead of the resistor.', 'Select Hole', 'info');
        return;
      }
      setTempPlacementData({ row: rowNum, col: colName });
      setPlacementMode('placing_resistor_2');
      showToast(`First lead placed in Row ${rowNum} (${colName}). Now click hole for the second lead.`, 'Resistor Lead 1 Placed', 'info');
      return;
    }

    if (placementMode === 'placing_resistor_2') {
      if (!rowNum || !colName) {
        showToast('Please click a breadboard socket hole for the second lead.', 'Select Hole', 'info');
        return;
      }
      setResistor({
        isPlaced: true,
        lead1: tempPlacementData,
        lead2: { row: rowNum, col: colName }
      });
      setPlacementMode(null);
      setTempPlacementData(null);
      showToast(`220Ω Resistor successfully plugged into Row ${tempPlacementData.row} and Row ${rowNum}!`, 'Resistor Plugged', 'success');
      return;
    }

    if (placementMode === 'placing_led_anode') {
      if (!rowNum || !colName) {
        showToast('Please click a breadboard hole for the LED Anode (+ long leg).', 'Select Hole', 'info');
        return;
      }
      setTempPlacementData({ row: rowNum, col: colName });
      setPlacementMode('placing_led_cathode');
      showToast(`Anode (+) placed in Row ${rowNum} (${colName}). Now click hole for Cathode (- short leg).`, 'Anode Placed', 'info');
      return;
    }

    if (placementMode === 'placing_led_cathode') {
      if (!rowNum || !colName) {
        showToast('Please click a breadboard hole for the LED Cathode (- short leg).', 'Select Hole', 'info');
        return;
      }
      setLed({
        isPlaced: true,
        anode: tempPlacementData,
        cathode: { row: rowNum, col: colName }
      });
      setPlacementMode(null);
      setTempPlacementData(null);
      showToast(`Red LED Bulb plugged: Anode in Row ${tempPlacementData.row}, Cathode in Row ${rowNum}!`, 'LED Plugged', 'success');
      return;
    }

    // 2. Otherwise: Jumper Wiring Mode
    if (!activeWiringStart) {
      setActiveWiringStart({ id: terminalId, label: terminalLabel });
      showToast(`Started jumper wire from ${terminalLabel}. Click any hole or pin to connect.`, 'Wiring Active', 'info');
    } else {
      if (activeWiringStart.id === terminalId) {
        setActiveWiringStart(null);
        return;
      }

      // Check if duplicate wire exists
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
    showToast('All wires removed from the workbench.', 'Wires Cleared', 'info');
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
  // Maps any terminal ID to its internal electrical conductive node
  const getElectricalNode = (termId) => {
    if (termId.startsWith('ARD_')) return termId; // Arduino pin is its own node
    if (termId.startsWith('PWR_TOP_POS_')) return 'NODE_PWR_TOP_POS';
    if (termId.startsWith('PWR_TOP_NEG_')) return 'NODE_PWR_TOP_NEG';
    if (termId.startsWith('PWR_BOT_POS_')) return 'NODE_PWR_BOT_POS';
    if (termId.startsWith('PWR_BOT_NEG_')) return 'NODE_PWR_BOT_NEG';

    // Terminal Grid: BB_{row}_{col}
    const match = termId.match(/^BB_(\d+)_([a-j])$/);
    if (match) {
      const row = match[1];
      const col = match[2];
      // columns a-e are tied horizontally together
      if (['a', 'b', 'c', 'd', 'e'].includes(col)) {
        return `NODE_ROW_${row}_TOP`;
      } else {
        return `NODE_ROW_${row}_BOT`;
      }
    }

    return termId;
  };

  // Check circuit continuity dynamically based on where user placed components & wires
  const circuitAnalysis = useMemo(() => {
    if (!resistor.isPlaced && !led.isPlaced) {
      return { isComplete: false, message: '⚠️ Both Resistor and LED are in the tray. Drag or click "Place" to insert them.', reason: 'no_components' };
    }
    if (!resistor.isPlaced) {
      return { isComplete: false, message: '⚠️ 220Ω Resistor missing! Click "Place Resistor" to insert into breadboard.', reason: 'no_resistor' };
    }
    if (!led.isPlaced) {
      return { isComplete: false, message: '⚠️ LED Bulb missing! Click "Place LED" to insert into breadboard.', reason: 'no_led' };
    }

    // Resistor nodes
    const resNode1 = getElectricalNode(`BB_${resistor.lead1.row}_${resistor.lead1.col}`);
    const resNode2 = getElectricalNode(`BB_${resistor.lead2.row}_${resistor.lead2.col}`);

    // LED nodes
    const ledAnodeNode = getElectricalNode(`BB_${led.anode.row}_${led.anode.col}`);
    const ledCathodeNode = getElectricalNode(`BB_${led.cathode.row}_${led.cathode.col}`);

    // Build Adjacency Graph from Wires
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

    // Helper: Is node X connected to node Y through wires?
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

    // Check if Pin 13 reaches Resistor:
    const pin13ToRes1 = isConnected('ARD_13', resNode1);
    const pin13ToRes2 = isConnected('ARD_13', resNode2);

    let resPowerNode = null;
    let resOutputNode = null;

    if (pin13ToRes1) {
      resPowerNode = resNode1;
      resOutputNode = resNode2;
    } else if (pin13ToRes2) {
      resPowerNode = resNode2;
      resOutputNode = resNode1;
    }

    if (!resPowerNode) {
      return { isComplete: false, message: '⚠️ Missing Power Wire: Connect Arduino Pin 13 to the Resistor row.', reason: 'no_power_wire' };
    }

    // Check if Resistor output reaches LED Anode:
    const resToAnode = isConnected(resOutputNode, ledAnodeNode);
    if (!resToAnode) {
      return { isComplete: false, message: `⚠️ Resistor does not reach LED Anode! Connect Row ${resistor.lead2.row} to Row ${led.anode.row}.`, reason: 'res_not_to_led' };
    }

    // Check if LED Cathode reaches Arduino GND:
    const cathodeToGnd = isConnected(ledCathodeNode, 'ARD_GND') || isConnected(ledCathodeNode, 'ARD_GND_TOP');
    if (!cathodeToGnd) {
      return { isComplete: false, message: `⚠️ Missing Ground Wire: Connect LED Cathode (Row ${led.cathode.row}) to Arduino GND.`, reason: 'no_gnd_wire' };
    }

    return {
      isComplete: true,
      message: `✅ Complete Closed Circuit! Path: Pin 13 ➔ Resistor (Row ${resistor.lead1.row} to ${resistor.lead2.row}) ➔ LED Anode (Row ${led.anode.row}) ➔ Cathode (Row ${led.cathode.row}) ➔ GND.`,
      reason: 'ok'
    };
  }, [resistor, led, wires]);

  const isCircuitClosed = circuitAnalysis.isComplete;

  // ==================== VISUAL BLOCK CODING STATE ====================
  const [blocks, setBlocks] = useState([
    { id: 'b1', type: 'set_pin', pin: '13', state: 'HIGH' },
    { id: 'b2', type: 'wait', duration: 1.0 },
    { id: 'b3', type: 'set_pin', pin: '13', state: 'LOW' },
    { id: 'b4', type: 'wait', duration: 1.0 }
  ]);
  const [repeatLoop, setRepeatLoop] = useState(true);
  const [activeBlockIndex, setActiveBlockIndex] = useState(-1);
  const [showCppCode, setShowCppCode] = useState(false);

  const addBlock = (type) => {
    if (type === 'set_pin') {
      setBlocks(prev => [...prev, { id: 'b_' + Date.now(), type: 'set_pin', pin: '13', state: 'HIGH' }]);
    } else {
      setBlocks(prev => [...prev, { id: 'b_' + Date.now(), type: 'wait', duration: 1.0 }]);
    }
  };

  const deleteBlock = (id) => {
    if (blocks.length <= 1) {
      showToast('You must keep at least 1 block in the program.', 'Cannot Delete', 'info');
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
  const [pin13Output, setPin13Output] = useState(false);
  const [serialLogs, setSerialLogs] = useState([]);

  // Computed: LED only glows if Pin 13 is HIGH and the complete circuit loop is closed!
  const isLedGlowing = isRunning && pin13Output && isCircuitClosed;

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
            setPin13Output(false);
            setSerialLogs(prev => [...prev.slice(-30), `[Program Complete] Reached end of sequence.`]);
            return;
          }
        }

        const block = blocks[currentStep];
        setActiveBlockIndex(currentStep);

        if (block.type === 'set_pin') {
          const isHigh = block.state === 'HIGH';
          setPin13Output(isHigh);

          if (isHigh && isCircuitClosed) {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${block.pin} HIGH ➔ 💡 LED Glows!`]);
          } else if (isHigh && !isCircuitClosed) {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin 13 HIGH, but circuit OPEN (no light)`]);
          } else {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${block.pin} LOW ➔ 🌑 LED Off`]);
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
      setPin13Output(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (timerId) clearInterval(timerId);
    };
  }, [isRunning, blocks, repeatLoop, isCircuitClosed]);

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
      setPin13Output(false);
      showToast('Simulation stopped.', 'Stopped', 'info');
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setActiveBlockIndex(-1);
    setRunTimeSec(0);
    setPin13Output(false);
    setSerialLogs([`[System] Reset to idle.`]);
    showToast('Simulation counters reset.', 'Reset Complete', 'info');
  };

  // ==================== 3D X-RAY ANATOMY MODAL STATE ====================
  const [xrayModalComponent, setXrayModalComponent] = useState(null); // 'bulb' | 'breadboard' | 'resistor' | 'arduino' | null

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

  return (
    <div className="min-h-screen bg-[#060913] text-white flex flex-col font-sans selection:bg-pixiu-blue selection:text-white relative">
      
      {/* Toast Alert */}
      {toastAlert && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
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

      {/* Top Navbar */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link 
            to={getBackRoute()}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors flex items-center gap-1 text-xs font-bold mr-1 cursor-pointer"
            title={`Return to ${getBackLabel()}`}
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">{getBackLabel()}</span>
          </Link>

          <div className="bg-white px-2 py-0.5 rounded-lg shadow-sm border border-white/20 shrink-0">
            <img src="/img/logo.png" alt="Pixiu Tech" className="h-6 w-auto object-contain" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                <Cpu size={16} className="text-pixiu-blue" />
                Pixiu Cyber-Lab • 1:1 Physical Breadboard Workbench
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                Full 400-Point Matrix
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Session: <strong className="text-slate-200">{activeUser?.name || activeUser?.username || 'Authorized User'}</strong> ({activeRole?.toUpperCase() || 'MEMBER'})
            </p>
          </div>
        </div>

        {/* Master Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoWirePreset}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Auto-place components & connect standard circuit"
          >
            <Sparkles size={14} className="text-amber-400" />
            <span className="hidden sm:inline">Auto-Setup Circuit</span>
          </button>

          <button
            onClick={handleClearAllWires}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Clear all jumper wires"
          >
            <Trash2 size={14} />
          </button>

          <button
            onClick={handleReset}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            title="Reset simulation counters"
          >
            <RotateCcw size={14} />
          </button>

          <button
            onClick={handleToggleRun}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg cursor-pointer ${
              isRunning 
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 animate-pulse' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {isRunning ? (
              <>
                <Square size={13} fill="currentColor" /> Stop Simulation
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" /> Run Simulation
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        {/* ==================== LEFT: INTERACTIVE 3D WORKBENCH WITH 1:1 BREADBOARD ==================== */}
        <div className="flex-1 flex flex-col bg-[#070C18] relative overflow-auto select-none">
          
          {/* Top Workbench Toolbar: Wiring Mode & Continuity Status */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs z-10">
            {/* Electrical Continuity Bar */}
            <div className="flex items-center gap-2 max-w-xl">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border shrink-0 ${
                isCircuitClosed 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isCircuitClosed ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {isCircuitClosed ? 'Closed Loop' : 'Open Circuit'}
              </span>
              <p className="text-[11px] text-slate-300 truncate" title={circuitAnalysis.message}>
                {circuitAnalysis.message}
              </p>
            </div>

            {/* Wire Spool Color Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wire Spool:</span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {WIRE_COLORS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setSelectedWireColor(c.hex)}
                    className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                      selectedWireColor === c.hex ? 'scale-125 border-white shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={`Select ${c.label} Jumper Wire`}
                  />
                ))}
              </div>

              {activeWiringStart && (
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] animate-pulse">
                  Wiring from: {activeWiringStart.label} (Click destination)
                </span>
              )}

              {placementMode && (
                <span className="px-2.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-mono text-[10px] font-bold border border-yellow-500/30 animate-pulse">
                  {placementMode.includes('resistor') ? 'Click holes to place Resistor leads' : 'Click holes to place LED Anode & Cathode'}
                </span>
              )}
            </div>
          </div>

          {/* ================= COMPONENT PARTS TRAY (FREE PULL & PUSH DOCK) ================= */}
          <div className="px-6 pt-3 pb-2">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-cyan-400" />
                <div>
                  <span className="text-xs font-black text-white block">PARTS TRAY (FREE PLACEMENT)</span>
                  <span className="text-[10px] text-slate-400">Click Place to insert legs into ANY holes on the 30-row breadboard</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* 1. 220Ω Resistor Card */}
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <div className="w-8 h-3.5 bg-[#C99C67] rounded-full border border-[#966F3D] flex items-center justify-around px-0.5">
                    <span className="w-0.5 h-full bg-red-600"></span>
                    <span className="w-0.5 h-full bg-red-600"></span>
                    <span className="w-0.5 h-full bg-[#5C3317]"></span>
                    <span className="w-0.5 h-full bg-[#D4AF37]"></span>
                  </div>
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-white block">220Ω Resistor</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {resistor.isPlaced ? `Row ${resistor.lead1.row}(${resistor.lead1.col}) ➔ ${resistor.lead2.row}(${resistor.lead2.col})` : 'In Tray'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (resistor.isPlaced) {
                        setResistor({ isPlaced: false, lead1: null, lead2: null });
                        showToast('Pulled Resistor out of breadboard back to tray.', 'Pulled to Tray', 'info');
                      } else {
                        setPlacementMode('placing_resistor_1');
                        showToast('Click the first breadboard socket hole to insert Resistor Lead 1.', 'Place Resistor', 'info');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      resistor.isPlaced 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {resistor.isPlaced ? 'Pull to Tray' : 'Place Resistor ➔'}
                  </button>
                  <button
                    onClick={() => setXrayModalComponent('resistor')}
                    className="p-1 text-slate-400 hover:text-amber-400 cursor-pointer"
                    title="X-Ray 3D Dissection"
                  >
                    <Eye size={13} />
                  </button>
                </div>

                {/* 2. 5mm Red LED Bulb Card */}
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <div className={`w-4 h-6 rounded-t-full rounded-b-xs border flex items-center justify-center ${
                    isLedGlowing ? 'bg-red-500 border-red-300 shadow-[0_0_10px_#EF4444]' : 'bg-red-900 border-red-800'
                  }`}>
                    <div className="w-1.5 h-2 bg-white/40 rounded-full"></div>
                  </div>
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-white block">5mm Red LED</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {led.isPlaced ? `Anode: R${led.anode.row}(${led.anode.col}), Cathode: R${led.cathode.row}(${led.cathode.col})` : 'In Tray'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (led.isPlaced) {
                        setLed({ isPlaced: false, anode: null, cathode: null });
                        showToast('Pulled LED Bulb out of breadboard back to tray.', 'Pulled to Tray', 'info');
                      } else {
                        setPlacementMode('placing_led_anode');
                        showToast('Click a breadboard hole to insert LED Anode (+ long leg).', 'Place LED', 'info');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      led.isPlaced 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {led.isPlaced ? 'Pull to Tray' : 'Place LED ➔'}
                  </button>
                  <button
                    onClick={() => setXrayModalComponent('bulb')}
                    className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                    title="X-Ray 3D Dissection"
                  >
                    <Eye size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ================= WORKBENCH CANVAS: ARDUINO (LEFT) + REAL 30-ROW BREADBOARD (RIGHT) ================= */}
          <div className="flex-1 p-6 flex flex-col xl:flex-row items-center justify-around gap-8 min-h-[640px] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
            
            {/* 1. PHOTOREALISTIC 3D ARDUINO UNO R3 BOARD */}
            <div 
              className="relative w-[280px] h-[390px] bg-[#005B60] rounded-2xl border-[3px] border-[#008184] shadow-[12px_18px_30px_rgba(0,0,0,0.8)] p-4 flex flex-col justify-between shrink-0 group select-none"
              style={{
                boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.2), inset 0 -4px 6px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div className="absolute inset-0 rounded-2xl border-b-4 border-r-4 border-[#00383B] pointer-events-none"></div>

              {/* USB-B Port */}
              <div className="absolute -top-3.5 left-5 w-14 h-9 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 rounded-t-md border border-slate-400 shadow-md flex items-center justify-center">
                <div className="w-8 h-4 bg-slate-800 rounded-xs border border-slate-600"></div>
              </div>

              {/* DC Barrel Jack */}
              <div className="absolute -bottom-4 left-5 w-12 h-10 bg-gradient-to-b from-slate-900 to-black rounded-b-md border border-slate-700 shadow-lg flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-500"></div>
              </div>

              {/* Reset Button */}
              <button 
                onClick={handleReset}
                className="absolute top-4 left-22 w-5 h-5 rounded-full bg-gradient-to-b from-red-500 to-red-700 border-2 border-red-300 shadow-md active:scale-90 transition-transform cursor-pointer"
                title="Hardware Reset"
              />

              {/* Top Digital Pin Header (0-13, GND, AREF) */}
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
                    { id: 'ARD_13', label: '13', active: pin13Output },
                    { id: 'ARD_12', label: '12' },
                    { id: 'ARD_11', label: '11' },
                    { id: 'ARD_10', label: '10' },
                    { id: 'ARD_9', label: '9' },
                    { id: 'ARD_8', label: '8' }
                  ].map((pin, i) => (
                    <div 
                      key={i} 
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
                      <div className="w-1.5 h-1.5 rounded-xs bg-slate-900"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Board Center: Branding + 16MHz Crystal + ATmega328P Chip */}
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
                        pin13Output ? 'bg-amber-400 shadow-[0_0_10px_#F59E0B] scale-125' : 'bg-amber-950/60 border border-amber-900'
                      }`}></span>
                      <span className="text-cyan-100">L (Pin 13)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399] animate-pulse"></span>
                      <span className="text-cyan-100">ON (5V)</span>
                    </div>
                  </div>
                </div>

                {/* 3D ATmega328P DIP-28 Chip */}
                <div 
                  onClick={() => setXrayModalComponent('arduino')}
                  className="w-full bg-[#161616] border-2 border-slate-700 rounded-lg p-2 flex flex-col justify-between shadow-[0_6px_12px_rgba(0,0,0,0.8)] cursor-pointer hover:border-cyan-400 transition-colors"
                  title="Click for 3D Dissection: Flash ROM, SRAM, ALU, 16MHz Crystal"
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
                      <Eye size={9} /> Click for 3D Die
                    </span>
                    <span>||||||||||||||</span>
                  </div>
                </div>
              </div>

              {/* Bottom Power Pin Header */}
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
                      onClick={() => handleTerminalClick(pin.id, `Arduino ${pin.label}`)}
                      className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                        activeWiringStart?.id === pin.id
                          ? 'ring-2 ring-white scale-125 bg-emerald-500'
                          : 'bg-black border border-slate-700 hover:border-emerald-400'
                      }`}
                      title={`Click to connect wire to ${pin.label}`}
                    >
                      <div className="w-1.5 h-1.5 rounded-xs bg-slate-800"></div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono text-cyan-200 font-bold px-1 select-none">
                  <span className="text-emerald-300 font-extrabold underline">POWER (5V / GND)</span>
                  <span>ANALOG IN</span>
                </div>
              </div>

            </div>

            {/* 2. EXACT 1:1 PHYSICAL BREADBOARD (MATCHING USER'S PHOTO media_1788448830729.jpg) */}
            <div 
              className="relative w-full max-w-[680px] bg-[#F7F7F8] rounded-xl border-4 border-[#E2E4E8] p-4 shadow-[0_25px_50px_rgba(0,0,0,0.85)] flex flex-col justify-between select-none overflow-x-auto"
              style={{
                boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), inset 0 2px 4px #FFFFFF, inset 0 -3px 6px #D1D5DB'
              }}
            >
              {/* Left & Right Dovetail Interlocking Tabs (Real Breadboard tabs) */}
              <div className="absolute -left-2.5 top-12 w-2.5 h-6 bg-[#E5E7EB] rounded-l-xs border-y border-l border-slate-300"></div>
              <div className="absolute -left-2.5 bottom-12 w-2.5 h-6 bg-[#E5E7EB] rounded-l-xs border-y border-l border-slate-300"></div>
              <div className="absolute -right-2.5 top-12 w-2.5 h-6 bg-[#E5E7EB] rounded-r-xs border-y border-r border-slate-300"></div>
              <div className="absolute -right-2.5 bottom-12 w-2.5 h-6 bg-[#E5E7EB] rounded-r-xs border-y border-r border-slate-300"></div>

              {/* ----------------- TOP POWER RAILS (+ RED / - BLUE) ----------------- */}
              <div className="space-y-1 pb-2 border-b border-slate-300">
                {/* Positive Rail (+) */}
                <div className="flex items-center gap-1">
                  <span className="text-rose-600 font-black text-xs w-4 text-center select-none">+</span>
                  <div className="flex-1 flex justify-between items-center bg-rose-50/50 py-0.5 px-2 rounded-xs border-y border-rose-200">
                    {POWER_GROUPS.map(num => (
                      <div 
                        key={`tp_${num}`}
                        onClick={() => handleTerminalClick(`PWR_TOP_POS_${num}`, `Top (+) Rail [${num}]`)}
                        className={`w-2.5 h-2.5 rounded-xs border cursor-pointer transition-all ${
                          activeWiringStart?.id === `PWR_TOP_POS_${num}`
                            ? 'bg-rose-500 ring-2 ring-white scale-125'
                            : 'bg-slate-900/90 border-slate-600 hover:bg-rose-500'
                        }`}
                        title={`Top Positive Rail Hole ${num}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Negative Rail (-) */}
                <div className="flex items-center gap-1">
                  <span className="text-blue-600 font-black text-xs w-4 text-center select-none">-</span>
                  <div className="flex-1 flex justify-between items-center bg-blue-50/50 py-0.5 px-2 rounded-xs border-y border-blue-200">
                    {POWER_GROUPS.map(num => (
                      <div 
                        key={`tn_${num}`}
                        onClick={() => handleTerminalClick(`PWR_TOP_NEG_${num}`, `Top (-) Rail [${num}]`)}
                        className={`w-2.5 h-2.5 rounded-xs border cursor-pointer transition-all ${
                          activeWiringStart?.id === `PWR_TOP_NEG_${num}`
                            ? 'bg-blue-500 ring-2 ring-white scale-125'
                            : 'bg-slate-900/90 border-slate-600 hover:bg-blue-500'
                        }`}
                        title={`Top Negative Rail Hole ${num}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* ----------------- MAIN TERMINAL GRID (ROWS 1 TO 30) ----------------- */}
              <div className="py-2 space-y-1 relative">
                
                {/* Printed Row Numbers Silkscreen (1, 5, 10, 15, 20, 25, 30) */}
                <div className="flex items-center pl-6 pr-2 justify-between text-[8px] font-mono font-bold text-slate-500 select-none pb-0.5">
                  {ROWS.map(r => (
                    <span key={`rt_${r}`} className={`w-3.5 text-center ${r % 5 === 0 ? 'text-slate-800 font-black' : 'text-slate-400'}`}>
                      {r % 5 === 0 || r === 1 ? r : '·'}
                    </span>
                  ))}
                </div>

                {/* TOP TERMINAL SECTION: COLUMNS a, b, c, d, e */}
                <div className="space-y-1">
                  {TOP_COLS.map(col => (
                    <div key={col} className="flex items-center gap-1">
                      <span className="text-[9px] font-mono font-bold text-slate-400 w-4 text-center uppercase">{col}</span>
                      <div className="flex-1 flex justify-between items-center px-1">
                        {ROWS.map(row => {
                          const holeId = `BB_${row}_${col}`;
                          const isWireStart = activeWiringStart?.id === holeId;
                          const hasWire = wires.some(w => w.fromId === holeId || w.toId === holeId);

                          // Check if this hole has resistor lead or LED lead
                          const isResLead1 = resistor.isPlaced && resistor.lead1.row === row && resistor.lead1.col === col;
                          const isResLead2 = resistor.isPlaced && resistor.lead2.row === row && resistor.lead2.col === col;
                          const isLedAnode = led.isPlaced && led.anode.row === row && led.anode.col === col;
                          const isLedCathode = led.isPlaced && led.cathode.row === row && led.cathode.col === col;

                          return (
                            <div 
                              key={holeId}
                              onClick={() => handleTerminalClick(holeId, `Row ${row} (${col})`, row, col)}
                              className={`relative w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                                isWireStart
                                  ? 'bg-blue-500 ring-2 ring-white scale-125 z-20'
                                  : hasWire
                                  ? 'bg-blue-600 ring-1 ring-blue-300'
                                  : isResLead1 || isResLead2
                                  ? 'bg-amber-600 ring-2 ring-amber-300'
                                  : isLedAnode
                                  ? 'bg-red-600 ring-2 ring-red-300'
                                  : isLedCathode
                                  ? 'bg-slate-700 ring-2 ring-slate-400'
                                  : 'bg-[#1E293B]/90 border border-slate-500 hover:border-blue-400 hover:scale-110'
                              }`}
                              title={`Breadboard Row ${row} (${col})`}
                            >
                              <div className="w-1.5 h-1.5 rounded-xs bg-[#0F172A] shadow-inner"></div>

                              {/* Visual Pin Indicators */}
                              {(isResLead1 || isResLead2) && (
                                <div className="absolute -top-1 w-2 h-2 rounded-full bg-amber-400 shadow-xs"></div>
                              )}
                              {isLedAnode && (
                                <div className={`absolute -top-2 w-3 h-3 rounded-full ${isLedGlowing ? 'bg-red-500 shadow-[0_0_10px_#EF4444] animate-pulse' : 'bg-red-800'}`}></div>
                              )}
                              {isLedCathode && (
                                <div className="absolute -top-1 w-2 h-2 rounded-full bg-slate-500"></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ----------------- CENTER IC DIVIDER TRENCH ----------------- */}
                <div 
                  className="h-3 bg-[#D9DCE2] my-1 rounded-xs border-y border-slate-400 shadow-inner flex items-center justify-center"
                  title="Center DIP IC Isolation Trench"
                >
                  <div className="w-full h-0.5 bg-slate-400/60"></div>
                </div>

                {/* BOTTOM TERMINAL SECTION: COLUMNS f, g, h, i, j */}
                <div className="space-y-1">
                  {BOT_COLS.map(col => (
                    <div key={col} className="flex items-center gap-1">
                      <span className="text-[9px] font-mono font-bold text-slate-400 w-4 text-center uppercase">{col}</span>
                      <div className="flex-1 flex justify-between items-center px-1">
                        {ROWS.map(row => {
                          const holeId = `BB_${row}_${col}`;
                          const isWireStart = activeWiringStart?.id === holeId;
                          const hasWire = wires.some(w => w.fromId === holeId || w.toId === holeId);

                          const isResLead1 = resistor.isPlaced && resistor.lead1.row === row && resistor.lead1.col === col;
                          const isResLead2 = resistor.isPlaced && resistor.lead2.row === row && resistor.lead2.col === col;
                          const isLedAnode = led.isPlaced && led.anode.row === row && led.anode.col === col;
                          const isLedCathode = led.isPlaced && led.cathode.row === row && led.cathode.col === col;

                          return (
                            <div 
                              key={holeId}
                              onClick={() => handleTerminalClick(holeId, `Row ${row} (${col})`, row, col)}
                              className={`relative w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                                isWireStart
                                  ? 'bg-blue-500 ring-2 ring-white scale-125 z-20'
                                  : hasWire
                                  ? 'bg-blue-600 ring-1 ring-blue-300'
                                  : isResLead1 || isResLead2
                                  ? 'bg-amber-600 ring-2 ring-amber-300'
                                  : isLedAnode
                                  ? 'bg-red-600 ring-2 ring-red-300'
                                  : isLedCathode
                                  ? 'bg-slate-700 ring-2 ring-slate-400'
                                  : 'bg-[#1E293B]/90 border border-slate-500 hover:border-blue-400 hover:scale-110'
                              }`}
                              title={`Breadboard Row ${row} (${col})`}
                            >
                              <div className="w-1.5 h-1.5 rounded-xs bg-[#0F172A] shadow-inner"></div>

                              {(isResLead1 || isResLead2) && (
                                <div className="absolute -bottom-1 w-2 h-2 rounded-full bg-amber-400 shadow-xs"></div>
                              )}
                              {isLedAnode && (
                                <div className={`absolute -bottom-2 w-3 h-3 rounded-full ${isLedGlowing ? 'bg-red-500 shadow-[0_0_10px_#EF4444] animate-pulse' : 'bg-red-800'}`}></div>
                              )}
                              {isLedCathode && (
                                <div className="absolute -bottom-1 w-2 h-2 rounded-full bg-slate-500"></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Row Numbers Silkscreen */}
                <div className="flex items-center pl-6 pr-2 justify-between text-[8px] font-mono font-bold text-slate-500 select-none pt-0.5">
                  {ROWS.map(r => (
                    <span key={`rb_${r}`} className={`w-3.5 text-center ${r % 5 === 0 ? 'text-slate-800 font-black' : 'text-slate-400'}`}>
                      {r % 5 === 0 || r === 1 ? r : '·'}
                    </span>
                  ))}
                </div>

              </div>

              {/* ----------------- BOTTOM POWER RAILS (- BLUE / + RED) ----------------- */}
              <div className="space-y-1 pt-2 border-t border-slate-300">
                {/* Bottom Negative (-) */}
                <div className="flex items-center gap-1">
                  <span className="text-blue-600 font-black text-xs w-4 text-center select-none">-</span>
                  <div className="flex-1 flex justify-between items-center bg-blue-50/50 py-0.5 px-2 rounded-xs border-y border-blue-200">
                    {POWER_GROUPS.map(num => (
                      <div 
                        key={`bn_${num}`}
                        onClick={() => handleTerminalClick(`PWR_BOT_NEG_${num}`, `Bottom (-) Rail [${num}]`)}
                        className={`w-2.5 h-2.5 rounded-xs border cursor-pointer transition-all ${
                          activeWiringStart?.id === `PWR_BOT_NEG_${num}`
                            ? 'bg-blue-500 ring-2 ring-white scale-125'
                            : 'bg-slate-900/90 border-slate-600 hover:bg-blue-500'
                        }`}
                        title={`Bottom Negative Rail Hole ${num}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Bottom Positive (+) */}
                <div className="flex items-center gap-1">
                  <span className="text-rose-600 font-black text-xs w-4 text-center select-none">+</span>
                  <div className="flex-1 flex justify-between items-center bg-rose-50/50 py-0.5 px-2 rounded-xs border-y border-rose-200">
                    {POWER_GROUPS.map(num => (
                      <div 
                        key={`bp_${num}`}
                        onClick={() => handleTerminalClick(`PWR_BOT_POS_${num}`, `Bottom (+) Rail [${num}]`)}
                        className={`w-2.5 h-2.5 rounded-xs border cursor-pointer transition-all ${
                          activeWiringStart?.id === `PWR_BOT_POS_${num}`
                            ? 'bg-rose-500 ring-2 ring-white scale-125'
                            : 'bg-slate-900/90 border-slate-600 hover:bg-rose-500'
                        }`}
                        title={`Bottom Positive Rail Hole ${num}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Bottom Active Wires List Bar */}
          <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-4 text-xs font-mono overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-slate-400 uppercase text-[10px]">Connected Jumper Wires ({wires.length}):</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {wires.map(w => (
                <div 
                  key={w.id} 
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: w.color }}></span>
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
                <span className="text-slate-600 italic">No jumper wires connected. Click pins & holes to wire.</span>
              )}
            </div>
          </div>

        </div>

        {/* ==================== RIGHT: VISUAL BLOCK CODING STUDIO ==================== */}
        <div className="w-full lg:w-[460px] bg-[#090E1A] flex flex-col shrink-0 border-t lg:border-t-0 border-slate-800">
          
          {/* Header */}
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Puzzle size={16} className="text-pixiu-blue" />
              <span className="font-extrabold text-white text-sm">Visual Block Coding Studio</span>
            </div>

            <button
              onClick={() => setShowCppCode(!showCppCode)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
            >
              <Code size={13} />
              <span>{showCppCode ? 'Back to Blocks' : 'View C++ Code'}</span>
            </button>
          </div>

          {/* BLOCK CANVAS */}
          {!showCppCode ? (
            <div className="flex-1 p-4 flex flex-col space-y-4 overflow-y-auto">
              
              {/* Event Block */}
              <div className="bg-[#EAB308]/20 border-2 border-[#EAB308] rounded-2xl p-3 shadow-md">
                <div className="flex items-center gap-2 font-bold text-xs text-yellow-300">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse"></div>
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
                        className={`rounded-2xl p-3 text-xs font-bold border-2 transition-all flex items-center justify-between gap-2 shadow-md ${
                          isActive 
                            ? 'bg-blue-600 border-cyan-300 text-white shadow-[0_0_20px_#38BDF8] scale-[1.02]' 
                            : 'bg-blue-600/90 hover:bg-blue-600 border-blue-400/80 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Zap size={15} className={isActive ? 'text-yellow-300 animate-bounce' : 'text-white'} />
                          <span>Set Digital Pin</span>
                          
                          <select 
                            value={block.pin}
                            onChange={(e) => updateBlock(block.id, 'pin', e.target.value)}
                            className="bg-blue-900 border border-blue-400 rounded-lg px-2 py-1 text-white font-bold cursor-pointer text-xs"
                          >
                            <option value="13">Pin 13 (Built-in LED)</option>
                            <option value="12">Pin 12</option>
                            <option value="11">Pin 11</option>
                          </select>

                          <span>to</span>

                          <select 
                            value={block.state}
                            onChange={(e) => updateBlock(block.id, 'state', e.target.value)}
                            className="bg-blue-900 border border-blue-400 rounded-lg px-2 py-1 text-white font-bold cursor-pointer text-xs"
                          >
                            <option value="HIGH">HIGH (💡 5V On)</option>
                            <option value="LOW">LOW (🌑 0V Off)</option>
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
                        className={`rounded-2xl p-3 text-xs font-bold border-2 transition-all flex items-center justify-between gap-2 shadow-md ${
                          isActive 
                            ? 'bg-amber-600 border-yellow-300 text-white shadow-[0_0_20px_#F59E0B] scale-[1.02]' 
                            : 'bg-amber-600/90 hover:bg-amber-600 border-amber-400/80 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock size={15} className={isActive ? 'text-white animate-spin' : 'text-white'} />
                          <span>Wait</span>

                          <input 
                            type="number"
                            min="0.1"
                            max="10"
                            step="0.5"
                            value={block.duration}
                            onChange={(e) => updateBlock(block.id, 'duration', parseFloat(e.target.value) || 1)}
                            className="w-16 bg-amber-900 border border-amber-400 rounded-lg px-2 py-1 text-white text-center font-bold text-xs"
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
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <RotateCcw size={14} className="text-cyan-400" />
                  <span className="font-bold text-slate-300">Repeat Program in Infinite Loop</span>
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
                  className="flex-1 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={14} /> Add Set Pin Block
                </button>
                <button
                  onClick={() => addBlock('wait')}
                  className="flex-1 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={14} /> Add Wait Delay Block
                </button>
              </div>

              {/* Serial Output */}
              <div className="mt-auto pt-2 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">AVR Core 16MHz Telemetry:</span>
                <div className="h-28 bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-[10px] text-emerald-400 overflow-y-auto space-y-0.5 shadow-inner">
                  {serialLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                  {serialLogs.length === 0 && (
                    <div className="text-slate-600 italic">Serial ready. Setup circuit and click 'Run Simulation'...</div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 p-4 flex flex-col space-y-3 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px] font-bold text-emerald-400">Compiled sketch.ino (16MHz AVR GCC)</span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono">Auto-Generated</span>
              </div>
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-3 font-mono text-xs text-slate-200 overflow-auto shadow-inner leading-relaxed">
                <pre>{generatedCppCode}</pre>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* ==================== 3D X-RAY ANATOMY MODAL ==================== */}
      {xrayModalComponent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#0e1628] to-[#070b14] border-2 border-cyan-500/40 w-full max-w-2xl rounded-3xl p-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                  <Eye size={18} />
                </span>
                <div>
                  <h3 className="text-base font-black text-white">
                    {xrayModalComponent === 'bulb' && '3D LED Bulb Anatomy & Quantum Electroluminescence'}
                    {xrayModalComponent === 'breadboard' && '3D Breadboard Internal Spring-Clip Architecture'}
                    {xrayModalComponent === 'resistor' && "3D 220Ω Resistor Spiral Core & Ohm's Law Physics"}
                    {xrayModalComponent === 'arduino' && 'ATmega328P Silicon Micro-Architecture (Die, RAM, ROM, Clock)'}
                  </h3>
                  <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-widest">
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

            <div className="flex-1 overflow-y-auto py-5 space-y-6 text-xs text-slate-300">
              {/* LED BULB */}
              {xrayModalComponent === 'bulb' && (
                <div className="space-y-5">
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-6">
                    <div className="w-52 h-44 bg-gradient-to-b from-red-950 to-slate-900 border border-red-500/40 rounded-xl p-3 relative flex flex-col justify-between overflow-hidden shadow-inner">
                      <div className="text-[9px] font-mono font-bold text-red-400 text-center">
                        P-N JUNCTION SEMICONDUCTOR CHIP
                      </div>

                      <div className="flex items-center justify-around my-auto">
                        <div className="text-center">
                          <span className="text-[8px] text-blue-400 block font-bold">N-REGION</span>
                          <div className="w-8 h-8 rounded-full bg-blue-500/30 border border-blue-400 flex items-center justify-center font-mono text-[9px] font-bold text-blue-200 animate-pulse">
                            e⁻ e⁻
                          </div>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-amber-300 font-black text-xs animate-bounce">⚡ hν</span>
                          <span className="text-[8px] text-red-400 font-mono">Photon λ=660nm</span>
                        </div>

                        <div className="text-center">
                          <span className="text-[8px] text-rose-400 block font-bold">P-REGION</span>
                          <div className="w-8 h-8 rounded-full bg-rose-500/30 border border-rose-400 flex items-center justify-center font-mono text-[9px] font-bold text-rose-200 animate-pulse">
                            h⁺ h⁺
                          </div>
                        </div>
                      </div>

                      <div className="text-[8px] font-mono text-center text-slate-400">
                        Electron recombines with hole ➔ Releases Photon of Light!
                      </div>
                    </div>

                    <div className="space-y-2 text-left">
                      <div className="font-bold text-white text-xs">5 Anatomical Layers of an LED:</div>
                      <ul className="space-y-1.5 text-slate-300 text-[11px]">
                        <li><strong className="text-red-400">1. Epoxy Dome:</strong> Optical lens focusing emitted light forward.</li>
                        <li><strong className="text-amber-400">2. Anvil (Cathode -):</strong> Reflective cup holding the semiconductor chip.</li>
                        <li><strong className="text-blue-400">3. Post (Anode +):</strong> Connects longer positive lead to the power rail.</li>
                        <li><strong className="text-yellow-400">4. Gold Whisker Wire:</strong> Ultra-fine wire passing current to the die.</li>
                        <li><strong className="text-emerald-400">5. GaAsP Crystal Die:</strong> Gallium Arsenide Phosphide chip emitting light.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Sparkles size={14} className="text-yellow-400" />
                      How It Actually Glows Behind the Scenes:
                    </h4>
                    <p className="leading-relaxed text-[11px] text-slate-300">
                      Unlike an incandescent bulb that burns a filament with heat, an LED uses <strong>cold solid-state electroluminescence</strong>. When voltage is applied, electrons from the N-region cross the energy bandgap and fall into holes in the P-region. As each electron drops into a lower energy state, it conserves energy by emitting a discrete quantum packet of electromagnetic radiation: a <strong>Photon of Light</strong> (E = h × c / λ).
                    </p>
                  </div>
                </div>
              )}

              {/* BREADBOARD CLIPS */}
              {xrayModalComponent === 'breadboard' && (
                <div className="space-y-5">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-center space-y-4">
                    <div className="font-bold text-white text-xs">Internal Phosphor-Bronze Spring Clip Matrix</div>
                    
                    <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center gap-4">
                      {['a', 'b', 'c', 'd', 'e'].map((col, i) => (
                        <div key={i} className="text-center">
                          <div className="w-8 h-8 rounded-lg bg-amber-400 border border-amber-200 text-black font-mono font-black text-xs flex items-center justify-center shadow-md">
                            {col}
                          </div>
                          <span className="text-[8px] font-mono text-amber-300 mt-1 block">Tied</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed max-w-lg mx-auto">
                      Beneath the off-white plastic casing are nickel-plated phosphor-bronze metal spring clips. All 5 socket holes in row 15 (columns a-b-c-d-e) touch the <strong>same single piece of metal</strong>. That is why plugging a resistor leg in 15c and an LED leg in 15d electrically connects them together without any soldering!
                    </p>
                  </div>
                </div>
              )}

              {/* RESISTOR */}
              {xrayModalComponent === 'resistor' && (
                <div className="space-y-5">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-6">
                    <div className="w-48 h-28 bg-[#966F3D]/20 border border-amber-600/40 rounded-xl p-3 flex flex-col items-center justify-center">
                      <div className="font-mono text-[9px] text-amber-400 font-bold mb-1">SPIRAL CARBON FILM</div>
                      <div className="font-mono text-lg font-black text-white tracking-widest">
                        220 Ω
                      </div>
                      <span className="text-[8px] text-slate-400 font-mono">Laser-cut spiral determines resistance</span>
                    </div>

                    <div className="space-y-2">
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
                <div className="space-y-5">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-white text-xs">Inside the ATmega328P Microcontroller Silicon Die</span>
                      <span className="font-mono text-[10px] text-cyan-400 font-bold">16 MIPS @ 16 MHz</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                      <div className="p-2.5 bg-blue-950/60 border border-blue-500/40 rounded-xl">
                        <div className="text-[10px] text-blue-300 font-bold">FLASH ROM</div>
                        <div className="text-base font-black text-white">32 KB</div>
                        <div className="text-[8px] text-slate-400">Stores Block Code</div>
                      </div>

                      <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl">
                        <div className="text-[10px] text-emerald-300 font-bold">SRAM</div>
                        <div className="text-base font-black text-white">2 KB</div>
                        <div className="text-[8px] text-slate-400">Scratchpad Variables</div>
                      </div>

                      <div className="p-2.5 bg-purple-950/60 border border-purple-500/40 rounded-xl">
                        <div className="text-[10px] text-purple-300 font-bold">EEPROM</div>
                        <div className="text-base font-black text-white">1 KB</div>
                        <div className="text-[8px] text-slate-400">Permanent Storage</div>
                      </div>

                      <div className="p-2.5 bg-amber-950/60 border border-amber-500/40 rounded-xl">
                        <div className="text-[10px] text-amber-300 font-bold">RISC ALU</div>
                        <div className="text-base font-black text-white">8-BIT</div>
                        <div className="text-[8px] text-slate-400">Math & Logic Unit</div>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-left space-y-1.5 text-[11px]">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Radio size={14} className="text-cyan-400 animate-pulse" />
                        The 16.000 MHz Quartz Heartbeat:
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        A thin slice of quartz crystal vibrates exactly <strong>16,000,000 times per second</strong> due to the inverse piezoelectric effect. Every tick advances the Program Counter (PC), fetching one instruction of your block code from Flash memory and executing it in 62.5 nanoseconds!
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="pt-3 border-t border-slate-700/80 flex justify-end">
              <button
                onClick={() => setXrayModalComponent(null)}
                className="px-5 py-2 bg-pixiu-blue hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
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
