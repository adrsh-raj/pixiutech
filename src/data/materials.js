export const GRADES = [
  { id: 'c6', name: 'Class 6', desc: 'Light, Signal and Simple Automation' },
  { id: 'c7', name: 'Class 7', desc: 'Sensing the Environment' },
  { id: 'c8', name: 'Class 8', desc: 'Measurement & Mobile Robotics' },
  { id: 'c9', name: 'Class 9', desc: 'Safety & Autonomous Robots' },
  { id: 'c11', name: 'Class 11', desc: 'Capstone Engineering' },
]

export const MATERIALS = [
  // ================= CLASS 6 =================
  { id: 'c6-u1', classId: 'c6', title: 'Unit 1: Introduction', format: 'book', meta: 'Class 6 • Unit 1 • 2026-08-19', desc: 'What Is a Robot, and What Is in Your Box', uploaded: true, url: '/materials/class6-unit1-student-watermarked.pdf' },
  { id: 'c6-u2', classId: 'c6', title: 'Unit 2: The Arduino IDE', format: 'book', meta: 'Class 6 • Unit 2 • 2026-08-19', desc: 'Meet the Board and the Software', uploaded: true, url: '/materials/class6-unit2-student-watermarked.pdf' },
  { id: 'c6-u3', classId: 'c6', title: 'Unit 3: Traffic Light Controller', format: 'book', meta: 'Class 6 • Unit 3 • 2026-08-19', desc: 'Basic Project: Wiring and Coding the Signal', uploaded: true, url: '/materials/class6-unit3-student-watermarked.pdf' },
  { id: 'c6-u4', classId: 'c6', title: 'Unit 4: Automatic Night Lamp', format: 'book', meta: 'Class 6 • Unit 4 • 2026-08-19', desc: 'Intermediate Project: LDR sensor logic', uploaded: true, url: '/materials/class6-unit4-student-watermarked.pdf' },
  { id: 'c6-u5', classId: 'c6', title: 'Unit 5: Smart Toll Booth', format: 'book', meta: 'Class 6 • Unit 5 • 2026-08-19', desc: 'Final Project: Ultrasonic and Servo Integration', uploaded: true, url: '/materials/class6-unit5-student-watermarked.pdf' },
  { id: 'c6-u6', classId: 'c6', title: 'Extra Challenges & Revision', format: 'book', meta: 'Class 6 • Unit 6 • 2026-08-19', desc: 'Advanced exercises and twenty revision questions', uploaded: true, url: '/materials/class6-unit6-student-watermarked.pdf' },
  { id: 'c6-code1', classId: 'c6', title: 'TrafficLight.ino', format: 'code', meta: 'Class 6 • Session 7 • v1.0', desc: 'Unit 3 - the traffic signal cycle, page 16 of the book', uploaded: false },
  { id: 'c6-code2', classId: 'c6', title: 'SmartTollBooth.ino', format: 'code', meta: 'Class 6 • Session 14 • v1.0', desc: 'Unit 5 - ultrasonic + servo barrier with vehicle counter', uploaded: false },

  // ================= CLASS 7 =================
  { id: 'c7-u1', classId: 'c7', title: 'Unit 1: Introduction', format: 'book', meta: 'Class 7 • Unit 1 • 2026-08-19', desc: 'The Digital World and the Analog World', uploaded: true, url: '/materials/class7-unit1-student-watermarked.pdf' },
  { id: 'c7-u2', classId: 'c7', title: 'Unit 2: The Arduino IDE', format: 'book', meta: 'Class 7 • Unit 2 • 2026-08-19', desc: 'analogRead, map and PWM basics', uploaded: true, url: '/materials/class7-unit2-student-watermarked.pdf' },
  { id: 'c7-u3', classId: 'c7', title: 'Unit 3: LED Dimmer & Mood Light', format: 'book', meta: 'Class 7 • Unit 3 • 2026-08-19', desc: 'Basic Project: Reading the Potentiometer', uploaded: true, url: '/materials/class7-unit3-student-watermarked.pdf' },
  { id: 'c7-u4', classId: 'c7', title: 'Unit 4: Temp & Humidity Monitor', format: 'book', meta: 'Class 7 • Unit 4 • 2026-08-19', desc: 'Intermediate Project: The DHT11 and Your First Library', uploaded: true, url: '/materials/class7-unit4-student-watermarked.pdf' },
  { id: 'c7-u5', classId: 'c7', title: 'Unit 5: Smart Rain Alarm', format: 'book', meta: 'Class 7 • Unit 5 • 2026-08-19', desc: 'Final Project: How a Rain Sensor Works', uploaded: true, url: '/materials/class7-unit5-student-watermarked.pdf' },
  { id: 'c7-u6', classId: 'c7', title: 'Extra Challenges & Revision', format: 'book', meta: 'Class 7 • Unit 6 • 2026-08-19', desc: 'Advanced exercises and twenty revision questions', uploaded: true, url: '/materials/class7-unit6-student-watermarked.pdf' },
  { id: 'c7-code1', classId: 'c7', title: 'TempHumidityMonitor.ino', format: 'code', meta: 'Class 7 • Session 10 • v1.0', desc: 'Unit 4 - DHT11 sensor integration and LCD output', uploaded: false },

  // ================= CLASS 8 =================
  { id: 'c8-u1', classId: 'c8', title: 'Unit 1: Introduction', format: 'book', meta: 'Class 8 • Unit 1 • 2026-08-19', desc: 'Machines That Measure, and What Is in Your Box', uploaded: true, url: '/materials/class8-unit1-student-watermarked.pdf' },
  { id: 'c8-u2', classId: 'c8', title: 'Unit 2: The Arduino IDE', format: 'book', meta: 'Class 8 • Unit 2 • 2026-08-19', desc: 'Numbers, Timing and the Serial Monitor', uploaded: true, url: '/materials/class8-unit2-student-watermarked.pdf' },
  { id: 'c8-u3', classId: 'c8', title: 'Unit 3: Height Measurement', format: 'book', meta: 'Class 8 • Unit 3 • 2026-08-19', desc: 'Basic Project: How an Ultrasonic Sensor Really Works', uploaded: true, url: '/materials/class8-unit3-student-watermarked.pdf' },
  { id: 'c8-u4', classId: 'c8', title: 'Unit 4: Smart Contactless Dustbin', format: 'book', meta: 'Class 8 • Unit 4 • 2026-08-19', desc: 'Intermediate Project: Servo Motors and the Lid Mechanism', uploaded: true, url: '/materials/class8-unit4-student-watermarked.pdf' },
  { id: 'c8-u5', classId: 'c8', title: 'Unit 5: Obstacle-Avoiding Robot', format: 'book', meta: 'Class 8 • Unit 5 • 2026-08-19', desc: 'Final Project: Motors, the H-Bridge and Battery Safety', uploaded: true, url: '/materials/class8-unit5-student-watermarked.pdf' },
  { id: 'c8-u6', classId: 'c8', title: 'Extra Challenges & Revision', format: 'book', meta: 'Class 8 • Unit 6 • 2026-08-19', desc: 'Advanced exercises and twenty revision questions', uploaded: true, url: '/materials/class8-unit6-student-watermarked.pdf' },
  { id: 'c8-code1', classId: 'c8', title: 'HeightStation.ino', format: 'code', meta: 'Class 8 • Session 6 • v1.0', desc: 'Unit 3 - Ultrasonic sensor distance measurement', uploaded: false },

  // ================= CLASS 9 =================
  { id: 'c9-u1', classId: 'c9', title: 'Unit 1: Introduction', format: 'book', meta: 'Class 9 • Unit 1 • 2026-08-19', desc: 'Systems That Sense, and What Is in Your Box', uploaded: true, url: '/materials/class9-unit1-student-watermarked.pdf' },
  { id: 'c9-u2', classId: 'c9', title: 'Unit 2: The Arduino IDE', format: 'book', meta: 'Class 9 • Unit 2 • 2026-08-19', desc: 'Inside the Board and Inside the Chip', uploaded: true, url: '/materials/class9-unit2-student-watermarked.pdf' },
  { id: 'c9-u3', classId: 'c9', title: 'Unit 3: Fire Security Alarm', format: 'book', meta: 'Class 9 • Unit 3 • 2026-08-19', desc: 'Basic Project: Inside a Flame Sensor', uploaded: true, url: '/materials/class9-unit3-student-watermarked.pdf' },
  { id: 'c9-u4', classId: 'c9', title: 'Unit 4: Smart LCD Weather', format: 'book', meta: 'Class 9 • Unit 4 • 2026-08-19', desc: 'Intermediate Project: Inside a Liquid Crystal Display', uploaded: true, url: '/materials/class9-unit4-student-watermarked.pdf' },
  { id: 'c9-u5', classId: 'c9', title: 'Unit 5: Line Following Robot', format: 'book', meta: 'Class 9 • Unit 5 • 2026-08-19', desc: 'Final Project: The Four-Case Algorithm', uploaded: true, url: '/materials/class9-unit5-student-watermarked.pdf' },
  { id: 'c9-u6', classId: 'c9', title: 'Extra Challenges & Revision', format: 'book', meta: 'Class 9 • Unit 6 • 2026-08-19', desc: 'Advanced exercises and twenty revision questions', uploaded: true, url: '/materials/class9-unit6-student-watermarked.pdf' },
  { id: 'c9-code1', classId: 'c9', title: 'LineFollowingRobot.ino', format: 'code', meta: 'Class 9 • Session 14 • v1.0', desc: 'Unit 5 - The four-case closed feedback loop algorithm', uploaded: false },

  // ================= CLASS 11 =================
  { id: 'c11-u1', classId: 'c11', title: 'Unit 1: Introduction', format: 'book', meta: 'Class 11 • Unit 1 • 2026-08-19', desc: 'Engineering a System, Error and Uncertainty', uploaded: true, url: '/materials/class11-unit1-student-watermarked.pdf' },
  { id: 'c11-u2', classId: 'c11', title: 'Unit 2: The Arduino IDE', format: 'book', meta: 'Class 11 • Unit 2 • 2026-08-19', desc: 'Data Acquisition and Non-Blocking Code', uploaded: true, url: '/materials/class11-unit2-student-watermarked.pdf' },
  { id: 'c11-u3', classId: 'c11', title: 'Unit 3: Laser Security', format: 'book', meta: 'Class 11 • Unit 3 • 2026-08-19', desc: 'Basic Project: Laser Diodes and Optical Alignment', uploaded: true, url: '/materials/class11-unit3-student-watermarked.pdf' },
  { id: 'c11-u4', classId: 'c11', title: 'Unit 4: Ultrasonic Calibration', format: 'book', meta: 'Class 11 • Unit 4 • 2026-08-19', desc: 'Intermediate Project: Filtering and Error Analysis', uploaded: true, url: '/materials/class11-unit4-student-watermarked.pdf' },
  { id: 'c11-u5', classId: 'c11', title: 'Unit 5: Capstone Maze Solver', format: 'book', meta: 'Class 11 • Unit 5 • 2026-08-19', desc: 'Final Project: State Machines and Path Memory', uploaded: true, url: '/materials/class11-unit5-student-watermarked.pdf' },
  { id: 'c11-u6', classId: 'c11', title: 'Extra Challenges & Revision', format: 'book', meta: 'Class 11 • Unit 6 • 2026-08-19', desc: 'Advanced exercises and twenty revision questions', uploaded: true, url: '/materials/class11-unit6-student-watermarked.pdf' },
  { id: 'c11-code1', classId: 'c11', title: 'MazeSolver.ino', format: 'code', meta: 'Class 11 • Session 14 • v1.0', desc: 'Unit 5 - State machine and path memory algorithm', uploaded: false },
]
