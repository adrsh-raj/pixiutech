// Default Initial Data Seed for Client-Side Fallback / Offline / Vercel Deployments

export const SEED_SCHOOLS = [
  {
    id: 'ZPS',
    name: 'Zenith Public School',
    code: 'ZPS',
    principal: 'Dr. R.K. Sharma',
    contact: '9876543210',
    status: 'Active',
    contract_start: '2026-04-01',
    renewal_date: '2027-03-31',
    expected_revenue: 100000
  }
];

export const SEED_CLASSES = [
  { id: 'CLS-ZPS-6A', school_id: 'ZPS', grade: '6', section: 'A', stream: 'General STEM', student_count: 5 },
  { id: 'CLS-ZPS-7A', school_id: 'ZPS', grade: '7', section: 'A', stream: 'General STEM', student_count: 5 },
  { id: 'CLS-ZPS-8A', school_id: 'ZPS', grade: '8', section: 'A', stream: 'General STEM', student_count: 5 },
  { id: 'CLS-ZPS-9A', school_id: 'ZPS', grade: '9', section: 'A', stream: 'General STEM', student_count: 5 },
  { id: 'CLS-ZPS-11A', school_id: 'ZPS', grade: '11', section: 'A', stream: 'AI & Robotics', student_count: 5 },
];

export const SEED_STUDENTS = [
  // Class 6A (Level 1)
  { student_id: 'ZPS6A 01', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', name: 'Aarav Sharma', parent_name: 'Ravi Sharma', parent_whatsapp: '919876543210', tech_level: 'Level 1', assigned_kit_id: 'KIT-ZPS-01', status: 'Active' },
  { student_id: 'ZPS6A 02', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', name: 'Ananya Verma', parent_name: 'Sanjay Verma', parent_whatsapp: '919876543211', tech_level: 'Level 1', assigned_kit_id: 'KIT-ZPS-02', status: 'Active' },
  { student_id: 'ZPS6A 03', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', name: 'Rohan Gupta', parent_name: 'Amit Gupta', parent_whatsapp: '919876543212', tech_level: 'Level 1', assigned_kit_id: 'KIT-ZPS-03', status: 'Active' },
  { student_id: 'ZPS6A 04', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', name: 'Ishita Singh', parent_name: 'Rajesh Singh', parent_whatsapp: '919876543213', tech_level: 'Level 1', assigned_kit_id: 'KIT-ZPS-04', status: 'Active' },
  { student_id: 'ZPS6A 05', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', name: 'Kabir Mehta', parent_name: 'Vikram Mehta', parent_whatsapp: '919876543214', tech_level: 'Level 1', assigned_kit_id: 'KIT-ZPS-05', status: 'Active' },

  // Class 7A (Level 2)
  { student_id: 'ZPS7A 01', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', name: 'Devansh Tiwari', parent_name: 'Manoj Tiwari', parent_whatsapp: '919876543215', tech_level: 'Level 2', assigned_kit_id: 'KIT-ZPS-06', status: 'Active' },
  { student_id: 'ZPS7A 02', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', name: 'Meera Nair', parent_name: 'Prakash Nair', parent_whatsapp: '919876543216', tech_level: 'Level 2', assigned_kit_id: 'KIT-ZPS-07', status: 'Active' },
  { student_id: 'ZPS7A 03', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', name: 'Aditya Patel', parent_name: 'Ketan Patel', parent_whatsapp: '919876543217', tech_level: 'Level 2', assigned_kit_id: 'KIT-ZPS-08', status: 'Active' },
  { student_id: 'ZPS7A 04', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', name: 'Saanvi Joshi', parent_name: 'Deepak Joshi', parent_whatsapp: '919876543218', tech_level: 'Level 2', assigned_kit_id: 'KIT-ZPS-09', status: 'Active' },
  { student_id: 'ZPS7A 05', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', name: 'Yash Vardhan', parent_name: 'Alok Vardhan', parent_whatsapp: '919876543219', tech_level: 'Level 2', assigned_kit_id: 'KIT-ZPS-10', status: 'Active' },

  // Class 8A (Level 3)
  { student_id: 'ZPS8A 01', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', name: 'Siddharth Roy', parent_name: 'Anirban Roy', parent_whatsapp: '919876543220', tech_level: 'Level 3', assigned_kit_id: 'KIT-ZPS-11', status: 'Active' },
  { student_id: 'ZPS8A 02', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', name: 'Diya Kapoor', parent_name: 'Sunil Kapoor', parent_whatsapp: '919876543221', tech_level: 'Level 3', assigned_kit_id: 'KIT-ZPS-12', status: 'Active' },
  { student_id: 'ZPS8A 03', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', name: 'Harsh Agarwal', parent_name: 'Pankaj Agarwal', parent_whatsapp: '919876543222', tech_level: 'Level 3', assigned_kit_id: 'KIT-ZPS-13', status: 'Active' },
  { student_id: 'ZPS8A 04', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', name: 'Tanvi Saxena', parent_name: 'Ramesh Saxena', parent_whatsapp: '919876543223', tech_level: 'Level 3', assigned_kit_id: 'KIT-ZPS-14', status: 'Active' },
  { student_id: 'ZPS8A 05', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', name: 'Reyansh Dubey', parent_name: 'Shyam Dubey', parent_whatsapp: '919876543224', tech_level: 'Level 3', assigned_kit_id: 'KIT-ZPS-15', status: 'Active' },

  // Class 9A (Level 4)
  { student_id: 'ZPS9A 01', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', name: 'Arjun Reddy', parent_name: 'Venkat Reddy', parent_whatsapp: '919876543225', tech_level: 'Level 4', assigned_kit_id: 'KIT-ZPS-16', status: 'Active' },
  { student_id: 'ZPS9A 02', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', name: 'Sneha Kulkarni', parent_name: 'Milind Kulkarni', parent_whatsapp: '919876543226', tech_level: 'Level 4', assigned_kit_id: 'KIT-ZPS-17', status: 'Active' },
  { student_id: 'ZPS9A 03', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', name: 'Varun Malhotra', parent_name: 'Gaurav Malhotra', parent_whatsapp: '919876543227', tech_level: 'Level 4', assigned_kit_id: 'KIT-ZPS-18', status: 'Active' },
  { student_id: 'ZPS9A 04', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', name: 'Riya Sen', parent_name: 'Subhash Sen', parent_whatsapp: '919876543228', tech_level: 'Level 4', assigned_kit_id: 'KIT-ZPS-19', status: 'Active' },
  { student_id: 'ZPS9A 05', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', name: 'Dhruv Chauhan', parent_name: 'Pradeep Chauhan', parent_whatsapp: '919876543229', tech_level: 'Level 4', assigned_kit_id: 'KIT-ZPS-20', status: 'Active' },

  // Class 11A (Level 5)
  { student_id: 'ZPS11A 01', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', name: 'Aryan Srivastava', parent_name: 'Akhilesh Srivastava', parent_whatsapp: '919876543230', tech_level: 'Level 5', assigned_kit_id: 'KIT-ZPS-21', status: 'Active' },
  { student_id: 'ZPS11A 02', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', name: 'Pooja Bhatt', parent_name: 'Mahesh Bhatt', parent_whatsapp: '919876543231', tech_level: 'Level 5', assigned_kit_id: 'KIT-ZPS-22', status: 'Active' },
  { student_id: 'ZPS11A 03', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', name: 'Nikhil Kashyap', parent_name: 'Dinesh Kashyap', parent_whatsapp: '919876543232', tech_level: 'Level 5', assigned_kit_id: 'KIT-ZPS-23', status: 'Active' },
  { student_id: 'ZPS11A 04', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', name: 'Kavya Pandey', parent_name: 'Suresh Pandey', parent_whatsapp: '919876543233', tech_level: 'Level 5', assigned_kit_id: 'KIT-ZPS-24', status: 'Active' },
  { student_id: 'ZPS11A 05', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', name: 'Shaurya Mishra', parent_name: 'Satish Mishra', parent_whatsapp: '919876543234', tech_level: 'Level 5', assigned_kit_id: 'KIT-ZPS-25', status: 'Active' },
];

export const SEED_TRAINERS = [
  {
    id: 'TR-01',
    name: 'Vikas Pandey',
    phone: '9876543299',
    role: 'Lead AI & Robotics Instructor',
    assigned_schools: 'ZPS',
    daily_rate: 600,
    weekly_days: 2,
    rating: 5.0,
    status: 'Active'
  }
];

export const SEED_BILLING = [
  {
    id: 'INV-ZPS-01',
    school_id: 'ZPS',
    school_name: 'Zenith Public School',
    tranche_number: 1,
    tranche_title: 'Tranche 1: Lab Setup & Hardware Kit Dispatch (40%)',
    amount: 40000,
    total_contract_value: 100000,
    date_issued: '2026-08-01',
    due_date: '2026-08-15',
    paid_date: '2026-08-05',
    payment_method: 'NEFT Bank Transfer',
    place_of_supply: 'Hata, Uttar Pradesh',
    status: 'Paid',
    receipt_no: 'REC-ZPS-2026-01',
    is_confirmed: 1
  },
  {
    id: 'INV-ZPS-02',
    school_id: 'ZPS',
    school_name: 'Zenith Public School',
    tranche_number: 2,
    tranche_title: 'Tranche 2: Mid-Term Curriculum Delivery & IoT Integration (30%)',
    amount: 30000,
    total_contract_value: 100000,
    date_issued: '2026-08-25',
    due_date: '2026-09-15',
    paid_date: null,
    payment_method: null,
    place_of_supply: 'Hata, Uttar Pradesh',
    status: 'Pending',
    receipt_no: null,
    is_confirmed: 0
  },
  {
    id: 'INV-ZPS-03',
    school_id: 'ZPS',
    school_name: 'Zenith Public School',
    tranche_number: 3,
    tranche_title: 'Tranche 3: Final AI Capstone, Student Exhibition & Certification (30%)',
    amount: 30000,
    total_contract_value: 100000,
    date_issued: '2026-08-25',
    due_date: '2026-11-30',
    paid_date: null,
    payment_method: null,
    place_of_supply: 'Hata, Uttar Pradesh',
    status: 'Pending',
    receipt_no: null,
    is_confirmed: 0
  }
];

export const SEED_SESSIONS = [
  { id: 'SES-001', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', trainer_id: 'TR-01', date: '2026-08-28', time: '10:00 AM', topic: 'Arduino Digital Outputs & Blink LED', status: 'Completed', notes: 'All 5 students completed hands-on LED circuit.', is_locked: 1 },
  { id: 'SES-002', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', trainer_id: 'TR-01', date: '2026-08-28', time: '11:30 AM', topic: 'Dual IR Sensor Line Comparator Tuning', status: 'Completed', notes: 'Potentiometer sensitivity tuned.', is_locked: 1 },
  { id: 'SES-003', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', trainer_id: 'TR-01', date: '2026-08-29', time: '10:00 AM', topic: 'Ultrasonic Pulse Timing & Radar Sweep', status: 'Completed', notes: 'Servo sweep mapped with HC-SR04.', is_locked: 1 },
  { id: 'SES-004', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', trainer_id: 'TR-01', date: '2026-08-29', time: '12:00 PM', topic: 'ESP32 WiFi Telemetry & Cloud Dashboard', status: 'Completed', notes: 'MQTT broker connected.', is_locked: 1 },
  { id: 'SES-005', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', trainer_id: 'TR-01', date: '2026-08-30', time: '11:00 AM', topic: 'OpenCV Real-time Face & Object Detection', status: 'Completed', notes: 'Webcam feed processed in Python.', is_locked: 1 },
  { id: 'SES-006', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', trainer_id: 'TR-01', date: '2026-09-04', time: '10:00 AM', topic: 'Sensors: Light (LDR) & Obstacle (IR)', status: 'Planned', notes: 'Prepare Level 1 Unit 2 sensor kits.', is_locked: 0 },
];

export const SEED_ATTENDANCE = [
  { id: 'ATT-001', session_id: 'SES-001', student_id: 'ZPS6A 01', status: 'Present', timestamp: '2026-08-28 10:15:00', date: '2026-08-28', class_id: 'CLS-ZPS-6A', topic: 'Arduino Digital Outputs & Blink LED', is_locked: 1 },
  { id: 'ATT-002', session_id: 'SES-001', student_id: 'ZPS6A 02', status: 'Present', timestamp: '2026-08-28 10:15:00', date: '2026-08-28', class_id: 'CLS-ZPS-6A', topic: 'Arduino Digital Outputs & Blink LED', is_locked: 1 },
  { id: 'ATT-003', session_id: 'SES-001', student_id: 'ZPS6A 03', status: 'Present', timestamp: '2026-08-28 10:15:00', date: '2026-08-28', class_id: 'CLS-ZPS-6A', topic: 'Arduino Digital Outputs & Blink LED', is_locked: 1 },
  { id: 'ATT-004', session_id: 'SES-001', student_id: 'ZPS6A 04', status: 'Present', timestamp: '2026-08-28 10:15:00', date: '2026-08-28', class_id: 'CLS-ZPS-6A', topic: 'Arduino Digital Outputs & Blink LED', is_locked: 1 },
  { id: 'ATT-005', session_id: 'SES-001', student_id: 'ZPS6A 05', status: 'Absent', timestamp: '2026-08-28 10:15:00', date: '2026-08-28', class_id: 'CLS-ZPS-6A', topic: 'Arduino Digital Outputs & Blink LED', is_locked: 1 },
];

export const SEED_INVENTORY = [
  { id: 'KIT-ZPS-01', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 1', school_id: 'ZPS', assigned_student_id: 'ZPS6A 01', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
  { id: 'KIT-ZPS-02', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 1', school_id: 'ZPS', assigned_student_id: 'ZPS6A 02', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
  { id: 'KIT-ZPS-06', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 2', school_id: 'ZPS', assigned_student_id: 'ZPS7A 01', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
  { id: 'KIT-ZPS-11', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 3', school_id: 'ZPS', assigned_student_id: 'ZPS8A 01', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
  { id: 'KIT-ZPS-16', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 4', school_id: 'ZPS', assigned_student_id: 'ZPS9A 01', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
  { id: 'KIT-ZPS-21', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 5', school_id: 'ZPS', assigned_student_id: 'ZPS11A 01', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
];

export const SEED_ALERTS = [
  {
    id: 'ALT-BILLING-ZPS',
    type: 'billing_due',
    title: '💰 Tranche 1 Collected: ₹40,000 / ₹1,00,000 Reconciled',
    message: 'Zenith Public School Tranche 1 payment of ₹40,000 received. Tranche 2 due on Sep 15, 2026.',
    severity: 'info',
    related_id: 'INV-ZPS-01',
    action_label: 'View Billing Ledger',
    action_type: 'view_billing',
    is_read: 0,
    created_at: '2026-08-28'
  }
];

export const SEED_CURRICULUM = [
  // Level 1: Class 6
  { id: 'CUR-101', week: 'Unit 1', level: 'Level 1', topic: 'Introduction to Electricity & Basic Circuits', objectives: 'Understand current, voltage, breadboards and series/parallel LEDs', status: 'Completed' },
  { id: 'CUR-102', week: 'Unit 2', level: 'Level 1', topic: 'Sensors: Light (LDR) & Obstacle (IR)', objectives: 'Analog vs digital inputs, calibration and wiring', status: 'Completed' },
  { id: 'CUR-103', week: 'Unit 3', level: 'Level 1', topic: 'Actuators: Motors, Buzzers & Relays', objectives: 'Transistor switches, relay driver circuits, and sound actuation', status: 'Upcoming' },
  { id: 'CUR-104', week: 'Unit 4', level: 'Level 1', topic: 'Microcontroller (Arduino) Programming Basics', objectives: 'Digital output pin modes, delay timing, and serial monitor debugging', status: 'Upcoming' },
  { id: 'CUR-105', week: 'Unit 5', level: 'Level 1', topic: 'Project Building: Smart Obstacle Avoiding Rover', objectives: 'Assemble 2WD chassis, L298N motor driver, and ultrasonic avoidance algorithm', status: 'Upcoming' },
  { id: 'CUR-106', week: 'Unit 6', level: 'Level 1', topic: 'Capstone Project: Automated Smart Lab Environment', objectives: 'Final end-of-term presentation and smart automation build', status: 'Upcoming' },

  // Level 2: Class 7
  { id: 'CUR-201', week: 'Unit 1', level: 'Level 2', topic: 'Microcontrollers & C++ Coding Fundamentals', objectives: 'Microcontroller architecture, IDE setup, variables and conditional logic', status: 'Completed' },
  { id: 'CUR-202', week: 'Unit 2', level: 'Level 2', topic: 'Analog vs Digital Sensors & Signal Interfacing', objectives: 'ADC resolution, potentiometer voltage divider and threshold comparator', status: 'Completed' },
  { id: 'CUR-203', week: 'Unit 3', level: 'Level 2', topic: 'LCD Display & Sensor Data Visualization', objectives: 'I2C 16x2 LCD interface, custom character generation and live telemetry', status: 'Upcoming' },
  { id: 'CUR-204', week: 'Unit 4', level: 'Level 2', topic: 'Autonomous Line Follower Robotics', objectives: 'Dual IR reflectance arrays, Differential drive control and track optimization', status: 'Upcoming' },
  { id: 'CUR-205', week: 'Unit 5', level: 'Level 2', topic: 'Smart Irrigation & Environmental Telemetry', objectives: 'Soil moisture capacitive probes, submersible pump relay control', status: 'Upcoming' },
  { id: 'CUR-206', week: 'Unit 6', level: 'Level 2', topic: 'Capstone Project: Multi-Sensor Autonomous Rover', objectives: 'Integration of ultrasonic radar, line tracking, and autonomous pathfinding', status: 'Upcoming' },

  // Level 3: Class 8
  { id: 'CUR-301', week: 'Unit 1', level: 'Level 3', topic: 'PWM Motor Control & High-Speed Differential Steering', objectives: 'H-bridge motor drivers, PWM speed control and encoder feedback', status: 'Completed' },
  { id: 'CUR-302', week: 'Unit 2', level: 'Level 3', topic: 'Ultrasonic Echo Mapping & Collision Prevention', objectives: 'HC-SR04 pulse timing, servo radar sweep and distance mapping', status: 'Completed' },
  { id: 'CUR-303', week: 'Unit 3', level: 'Level 3', topic: 'Bluetooth Wireless Remote Teleoperation', objectives: 'HC-05 serial pairing, smartphone app control and command parsing', status: 'Upcoming' },
  { id: 'CUR-304', week: 'Unit 4', level: 'Level 3', topic: 'Advanced PID Line Follower System', objectives: 'Proportional-Integral-Derivative tuning for smooth high-speed curve navigation', status: 'Upcoming' },
  { id: 'CUR-305', week: 'Unit 5', level: 'Level 3', topic: 'IoT Sensor Logging & Real-time Web Monitoring', objectives: 'Cloud telemetry logging, sensor dashboard, and remote threshold alerting', status: 'Upcoming' },
  { id: 'CUR-306', week: 'Unit 6', level: 'Level 3', topic: 'Capstone Project: Bluetooth Combat / Surveillance Bot', objectives: 'High-torque 4WD chassis with wireless command link and modular payload', status: 'Upcoming' },

  // Level 4: Class 9
  { id: 'CUR-401', week: 'Unit 1', level: 'Level 4', topic: 'ESP32 & Wireless IoT Microcontrollers', objectives: 'ESP32 architecture, Wi-Fi station mode, web server and telemetry', status: 'Completed' },
  { id: 'CUR-402', week: 'Unit 2', level: 'Level 4', topic: 'Wi-Fi HTTP / MQTT Cloud Telemetry', objectives: 'REST API webhooks, MQTT publish/subscribe pubsub broker integration', status: 'Completed' },
  { id: 'CUR-403', week: 'Unit 3', level: 'Level 4', topic: 'Advanced Sensor Fusion & Gyro / Accelerometer', objectives: 'MPU6050 I2C communication, pitch-roll angle filtering and stabilization', status: 'Upcoming' },
  { id: 'CUR-404', week: 'Unit 4', level: 'Level 4', topic: 'Web Dashboard Integration & Remote Relay Control', objectives: 'Interactive WebSocket control interface for remote industrial actuation', status: 'Upcoming' },
  { id: 'CUR-405', week: 'Unit 5', level: 'Level 4', topic: 'Smart Campus IoT Gateway Architecture', objectives: 'Multi-node sensor network with centralized coordinator hub', status: 'Upcoming' },
  { id: 'CUR-406', week: 'Unit 6', level: 'Level 4', topic: 'Capstone Project: Full-Stack IoT Weather Station & Surveillance', objectives: 'Solar powered weather sensing node sending telemetry to cloud dashboard', status: 'Upcoming' },

  // Level 5: Class 11
  { id: 'CUR-501', week: 'Unit 1', level: 'Level 5', topic: 'Python for Computer Vision & Machine Intelligence', objectives: 'OpenCV basics, video stream capture, color masking and edge detection', status: 'Completed' },
  { id: 'CUR-502', week: 'Unit 2', level: 'Level 5', topic: 'OpenCV Color Masking & Contour Object Tracking', objectives: 'HSV color space calibration, morphological filters and centroid calculation', status: 'Completed' },
  { id: 'CUR-503', week: 'Unit 3', level: 'Level 5', topic: 'Haar Cascade Facial Recognition & Surveillance', objectives: 'Pretrained Haar cascades, multi-face tracking and attendance logging', status: 'Upcoming' },
  { id: 'CUR-504', week: 'Unit 4', level: 'Level 5', topic: 'YOLO Object Detection & Neural Network Inferencing', objectives: 'YOLOv8 deep learning model on edge devices, bounding box parsing', status: 'Upcoming' },
  { id: 'CUR-505', week: 'Unit 5', level: 'Level 5', topic: 'MediaPipe Edge AI Gesture Mapping', objectives: 'Hand landmark detection and gesture-controlled robotic actuation', status: 'Upcoming' },
  { id: 'CUR-506', week: 'Unit 6', level: 'Level 5', topic: 'Capstone Project: Autonomous Vision Surveillance Rover', objectives: 'Real-time object tracking and autonomous rover obstacle navigation', status: 'Upcoming' }
];

// Full 60 Curriculum Content Materials (Units 1-6 for Classes 6, 7, 8, 9, 11)
export const SEED_CONTENT = [
  // ==================== CLASS 6 (LEVEL 1) ====================
  // Unit 1
  { id: 'CNT-601-S', title: 'Class 6 - Unit 1: Basic Circuits (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Student', url: '/materials/class6-unit1-student-watermarked.pdf', description: 'Level 1 Unit 1 Student Study Material with Circuit Schematics' },
  { id: 'CNT-601-T', title: 'Class 6 - Unit 1: Basic Circuits (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Teacher', url: '/materials/class6-unit1-teacher.pdf', description: 'Level 1 Unit 1 Instructor Guide & Lesson Plan' },
  // Unit 2
  { id: 'CNT-602-S', title: 'Class 6 - Unit 2: Sensors LDR & IR (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Student', url: '/materials/class6-unit2-student-watermarked.pdf', description: 'Level 1 Unit 2 Light & Obstacle Sensor Manual' },
  { id: 'CNT-602-T', title: 'Class 6 - Unit 2: Sensors LDR & IR (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Teacher', url: '/materials/class6-unit2-teacher.pdf', description: 'Level 1 Unit 2 Instructor Calibration Guide' },
  // Unit 3
  { id: 'CNT-603-S', title: 'Class 6 - Unit 3: Motors & Actuators (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Student', url: '/materials/class6-unit3-student-watermarked.pdf', description: 'Level 1 Unit 3 Motors, Buzzers & Relays Build Guide' },
  { id: 'CNT-603-T', title: 'Class 6 - Unit 3: Motors & Actuators (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Teacher', url: '/materials/class6-unit3-teacher.pdf', description: 'Level 1 Unit 3 Teacher Lesson Plan' },
  // Unit 4
  { id: 'CNT-604-S', title: 'Class 6 - Unit 4: Microcontroller Intro (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Student', url: '/materials/class6-unit4-student-watermarked.pdf', description: 'Level 1 Unit 4 Arduino Coding & Pin Mapping' },
  { id: 'CNT-604-T', title: 'Class 6 - Unit 4: Microcontroller Intro (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Teacher', url: '/materials/class6-unit4-teacher.pdf', description: 'Level 1 Unit 4 Coding Walkthrough Guide' },
  // Unit 5
  { id: 'CNT-605-S', title: 'Class 6 - Unit 5: Obstacle Rover Project (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Student', url: '/materials/class6-unit5-student-watermarked.pdf', description: 'Level 1 Unit 5 2WD Autonomous Chassis Build' },
  { id: 'CNT-605-T', title: 'Class 6 - Unit 5: Obstacle Rover Project (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Teacher', url: '/materials/class6-unit5-teacher.pdf', description: 'Level 1 Unit 5 Project Assembly Rubric' },
  // Unit 6
  { id: 'CNT-606-S', title: 'Class 6 - Unit 6: Smart Lab Capstone (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Student', url: '/materials/class6-unit6-student-watermarked.pdf', description: 'Level 1 Unit 6 Capstone Project Guidelines' },
  { id: 'CNT-606-T', title: 'Class 6 - Unit 6: Smart Lab Capstone (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Teacher', url: '/materials/class6-unit6-teacher.pdf', description: 'Level 1 Unit 6 Evaluation Guide' },

  // ==================== CLASS 7 (LEVEL 2) ====================
  // Unit 1
  { id: 'CNT-701-S', title: 'Class 7 - Unit 1: C++ Fundamentals (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Student', url: '/materials/class7-unit1-student-watermarked.pdf', description: 'Level 2 Unit 1 Logic, Variables & Loops' },
  { id: 'CNT-701-T', title: 'Class 7 - Unit 1: C++ Fundamentals (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Teacher', url: '/materials/class7-unit1-teacher.pdf', description: 'Level 2 Unit 1 Instructor Guide' },
  // Unit 2
  { id: 'CNT-702-S', title: 'Class 7 - Unit 2: Analog Sensor Interfacing (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Student', url: '/materials/class7-unit2-student-watermarked.pdf', description: 'Level 2 Unit 2 ADC Resolution & Potentiometers' },
  { id: 'CNT-702-T', title: 'Class 7 - Unit 2: Analog Sensor Interfacing (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Teacher', url: '/materials/class7-unit2-teacher.pdf', description: 'Level 2 Unit 2 Calibration Lesson Plan' },
  // Unit 3
  { id: 'CNT-703-S', title: 'Class 7 - Unit 3: I2C LCD Display (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Student', url: '/materials/class7-unit3-student-watermarked.pdf', description: 'Level 2 Unit 3 16x2 Display Telemetry Interfacing' },
  { id: 'CNT-703-T', title: 'Class 7 - Unit 3: I2C LCD Display (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Teacher', url: '/materials/class7-unit3-teacher.pdf', description: 'Level 2 Unit 3 I2C Addressing Guide' },
  // Unit 4
  { id: 'CNT-704-S', title: 'Class 7 - Unit 4: Line Follower Robot (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Student', url: '/materials/class7-unit4-student-watermarked.pdf', description: 'Level 2 Unit 4 Dual IR Sensor Line Follower' },
  { id: 'CNT-704-T', title: 'Class 7 - Unit 4: Line Follower Robot (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Teacher', url: '/materials/class7-unit4-teacher.pdf', description: 'Level 2 Unit 4 Algorithm Troubleshooting' },
  // Unit 5
  { id: 'CNT-705-S', title: 'Class 7 - Unit 5: Smart Irrigation System (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Student', url: '/materials/class7-unit5-student-watermarked.pdf', description: 'Level 2 Unit 5 Soil Probe & Pump Automation' },
  { id: 'CNT-705-T', title: 'Class 7 - Unit 5: Smart Irrigation System (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Teacher', url: '/materials/class7-unit5-teacher.pdf', description: 'Level 2 Unit 5 Project Guide' },
  // Unit 6
  { id: 'CNT-706-S', title: 'Class 7 - Unit 6: Multi-Sensor Capstone (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Student', url: '/materials/class7-unit6-student-watermarked.pdf', description: 'Level 2 Unit 6 Capstone Project Guidelines' },
  { id: 'CNT-706-T', title: 'Class 7 - Unit 6: Multi-Sensor Capstone (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Teacher', url: '/materials/class7-unit6-teacher.pdf', description: 'Level 2 Unit 6 Evaluation Guide' },

  // ==================== CLASS 8 (LEVEL 3) ====================
  // Unit 1
  { id: 'CNT-801-S', title: 'Class 8 - Unit 1: PWM Motor Control (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Student', url: '/materials/class8-unit1-student-watermarked.pdf', description: 'Level 3 Unit 1 Differential Drive & Speed Tuning' },
  { id: 'CNT-801-T', title: 'Class 8 - Unit 1: PWM Motor Control (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Teacher', url: '/materials/class8-unit1-teacher.pdf', description: 'Level 3 Unit 1 Driver Schematic Guide' },
  // Unit 2
  { id: 'CNT-802-S', title: 'Class 8 - Unit 2: Ultrasonic Echo Mapping (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Student', url: '/materials/class8-unit2-student-watermarked.pdf', description: 'Level 3 Unit 2 HC-SR04 Radar Sweep Algorithm' },
  { id: 'CNT-802-T', title: 'Class 8 - Unit 2: Ultrasonic Echo Mapping (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Teacher', url: '/materials/class8-unit2-teacher.pdf', description: 'Level 3 Unit 2 Lesson Plan' },
  // Unit 3
  { id: 'CNT-803-S', title: 'Class 8 - Unit 3: Bluetooth Remote Control (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Student', url: '/materials/class8-unit3-student-watermarked.pdf', description: 'Level 3 Unit 3 HC-05 Wireless App Pairing' },
  { id: 'CNT-803-T', title: 'Class 8 - Unit 3: Bluetooth Remote Control (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Teacher', url: '/materials/class8-unit3-teacher.pdf', description: 'Level 3 Unit 3 Wireless Troubleshooting' },
  // Unit 4
  { id: 'CNT-804-S', title: 'Class 8 - Unit 4: PID Line Tracking (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Student', url: '/materials/class8-unit4-student-watermarked.pdf', description: 'Level 3 Unit 4 PID Controller Mathematics & Tuning' },
  { id: 'CNT-804-T', title: 'Class 8 - Unit 4: PID Line Tracking (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Teacher', url: '/materials/class8-unit4-teacher.pdf', description: 'Level 3 Unit 4 Tuning Rubric' },
  // Unit 5
  { id: 'CNT-805-S', title: 'Class 8 - Unit 5: IoT Cloud Data Logging (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Student', url: '/materials/class8-unit5-student-watermarked.pdf', description: 'Level 3 Unit 5 Real-time Sensor Logging Dashboard' },
  { id: 'CNT-805-T', title: 'Class 8 - Unit 5: IoT Cloud Data Logging (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Teacher', url: '/materials/class8-unit5-teacher.pdf', description: 'Level 3 Unit 5 Cloud Integration Guide' },
  // Unit 6
  { id: 'CNT-806-S', title: 'Class 8 - Unit 6: Combat Bot Capstone (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Student', url: '/materials/class8-unit6-student-watermarked.pdf', description: 'Level 3 Unit 6 4WD Bluetooth Combat Rover' },
  { id: 'CNT-806-T', title: 'Class 8 - Unit 6: Combat Bot Capstone (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Teacher', url: '/materials/class8-unit6-teacher.pdf', description: 'Level 3 Unit 6 Evaluation Guide' },

  // ==================== CLASS 9 (LEVEL 4) ====================
  // Unit 1
  { id: 'CNT-901-S', title: 'Class 9 - Unit 1: ESP32 IoT Microcontrollers (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Student', url: '/materials/class9-unit1-student-watermarked.pdf', description: 'Level 4 Unit 1 ESP32 Dual Core & Wi-Fi Station Mode' },
  { id: 'CNT-901-T', title: 'Class 9 - Unit 1: ESP32 IoT Microcontrollers (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Teacher', url: '/materials/class9-unit1-teacher.pdf', description: 'Level 4 Unit 1 ESP32 Setup & Toolchain' },
  // Unit 2
  { id: 'CNT-902-S', title: 'Class 9 - Unit 2: HTTP & MQTT Cloud Protocols (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Student', url: '/materials/class9-unit2-student-watermarked.pdf', description: 'Level 4 Unit 2 REST APIs & MQTT PubSub Telemetry' },
  { id: 'CNT-902-T', title: 'Class 9 - Unit 2: HTTP & MQTT Cloud Protocols (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Teacher', url: '/materials/class9-unit2-teacher.pdf', description: 'Level 4 Unit 2 Broker Architecture Guide' },
  // Unit 3
  { id: 'CNT-903-S', title: 'Class 9 - Unit 3: MPU6050 Gyro Sensor Fusion (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Student', url: '/materials/class9-unit3-student-watermarked.pdf', description: 'Level 4 Unit 3 6-DOF Accelerometer & Filter Calculations' },
  { id: 'CNT-903-T', title: 'Class 9 - Unit 3: MPU6050 Gyro Sensor Fusion (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Teacher', url: '/materials/class9-unit3-teacher.pdf', description: 'Level 4 Unit 3 Sensor Fusion Lesson Plan' },
  // Unit 4
  { id: 'CNT-904-S', title: 'Class 9 - Unit 4: WebSockets & Cloud Actuation (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Student', url: '/materials/class9-unit4-student-watermarked.pdf', description: 'Level 4 Unit 4 Real-time Bi-directional Control Interface' },
  { id: 'CNT-904-T', title: 'Class 9 - Unit 4: WebSockets & Cloud Actuation (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Teacher', url: '/materials/class9-unit4-teacher.pdf', description: 'Level 4 Unit 4 Full-Stack Web Guide' },
  // Unit 5
  { id: 'CNT-905-S', title: 'Class 9 - Unit 5: Smart Campus IoT Architecture (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Student', url: '/materials/class9-unit5-student-watermarked.pdf', description: 'Level 4 Unit 5 Multi-node Mesh Network' },
  { id: 'CNT-905-T', title: 'Class 9 - Unit 5: Smart Campus IoT Architecture (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Teacher', url: '/materials/class9-unit5-teacher.pdf', description: 'Level 4 Unit 5 Gateway Setup Guide' },
  // Unit 6
  { id: 'CNT-906-S', title: 'Class 9 - Unit 6: IoT Weather Station Capstone (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Student', url: '/materials/class9-unit6-student-watermarked.pdf', description: 'Level 4 Unit 6 Full-Stack IoT Capstone' },
  { id: 'CNT-906-T', title: 'Class 9 - Unit 6: IoT Weather Station Capstone (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Teacher', url: '/materials/class9-unit6-teacher.pdf', description: 'Level 4 Unit 6 Evaluation Guide' },

  // ==================== CLASS 11 (LEVEL 5) ====================
  // Unit 1
  { id: 'CNT-1101-S', title: 'Class 11 - Unit 1: Python OpenCV Vision (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Student', url: '/materials/class11-unit1-student-watermarked.pdf', description: 'Level 5 Unit 1 Video Stream Capture & Color Masking' },
  { id: 'CNT-1101-T', title: 'Class 11 - Unit 1: Python OpenCV Vision (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Teacher', url: '/materials/class11-unit1-teacher.pdf', description: 'Level 5 Unit 1 Python Vision Toolchain' },
  // Unit 2
  { id: 'CNT-1102-S', title: 'Class 11 - Unit 2: Object Contour Tracking (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Student', url: '/materials/class11-unit2-student-watermarked.pdf', description: 'Level 5 Unit 2 HSV Thresholding & Centroid Calculation' },
  { id: 'CNT-1102-T', title: 'Class 11 - Unit 2: Object Contour Tracking (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Teacher', url: '/materials/class11-unit2-teacher.pdf', description: 'Level 5 Unit 2 Morphological Operations Guide' },
  // Unit 3
  { id: 'CNT-1103-S', title: 'Class 11 - Unit 3: Haar Cascades Facial Recognition (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Student', url: '/materials/class11-unit3-student-watermarked.pdf', description: 'Level 5 Unit 3 Multi-Face Detection & Automated Attendance' },
  { id: 'CNT-1103-T', title: 'Class 11 - Unit 3: Haar Cascades Facial Recognition (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Teacher', url: '/materials/class11-unit3-teacher.pdf', description: 'Level 5 Unit 3 Model Pipeline Guide' },
  // Unit 4
  { id: 'CNT-1104-S', title: 'Class 11 - Unit 4: YOLOv8 Neural Object Detection (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Student', url: '/materials/class11-unit4-student-watermarked.pdf', description: 'Level 5 Unit 4 Deep Learning Edge Inference' },
  { id: 'CNT-1104-T', title: 'Class 11 - Unit 4: YOLOv8 Neural Object Detection (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Teacher', url: '/materials/class11-unit4-teacher.pdf', description: 'Level 5 Unit 4 Edge Deployment Lesson Plan' },
  // Unit 5
  { id: 'CNT-1105-S', title: 'Class 11 - Unit 5: MediaPipe Edge AI Gesture Mapping (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Student', url: '/materials/class11-unit5-student-watermarked.pdf', description: 'Level 5 Unit 5 21-Point Hand Landmark Detection' },
  { id: 'CNT-1105-T', title: 'Class 11 - Unit 5: MediaPipe Edge AI Gesture Mapping (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Teacher', url: '/materials/class11-unit5-teacher.pdf', description: 'Level 5 Unit 5 Gesture Mapping Rubric' },
  // Unit 6
  { id: 'CNT-1106-S', title: 'Class 11 - Unit 6: Vision AI Rover Capstone (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Student', url: '/materials/class11-unit6-student-watermarked.pdf', description: 'Level 5 Unit 6 Autonomous Vision Surveillance Rover' },
  { id: 'CNT-1106-T', title: 'Class 11 - Unit 6: Vision AI Rover Capstone (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Teacher', url: '/materials/class11-unit6-teacher.pdf', description: 'Level 5 Unit 6 Capstone Evaluation Guide' }
];
