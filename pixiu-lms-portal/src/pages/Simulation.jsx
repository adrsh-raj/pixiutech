import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Cpu, Play, Square, RotateCcw, Volume2, VolumeX, BookOpen, 
  Terminal, ShieldAlert, Lock, ArrowLeft, Sparkles, CheckCircle2, 
  AlertTriangle, Info, Eye, Sliders, Layers, ChevronDown, ChevronRight,
  ExternalLink, Download, Compass, Zap
} from 'lucide-react';

// Built-in Curriculum Experiments
const EXPERIMENTS = [
  {
    id: 'exp1_blink',
    title: 'Exp 1: Built-in LED Blink (Pin 13)',
    grade: 'Grade 6',
    description: 'Understand microcontroller digital output timing and toggle the onboard Pin 13 LED.',
    wires: [
      { id: 'w1', from: 'ARD_13', to: 'BB_A15', color: '#1D6EFF' },
      { id: 'w2', from: 'ARD_GND1', to: 'BB_A16', color: '#0F172A' }
    ],
    components: [
      { type: 'led', color: 'red', position: { x: 340, y: 130 }, pinAnode: 'BB_A15', pinCathode: 'BB_A16' },
      { type: 'resistor', value: '220Ω', position: { x: 340, y: 190 } }
    ],
    code: `// Pixiu Tech OS - Experiment 1: LED Blink
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Pixiu Cyber-Lab: LED Blink Initialized on Pin 13");
}

void loop() {
  digitalWrite(ledPin, HIGH);
  Serial.println("Pin 13 -> HIGH (LED ON)");
  delay(1000);
  
  digitalWrite(ledPin, LOW);
  Serial.println("Pin 13 -> LOW (LED OFF)");
  delay(1000);
}`
  },
  {
    id: 'exp2_traffic',
    title: 'Exp 2: 3-Stage Smart Traffic Light',
    grade: 'Grade 6-7',
    description: 'Control Red (Pin 12), Yellow (Pin 11), and Green (Pin 10) LEDs with state automation sequence.',
    wires: [
      { id: 'w1', from: 'ARD_12', to: 'LED_RED', color: '#EF4444' },
      { id: 'w2', from: 'ARD_11', to: 'LED_YELLOW', color: '#F59E0B' },
      { id: 'w3', from: 'ARD_10', to: 'LED_GREEN', color: '#10B981' },
      { id: 'w4', from: 'ARD_GND1', to: 'BB_GND_RAIL', color: '#0F172A' }
    ],
    components: [
      { type: 'led', color: 'red', position: { x: 320, y: 110 } },
      { type: 'led', color: 'yellow', position: { x: 370, y: 110 } },
      { type: 'led', color: 'green', position: { x: 420, y: 110 } }
    ],
    code: `// Pixiu Tech OS - Experiment 2: Smart Traffic Light
const int redPin = 12;
const int yellowPin = 11;
const int greenPin = 10;

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(yellowPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Traffic Controller Online. Cycle running...");
}

void loop() {
  // RED STOP (4 seconds)
  digitalWrite(redPin, HIGH);
  digitalWrite(yellowPin, LOW);
  digitalWrite(greenPin, LOW);
  Serial.println("🚦 State: RED STOP");
  delay(2500);

  // YELLOW CAUTION (1.5 seconds)
  digitalWrite(redPin, LOW);
  digitalWrite(yellowPin, HIGH);
  Serial.println("⚠️ State: YELLOW CAUTION");
  delay(1200);

  // GREEN GO (3.5 seconds)
  digitalWrite(yellowPin, LOW);
  digitalWrite(greenPin, HIGH);
  Serial.println("✅ State: GREEN GO");
  delay(2500);
}`
  },
  {
    id: 'exp3_ultrasonic',
    title: 'Exp 3: HC-SR04 Contactless Radar & Alarm',
    grade: 'Grade 8',
    description: 'Calculate distance using ultrasonic sound echoes (Trig Pin 9, Echo Pin 8) and trigger acoustic alert.',
    wires: [
      { id: 'w1', from: 'ARD_5V', to: 'US_VCC', color: '#EF4444' },
      { id: 'w2', from: 'ARD_GND1', to: 'US_GND', color: '#0F172A' },
      { id: 'w3', from: 'ARD_9', to: 'US_TRIG', color: '#3B82F6' },
      { id: 'w4', from: 'ARD_8', to: 'US_ECHO', color: '#10B981' },
      { id: 'w5', from: 'ARD_7', to: 'BUZZER_POS', color: '#F59E0B' }
    ],
    components: [
      { type: 'ultrasonic', position: { x: 330, y: 100 } },
      { type: 'buzzer', position: { x: 450, y: 180 } }
    ],
    code: `// Pixiu Tech OS - Experiment 3: Ultrasonic Obstacle Radar
const int trigPin = 9;
const int echoPin = 8;
const int buzzerPin = 7;

long duration;
int distance;

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buzzerPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("HC-SR04 Ultrasonic Radar Initialized.");
}

void loop() {
  // Clear trigger pin
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  
  // Emit 10us burst
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  // Calculate distance: sound travels at 0.034 cm/us
  duration = pulseIn(echoPin, HIGH);
  distance = duration * 0.034 / 2;

  Serial.print("Target Distance: ");
  Serial.print(distance);
  Serial.println(" cm");

  // Proximity Alert Trigger if obstacle closer than 30 cm
  if (distance > 0 && distance < 30) {
    tone(buzzerPin, 1200); // 1.2 kHz alarm
    Serial.println("⚠️ PROXIMITY ALERT! Obstacle in safe zone!");
  } else {
    noTone(buzzerPin);
  }
  delay(500);
}`
  },
  {
    id: 'exp4_nightlamp',
    title: 'Exp 4: Automatic LDR Night Lamp',
    grade: 'Grade 7-8',
    description: 'Use light-dependent photoresistor on Analog Pin A0 to automatically activate streetlight at dusk.',
    wires: [
      { id: 'w1', from: 'ARD_5V', to: 'LDR_VCC', color: '#EF4444' },
      { id: 'w2', from: 'ARD_A0', to: 'LDR_SIG', color: '#8B5CF6' },
      { id: 'w3', from: 'ARD_GND1', to: 'LDR_GND', color: '#0F172A' },
      { id: 'w4', from: 'ARD_13', to: 'LAMP_LED', color: '#10B981' }
    ],
    components: [
      { type: 'ldr', position: { x: 330, y: 120 } },
      { type: 'led', color: 'yellow', position: { x: 420, y: 120 } }
    ],
    code: `// Pixiu Tech OS - Experiment 4: Automatic LDR Streetlight
const int ldrPin = A0;
const int lampPin = 13;
int lightLevel = 0;

void setup() {
  pinMode(lampPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Smart Streetlight Controller Activated.");
}

void loop() {
  lightLevel = analogRead(ldrPin);
  Serial.print("Ambient Lux Sensor: ");
  Serial.println(lightLevel);

  // If ambient light drops below threshold (dusk/darkness)
  if (lightLevel < 400) {
    digitalWrite(lampPin, HIGH);
    Serial.println("🌙 DARKNESS DETECTED -> Street Lamp ON");
  } else {
    digitalWrite(lampPin, LOW);
    Serial.println("☀️ DAYLIGHT DETECTED -> Street Lamp OFF");
  }
  delay(800);
}`
  },
  {
    id: 'exp5_servo',
    title: 'Exp 5: SG90 Robotic Arm Servo Sweep',
    grade: 'Grade 8-9',
    description: 'Control robotic arm joint angle from 0° to 180° with PWM pulse timing on Digital Pin 9.',
    wires: [
      { id: 'w1', from: 'ARD_5V', to: 'SERVO_VCC', color: '#EF4444' },
      { id: 'w2', from: 'ARD_GND1', to: 'SERVO_GND', color: '#0F172A' },
      { id: 'w3', from: 'ARD_9', to: 'SERVO_SIG', color: '#F59E0B' }
    ],
    components: [
      { type: 'servo', position: { x: 350, y: 130 } }
    ],
    code: `// Pixiu Tech OS - Experiment 5: SG90 Servo Sweep
#include <Servo.h>

Servo roboticJoint;
int pos = 0;

void setup() {
  roboticJoint.attach(9);
  Serial.begin(9600);
  Serial.println("SG90 Robotic Joint Calibrated (0 to 180 deg).");
}

void loop() {
  // Sweep from 0 to 180 degrees
  for (pos = 0; pos <= 180; pos += 45) {
    roboticJoint.write(pos);
    Serial.print("Robotic Arm Angle: ");
    Serial.print(pos);
    Serial.println(" deg");
    delay(600);
  }
  
  // Sweep back to 0 degrees
  for (pos = 180; pos >= 0; pos -= 45) {
    roboticJoint.write(pos);
    Serial.print("Robotic Arm Return: ");
    Serial.print(pos);
    Serial.println(" deg");
    delay(600);
  }
}`
  }
];

// Component Datasheets for Student Deep-Dive
const COMPONENT_DATASHEETS = {
  arduino: {
    title: 'Arduino Uno R3 Microcontroller Board',
    category: 'Core Microcontroller Unit',
    specs: 'ATmega328P @ 16 MHz • 5V Operating Voltage • 14 Digital Pins (6 PWM) • 6 Analog Pins (A0-A5)',
    summary: 'The brain of the robotics lab. Executes C++ code sequentially. Digital pins can output 5V (HIGH) or 0V (LOW). Analog pins convert variable sensor voltages (0-5V) into numerical integers from 0 to 1023 (10-bit ADC).',
    rules: [
      'Maximum current per I/O pin is 40mA. Never connect high-power motors directly to Arduino pins without a driver/transistor.',
      'Always connect common Ground (GND) across all external power supplies and sensors.'
    ]
  },
  breadboard: {
    title: 'Solderless Half-Size Breadboard (400 Tie-Points)',
    category: 'Prototyping Platform',
    specs: '30 rows (a-e, f-j) • 2 dual power distribution buses (+ / -)',
    summary: 'Enables rapid solder-free electrical connections. Metal spring clips inside connect rows horizontally (a-b-c-d-e are tied together, f-g-h-i-j are tied together). The long vertical side rails distribute 5V and GND along the entire board.',
    rules: [
      'The central divider groove separates column e and f, designed specifically for dual-in-line IC chips.',
      'Never short positive (+) and negative (-) power rails together.'
    ]
  },
  led: {
    title: 'Diffused 5mm Light Emitting Diode (LED)',
    category: 'Optoelectronic Semiconductor',
    specs: 'Forward Voltage: 1.8V - 2.2V • Max Continuous Current: 20mA',
    summary: 'Emits light when current flows in forward direction. The longer leg is the Anode (+) and the shorter leg with flat edge on plastic rim is the Cathode (- / GND).',
    rules: [
      'CRITICAL: Always connect a 220Ω current-limiting resistor in series. Connecting an LED directly to 5V will burn the semiconductor crystal in milliseconds!',
      'Ohm\'s Law calculation: R = (5V - 2.0V) / 0.02A = 150Ω (we use standard 220Ω for safe 14mA operation).'
    ]
  },
  ultrasonic: {
    title: 'HC-SR04 Ultrasonic Distance Sensor',
    category: 'Acoustic Time-of-Flight Sensor',
    specs: 'Operating Voltage: 5V • Measuring Range: 2cm to 400cm • Precision: 3mm • Trigger: 10µs TTL pulse',
    summary: 'Emits 8 pulses of ultrasonic ultrasound at 40 kHz through the transmitter transducer (T). When sound strikes an obstacle, it bounces back and strikes the receiver transducer (R). The Echo pin stays HIGH for the duration sound travels to and from target.',
    rules: [
      'Formula: Distance (cm) = (Echo Time in microseconds × 0.0343) / 2',
      'The divisor 2 accounts for sound traveling to the object and returning.'
    ]
  },
  servo: {
    title: 'SG90 9g Micro Servo Motor',
    category: 'Rotary Actuator & Closed-Loop Control',
    specs: 'Operating Voltage: 4.8V - 6V • Rotation: 0° - 180° • Stall Torque: 1.8 kg-cm • Pulse Cycle: 20ms (50Hz)',
    summary: 'Contains a DC motor, reduction gear train, potentiometer position sensor, and control circuit. An internal feedback loop compares output shaft position to PWM pulse width (1ms = 0°, 1.5ms = 90°, 2ms = 180°).',
    rules: [
      'Brown Wire = Ground (GND), Red Wire = 5V Power, Orange Wire = PWM Control Signal (e.g. Pin 9).',
      'Do not force the horn beyond mechanical end stops by hand to prevent stripping internal nylon gears.'
    ]
  },
  ldr: {
    title: 'Light Dependent Resistor (LDR / Photoresistor)',
    category: 'Analog Optical Sensor',
    specs: 'Dark Resistance: ~1 MΩ • Light Resistance: ~1 kΩ - 10 kΩ • Peak Spectral Response: 540nm',
    summary: 'A semiconductor resistor whose electrical resistance drops drastically when struck by photons of light. Used in voltage divider configurations with a fixed 10kΩ resistor so Arduino Analog pins can read varying voltage as light changes.',
    rules: [
      'In bright daylight, LDR resistance is low, pulling voltage down. In darkness, LDR resistance spikes, shifting ADC reading.'
    ]
  },
  buzzer: {
    title: 'Piezoelectric Acoustic Buzzer',
    category: 'Audio Transducer',
    specs: 'Operating Voltage: 3.3V - 5V • Resonant Frequency: 2048 Hz - 4000 Hz',
    summary: 'Contains a piezoceramic disc bonded to a brass plate. When voltage is applied, piezoelectric crystal flexes, generating acoustic pressure waves heard as audible tones.',
    rules: [
      'Active buzzers have internal oscillator (just apply 5V). Passive buzzers need tone() PWM signal to produce distinct musical notes.'
    ]
  }
};

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

  // Active Experiment & Code
  const [selectedExpId, setSelectedExpId] = useState('exp1_blink');
  const activeExp = useMemo(() => EXPERIMENTS.find(e => e.id === selectedExpId) || EXPERIMENTS[0], [selectedExpId]);
  const [code, setCode] = useState(activeExp.code);

  // Simulation State
  const [isRunning, setIsRunning] = useState(false);
  const [runTimeSec, setRunTimeSec] = useState(0);
  const [serialOutput, setSerialOutput] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'theory' | 'serial'

  // Hardware Virtual State
  const [pinStates, setPinStates] = useState({ 13: 0, 12: 0, 11: 0, 10: 0, 9: 0, 8: 0, 7: 0, A0: 550 });
  const [ultrasonicDistance, setUltrasonicDistance] = useState(45); // cm
  const [ldrLux, setLdrLux] = useState(650); // analog reading 0-1023
  const [servoAngle, setServoAngle] = useState(0); // 0-180 degrees
  const [activeDatasheetKey, setActiveDatasheetKey] = useState('arduino');

  // Web Audio Context for real buzzer tone
  const audioCtxRef = useRef(null);
  const oscNodeRef = useRef(null);

  // Switch experiment
  const handleSelectExperiment = (expId) => {
    setIsRunning(false);
    setSelectedExpId(expId);
    const exp = EXPERIMENTS.find(e => e.id === expId);
    if (exp) {
      setCode(exp.code);
      setSerialOutput([`[System] Loaded ${exp.title}`, `[Ready] Click '⚡ Run Simulation' to execute.`]);
    }
  };

  // Web Audio Tone Controller
  const playBuzzerTone = (freq = 1200) => {
    if (isAudioMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      if (!oscNodeRef.current) {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        oscNodeRef.current = { osc, gain };
      }
    } catch (e) {}
  };

  const stopBuzzerTone = () => {
    try {
      if (oscNodeRef.current) {
        oscNodeRef.current.osc.stop();
        oscNodeRef.current.osc.disconnect();
        oscNodeRef.current = null;
      }
    } catch (e) {}
  };

  // Virtual Execution Simulation Engine
  useEffect(() => {
    let interval = null;
    let timer = null;
    let step = 0;

    if (isRunning) {
      setSerialOutput(prev => [...prev, `[AVR 16MHz] Simulation Started • Program: ${activeExp.title}`]);
      
      timer = setInterval(() => {
        setRunTimeSec(prev => prev + 1);
      }, 1000);

      // Simulation cycle based on active experiment
      interval = setInterval(() => {
        step = (step + 1) % 6;

        if (selectedExpId === 'exp1_blink') {
          // Blink pin 13 every second
          const isHigh = step % 2 === 0;
          setPinStates(prev => ({ ...prev, 13: isHigh ? 1 : 0 }));
          setSerialOutput(prev => [...prev.slice(-40), isHigh ? "Pin 13 -> HIGH (LED ON)" : "Pin 13 -> LOW (LED OFF)"]);
        } 
        else if (selectedExpId === 'exp2_traffic') {
          // Traffic light sequence: Red (0,1) -> Yellow (2) -> Green (3,4,5)
          if (step === 0 || step === 1) {
            setPinStates(prev => ({ ...prev, 12: 1, 11: 0, 10: 0 }));
            setSerialOutput(prev => [...prev.slice(-40), "🚦 State: RED STOP (Pin 12)"]);
          } else if (step === 2) {
            setPinStates(prev => ({ ...prev, 12: 0, 11: 1, 10: 0 }));
            setSerialOutput(prev => [...prev.slice(-40), "⚠️ State: YELLOW CAUTION (Pin 11)"]);
          } else {
            setPinStates(prev => ({ ...prev, 12: 0, 11: 0, 10: 1 }));
            setSerialOutput(prev => [...prev.slice(-40), "✅ State: GREEN GO (Pin 10)"]);
          }
        } 
        else if (selectedExpId === 'exp3_ultrasonic') {
          // Ultrasonic obstacle alert based on user's distance slider
          setSerialOutput(prev => [
            ...prev.slice(-40), 
            `Target Distance: ${ultrasonicDistance} cm ${ultrasonicDistance < 30 ? '⚠️ PROXIMITY ALERT!' : '• Safe Zone'}`
          ]);
          if (ultrasonicDistance < 30) {
            setPinStates(prev => ({ ...prev, 7: 1 }));
            playBuzzerTone(1400);
          } else {
            setPinStates(prev => ({ ...prev, 7: 0 }));
            stopBuzzerTone();
          }
        } 
        else if (selectedExpId === 'exp4_nightlamp') {
          // Night lamp based on LDR slider
          const isDark = ldrLux < 400;
          setPinStates(prev => ({ ...prev, 13: isDark ? 1 : 0 }));
          setSerialOutput(prev => [
            ...prev.slice(-40),
            `Ambient Lux: ${ldrLux} -> ${isDark ? '🌙 DARKNESS: Street Lamp ON (Pin 13)' : '☀️ DAYLIGHT: Street Lamp OFF'}`
          ]);
        } 
        else if (selectedExpId === 'exp5_servo') {
          // Servo sweep rotation
          const angles = [0, 45, 90, 135, 180, 90];
          const currentAngle = angles[step % angles.length];
          setServoAngle(currentAngle);
          setSerialOutput(prev => [...prev.slice(-40), `Robotic Arm Joint Angle -> ${currentAngle}°`]);
        }
      }, 1000);
    } else {
      stopBuzzerTone();
    }

    return () => {
      clearInterval(interval);
      clearInterval(timer);
      stopBuzzerTone();
    };
  }, [isRunning, selectedExpId, ultrasonicDistance, ldrLux, isAudioMuted]);

  // Handle Run/Stop
  const handleToggleRun = () => {
    if (!isRunning) {
      setIsRunning(true);
      showToast('Simulation started! C++ byte execution active on 16MHz virtual core.', 'Running Virtual Arduino', 'success');
    } else {
      setIsRunning(false);
      stopBuzzerTone();
      showToast('Simulation paused.', 'Simulator Idle', 'info');
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    stopBuzzerTone();
    setRunTimeSec(0);
    setPinStates({ 13: 0, 12: 0, 11: 0, 10: 0, 9: 0, 8: 0, 7: 0, A0: 550 });
    setServoAngle(0);
    setSerialOutput([`[System] Workbench reset to defaults.`]);
    showToast('Virtual hardware pins and counters reset.', 'Reset Complete', 'info');
  };

  // Direct Access Authorization Guard: If someone visits pixiutech.com/simulation without portal authentication
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
              The <strong>Pixiu Cyber-Lab Virtual Arduino Simulation Workbench</strong> is an enterprise-grade hardware sandbox reserved exclusively for enrolled students, partner schools, certified faculty, and administrators.
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
          Pixiu Tech LLP • Enterprise Embedded Robotics Simulation Engine • Protected Institutional Endpoint
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
    <div className="min-h-screen bg-[#070B14] text-white flex flex-col font-sans selection:bg-pixiu-blue selection:text-white relative">
      
      {/* Dynamic Toast Alert Notification */}
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
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
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
                Virtual Arduino Workbench
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                Simulation Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Authenticated Session: <strong className="text-slate-200">{activeUser?.name || activeUser?.username || 'Authorized User'}</strong> ({activeRole?.toUpperCase() || 'MEMBER'})
            </p>
          </div>
        </div>

        {/* Action Controls in Top Bar */}
        <div className="flex items-center gap-2">
          {/* Audio Mute Toggle */}
          <button
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isAudioMuted ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
            }`}
            title={isAudioMuted ? "Unmute Buzzer Sound" : "Mute Buzzer Sound"}
          >
            {isAudioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Reset Workbench */}
          <button
            onClick={handleReset}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            title="Reset simulation state and pins"
          >
            <RotateCcw size={15} />
            <span className="hidden sm:inline">Reset</span>
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

      {/* Main Workspace (Split: Left Workbench Canvas + Right Code / Theory Console) */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        {/* ==================== LEFT: INTERACTIVE HARDWARE CANVAS ==================== */}
        <div className="flex-1 flex flex-col bg-[#050811] border-r border-slate-800/80 relative overflow-auto">
          
          {/* Top Workbench Toolbar (Experiment Presets) */}
          <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Select Experiment:</span>
              <select
                value={selectedExpId}
                onChange={(e) => handleSelectExperiment(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-pixiu-blue cursor-pointer"
              >
                {EXPERIMENTS.map(exp => (
                  <option key={exp.id} value={exp.id}>{exp.title} ({exp.grade})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-ping' : 'bg-slate-600'}`}></span>
                <span>Status: <strong className={isRunning ? 'text-emerald-400' : 'text-slate-500'}>{isRunning ? 'RUNNING (16MHz)' : 'IDLE'}</strong></span>
              </div>
              <div className="text-slate-400">
                Runtime: <strong className="text-white font-mono">{String(Math.floor(runTimeSec / 60)).padStart(2, '0')}:{String(runTimeSec % 60).padStart(2, '0')}</strong>
              </div>
            </div>
          </div>

          {/* Interactive Hardware Graphic Surface */}
          <div className="flex-1 p-4 sm:p-6 flex flex-col items-center justify-center relative min-h-[480px]">
            
            {/* Interactive Hardware Container */}
            <div className="relative w-full max-w-2xl bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xs flex flex-col md:flex-row items-center justify-around gap-6">
              
              {/* 1. PHOTOREALISTIC ARDUINO UNO R3 VECTOR BOARD */}
              <div className="relative w-[280px] h-[360px] bg-[#0A4D68] rounded-2xl border-2 border-[#088395] shadow-2xl p-4 flex flex-col justify-between shrink-0 select-none">
                
                {/* USB-B Port (Metal Housing) */}
                <div className="absolute -top-3 left-4 w-12 h-8 bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 rounded-t border border-slate-400 shadow-md"></div>
                
                {/* DC Power Barrel Jack */}
                <div className="absolute -bottom-3 left-4 w-11 h-9 bg-slate-950 rounded-b border border-slate-800 shadow-md"></div>

                {/* Reset Button */}
                <div className="absolute top-4 left-20 w-4 h-4 rounded-full bg-rose-600 border border-rose-400 shadow-sm cursor-pointer active:scale-95" onClick={handleReset} title="Arduino Reset Button"></div>

                {/* Top Digital Pin Header (Pins 0 to 13, GND, AREF) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[8px] font-mono text-cyan-200 font-bold px-1">
                    <span>AREF</span>
                    <span>GND</span>
                    <span>13</span>
                    <span>12</span>
                    <span>11~</span>
                    <span>10~</span>
                    <span>9~</span>
                    <span>8</span>
                  </div>
                  <div className="h-6 bg-slate-950 border border-slate-800 rounded px-1.5 flex items-center justify-between">
                    {[
                      { id: 'AREF', label: 'AREF' },
                      { id: 'GND', label: 'GND' },
                      { id: 13, label: '13', active: pinStates[13] },
                      { id: 12, label: '12', active: pinStates[12] },
                      { id: 11, label: '11', active: pinStates[11] },
                      { id: 10, label: '10', active: pinStates[10] },
                      { id: 9, label: '9', active: pinStates[9] },
                      { id: 8, label: '8', active: pinStates[8] }
                    ].map((pin, i) => (
                      <div 
                        key={i} 
                        className={`w-2.5 h-2.5 rounded-xs transition-all ${
                          pin.active ? 'bg-amber-400 shadow-xs shadow-amber-400' : 'bg-slate-700'
                        }`}
                        title={`Digital Pin ${pin.label}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Board Branding & ATmega328P Chip */}
                <div className="my-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-black tracking-widest text-cyan-200 block">PIXIU UNO</span>
                      <span className="text-[8px] font-mono text-cyan-300/80">SMART ROBOTICS R3</span>
                    </div>

                    {/* Built-in Pin 13 'L' LED & Power 'ON' LED */}
                    <div className="flex flex-col gap-1 text-[8px] font-mono font-bold">
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full transition-all ${pinStates[13] ? 'bg-amber-400 shadow-sm shadow-amber-400' : 'bg-slate-800'}`}></span>
                        <span className="text-cyan-200">L (Pin 13)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse"></span>
                        <span className="text-cyan-200">ON (5V)</span>
                      </div>
                    </div>
                  </div>

                  {/* ATmega328P Microcontroller Chip Graphic */}
                  <div className="w-full h-14 bg-slate-950 border border-slate-700 rounded-md p-1.5 flex flex-col justify-between shadow-inner">
                    <div className="flex justify-between px-1 text-[7px] font-mono text-slate-500">
                      <span>||||||||||||||</span>
                      <span>ATMEGA328P-PU</span>
                      <span>||||||||||||||</span>
                    </div>
                    <div className="text-center font-mono text-[9px] font-bold text-slate-400">
                      16.000 MHz CRYSTAL
                    </div>
                  </div>
                </div>

                {/* Bottom Power & Analog Pin Headers */}
                <div className="space-y-1">
                  <div className="h-6 bg-slate-950 border border-slate-800 rounded px-1.5 flex items-center justify-between">
                    {['3.3V', '5V', 'GND', 'GND', 'VIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((pin, i) => (
                      <div 
                        key={i} 
                        className="w-2.5 h-2.5 bg-slate-700 rounded-xs hover:bg-blue-400 cursor-pointer"
                        title={`Pin ${pin}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[8px] font-mono text-cyan-200 font-bold px-1">
                    <span>POWER (5V/GND)</span>
                    <span>ANALOG IN (A0-A5)</span>
                  </div>
                </div>

              </div>

              {/* 2. DYNAMIC COMPONENT STAGE (Changes based on experiment) */}
              <div className="flex-1 w-full flex flex-col items-center justify-center space-y-6">
                
                {/* Visual Breadboard / Prototyping Rail */}
                <div className="w-full bg-[#F8FAFC] rounded-2xl p-4 border border-slate-300 shadow-xl text-slate-900">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-2 border-b border-slate-200 pb-1">
                    <span>BREADBOARD COMPONENT STAGE</span>
                    <span className="font-mono text-pixiu-blue">{activeExp.title.split(':')[0]}</span>
                  </div>

                  {/* Active Experiment Dynamic Visualizer */}
                  <div className="py-3 flex flex-col items-center justify-center">
                    
                    {/* EXP 1: LED Blink Visualizer */}
                    {selectedExpId === 'exp1_blink' && (
                      <div className="text-center space-y-3">
                        <div className="relative inline-block">
                          <div className={`w-14 h-14 rounded-full transition-all duration-200 flex items-center justify-center border-2 ${
                            pinStates[13] 
                              ? 'bg-red-500 border-red-300 shadow-xl shadow-red-500/80 scale-110' 
                              : 'bg-red-950/40 border-red-900/60 opacity-60'
                          }`}>
                            <Zap size={24} className={pinStates[13] ? 'text-white animate-bounce' : 'text-red-800'} />
                          </div>
                        </div>
                        <div className="font-mono text-xs font-bold text-slate-800">
                          Red 5mm LED: <strong className={pinStates[13] ? 'text-red-600' : 'text-slate-400'}>{pinStates[13] ? '⚡ GLOWING (HIGH)' : 'OFF (LOW)'}</strong>
                        </div>
                        <p className="text-[11px] text-slate-500">Protected by 220Ω Series Resistor</p>
                      </div>
                    )}

                    {/* EXP 2: Traffic Light 3-LED Stage */}
                    {selectedExpId === 'exp2_traffic' && (
                      <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center gap-6 shadow-inner">
                        {/* Red LED */}
                        <div className="text-center space-y-1">
                          <div className={`w-10 h-10 rounded-full mx-auto border transition-all ${
                            pinStates[12] ? 'bg-red-500 border-red-300 shadow-lg shadow-red-500/80 scale-105' : 'bg-red-950/50 border-red-900'
                          }`} />
                          <span className="text-[10px] font-mono font-bold text-red-400">RED (Pin 12)</span>
                        </div>
                        {/* Yellow LED */}
                        <div className="text-center space-y-1">
                          <div className={`w-10 h-10 rounded-full mx-auto border transition-all ${
                            pinStates[11] ? 'bg-yellow-400 border-yellow-200 shadow-lg shadow-yellow-400/80 scale-105' : 'bg-yellow-950/50 border-yellow-900'
                          }`} />
                          <span className="text-[10px] font-mono font-bold text-yellow-400">YEL (Pin 11)</span>
                        </div>
                        {/* Green LED */}
                        <div className="text-center space-y-1">
                          <div className={`w-10 h-10 rounded-full mx-auto border transition-all ${
                            pinStates[10] ? 'bg-emerald-500 border-emerald-300 shadow-lg shadow-emerald-500/80 scale-105' : 'bg-emerald-950/50 border-emerald-900'
                          }`} />
                          <span className="text-[10px] font-mono font-bold text-emerald-400">GRN (Pin 10)</span>
                        </div>
                      </div>
                    )}

                    {/* EXP 3: Ultrasonic Distance Sensor with Slider */}
                    {selectedExpId === 'exp3_ultrasonic' && (
                      <div className="w-full space-y-4">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Compass size={24} className="text-blue-600" />
                            <div>
                              <div className="text-xs font-bold text-slate-800">HC-SR04 Target Obstacle Slider</div>
                              <div className="text-[10px] text-slate-500">Drag to change physical distance in front of sensors</div>
                            </div>
                          </div>
                          <span className="text-lg font-mono font-black text-blue-700">{ultrasonicDistance} cm</span>
                        </div>

                        <input 
                          type="range"
                          min="2"
                          max="150"
                          value={ultrasonicDistance}
                          onChange={(e) => setUltrasonicDistance(Number(e.target.value))}
                          className="w-full accent-blue-600 cursor-pointer"
                        />

                        {/* Buzzer Alert Strip */}
                        <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                          pinStates[7] ? 'bg-red-100 border-red-300 text-red-700 animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                          <div className="flex items-center gap-2">
                            <Volume2 size={16} className={pinStates[7] ? 'text-red-600' : 'text-slate-400'} />
                            <span>Piezo Buzzer Status:</span>
                          </div>
                          <span>{pinStates[7] ? '🔊 BEEPING (Distance < 30cm)' : 'SILENT'}</span>
                        </div>
                      </div>
                    )}

                    {/* EXP 4: LDR Light Sensor */}
                    {selectedExpId === 'exp4_nightlamp' && (
                      <div className="w-full space-y-4">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sliders size={22} className="text-amber-600" />
                            <div>
                              <div className="text-xs font-bold text-slate-800">Ambient Light (Lux) Controller</div>
                              <div className="text-[10px] text-slate-500">Slide left for Night, slide right for Daytime</div>
                            </div>
                          </div>
                          <span className="text-base font-mono font-bold text-amber-700">{ldrLux} ADC</span>
                        </div>

                        <input 
                          type="range"
                          min="50"
                          max="1000"
                          value={ldrLux}
                          onChange={(e) => setLdrLux(Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />

                        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                          pinStates[13] ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-600'
                        }`}>
                          <span>Automatic Streetlight (Pin 13):</span>
                          <span className="flex items-center gap-1">
                            <span className={`w-2.5 h-2.5 rounded-full ${pinStates[13] ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                            {pinStates[13] ? '💡 LAMP ON (Darkness)' : '🌑 LAMP OFF (Daylight)'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* EXP 5: SG90 Servo Sweep */}
                    {selectedExpId === 'exp5_servo' && (
                      <div className="text-center space-y-4">
                        {/* Interactive Rotating Servo Horn */}
                        <div className="w-32 h-32 mx-auto bg-slate-900 border-2 border-blue-500 rounded-2xl p-2 relative flex items-center justify-center shadow-lg">
                          <div className="absolute top-2 left-2 text-[8px] font-mono text-blue-400 font-bold">SG90 9g</div>
                          {/* Rotating Arm */}
                          <div 
                            className="w-20 h-4 bg-white rounded-full border-2 border-blue-600 shadow-md origin-center transition-transform duration-500 flex items-center justify-end pr-1"
                            style={{ transform: `rotate(${servoAngle - 90}deg)` }}
                          >
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          </div>
                        </div>

                        <div className="font-mono text-sm font-black text-blue-600">
                          Shaft Angle: {servoAngle}°
                        </div>
                        <p className="text-[11px] text-slate-500">Controlled by 50Hz PWM signal on Digital Pin 9</p>
                      </div>
                    )}

                  </div>
                </div>

                {/* Quick Component Inspector Pill */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">Datasheet:</span>
                  {['arduino', 'led', 'ultrasonic', 'servo', 'ldr', 'buzzer'].map(compKey => (
                    <button
                      key={compKey}
                      onClick={() => {
                        setActiveDatasheetKey(compKey);
                        setActiveTab('theory');
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold capitalize border border-slate-700 transition-colors cursor-pointer"
                    >
                      {compKey}
                    </button>
                  ))}
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* ==================== RIGHT: C++ CODE EDITOR / THEORY / SERIAL MONITOR ==================== */}
        <div className="w-full lg:w-[460px] bg-slate-950 flex flex-col shrink-0 border-t lg:border-t-0 border-slate-800">
          
          {/* Tabs: Code Editor | Theory & Pinout | Serial Monitor */}
          <div className="bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('code')}
                className={`px-3 py-2.5 font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'code' ? 'border-pixiu-blue text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu size={14} /> C++ Arduino Code
              </button>

              <button
                onClick={() => setActiveTab('theory')}
                className={`px-3 py-2.5 font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'theory' ? 'border-pixiu-blue text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen size={14} /> Datasheet & Theory
              </button>

              <button
                onClick={() => setActiveTab('serial')}
                className={`px-3 py-2.5 font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'serial' ? 'border-pixiu-blue text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal size={14} /> Serial Monitor
              </button>
            </div>
          </div>

          {/* TAB 1: C++ CODE EDITOR */}
          {activeTab === 'code' && (
            <div className="flex-1 flex flex-col p-4 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px] font-bold text-slate-300">sketch.ino • 16MHz C++</span>
                <button
                  onClick={() => setCode(activeExp.code)}
                  className="text-pixiu-blue hover:underline cursor-pointer text-[11px] font-bold"
                >
                  Reload Verified Code
                </button>
              </div>

              <div className="flex-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 font-mono text-xs text-slate-200 overflow-auto shadow-inner">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-full bg-transparent resize-none focus:outline-none leading-relaxed font-mono selection:bg-blue-600 selection:text-white"
                  spellCheck={false}
                />
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-1">
                <div className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  {activeExp.title}
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {activeExp.description}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: THEORY & COMPONENT DATASHEET */}
          {activeTab === 'theory' && (
            <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen size={16} className="text-pixiu-blue" />
                  Robotics Hardware Datasheet
                </h3>
                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-mono text-[10px] font-bold uppercase">
                  Classroom Guide
                </span>
              </div>

              {/* Selector Pills */}
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(COMPONENT_DATASHEETS).map(k => (
                  <button
                    key={k}
                    onClick={() => setActiveDatasheetKey(k)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs capitalize transition-all cursor-pointer ${
                      activeDatasheetKey === k ? 'bg-pixiu-blue text-white shadow-sm' : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Active Component Details */}
              {COMPONENT_DATASHEETS[activeDatasheetKey] && (
                <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div>
                    <span className="text-[10px] font-mono text-pixiu-blue font-bold uppercase tracking-wider block">
                      {COMPONENT_DATASHEETS[activeDatasheetKey].category}
                    </span>
                    <h4 className="text-base font-bold text-white mt-0.5">
                      {COMPONENT_DATASHEETS[activeDatasheetKey].title}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-1 bg-slate-950 p-2 rounded-lg border border-slate-800">
                      {COMPONENT_DATASHEETS[activeDatasheetKey].specs}
                    </p>
                  </div>

                  <div>
                    <h5 className="font-bold text-slate-300 mb-1">Working Principle:</h5>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      {COMPONENT_DATASHEETS[activeDatasheetKey].summary}
                    </p>
                  </div>

                  <div>
                    <h5 className="font-bold text-amber-400 mb-1 flex items-center gap-1">
                      <AlertTriangle size={13} /> Common Wiring Mistakes & Safety Rules:
                    </h5>
                    <ul className="space-y-1.5 text-slate-400 text-[11px]">
                      {COMPONENT_DATASHEETS[activeDatasheetKey].rules.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE SERIAL MONITOR */}
          {activeTab === 'serial' && (
            <div className="flex-1 flex flex-col p-4 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                  <Terminal size={14} /> Serial Port • 9600 Baud Rate
                </span>
                <button
                  onClick={() => setSerialOutput([])}
                  className="text-slate-400 hover:text-white text-[10px] font-bold cursor-pointer"
                >
                  Clear Terminal
                </button>
              </div>

              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-3 font-mono text-[11px] text-emerald-400 overflow-y-auto space-y-1 shadow-inner">
                {serialOutput.map((line, idx) => (
                  <div key={idx} className="leading-tight">
                    <span className="text-slate-600 mr-2">[{idx + 1}]</span>
                    <span>{line}</span>
                  </div>
                ))}
                {serialOutput.length === 0 && (
                  <div className="text-slate-600 italic">Serial Monitor waiting for code execution...</div>
                )}
              </div>
            </div>
          )}

        </div>

      </main>

    </div>
  );
}
