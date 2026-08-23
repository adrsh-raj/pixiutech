export const GRADES = [
  { id: 'c6', name: 'Class 6', desc: 'Light, Signal and Simple Automation' },
  { id: 'c7', name: 'Class 7', desc: 'Sensing the Environment' },
  { id: 'c8', name: 'Class 8', desc: 'Measurement & Mobile Robotics' },
  { id: 'c9', name: 'Class 9', desc: 'Safety & Autonomous Robots' },
  { id: 'c11', name: 'Class 11', desc: 'Capstone Engineering' },
]

export const MATERIALS = [
  // CLASS 6
  { 
    id: 'c6-book', classId: 'c6', title: 'Class 6 Robotics Lab Book', format: 'book', 
    meta: 'Class 6 • Whole course • 0.47 MB • v1.0 • 2026-08-19', 
    desc: '34 pages - all five units, three projects, quizzes and answer key', 
    uploaded: true, url: '/materials/class6-unit1-student-watermarked.pdf' 
  },
  { 
    id: 'c6-code1', classId: 'c6', title: 'TrafficLight.ino', format: 'code', 
    meta: 'Class 6 • Session 7 • v1.0 • 2026-08-19', 
    desc: 'Unit 3 - the traffic signal cycle, page 16 of the book', 
    uploaded: false 
  },
  { 
    id: 'c6-code2', classId: 'c6', title: 'NightLamp.ino', format: 'code', 
    meta: 'Class 6 • Session 10 • v1.0 • 2026-08-19', 
    desc: 'Unit 4 - LDR threshold logic with Serial output', 
    uploaded: false 
  },
  { 
    id: 'c6-code3', classId: 'c6', title: 'SmartTollBooth.ino', format: 'code', 
    meta: 'Class 6 • Session 14 • v1.0 • 2026-08-19', 
    desc: 'Unit 5 - ultrasonic + servo barrier with vehicle counter', 
    uploaded: false 
  },

  // CLASS 7
  { 
    id: 'c7-book', classId: 'c7', title: 'Class 7 Robotics Lab Book', format: 'book', 
    meta: 'Class 7 • Whole course • 0.52 MB • v1.0 • 2026-08-19', 
    desc: '36 pages - sensing the environment, complete curriculum', 
    uploaded: true, url: '/materials/class7-unit1-student-watermarked.pdf' 
  },
  { 
    id: 'c7-code1', classId: 'c7', title: 'LedDimmer.ino', format: 'code', 
    meta: 'Class 7 • Session 7 • v1.0 • 2026-08-19', 
    desc: 'Unit 3 - PWM fading and analog read', 
    uploaded: true, url: '#' 
  },
  { 
    id: 'c7-code2', classId: 'c7', title: 'TempHumidityMonitor.ino', format: 'code', 
    meta: 'Class 7 • Session 10 • v1.0 • 2026-08-19', 
    desc: 'Unit 4 - DHT11 sensor integration and LCD output', 
    uploaded: false 
  },
  { 
    id: 'c7-code3', classId: 'c7', title: 'SmartRainAlarm.ino', format: 'code', 
    meta: 'Class 7 • Session 14 • v1.0 • 2026-08-19', 
    desc: 'Unit 5 - Analog rain sensor with buzzer alerts', 
    uploaded: false 
  },

  // CLASS 8
  { 
    id: 'c8-book', classId: 'c8', title: 'Class 8 Robotics Lab Book', format: 'book', 
    meta: 'Class 8 • Whole course • 0.60 MB • v1.0 • 2026-08-19', 
    desc: '39 pages - measurement, automation and mobile robotics', 
    uploaded: true, url: '/materials/class8-unit1-student-watermarked.pdf' 
  },
  { 
    id: 'c8-code1', classId: 'c8', title: 'HeightStation.ino', format: 'code', 
    meta: 'Class 8 • Session 6 • v1.0 • 2026-08-19', 
    desc: 'Unit 3 - Ultrasonic sensor distance measurement', 
    uploaded: false 
  },
  { 
    id: 'c8-code2', classId: 'c8', title: 'SmartDustbin.ino', format: 'code', 
    meta: 'Class 8 • Session 10 • v1.0 • 2026-08-19', 
    desc: 'Unit 4 - Servo motor integration with ultrasonic trigger', 
    uploaded: false 
  },

  // CLASS 9
  { 
    id: 'c9-book', classId: 'c9', title: 'Class 9 Robotics Lab Book', format: 'book', 
    meta: 'Class 9 • Whole course • 0.68 MB • v1.0 • 2026-08-19', 
    desc: '43 pages - safety systems, displays and autonomous robots', 
    uploaded: true, url: '/materials/class9-unit1-student-watermarked.pdf' 
  },
  { 
    id: 'c9-code1', classId: 'c9', title: 'FireSecurityAlarm.ino', format: 'code', 
    meta: 'Class 9 • Session 7 • v1.0 • 2026-08-19', 
    desc: 'Unit 3 - Flame sensor logic and latching alarms', 
    uploaded: false 
  },

  // CLASS 11
  { 
    id: 'c11-book', classId: 'c11', title: 'Class 11 Robotics Lab Book', format: 'book', 
    meta: 'Class 11 • Whole course • 0.72 MB • v1.0 • 2026-08-19', 
    desc: '41 pages - integrated systems, data and capstone engineering', 
    uploaded: true, url: '/materials/class11-unit1-student-watermarked.pdf' 
  },
  { 
    id: 'c11-code1', classId: 'c11', title: 'MazeSolver.ino', format: 'code', 
    meta: 'Class 11 • Session 14 • v1.0 • 2026-08-19', 
    desc: 'Unit 5 - State machine and path memory algorithm', 
    uploaded: false 
  }
]
