import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Cpu, Play, Square, RotateCcw, ShieldAlert, Lock, ArrowLeft, 
  Sparkles, CheckCircle2, Eye, Zap, Plus, Trash2, Code, Puzzle, 
  X, Radio, Clock, ArrowRight, Layers, HelpCircle
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

  // ==================== COMPONENT TRAY STATE (PULL & PUSH) ====================
  // 1. 220Ω Resistor: inTray or onBreadboard (spanning Row 8 and Row 12)
  const [resistorState, setResistorState] = useState('breadboard'); // 'tray' | 'breadboard'
  
  // 2. 5mm Red LED Bulb: inTray or onBreadboard (Anode in Row 12, Cathode in Row 16)
  const [ledState, setLedState] = useState('breadboard'); // 'tray' | 'breadboard'

  // ==================== MANUAL PIN-TO-HOLE WIRING ENGINE ====================
  // Wires array: [{ id, from, to, fromName, toName, color }]
  const [wires, setWires] = useState([
    { id: 'w1', from: 'ARD_13', to: 'BB_8', fromName: 'Pin 13', toName: 'Breadboard Row 8', color: '#3B82F6' },
    { id: 'w2', from: 'BB_16', to: 'ARD_GND', fromName: 'Breadboard Row 16', toName: 'Arduino GND', color: '#0F172A' }
  ]);
  const [selectedWireColor, setSelectedWireColor] = useState('#3B82F6');
  const [pendingWireStart, setPendingWireStart] = useState(null); // { id, name }

  // Quick Wire Color Palette
  const WIRE_COLORS = [
    { label: 'Blue', hex: '#3B82F6' },
    { label: 'Black (GND)', hex: '#0F172A' },
    { label: 'Red (5V)', hex: '#EF4444' },
    { label: 'Yellow', hex: '#F59E0B' },
    { label: 'Green', hex: '#10B981' }
  ];

  // Handle clicking a pin on Arduino or hole on Breadboard
  const handleNodeClick = (nodeId, nodeName) => {
    if (!pendingWireStart) {
      // Start wire
      setPendingWireStart({ id: nodeId, name: nodeName });
      showToast(`Started wire from ${nodeName}. Click destination to connect.`, 'Wiring Active', 'info');
    } else {
      // End wire
      if (pendingWireStart.id === nodeId) {
        setPendingWireStart(null);
        return;
      }

      // Check if duplicate wire exists
      const exists = wires.some(w => 
        (w.from === pendingWireStart.id && w.to === nodeId) || 
        (w.from === nodeId && w.to === pendingWireStart.id)
      );

      if (exists) {
        showToast('A jumper wire already connects these two points.', 'Already Connected', 'info');
        setPendingWireStart(null);
        return;
      }

      const newWire = {
        id: 'w_' + Date.now(),
        from: pendingWireStart.id,
        to: nodeId,
        fromName: pendingWireStart.name,
        toName: nodeName,
        color: selectedWireColor
      };

      setWires(prev => [...prev, newWire]);
      showToast(`Connected ${pendingWireStart.name} ➔ ${nodeName}`, 'Wire Connected', 'success');
      setPendingWireStart(null);
    }
  };

  const removeWire = (wireId) => {
    setWires(prev => prev.filter(w => w.id !== wireId));
    showToast('Jumper wire pulled out and removed.', 'Wire Removed', 'info');
  };

  const handleClearAllWires = () => {
    setWires([]);
    setPendingWireStart(null);
    setIsRunning(false);
    showToast('All wires removed from the workbench.', 'Workbench Cleared', 'info');
  };

  const handleAutoWire = () => {
    setResistorState('breadboard');
    setLedState('breadboard');
    setWires([
      { id: 'w1', from: 'ARD_13', to: 'BB_8', fromName: 'Pin 13', toName: 'Breadboard Row 8', color: '#3B82F6' },
      { id: 'w2', from: 'BB_16', to: 'ARD_GND', fromName: 'Breadboard Row 16', toName: 'Arduino GND', color: '#0F172A' }
    ]);
    showToast('Standard 220Ω LED circuit auto-wired correctly.', 'Auto-Wired Complete', 'success');
  };

  // ==================== CIRCUIT CONTINUITY & ELECTRICAL SOLVER ====================
  // Check if:
  // 1. Resistor is on breadboard (spans Row 8 and Row 12)
  // 2. LED is on breadboard (Anode in Row 12, Cathode in Row 16)
  // 3. Pin 13 is connected to Row 8
  // 4. Arduino GND is connected to Row 16
  const hasResistor = resistorState === 'breadboard';
  const hasLed = ledState === 'breadboard';

  const hasPin13ToRow8 = wires.some(w => 
    (w.from === 'ARD_13' && w.to === 'BB_8') || (w.from === 'BB_8' && w.to === 'ARD_13')
  );

  const hasRow16ToGnd = wires.some(w => 
    (w.from === 'BB_16' && w.to === 'ARD_GND') || (w.from === 'ARD_GND' && w.to === 'BB_16')
  );

  const isCircuitClosed = hasResistor && hasLed && hasPin13ToRow8 && hasRow16ToGnd;

  // Diagnostic feedback message for students
  const circuitStatusText = useMemo(() => {
    if (!hasResistor && !hasLed) return '⚠️ Both Resistor and LED are in the tray! Push them to the breadboard.';
    if (!hasResistor) return '⚠️ Missing Resistor! Push 220Ω resistor from tray to Breadboard Row 8 & 12.';
    if (!hasLed) return '⚠️ Missing LED Bulb! Push Red LED from tray to Breadboard Row 12 & 16.';
    if (!hasPin13ToRow8 && !hasRow16ToGnd) return '⚠️ Missing Jumper Wires: Connect Pin 13 ➔ Row 8 and Row 16 ➔ GND.';
    if (!hasPin13ToRow8) return '⚠️ Missing Power Wire: Connect Arduino Pin 13 to Breadboard Row 8.';
    if (!hasRow16ToGnd) return '⚠️ Missing Ground Wire: Connect Breadboard Row 16 (LED Cathode) to Arduino GND.';
    return '✅ Complete Closed Loop! Current flows: Pin 13 ➔ Row 8 ➔ Resistor ➔ Row 12 ➔ LED ➔ Row 16 ➔ GND.';
  }, [hasResistor, hasLed, hasPin13ToRow8, hasRow16ToGnd]);

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
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin ${block.pin} HIGH ➔ 💡 LED Bulb Glows!`]);
          } else if (isHigh && !isCircuitClosed) {
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin 13 is HIGH, but circuit is OPEN (no current)`]);
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
        showToast('Circuit is not complete! Connect Pin 13 ➔ Resistor ➔ LED ➔ GND to see it glow.', 'Circuit Incomplete', 'info');
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
                Pixiu Cyber-Lab • 3D Arduino Workbench
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                Hands-On Wire & Solderless Breadboard
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Session: <strong className="text-slate-200">{activeUser?.name || activeUser?.username || 'Authorized User'}</strong> ({activeRole?.toUpperCase() || 'MEMBER'})
            </p>
          </div>
        </div>

        {/* Master Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoWire}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Automatically place parts & connect wires for standard circuit"
          >
            <Sparkles size={14} className="text-amber-400" />
            <span className="hidden sm:inline">Auto-Wire Standard Circuit</span>
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
        
        {/* ==================== LEFT: INTERACTIVE 3D WORKBENCH ==================== */}
        <div className="flex-1 flex flex-col bg-[#070C18] relative overflow-auto select-none">
          
          {/* Top Workbench Toolbar: Wiring Mode & Continuity Status */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs z-10">
            {/* Electrical Continuity Bar */}
            <div className="flex items-center gap-2 max-w-lg">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border shrink-0 ${
                isCircuitClosed 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isCircuitClosed ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {isCircuitClosed ? 'Closed Loop' : 'Open Circuit'}
              </span>
              <p className="text-[11px] text-slate-300 truncate" title={circuitStatusText}>
                {circuitStatusText}
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

              {pendingWireStart && (
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] animate-pulse">
                  Wiring from: {pendingWireStart.name}
                </span>
              )}
            </div>
          </div>

          {/* ================= COMPONENT PARTS TRAY (PULL & PUSH DOCK) ================= */}
          <div className="px-6 pt-4 pb-2">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-cyan-400" />
                <div>
                  <span className="text-xs font-black text-white block">PARTS TRAY (PULL & PUSH)</span>
                  <span className="text-[10px] text-slate-400">Push components onto breadboard or pull them back out</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* 1. 220Ω Resistor Tray Card */}
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
                      {resistorState === 'breadboard' ? 'Inserted: Row 8 & 12' : 'In Tray'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (resistorState === 'breadboard') {
                        setResistorState('tray');
                        showToast('Pulled 220Ω Resistor out of breadboard back into tray.', 'Pulled to Tray', 'info');
                      } else {
                        setResistorState('breadboard');
                        showToast('Pushed 220Ω Resistor into Breadboard Rows 8 & 12.', 'Pushed to Breadboard', 'success');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      resistorState === 'breadboard' 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {resistorState === 'breadboard' ? 'Pull Out' : 'Push to Board ➔'}
                  </button>
                  <button
                    onClick={() => setXrayModalComponent('resistor')}
                    className="p-1 text-slate-400 hover:text-amber-400 cursor-pointer"
                    title="X-Ray 3D Dissection of Resistor"
                  >
                    <Eye size={13} />
                  </button>
                </div>

                {/* 2. 5mm Red LED Bulb Tray Card */}
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <div className={`w-4 h-6 rounded-t-full rounded-b-xs border flex items-center justify-center ${
                    isLedGlowing ? 'bg-red-500 border-red-300 shadow-[0_0_10px_#EF4444]' : 'bg-red-900 border-red-800'
                  }`}>
                    <div className="w-1.5 h-2 bg-white/40 rounded-full"></div>
                  </div>
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-white block">5mm Red LED</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {ledState === 'breadboard' ? 'Inserted: Row 12 & 16' : 'In Tray'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (ledState === 'breadboard') {
                        setLedState('tray');
                        showToast('Pulled LED Bulb out of breadboard back into tray.', 'Pulled to Tray', 'info');
                      } else {
                        setLedState('breadboard');
                        showToast('Pushed Red LED Bulb into Breadboard Rows 12 & 16.', 'Pushed to Breadboard', 'success');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      ledState === 'breadboard' 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                        : 'bg-red-600 hover:bg-red-500 text-white'
                    }`}
                  >
                    {ledState === 'breadboard' ? 'Pull Out' : 'Push to Board ➔'}
                  </button>
                  <button
                    onClick={() => setXrayModalComponent('bulb')}
                    className="p-1 text-slate-400 hover:text-red-400 cursor-pointer"
                    title="X-Ray 3D Dissection of LED Bulb"
                  >
                    <Eye size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ================= 3D WORKBENCH SURFACE WITH ARDUINO & SEPARATE BREADBOARD ================= */}
          <div className="flex-1 p-6 flex items-center justify-center relative min-h-[580px] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
            
            {/* Workbench Anti-Static Mat */}
            <div className="relative w-full max-w-5xl bg-gradient-to-br from-[#0c1424] via-[#090f1d] to-[#050912] rounded-3xl p-6 sm:p-8 border border-slate-700/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-center justify-between gap-8">
              
              {/* SVG JUMPER WIRES OVERLAY LAYER */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                {wires.map((wire) => {
                  // Approximate coordinates for visually stunning 3D curved wires
                  const isPin13ToRow8 = (wire.from === 'ARD_13' && wire.to === 'BB_8') || (wire.from === 'BB_8' && wire.to === 'ARD_13');
                  const isRow16ToGnd = (wire.from === 'BB_16' && wire.to === 'ARD_GND') || (wire.from === 'ARD_GND' && wire.to === 'BB_16');

                  if (isPin13ToRow8) {
                    // Curved wire from Arduino Pin 13 to Breadboard Row 8
                    return (
                      <g key={wire.id} className="pointer-events-auto cursor-pointer group" onClick={() => removeWire(wire.id)}>
                        <title>Click to pull/remove jumper wire ({wire.fromName} ➔ {wire.toName})</title>
                        {/* Shadow */}
                        <path 
                          d="M 230 110 C 350 40, 480 70, 560 175" 
                          fill="none" 
                          stroke="rgba(0,0,0,0.5)" 
                          strokeWidth="7" 
                          strokeLinecap="round"
                        />
                        {/* Real Wire */}
                        <path 
                          d="M 230 106 C 350 36, 480 66, 560 171" 
                          fill="none" 
                          stroke={wire.color} 
                          strokeWidth="4" 
                          strokeLinecap="round"
                          className="transition-all group-hover:stroke-white group-hover:stroke-5"
                        />
                        {/* Terminal Sleeves */}
                        <circle cx="230" cy="106" r="4.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
                        <circle cx="560" cy="171" r="4.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
                      </g>
                    );
                  }

                  if (isRow16ToGnd) {
                    // Curved wire from Breadboard Row 16 to Arduino GND
                    return (
                      <g key={wire.id} className="pointer-events-auto cursor-pointer group" onClick={() => removeWire(wire.id)}>
                        <title>Click to pull/remove jumper wire ({wire.fromName} ➔ {wire.toName})</title>
                        {/* Shadow */}
                        <path 
                          d="M 560 300 C 460 420, 320 380, 210 395" 
                          fill="none" 
                          stroke="rgba(0,0,0,0.5)" 
                          strokeWidth="7" 
                          strokeLinecap="round"
                        />
                        {/* Real Wire */}
                        <path 
                          d="M 560 296 C 460 416, 320 376, 210 391" 
                          fill="none" 
                          stroke={wire.color} 
                          strokeWidth="4" 
                          strokeLinecap="round"
                          className="transition-all group-hover:stroke-white group-hover:stroke-5"
                        />
                        {/* Terminal Sleeves */}
                        <circle cx="560" cy="296" r="4.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
                        <circle cx="210" cy="391" r="4.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
                      </g>
                    );
                  }

                  return null;
                })}
              </svg>

              {/* ================= 1. STANDALONE 3D ARDUINO UNO R3 BOARD ================= */}
              <div 
                className="relative w-[300px] h-[400px] bg-[#005B60] rounded-2xl border-[3px] border-[#008184] shadow-[12px_18px_30px_rgba(0,0,0,0.8)] p-4 flex flex-col justify-between shrink-0 group transition-transform duration-300 select-none z-10"
                style={{
                  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.2), inset 0 -4px 6px rgba(0, 0, 0, 0.5)'
                }}
              >
                {/* 3D Depth Bevel */}
                <div className="absolute inset-0 rounded-2xl border-b-4 border-r-4 border-[#00383B] pointer-events-none"></div>

                {/* Silver Metal USB-B Connector */}
                <div className="absolute -top-3.5 left-5 w-14 h-9 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 rounded-t-md border border-slate-400 shadow-md flex items-center justify-center">
                  <div className="w-8 h-4 bg-slate-800 rounded-xs border border-slate-600"></div>
                </div>

                {/* Black DC Power Barrel Jack */}
                <div className="absolute -bottom-4 left-5 w-12 h-10 bg-gradient-to-b from-slate-900 to-black rounded-b-md border border-slate-700 shadow-lg flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-500"></div>
                </div>

                {/* Red Tactile Reset Button */}
                <button 
                  onClick={handleReset}
                  className="absolute top-4 left-22 w-5 h-5 rounded-full bg-gradient-to-b from-red-500 to-red-700 border-2 border-red-300 shadow-md active:scale-90 transition-transform cursor-pointer"
                  title="Hardware Reset"
                />

                {/* Top Digital Pin Header */}
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
                  
                  {/* Digital Pin Sockets */}
                  <div className="h-7 bg-[#111] border-2 border-slate-800 rounded-md px-1.5 flex items-center justify-between shadow-inner">
                    {[
                      { id: 'ARD_AREF', label: 'AREF' },
                      { id: 'ARD_GND_TOP', label: 'GND' },
                      { id: 'ARD_13', label: '13', active: pin13Output, isPin13: true },
                      { id: 'ARD_12', label: '12' },
                      { id: 'ARD_11', label: '11' },
                      { id: 'ARD_10', label: '10' },
                      { id: 'ARD_9', label: '9' },
                      { id: 'ARD_8', label: '8' }
                    ].map((pin, i) => (
                      <div 
                        key={i} 
                        onClick={() => handleNodeClick(pin.id, `Arduino Pin ${pin.label}`)}
                        className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                          pendingWireStart?.id === pin.id
                            ? 'ring-2 ring-white scale-125 bg-blue-500'
                            : pin.active 
                            ? 'bg-amber-400 shadow-[0_0_10px_#F59E0B] scale-110' 
                            : pin.isPin13 && hasPin13ToRow8
                            ? 'bg-blue-600 border border-blue-300'
                            : 'bg-black border border-slate-700 hover:border-cyan-400'
                        }`}
                        title={`Click to connect wire to Pin ${pin.label}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-xs bg-slate-900"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Middle Board Center: Branding + 16MHz Crystal + ATmega328P */}
                <div className="my-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black tracking-wider text-white block">PIXIU UNO</span>
                      <span className="text-[8px] font-mono text-cyan-200">STANDALONE R3</span>
                    </div>

                    <div 
                      className="w-10 h-5 bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400 rounded-full border border-slate-400 shadow-md flex items-center justify-center font-mono text-[6px] font-bold text-slate-700"
                      title="16.000 MHz Quartz Clock"
                    >
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
                    className="w-full bg-[#161616] border-2 border-slate-700 rounded-lg p-2 flex flex-col justify-between shadow-[0_6px_12px_rgba(0,0,0,0.8)] cursor-pointer hover:border-cyan-400 transition-colors group/chip"
                    title="Click for 3D Dissection: Flash ROM, SRAM, ALU, 16MHz Crystal"
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="w-2 h-2 rounded-full border border-slate-600 bg-slate-900"></div>
                      <span className="font-mono text-[8px] font-bold tracking-widest text-slate-400 group-hover/chip:text-cyan-300">
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
                      { id: 'ARD_GND', label: 'GND', isGnd: true },
                      { id: 'ARD_GND2', label: 'GND', isGnd: true },
                      { id: 'ARD_VIN', label: 'VIN' },
                      { id: 'ARD_A0', label: 'A0' },
                      { id: 'ARD_A1', label: 'A1' },
                      { id: 'ARD_A2', label: 'A2' }
                    ].map((pin, i) => (
                      <div 
                        key={i} 
                        onClick={() => handleNodeClick(pin.id, `Arduino ${pin.label}`)}
                        className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                          pendingWireStart?.id === pin.id
                            ? 'ring-2 ring-white scale-125 bg-emerald-500'
                            : pin.isGnd && hasRow16ToGnd
                            ? 'bg-slate-800 border-2 border-slate-400'
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

              {/* ================= 2. SEPARATE STANDALONE 3D SOLDERLESS BREADBOARD ================= */}
              <div 
                className="relative w-[340px] bg-[#EFEFEF] rounded-2xl border-[3px] border-slate-300 p-4 shadow-[12px_18px_30px_rgba(0,0,0,0.8)] flex flex-col justify-between select-none z-10 group"
                style={{
                  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.9), inset 0 -4px 6px rgba(0, 0, 0, 0.15)'
                }}
              >
                {/* 3D Depth Bevel */}
                <div className="absolute inset-0 rounded-2xl border-b-4 border-r-4 border-slate-400/80 pointer-events-none"></div>

                {/* Breadboard Header */}
                <div className="flex items-center justify-between mb-2 border-b border-slate-300 pb-1.5">
                  <div>
                    <span className="text-xs font-black text-slate-800 block">SEPARATE BREADBOARD</span>
                    <span className="text-[8px] font-mono text-slate-500">400 TIE-POINT MATRIX</span>
                  </div>
                  <button
                    onClick={() => setXrayModalComponent('breadboard')}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[9px] font-bold flex items-center gap-1 border border-slate-300 transition-colors cursor-pointer"
                    title="View internal spring clips"
                  >
                    <Eye size={11} /> X-Ray Clips
                  </button>
                </div>

                {/* Power Rails (+ and -) */}
                <div className="flex justify-between items-center px-1 mb-2">
                  <div className="flex items-center gap-1">
                    <span className="text-rose-600 font-bold text-xs">+</span>
                    <div className="w-32 h-0.5 bg-rose-500 rounded-full"></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-32 h-0.5 bg-blue-600 rounded-full"></div>
                    <span className="text-blue-600 font-bold text-xs">-</span>
                  </div>
                </div>

                {/* BREADBOARD TIE-POINT ROWS GRID (Interactive Holes) */}
                <div className="relative bg-[#E5E7EB] border border-slate-300 rounded-xl p-3 my-1 space-y-2.5 shadow-inner">
                  
                  {/* Visual Placed Components on Breadboard */}
                  {/* COMPONENT A: Pushed Resistor across Row 8 and Row 12 */}
                  {resistorState === 'breadboard' && (
                    <div 
                      onClick={() => setXrayModalComponent('resistor')}
                      className="absolute top-[38px] left-12 right-12 z-20 flex items-center justify-between pointer-events-auto cursor-pointer hover:scale-105 transition-transform"
                      title="220Ω Resistor plugged into Row 8 and Row 12. Click for X-Ray Dissection."
                    >
                      <div className="w-2 h-2 rounded-full bg-slate-600 border border-slate-400"></div>
                      <div className="flex-1 h-0.5 bg-slate-400"></div>
                      <div className="w-12 h-5 bg-[#C99C67] rounded-full border border-[#966F3D] shadow-md flex items-center justify-around px-1 relative">
                        <span className="w-1 h-full bg-red-600"></span>
                        <span className="w-1 h-full bg-red-600"></span>
                        <span className="w-1 h-full bg-[#5C3317]"></span>
                        <span className="w-1 h-full bg-[#D4AF37]"></span>
                      </div>
                      <div className="flex-1 h-0.5 bg-slate-400"></div>
                      <div className="w-2 h-2 rounded-full bg-slate-600 border border-slate-400"></div>
                    </div>
                  )}

                  {/* COMPONENT B: Pushed 5mm Red LED Bulb in Row 12 and Row 16 */}
                  {ledState === 'breadboard' && (
                    <div 
                      onClick={() => setXrayModalComponent('bulb')}
                      className="absolute top-[90px] left-16 right-16 z-20 flex flex-col items-center pointer-events-auto cursor-pointer hover:scale-105 transition-transform"
                      title="5mm Red LED Bulb plugged into Row 12 (Anode) and Row 16 (Cathode). Click for X-Ray Dissection."
                    >
                      {/* Luminous Glow when circuit is complete and active */}
                      {isLedGlowing && (
                        <div className="absolute -top-3 w-28 h-28 rounded-full bg-red-500/50 blur-xl animate-pulse pointer-events-none"></div>
                      )}

                      {/* Translucent 3D Red Dome */}
                      <div className={`relative w-11 h-13 rounded-t-full rounded-b-xs border-2 transition-all flex flex-col items-center justify-end pb-1 ${
                        isLedGlowing 
                          ? 'bg-gradient-to-b from-red-500 via-red-600 to-red-700 border-red-300 shadow-[0_0_35px_#EF4444]' 
                          : 'bg-gradient-to-b from-red-900/60 via-red-950/80 to-red-900 border-red-800 opacity-90'
                      }`}>
                        <div className="absolute top-1.5 left-1.5 w-2 h-3.5 rounded-full bg-white/60 blur-[0.5px]"></div>
                        {/* Internal Leadframe */}
                        <div className="w-6 h-6 flex items-end justify-center gap-0.5">
                          <div className={`w-2.5 h-4 bg-slate-300 rounded-t-xs flex items-start justify-center pt-0.5 ${
                            isLedGlowing ? 'shadow-[0_0_8px_#fff]' : ''
                          }`}>
                            <div className={`w-1 h-1 rounded-full ${isLedGlowing ? 'bg-white animate-ping' : 'bg-red-900'}`}></div>
                          </div>
                          <div className="w-1 h-3.5 bg-slate-300 rounded-t-xs"></div>
                        </div>
                      </div>

                      {/* Legs extending into breadboard holes */}
                      <div className="flex justify-between w-14 mt-0.5 text-[7px] font-bold text-slate-600">
                        <span>Anode (12)</span>
                        <span>Cathode (16)</span>
                      </div>
                    </div>
                  )}

                  {/* Interactive Breadboard Rows: 4, 8, 12, 16, 20 */}
                  {[
                    { row: 4, label: 'Row 4', hint: 'Spare Row' },
                    { row: 8, label: 'Row 8 (Resistor In)', isResistorIn: true, connected: hasPin13ToRow8 },
                    { row: 12, label: 'Row 12 (Resistor Out / LED Anode +)', isJunction: true },
                    { row: 16, label: 'Row 16 (LED Cathode -)', isLedGnd: true, connected: hasRow16ToGnd },
                    { row: 20, label: 'Row 20', hint: 'Spare Row' }
                  ].map((r) => (
                    <div 
                      key={r.row}
                      onClick={() => handleNodeClick(`BB_${r.row}`, `Breadboard Row ${r.row}`)}
                      className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                        pendingWireStart?.id === `BB_${r.row}`
                          ? 'bg-blue-200 border-blue-500 scale-105 shadow-md'
                          : r.connected
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-white hover:bg-slate-100 border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-slate-700">
                        <span className="w-5 text-slate-400">[{r.row}]</span>
                        <span>{r.label}</span>
                      </div>

                      {/* 5 Socket Holes a, b, c, d, e */}
                      <div className="flex items-center gap-1">
                        {['a', 'b', 'c', 'd', 'e'].map(h => (
                          <div 
                            key={h} 
                            className={`w-2.5 h-2.5 rounded-xs border shadow-inner ${
                              r.connected ? 'bg-blue-600 border-blue-400' : 'bg-slate-800 border-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                </div>

                {/* Bottom Guide */}
                <div className="pt-1 text-[9px] font-mono text-slate-500 flex items-center justify-between">
                  <span>Columns a-e internally tied</span>
                  <span>Click row to connect wire</span>
                </div>

              </div>

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
              
              {/* Event Container */}
              <div className="bg-[#EAB308]/20 border-2 border-[#EAB308] rounded-2xl p-3 shadow-md">
                <div className="flex items-center gap-2 font-bold text-xs text-yellow-300">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse"></div>
                  <span>🟢 WHEN SIMULATION STARTS</span>
                </div>
              </div>

              {/* Stack of Visual Blocks */}
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

              {/* AVR Core Serial Telemetry */}
              <div className="mt-auto pt-2 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">AVR Core 16MHz Serial Telemetry:</span>
                <div className="h-28 bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-[10px] text-emerald-400 overflow-y-auto space-y-0.5 shadow-inner">
                  {serialLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                  {serialLogs.length === 0 && (
                    <div className="text-slate-600 italic">Serial ready. Wire circuit and click 'Run Simulation'...</div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            /* C++ SKETCH VIEW */
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

      {/* ========================================================================= */}
      {/* ============ 3D X-RAY ANATOMY & QUANTUM PHYSICS DISSECTION MODAL ============ */}
      {/* ========================================================================= */}
      {xrayModalComponent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#0e1628] to-[#070b14] border-2 border-cyan-500/40 w-full max-w-2xl rounded-3xl p-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
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

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-5 space-y-6 text-xs text-slate-300">
              
              {/* LED QUANTUM DISSECTION */}
              {xrayModalComponent === 'bulb' && (
                <div className="space-y-5">
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-6">
                    {/* Animated Quantum P-N Junction Graphic */}
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
                        <li><strong className="text-red-400">1. Epoxy Dome:</strong> Acts as an optical lens focusing emitted light forward.</li>
                        <li><strong className="text-amber-400">2. Anvil (Cathode -):</strong> Holds the reflective cup where the semiconductor chip sits.</li>
                        <li><strong className="text-blue-400">3. Post (Anode +):</strong> Connects the longer positive lead to the power rail.</li>
                        <li><strong className="text-yellow-400">4. Gold Whisker Wire:</strong> Ultra-fine gold wire passing current to the die.</li>
                        <li><strong className="text-emerald-400">5. GaAsP Crystal Die:</strong> Gallium Arsenide Phosphide chip where quantum electroluminescence occurs.</li>
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

              {/* BREADBOARD INTERNAL CLIPS DISSECTION */}
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
                      Beneath the off-white plastic casing are nickel-plated phosphor-bronze metal spring clips. All 5 socket holes in row 12 (columns a-b-c-d-e) touch the <strong>same single piece of metal</strong>. That is why plugging a resistor leg in 12a and an LED leg in 12b electrically connects them together without any soldering!
                    </p>
                  </div>
                </div>
              )}

              {/* RESISTOR DISSECTION */}
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

            {/* Modal Footer */}
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
