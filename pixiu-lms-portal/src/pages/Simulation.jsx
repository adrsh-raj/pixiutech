import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Cpu, Play, Square, RotateCcw, Volume2, VolumeX, BookOpen, 
  Terminal, ShieldAlert, Lock, ArrowLeft, Sparkles, CheckCircle2, 
  AlertTriangle, Info, Eye, Sliders, Layers, ChevronDown, ChevronRight,
  ExternalLink, Download, Compass, Zap, Plus, Trash2, Code, Puzzle,
  Maximize2, X, Activity, Radio, HelpCircle, ArrowRight
} from 'lucide-react';

export default function Simulation() {
  const navigate = useNavigate();

  // 1. Direct Portal Session & Role Resolution via localStorage
  const [activeUser] = useState(() => {
    try {
      const u = localStorage.getItem('pixiu_auth_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
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

  // ==================== CIRCUIT WIRING STATE ====================
  // 3 Required Connections for complete circuit:
  // 1. 'pin13_to_resistor' (Arduino Pin 13 -> Resistor Lead 1)
  // 2. 'resistor_to_led'   (Resistor Lead 2 -> LED Anode / Long Leg)
  // 3. 'led_to_gnd'        (LED Cathode / Short Leg -> Arduino GND)
  const [wires, setWires] = useState({
    pin13_to_resistor: true,
    resistor_to_led: true,
    led_to_gnd: true
  });

  // Circuit Validation Logic
  const isCircuitClosed = wires.pin13_to_resistor && wires.resistor_to_led && wires.led_to_gnd;

  // Toggle wire connection manually for student practice
  const toggleWire = (wireKey) => {
    setWires(prev => {
      const updated = { ...prev, [wireKey]: !prev[wireKey] };
      const closed = updated.pin13_to_resistor && updated.resistor_to_led && updated.led_to_gnd;
      if (closed) {
        showToast('Circuit path complete! Closed electrical loop established.', 'Circuit Closed', 'success');
      } else {
        showToast('Circuit broken! Current cannot flow until all legs are connected.', 'Circuit Open', 'info');
      }
      return updated;
    });
  };

  const handleAutoWire = () => {
    setWires({ pin13_to_resistor: true, resistor_to_led: true, led_to_gnd: true });
    showToast('Standard 220Ω LED Blink circuit auto-wired to Pin 13 & GND.', 'Auto-Wired', 'success');
  };

  const handleClearWires = () => {
    setWires({ pin13_to_resistor: false, resistor_to_led: false, led_to_gnd: false });
    setIsRunning(false);
    showToast('All jumper wires disconnected. Wire the circuit to begin.', 'Wires Removed', 'info');
  };

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

  // Add Block helper
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

  // ==================== SIMULATION ENGINE ====================
  const [isRunning, setIsRunning] = useState(false);
  const [runTimeSec, setRunTimeSec] = useState(0);
  const [ledGlowState, setLedGlowState] = useState(false);
  const [pin13Output, setPin13Output] = useState(false);
  const [serialLogs, setSerialLogs] = useState([]);

  // Block execution runner
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
            setLedGlowState(false);
            setPin13Output(false);
            setSerialLogs(prev => [...prev.slice(-30), `[Program Complete] Reached end of block sequence.`]);
            return;
          }
        }

        const block = blocks[currentStep];
        setActiveBlockIndex(currentStep);

        if (block.type === 'set_pin') {
          const isHigh = block.state === 'HIGH';
          setPin13Output(isHigh);

          // LED only glows if Pin 13 is HIGH AND the circuit is closed!
          if (isHigh && isCircuitClosed) {
            setLedGlowState(true);
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Set Pin ${block.pin} -> HIGH (💡 LED Glows)`]);
          } else if (isHigh && !isCircuitClosed) {
            setLedGlowState(false);
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Pin 13 is HIGH, but circuit is OPEN (no light)`]);
          } else {
            setLedGlowState(false);
            setSerialLogs(prev => [...prev.slice(-30), `[Step ${currentStep + 1}] Set Pin ${block.pin} -> LOW (🌑 LED Off)`]);
          }

          currentStep++;
          timeoutId = setTimeout(executeNextBlock, 300); // quick transition to next block
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
      setLedGlowState(false);
      setPin13Output(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (timerId) clearInterval(timerId);
    };
  }, [isRunning, blocks, repeatLoop, isCircuitClosed]);

  // Master Run/Stop Toggle
  const handleToggleRun = () => {
    if (!isRunning) {
      if (!isCircuitClosed) {
        showToast('Warning: Circuit is open! Connect Pin 13, Resistor, LED, and GND to see the bulb glow.', 'Circuit Incomplete', 'info');
      }
      setIsRunning(true);
      setSerialLogs(prev => [...prev, `[AVR Core 16MHz] Block Execution Loop Active.`]);
      showToast('Simulation running! Blocks executing in sequence.', 'Simulation Started', 'success');
    } else {
      setIsRunning(false);
      setActiveBlockIndex(-1);
      setLedGlowState(false);
      setPin13Output(false);
      showToast('Simulation paused.', 'Simulation Stopped', 'info');
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setActiveBlockIndex(-1);
    setRunTimeSec(0);
    setLedGlowState(false);
    setPin13Output(false);
    setSerialLogs([`[System] Workbench reset to idle.`]);
    showToast('Simulation counters reset.', 'Reset Complete', 'info');
  };

  // ==================== 3D X-RAY ANATOMY MODAL STATE ====================
  // 'led' | 'breadboard' | 'resistor' | 'arduino' | null
  const [xrayModalComponent, setXrayModalComponent] = useState(null);

  // Generate C++ Arduino Code equivalent to visual blocks
  const generatedCppCode = useMemo(() => {
    let loopCode = '';
    blocks.forEach(b => {
      if (b.type === 'set_pin') {
        loopCode += `  digitalWrite(${b.pin}, ${b.state}); // Set pin ${b.pin} ${b.state}\n`;
      } else if (b.type === 'wait') {
        loopCode += `  delay(${Math.round(b.duration * 1000)}); // Wait ${b.duration} seconds\n`;
      }
    });

    return `// Pixiu Cyber-Lab Auto-Generated Arduino C++ Sketch
// Generated from Visual Block Coding Studio

const int targetPin = 13;

void setup() {
  // Initialize digital pin 13 as an output
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

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-left text-xs space-y-3">
            <p className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">How to unlock access:</p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">1.</span>
                <span><strong>Students:</strong> Sign in with your Roll ID to practice coursework and log practical build transcripts.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">2.</span>
                <span><strong>Trainers:</strong> Launch the simulator from your Live Session Runner for smart-board classroom projection.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">3.</span>
                <span><strong>Schools:</strong> Inspect your robotics laboratory hardware units and student circuit assignments.</span>
              </li>
            </ul>
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

        <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500 font-mono">
          Pixiu Tech LLP • Enterprise 3D Robotics Simulation Engine • Protected Institutional Endpoint
        </footer>
      </div>
    );
  }

  // Active Authenticated Navigation Target (Back button redirect)
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
      
      {/* Toast Alert Notification */}
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
                Photorealistic 3D
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Session: <strong className="text-slate-200">{activeUser?.name || activeUser?.username || 'Authorized User'}</strong> ({activeRole?.toUpperCase() || 'MEMBER'})
            </p>
          </div>
        </div>

        {/* Action Controls in Top Bar */}
        <div className="flex items-center gap-2">
          {/* Auto-wire reference circuit */}
          <button
            onClick={handleAutoWire}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Automatically connect all wires for standard LED circuit"
          >
            <Sparkles size={14} className="text-amber-400" />
            <span className="hidden sm:inline">Auto-Wire Circuit</span>
          </button>

          <button
            onClick={handleClearWires}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Disconnect all wires to practice manual wiring"
          >
            <Trash2 size={14} />
          </button>

          <button
            onClick={handleReset}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            title="Reset simulation state"
          >
            <RotateCcw size={14} />
          </button>

          {/* Master Run / Stop Button */}
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

      {/* Main Workspace (Left 3D Workbench Canvas + Right Block Coding Palette) */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        {/* ==================== LEFT: 3D PHOTOREALISTIC HARDWARE WORKBENCH ==================== */}
        <div className="flex-1 flex flex-col bg-[#080d1a] relative overflow-auto select-none">
          
          {/* Engineering ESD Mat Background Surface */}
          <div className="p-3 bg-slate-900/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs z-10">
            {/* Circuit Status Badge */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Circuit Loop:</span>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border ${
                isCircuitClosed 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isCircuitClosed ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {isCircuitClosed ? 'Closed Loop • Ready to Energize' : 'Open Circuit • Incomplete Wiring'}
              </span>
            </div>

            {/* Quick X-Ray Dissection Triggers */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">3D X-Ray:</span>
              <button
                onClick={() => setXrayModalComponent('bulb')}
                className="px-2.5 py-1 bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                🔬 LED Bulb Inside
              </button>
              <button
                onClick={() => setXrayModalComponent('breadboard')}
                className="px-2.5 py-1 bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                🔬 Breadboard Clips
              </button>
              <button
                onClick={() => setXrayModalComponent('resistor')}
                className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                🔬 220Ω Resistor
              </button>
              <button
                onClick={() => setXrayModalComponent('arduino')}
                className="px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                🔬 ATmega328P Die
              </button>
            </div>
          </div>

          {/* 3D Workbench Canvas with Orthographic / Isometric Shadows */}
          <div className="flex-1 p-6 flex items-center justify-center relative min-h-[560px] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
            
            {/* Workbench Anti-Static Mat Container */}
            <div className="relative w-full max-w-4xl bg-gradient-to-br from-[#0c1322] via-[#090f1b] to-[#060a14] rounded-3xl p-6 sm:p-8 border border-slate-700/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] flex flex-col md:flex-row items-center justify-around gap-8">
              
              {/* ================= 1. PHOTOREALISTIC 3D ARDUINO UNO R3 ================= */}
              <div 
                className="relative w-[300px] h-[390px] bg-[#005B60] rounded-2xl border-[3px] border-[#008184] shadow-[12px_18px_30px_rgba(0,0,0,0.8)] p-4 flex flex-col justify-between shrink-0 group transition-transform duration-300 hover:scale-[1.01]"
                style={{
                  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.2), inset 0 -4px 6px rgba(0, 0, 0, 0.5)'
                }}
              >
                {/* 3D Depth PCB Edge Bevel */}
                <div className="absolute inset-0 rounded-2xl border-b-4 border-r-4 border-[#00383B] pointer-events-none"></div>

                {/* Metal USB-B Connector (3D Silver Casing) */}
                <div 
                  className="absolute -top-3.5 left-5 w-14 h-9 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 rounded-t-md border border-slate-400 shadow-md flex items-center justify-center"
                  style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.5), inset 0 1px 2px #fff' }}
                >
                  <div className="w-8 h-4 bg-slate-800 rounded-xs border border-slate-600"></div>
                </div>

                {/* DC Power Barrel Jack (3D Plastic + Metal Center) */}
                <div 
                  className="absolute -bottom-4 left-5 w-12 h-10 bg-gradient-to-b from-slate-900 to-black rounded-b-md border border-slate-700 shadow-lg flex items-center justify-center"
                >
                  <div className="w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-500 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                  </div>
                </div>

                {/* Red Tactile Reset Button */}
                <button 
                  onClick={handleReset}
                  className="absolute top-4 left-22 w-5 h-5 rounded-full bg-gradient-to-b from-red-500 to-red-700 border-2 border-red-300 shadow-md active:scale-90 transition-transform cursor-pointer"
                  title="Arduino Hardware Reset Button"
                />

                {/* Top Digital Pin Header (Pins 0 to 13, GND, AREF) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[8px] font-mono text-cyan-200 font-bold px-1 select-none">
                    <span>AREF</span>
                    <span>GND</span>
                    <span className={wires.pin13_to_resistor ? 'text-amber-300 font-extrabold underline' : ''}>13</span>
                    <span>12</span>
                    <span>11~</span>
                    <span>10~</span>
                    <span>9~</span>
                    <span>8</span>
                  </div>
                  
                  {/* 3D Black Female Socket Header */}
                  <div className="h-7 bg-[#111] border-2 border-slate-800 rounded-md px-1.5 flex items-center justify-between shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]">
                    {[
                      { id: 'AREF', label: 'AREF' },
                      { id: 'GND_TOP', label: 'GND', isGnd: true },
                      { id: '13', label: '13', active: pin13Output, isPin13: true },
                      { id: '12', label: '12' },
                      { id: '11', label: '11' },
                      { id: '10', label: '10' },
                      { id: '9', label: '9' },
                      { id: '8', label: '8' }
                    ].map((pin, i) => (
                      <div 
                        key={i} 
                        onClick={() => pin.isPin13 && toggleWire('pin13_to_resistor')}
                        className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                          pin.active 
                            ? 'bg-amber-400 shadow-[0_0_8px_#F59E0B] scale-110' 
                            : pin.isPin13 && wires.pin13_to_resistor
                            ? 'bg-blue-500 border border-blue-300'
                            : 'bg-black border border-slate-700 hover:border-blue-400'
                        }`}
                        title={pin.isPin13 ? "Digital Pin 13 (Click to toggle jumper wire to resistor)" : `Digital Pin ${pin.label}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-xs bg-slate-900 shadow-inner"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Middle Board Center: Branding + 16MHz Crystal + ATmega328P */}
                <div className="my-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black tracking-wider text-white block">PIXIU UNO</span>
                      <span className="text-[8px] font-mono text-cyan-200">3D ROBOTICS LAB</span>
                    </div>

                    {/* 3D Stamped 16.000 MHz Silver Quartz Crystal */}
                    <div 
                      className="w-10 h-5 bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400 rounded-full border border-slate-400 shadow-md flex items-center justify-center font-mono text-[6px] font-bold text-slate-700 tracking-tighter"
                      title="16.000 MHz Quartz Crystal Clock"
                    >
                      16.000
                    </div>

                    {/* Built-in Pin 13 'L' Indicator LED & 5V 'ON' LED */}
                    <div className="flex flex-col gap-1 text-[8px] font-mono font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full transition-all ${
                          pin13Output 
                            ? 'bg-amber-400 shadow-[0_0_10px_#F59E0B] scale-125' 
                            : 'bg-amber-950/60 border border-amber-900'
                        }`}></span>
                        <span className="text-cyan-100">L (Pin 13)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399] animate-pulse"></span>
                        <span className="text-cyan-100">ON (5V)</span>
                      </div>
                    </div>
                  </div>

                  {/* 3D Realistic ATmega328P DIP-28 Silicon Microcontroller Chip */}
                  <div 
                    onClick={() => setXrayModalComponent('arduino')}
                    className="w-full bg-[#161616] border-2 border-slate-700 rounded-lg p-2 flex flex-col justify-between shadow-[0_6px_12px_rgba(0,0,0,0.8)] cursor-pointer hover:border-cyan-400 transition-colors group/chip"
                    title="Click to view X-Ray 3D Dissection of ATmega328P Silicon Core (Flash ROM, SRAM, ALU, Clock)"
                  >
                    {/* Top Pin Notch & Engraved Text */}
                    <div className="flex items-center justify-between px-1">
                      <div className="w-2 h-2 rounded-full border border-slate-600 bg-slate-900"></div>
                      <span className="font-mono text-[8px] font-bold tracking-widest text-slate-400 group-hover/chip:text-cyan-300">
                        ATMEGA328P-PU
                      </span>
                      <span className="text-[7px] font-mono text-slate-600">AVR 8-BIT</span>
                    </div>

                    {/* 28 Metal Legs Graphical Indicator */}
                    <div className="flex justify-between px-2 pt-1 font-mono text-[7px] text-slate-500">
                      <span>||||||||||||||</span>
                      <span className="text-cyan-400 font-bold flex items-center gap-0.5">
                        <Eye size={9} /> Click for 3D Die
                      </span>
                      <span>||||||||||||||</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Power & Analog Pin Headers */}
                <div className="space-y-1">
                  <div className="h-7 bg-[#111] border-2 border-slate-800 rounded-md px-1.5 flex items-center justify-between shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]">
                    {[
                      { label: '3.3V' },
                      { label: '5V' },
                      { label: 'GND', isGnd: true },
                      { label: 'GND', isGnd: true },
                      { label: 'VIN' },
                      { label: 'A0' },
                      { label: 'A1' },
                      { label: 'A2' },
                      { label: 'A3' },
                      { label: 'A4' }
                    ].map((pin, i) => (
                      <div 
                        key={i} 
                        onClick={() => pin.isGnd && toggleWire('led_to_gnd')}
                        className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center cursor-pointer transition-all ${
                          pin.isGnd && wires.led_to_gnd
                            ? 'bg-slate-900 border-2 border-slate-400'
                            : 'bg-black border border-slate-700 hover:border-emerald-400'
                        }`}
                        title={pin.isGnd ? "GND Ground Pin (Click to toggle ground wire to LED Cathode)" : `Pin ${pin.label}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-xs bg-slate-800"></div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[8px] font-mono text-cyan-200 font-bold px-1 select-none">
                    <span className={wires.led_to_gnd ? 'text-emerald-300 font-extrabold underline' : ''}>POWER (5V / GND)</span>
                    <span>ANALOG (A0-A5)</span>
                  </div>
                </div>

              </div>

              {/* ================= 2. PHOTOREALISTIC 3D BREADBOARD WITH INSERTED PARTS ================= */}
              <div 
                className="relative w-[320px] bg-[#EFEFEF] rounded-2xl border-[3px] border-slate-300 p-5 shadow-[12px_18px_30px_rgba(0,0,0,0.8)] flex flex-col justify-between select-none group"
                style={{
                  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.9), inset 0 -4px 6px rgba(0, 0, 0, 0.15)'
                }}
              >
                {/* 3D Depth Bevel */}
                <div className="absolute inset-0 rounded-2xl border-b-4 border-r-4 border-slate-400/80 pointer-events-none"></div>

                {/* Top Header: Breadboard Title & X-Ray Button */}
                <div className="flex items-center justify-between mb-3 border-b border-slate-300 pb-2">
                  <div>
                    <span className="text-xs font-black text-slate-800 block">SOLDERLESS BREADBOARD</span>
                    <span className="text-[9px] font-mono text-slate-500">400 TIE-POINT MATRIX</span>
                  </div>
                  <button
                    onClick={() => setXrayModalComponent('breadboard')}
                    className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-slate-300 transition-colors cursor-pointer"
                    title="Click to view internal metallic spring clips inside the breadboard"
                  >
                    <Eye size={12} /> X-Ray Clips
                  </button>
                </div>

                {/* Positive (+) & Negative (-) Power Rails with Realistic Red & Blue Lines */}
                <div className="flex justify-between items-center px-1 mb-3">
                  <div className="flex items-center gap-1">
                    <span className="text-rose-600 font-bold text-xs">+</span>
                    <div className="w-28 h-0.5 bg-rose-500 rounded-full"></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-28 h-0.5 bg-blue-600 rounded-full"></div>
                    <span className="text-blue-600 font-bold text-xs">-</span>
                  </div>
                </div>

                {/* ================= COMPONENT PLACEMENT STAGE ================= */}
                <div className="bg-[#E5E7EB] border border-slate-300 rounded-xl p-3 my-2 space-y-4 shadow-inner">
                  
                  {/* COMPONENT 1: 3D 220Ω CURRENT-LIMITING RESISTOR */}
                  <div 
                    onClick={() => setXrayModalComponent('resistor')}
                    className="p-2.5 bg-white rounded-xl border border-slate-300 shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-400 transition-all group/res"
                    title="Click for 3D Dissection: Ceramic core, carbon spiral, and Ohm's Law thermal protection"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-800">220Ω Resistor</span>
                        <span className="text-[9px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">1/4 Watt</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Prevents LED from burning out</span>
                    </div>

                    {/* 3D Realistic Resistor Body with Color Bands (Red, Red, Brown, Gold) */}
                    <div className="flex items-center">
                      <div className="w-3 h-0.5 bg-slate-400"></div>
                      <div 
                        className="w-12 h-5 bg-[#C99C67] rounded-full border border-[#966F3D] shadow-md flex items-center justify-around px-1 relative overflow-hidden"
                        style={{ boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.2)' }}
                      >
                        <span className="w-1 h-full bg-red-600 shadow-xs" title="Band 1: 2 (Red)"></span>
                        <span className="w-1 h-full bg-red-600 shadow-xs" title="Band 2: 2 (Red)"></span>
                        <span className="w-1 h-full bg-[#5C3317] shadow-xs" title="Band 3: x10 (Brown)"></span>
                        <span className="w-1 h-full bg-[#D4AF37] shadow-xs" title="Band 4: ±5% (Gold)"></span>
                      </div>
                      <div className="w-3 h-0.5 bg-slate-400"></div>
                    </div>
                  </div>

                  {/* COMPONENT 2: 3D PHOTOREALISTIC 5MM DIFFUSED RED LED BULB */}
                  <div 
                    onClick={() => setXrayModalComponent('bulb')}
                    className="p-3 bg-white rounded-xl border border-slate-300 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:border-red-400 transition-all group/led"
                    title="Click for 3D Dissection: See how the bulb actually glows via P-N junction quantum photon emission!"
                  >
                    <div className="w-full flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-800">5mm Red LED Bulb</span>
                        <span className="text-[9px] font-mono bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">
                          {ledGlowState ? '⚡ GLOWING' : 'OFF'}
                        </span>
                      </div>
                      <span className="text-[9px] text-pixiu-blue font-bold flex items-center gap-0.5">
                        <Eye size={10} /> X-Ray Quantum Inside
                      </span>
                    </div>

                    {/* 3D Photorealistic LED Bulb Rendering with Visible Inner Anvil & Post */}
                    <div className="relative my-2 flex flex-col items-center">
                      
                      {/* Luminous Glow Aura (Visible when energized) */}
                      {ledGlowState && (
                        <div className="absolute -top-3 w-28 h-28 rounded-full bg-red-500/40 blur-xl animate-pulse pointer-events-none"></div>
                      )}

                      {/* Translucent Epoxy Resin Dome */}
                      <div 
                        className={`relative w-14 h-16 rounded-t-full rounded-b-sm border-2 transition-all duration-300 flex flex-col items-center justify-end pb-1.5 ${
                          ledGlowState 
                            ? 'bg-gradient-to-b from-red-500 via-red-600 to-red-700 border-red-300 shadow-[0_0_35px_rgba(239,68,68,0.9)] scale-105' 
                            : 'bg-gradient-to-b from-red-900/60 via-red-950/70 to-red-900/80 border-red-800 opacity-90'
                        }`}
                        style={{
                          boxShadow: ledGlowState 
                            ? '0 0 40px #EF4444, inset 0 3px 6px #FFA3A3, inset 0 -4px 8px #991B1B' 
                            : 'inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -3px 6px rgba(0,0,0,0.6)'
                        }}
                      >
                        {/* Specular White Glass Reflection Highlight */}
                        <div className="absolute top-2 left-2 w-3 h-5 rounded-full bg-white/60 blur-[0.5px] -rotate-15"></div>

                        {/* Visible Internal Lead Frame (Anvil & Post) */}
                        <div className="relative w-8 h-8 flex items-end justify-center gap-1 z-10">
                          {/* Large Anvil (Cathode / Flat Edge) */}
                          <div className="w-3.5 h-6 bg-slate-300/80 rounded-t-xs border border-slate-400 flex items-start justify-center pt-0.5">
                            {/* Semiconductor Die with Photon Emission Core */}
                            <div className={`w-1.5 h-1.5 rounded-full ${ledGlowState ? 'bg-white shadow-[0_0_8px_#fff] animate-ping' : 'bg-red-900'}`}></div>
                          </div>
                          {/* Small Post (Anode) */}
                          <div className="w-1.5 h-5 bg-slate-300/80 rounded-t-xs border border-slate-400"></div>
                        </div>

                        {/* Rim at Base of Bulb (Flat on Cathode side) */}
                        <div className="w-full h-1.5 bg-red-700/90 border-t border-red-500 rounded-b-xs"></div>
                      </div>

                      {/* 3D Metal Legs (Long Anode + Short Cathode) */}
                      <div className="flex gap-4 items-start mt-0.5">
                        {/* Anode (+) Long Leg */}
                        <div className="flex flex-col items-center">
                          <div className="w-1 h-7 bg-gradient-to-r from-slate-300 to-slate-400 border-x border-slate-500"></div>
                          <span className="text-[7px] font-bold text-slate-500 mt-0.5">ANODE (+)</span>
                        </div>
                        {/* Cathode (-) Short Leg with flat rim mark */}
                        <div className="flex flex-col items-center">
                          <div className="w-1 h-5 bg-gradient-to-r from-slate-300 to-slate-400 border-x border-slate-500"></div>
                          <span className="text-[7px] font-bold text-slate-500 mt-0.5">CATHODE (-)</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 text-center">
                      {ledGlowState 
                        ? '💡 Photons Emitted! Continuous electron-hole recombination.' 
                        : 'Current Off. Connect legs & click Run.'}
                    </p>
                  </div>

                </div>

                {/* Bottom Interactive Wire Snapping Controls */}
                <div className="space-y-1.5 pt-1 text-[11px] font-mono">
                  <div 
                    onClick={() => toggleWire('pin13_to_resistor')}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors border border-slate-200"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${wires.pin13_to_resistor ? 'bg-blue-500' : 'bg-slate-400'}`}></span>
                      <span>Wire 1: Pin 13 ➔ Resistor</span>
                    </span>
                    <span className={`font-bold ${wires.pin13_to_resistor ? 'text-blue-600' : 'text-slate-400'}`}>
                      {wires.pin13_to_resistor ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>

                  <div 
                    onClick={() => toggleWire('resistor_to_led')}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors border border-slate-200"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${wires.resistor_to_led ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                      <span>Wire 2: Resistor ➔ LED Anode</span>
                    </span>
                    <span className={`font-bold ${wires.resistor_to_led ? 'text-amber-600' : 'text-slate-400'}`}>
                      {wires.resistor_to_led ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>

                  <div 
                    onClick={() => toggleWire('led_to_gnd')}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors border border-slate-200"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${wires.led_to_gnd ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      <span>Wire 3: LED Cathode ➔ GND</span>
                    </span>
                    <span className={`font-bold ${wires.led_to_gnd ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {wires.led_to_gnd ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* ==================== RIGHT: VISUAL BLOCK CODING STUDIO ==================== */}
        <div className="w-full lg:w-[480px] bg-[#090E1A] flex flex-col shrink-0 border-t lg:border-t-0 border-slate-800">
          
          {/* Top Block Studio Header */}
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Puzzle size={16} className="text-pixiu-blue" />
              <span className="font-extrabold text-white text-sm">Visual Block Coding Studio</span>
            </div>

            {/* Toggle: Blocks vs C++ Code View */}
            <button
              onClick={() => setShowCppCode(!showCppCode)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-1 transition-all cursor-pointer"
            >
              <Code size={13} />
              <span>{showCppCode ? 'Back to Blocks' : 'View C++ Code'}</span>
            </button>
          </div>

          {/* BLOCK CODING INTERFACE */}
          {!showCppCode ? (
            <div className="flex-1 p-4 flex flex-col space-y-4 overflow-y-auto">
              
              {/* Event Container Block: 'When Simulation Starts' */}
              <div className="bg-[#EAB308]/20 border-2 border-[#EAB308] rounded-2xl p-3 shadow-md">
                <div className="flex items-center gap-2 font-bold text-xs text-yellow-300">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse"></div>
                  <span>🟢 WHEN SIMULATION STARTS</span>
                </div>
              </div>

              {/* Stack of User Visual Blocks */}
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
                          
                          {/* Pin Dropdown */}
                          <select 
                            value={block.pin}
                            onChange={(e) => updateBlock(block.id, 'pin', e.target.value)}
                            className="bg-blue-900 border border-blue-400 rounded-lg px-2 py-1 text-white font-bold cursor-pointer text-xs"
                          >
                            <option value="13">Pin 13 (Built-in LED)</option>
                            <option value="12">Pin 12</option>
                            <option value="11">Pin 11</option>
                            <option value="10">Pin 10</option>
                          </select>

                          <span>to</span>

                          {/* State Dropdown */}
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
                  <span className="font-bold text-slate-300">Repeat Program Forever in Loop</span>
                </div>
                <input 
                  type="checkbox"
                  checked={repeatLoop}
                  onChange={(e) => setRepeatLoop(e.target.checked)}
                  className="w-4 h-4 accent-pixiu-blue cursor-pointer"
                />
              </div>

              {/* Add Blocks Toolbar */}
              <div className="pt-2 flex items-center gap-2">
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

              {/* Serial Execution Output */}
              <div className="mt-auto pt-2 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">AVR Core 16MHz Serial Output:</span>
                <div className="h-28 bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-[10px] text-emerald-400 overflow-y-auto space-y-0.5 shadow-inner">
                  {serialLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                  {serialLogs.length === 0 && (
                    <div className="text-slate-600 italic">Serial ready. Click 'Run Simulation' to observe telemetry...</div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            /* C++ ARDUINO CODE PREVIEW */
            <div className="flex-1 p-4 flex flex-col space-y-3 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px] font-bold text-emerald-400">Compiled sketch.ino (16MHz AVR GCC)</span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono">Read Only</span>
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

            {/* Modal Body: Dynamic 3D Exploded View by Component */}
            <div className="flex-1 overflow-y-auto py-5 space-y-6 text-xs text-slate-300">
              
              {/* ================= CASE 1: LED BULB QUANTUM DISSECTION ================= */}
              {xrayModalComponent === 'bulb' && (
                <div className="space-y-5">
                  {/* 3D Exploded Visual Diagram */}
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-6">
                    {/* Animated Quantum P-N Junction Graphic */}
                    <div className="w-52 h-44 bg-gradient-to-b from-red-950 to-slate-900 border border-red-500/40 rounded-xl p-3 relative flex flex-col justify-between overflow-hidden shadow-inner">
                      <div className="text-[9px] font-mono font-bold text-red-400 text-center">
                        P-N JUNCTION SEMICONDUCTOR CHIP
                      </div>

                      {/* Moving Electrons & Holes Visualization */}
                      <div className="flex items-center justify-around my-auto">
                        {/* N-Type Region (Excess Electrons e-) */}
                        <div className="text-center">
                          <span className="text-[8px] text-blue-400 block font-bold">N-REGION</span>
                          <div className="w-8 h-8 rounded-full bg-blue-500/30 border border-blue-400 flex items-center justify-center font-mono text-[9px] font-bold text-blue-200 animate-pulse">
                            e⁻ e⁻
                          </div>
                        </div>

                        {/* Quantum Photon Emission Light Wave */}
                        <div className="flex flex-col items-center">
                          <span className="text-amber-300 font-black text-xs animate-bounce">⚡ hν</span>
                          <span className="text-[8px] text-red-400 font-mono">Photon λ=660nm</span>
                        </div>

                        {/* P-Type Region (Excess Holes h+) */}
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

                    {/* Exploded Parts List */}
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

                  {/* Scientific Principle Explanation */}
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

              {/* ================= CASE 2: BREADBOARD INTERNAL CLIPS ================= */}
              {xrayModalComponent === 'breadboard' && (
                <div className="space-y-5">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-center space-y-4">
                    <div className="font-bold text-white text-xs">Internal Phosphor-Bronze Spring Clip Matrix</div>
                    
                    {/* Visual 5-Pin Clip Cross-Section */}
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
                      Beneath the off-white plastic casing are nickel-plated phosphor-bronze metal spring clips. All 5 socket holes in row 15 (columns a-b-c-d-e) touch the <strong>same single piece of metal</strong>. That is why plugging a resistor leg in 15a and an LED leg in 15b electrically connects them together without any soldering!
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <strong className="text-cyan-400 block mb-1">Central IC Trench:</strong>
                      The 0.3-inch divider groove in the center separates row a-e from f-j, allowing dual-in-line IC chips to span both sides without shorting their opposing pins.
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <strong className="text-rose-400 block mb-1">Power Distribution Rails:</strong>
                      The vertical side buses (+ and -) run continuous metal strips along the entire length of the board to distribute 5V and Ground everywhere.
                    </div>
                  </div>
                </div>
              )}

              {/* ================= CASE 3: 220Ω RESISTOR CARBON FILM ================= */}
              {xrayModalComponent === 'resistor' && (
                <div className="space-y-5">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-around gap-6">
                    {/* Spiral Track Graphic */}
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

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 text-[11px]">
                    <h4 className="font-bold text-white text-xs">Why Do We Need It? (Thermal Burnout Protection):</h4>
                    <p className="leading-relaxed text-slate-300">
                      An LED has near-zero internal resistance once its forward threshold voltage (2.0V) is reached. If connected directly to 5V without this 220Ω resistor, runaway current exceeding 200mA will surge through the crystal, melting the gold whisker wire within milliseconds. The resistor's carbon atoms collide with incoming electrons, slowing them down and dissipating the excess 3 Volts safely as microscopic heat ($P = I^2 R$).
                    </p>
                  </div>
                </div>
              )}

              {/* ================= CASE 4: ARDUINO UNO ATmega328P SILICON DIE ================= */}
              {xrayModalComponent === 'arduino' && (
                <div className="space-y-5">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-white text-xs">Inside the ATmega328P Microcontroller Silicon Die</span>
                      <span className="font-mono text-[10px] text-cyan-400 font-bold">16 MIPS @ 16 MHz</span>
                    </div>

                    {/* Silicon Die Sub-Blocks Grid */}
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
