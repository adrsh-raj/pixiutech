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
    due_date: '2026-09-15',
    paid_date: null,
    payment_method: null,
    place_of_supply: 'Hata, Uttar Pradesh',
    status: 'Pending',
    receipt_no: null,
    is_confirmed: 0
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
    due_date: '2026-10-15',
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
  // Class 6A
  { id: 'SES-001', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', trainer_id: 'TR-01', date: 'Upcoming', time: 'Live Session', topic: 'Unit 2: Sensors: Light (LDR) & Obstacle (IR)', status: 'Planned', notes: 'Level 1 Unit 2 Lab build.', is_locked: 0 },

  // Class 7A
  { id: 'SES-002', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', trainer_id: 'TR-01', date: 'Upcoming', time: 'Live Session', topic: 'Unit 2: Analog vs Digital Sensors & Signal Interfacing', status: 'Planned', notes: 'Level 1 Unit 2 Sensor signals.', is_locked: 0 },

  // Class 8A
  { id: 'SES-003', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', trainer_id: 'TR-01', date: 'Upcoming', time: 'Live Session', topic: 'Unit 2: Ultrasonic Echo Mapping & Collision Prevention', status: 'Planned', notes: 'Level 1 Unit 2 Distance radar sweep.', is_locked: 0 },

  // Class 9A
  { id: 'SES-004', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', trainer_id: 'TR-01', date: 'Upcoming', time: 'Live Session', topic: 'Unit 2: Wi-Fi HTTP / MQTT Cloud Telemetry', status: 'Planned', notes: 'Level 1 Unit 2 Cloud teleoperation.', is_locked: 0 },

  // Class 11A
  { id: 'SES-005', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', trainer_id: 'TR-01', date: 'Upcoming', time: 'Live Session', topic: 'Unit 2: OpenCV Color Masking & Contour Object Tracking', status: 'Planned', notes: 'Level 1 Unit 2 Vision edge detection.', is_locked: 0 },
];

// Completely cleared attendance logs (live date, day, time and timestamp will be recorded on real-time submission)
export const SEED_ATTENDANCE = [];

export const SEED_INVENTORY = [
  { id: 'KIT-ZPS-01', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 1', school_id: 'ZPS', assigned_student_id: 'ZPS6A 01', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
  { id: 'KIT-ZPS-02', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 1', school_id: 'ZPS', assigned_student_id: 'ZPS6A 02', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
  { id: 'KIT-ZPS-06', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 2', school_id: 'ZPS', assigned_student_id: 'ZPS7A 01', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
  { id: 'KIT-ZPS-11', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 3', school_id: 'ZPS', assigned_student_id: 'ZPS8A 01', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
  { id: 'KIT-ZPS-16', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 4', school_id: 'ZPS', assigned_student_id: 'ZPS9A 01', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
  { id: 'KIT-ZPS-21', name: 'Standard Robotics Lab Kit (Uno + Dual Motor)', level: 'Level 5', school_id: 'ZPS', assigned_student_id: 'ZPS11A 01', status: 'Healthy', last_checked: '2026-08-28', issue_notes: 'Standard Zenith Lab Kit assigned' },
];

export const SEED_ALERTS = [];

// Admin Broadcast Notifications & Class Announcements (Multi-Class 6, 7, 8, 9, 11 & Trainers with Full Editability)
export const SEED_NOTIFICATIONS = [
  {
    id: 'NOTIF-001',
    target_type: 'All_Students',
    target_classes: '6,7,8,9,11',
    target_trainer_id: 'All',
    title: '📢 Next Robotics Lab Class Scheduled',
    message: 'Dear Students & Faculty, the upcoming practical robotics session for Classes 6, 7, 8, 9, 11 is scheduled for Friday, 04 Sep 2026 at 10:00 AM. Please ensure all student workbooks are brought to class.',
    template_type: 'next_class',
    scheduled_date: 'Friday, 04 Sep 2026',
    scheduled_time: '10:00 AM',
    severity: 'info',
    status: 'Active',
    created_at: '2026-08-31 22:40:00'
  },
  {
    id: 'NOTIF-002',
    target_type: 'All_Students',
    target_classes: '6,7,8,9,11',
    target_trainer_id: 'All',
    title: '📝 Unit 1 Revision & Circuit Viva Notice',
    message: 'Attention All Classes (6, 7, 8, 9, 11): Unit 1 concept revision and hands-on circuit viva checks will be held in Friday session. Please study the Unit 1 guides in your Student Portal.',
    template_type: 'revision',
    scheduled_date: 'Friday, 04 Sep 2026',
    scheduled_time: '11:00 AM',
    severity: 'important',
    status: 'Active',
    created_at: '2026-08-31 22:41:00'
  },
  {
    id: 'NOTIF-003',
    target_type: 'All_Trainers',
    target_classes: '6,7,8,9,11',
    target_trainer_id: 'TR-01',
    title: '🛠️ Trainer Directive: Prepare Level 1 Unit 2 Sensor Kits',
    message: 'Trainer Vikas Pandey: Please inspect and calibrate the LDR, IR and ultrasonic sensors for Classes 6A to 11A before Friday morning session.',
    template_type: 'kit_prep',
    scheduled_date: 'Friday, 04 Sep 2026',
    scheduled_time: '09:30 AM',
    severity: 'urgent',
    status: 'Active',
    created_at: '2026-08-31 22:42:00'
  }
];

// Structured Class Syllabus (Units 1 to 6 mapped to Levels: Unit 1 Intro Level 0, Unit 2 Level 1, etc.)
export const SEED_CURRICULUM = [
  // ==================== CLASS 6 ====================
  { id: 'CUR-101', week: 'Unit 1', level: 'Level 0', class_grade: '6', topic: 'Introduction to Electricity & Basic Circuits', objectives: 'Understand current, voltage, breadboards and series/parallel LEDs', status: 'Completed' },
  { id: 'CUR-102', week: 'Unit 2', level: 'Level 1', class_grade: '6', topic: 'Sensors: Light (LDR) & Obstacle (IR)', objectives: 'Analog vs digital inputs, calibration and sensor signal wiring', status: 'Upcoming' },
  { id: 'CUR-103', week: 'Unit 3', level: 'Level 2', class_grade: '6', topic: 'Actuators: Motors, Buzzers & Relays', objectives: 'Transistor switches, relay driver circuits, and sound actuation', status: 'Upcoming' },
  { id: 'CUR-104', week: 'Unit 4', level: 'Level 3', class_grade: '6', topic: 'Microcontroller (Arduino) Programming Basics', objectives: 'Digital output pin modes, delay timing, and serial monitor debugging', status: 'Upcoming' },
  { id: 'CUR-105', week: 'Unit 5', level: 'Level 4', class_grade: '6', topic: 'Project Building: Smart Obstacle Avoiding Rover', objectives: 'Assemble 2WD chassis, L298N motor driver, and ultrasonic avoidance algorithm', status: 'Upcoming' },
  { id: 'CUR-106', week: 'Unit 6', level: 'Level 5', class_grade: '6', topic: 'Capstone Project: Automated Smart Lab Environment', objectives: 'Final end-of-term presentation and smart automation build', status: 'Upcoming' },

  // ==================== CLASS 7 ====================
  { id: 'CUR-201', week: 'Unit 1', level: 'Level 0', class_grade: '7', topic: 'C++ Coding Fundamentals & Logic Gates', objectives: 'Microcontroller architecture, IDE setup, variables and conditional logic', status: 'Completed' },
  { id: 'CUR-202', week: 'Unit 2', level: 'Level 1', class_grade: '7', topic: 'Analog vs Digital Sensors & Signal Interfacing', objectives: 'ADC resolution, potentiometer voltage divider and threshold comparator', status: 'Upcoming' },
  { id: 'CUR-203', week: 'Unit 3', level: 'Level 2', class_grade: '7', topic: 'LCD Display & Sensor Data Visualization', objectives: 'I2C 16x2 LCD interface, custom character generation and live telemetry', status: 'Upcoming' },
  { id: 'CUR-204', week: 'Unit 4', level: 'Level 3', class_grade: '7', topic: 'Autonomous Line Follower Robotics', objectives: 'Dual IR reflectance arrays, Differential drive control and track optimization', status: 'Upcoming' },
  { id: 'CUR-205', week: 'Unit 5', level: 'Level 4', class_grade: '7', topic: 'Smart Irrigation & Environmental Telemetry', objectives: 'Soil moisture capacitive probes, submersible pump relay control', status: 'Upcoming' },
  { id: 'CUR-206', week: 'Unit 6', level: 'Level 5', class_grade: '7', topic: 'Capstone Project: Multi-Sensor Autonomous Rover', objectives: 'Integration of ultrasonic radar, line tracking, and autonomous pathfinding', status: 'Upcoming' },

  // ==================== CLASS 8 ====================
  { id: 'CUR-301', week: 'Unit 1', level: 'Level 0', class_grade: '8', topic: 'PWM Motor Control & High-Speed Steering', objectives: 'H-bridge motor drivers, PWM speed control and encoder feedback', status: 'Completed' },
  { id: 'CUR-302', week: 'Unit 2', level: 'Level 1', class_grade: '8', topic: 'Ultrasonic Echo Mapping & Collision Prevention', objectives: 'HC-SR04 pulse timing, servo radar sweep and distance mapping', status: 'Upcoming' },
  { id: 'CUR-303', week: 'Unit 3', level: 'Level 2', class_grade: '8', topic: 'Bluetooth Wireless Remote Teleoperation', objectives: 'HC-05 serial pairing, smartphone app control and command parsing', status: 'Upcoming' },
  { id: 'CUR-304', week: 'Unit 4', level: 'Level 3', class_grade: '8', topic: 'Advanced PID Line Follower System', objectives: 'Proportional-Integral-Derivative tuning for smooth high-speed curve navigation', status: 'Upcoming' },
  { id: 'CUR-305', week: 'Unit 5', level: 'Level 4', class_grade: '8', topic: 'IoT Sensor Logging & Real-time Web Monitoring', objectives: 'Cloud telemetry logging, sensor dashboard, and remote threshold alerting', status: 'Upcoming' },
  { id: 'CUR-306', week: 'Unit 6', level: 'Level 5', class_grade: '8', topic: 'Capstone Project: Bluetooth Combat / Surveillance Bot', objectives: 'High-torque 4WD chassis with wireless command link and modular payload', status: 'Upcoming' },

  // ==================== CLASS 9 ====================
  { id: 'CUR-401', week: 'Unit 1', level: 'Level 0', class_grade: '9', topic: 'ESP32 & Wireless IoT Microcontrollers', objectives: 'ESP32 architecture, Wi-Fi station mode, web server and telemetry', status: 'Completed' },
  { id: 'CUR-402', week: 'Unit 2', level: 'Level 1', class_grade: '9', topic: 'Wi-Fi HTTP / MQTT Cloud Telemetry', objectives: 'REST API webhooks, MQTT publish/subscribe pubsub broker integration', status: 'Upcoming' },
  { id: 'CUR-403', week: 'Unit 3', level: 'Level 2', class_grade: '9', topic: 'Advanced Sensor Fusion & Gyro / Accelerometer', objectives: 'MPU6050 I2C communication, pitch-roll angle filtering and stabilization', status: 'Upcoming' },
  { id: 'CUR-404', week: 'Unit 4', level: 'Level 3', class_grade: '9', topic: 'Web Dashboard Integration & Remote Relay Control', objectives: 'Interactive WebSocket control interface for remote industrial actuation', status: 'Upcoming' },
  { id: 'CUR-405', week: 'Unit 5', level: 'Level 4', class_grade: '9', topic: 'Smart Campus IoT Gateway Architecture', objectives: 'Multi-node sensor network with centralized coordinator hub', status: 'Upcoming' },
  { id: 'CUR-406', week: 'Unit 6', level: 'Level 5', class_grade: '9', topic: 'Capstone Project: Full-Stack IoT Weather Station & Surveillance', objectives: 'Solar powered weather sensing node sending telemetry to cloud dashboard', status: 'Upcoming' },

  // ==================== CLASS 11 ====================
  { id: 'CUR-501', week: 'Unit 1', level: 'Level 0', class_grade: '11', topic: 'Python for Computer Vision & Machine Intelligence', objectives: 'OpenCV basics, video stream capture, color masking and edge detection', status: 'Completed' },
  { id: 'CUR-502', week: 'Unit 2', level: 'Level 1', class_grade: '11', topic: 'OpenCV Color Masking & Contour Object Tracking', objectives: 'HSV color space calibration, morphological filters and centroid calculation', status: 'Upcoming' },
  { id: 'CUR-503', week: 'Unit 3', level: 'Level 2', class_grade: '11', topic: 'Haar Cascade Facial Recognition & Surveillance', objectives: 'Pretrained Haar cascades, multi-face tracking and attendance logging', status: 'Upcoming' },
  { id: 'CUR-504', week: 'Unit 4', level: 'Level 3', class_grade: '11', topic: 'YOLO Object Detection & Neural Network Inferencing', objectives: 'YOLOv8 deep learning model on edge devices, bounding box parsing', status: 'Upcoming' },
  { id: 'CUR-505', week: 'Unit 5', level: 'Level 4', class_grade: '11', topic: 'MediaPipe Edge AI Gesture Mapping', objectives: 'Hand landmark detection and gesture-controlled robotic actuation', status: 'Upcoming' },
  { id: 'CUR-506', week: 'Unit 6', level: 'Level 5', class_grade: '11', topic: 'Capstone Project: Autonomous Vision Surveillance Rover', objectives: 'Real-time object tracking and autonomous rover obstacle navigation', status: 'Upcoming' }
];

// Content Assets: All 30 Unwatermarked Teacher Master Units (for Teachers/Trainers) + Student Editions for students
export const SEED_CONTENT = [
  // ==================== TEACHER MASTER PACKS (30 UNITS - ALL CLASSES 6, 7, 8, 9, 11) ====================
  // Class 6 (Level 1) Teacher Masters
  { id: 'CNT-601-T', title: 'Class 6 - Unit 1: Basic Circuits (Teacher Master)', type: 'PDF', level: null, class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit1-teacher.pdf', description: 'Clean instructor guide, circuit schematics & viva questions for Unit 1' },
  { id: 'CNT-602-T', title: 'Class 6 - Unit 2: Sensors LDR & IR (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit2-teacher.pdf', description: 'Level 1 Unit 2 Instructor Calibration & Sensor Circuit Guide' },
  { id: 'CNT-603-T', title: 'Class 6 - Unit 3: Motors & Actuators (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit3-teacher.pdf', description: 'Level 2 Unit 3 Motors, Buzzers & Relay Driver Lesson Plan' },
  { id: 'CNT-604-T', title: 'Class 6 - Unit 4: Microcontroller Intro (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit4-teacher.pdf', description: 'Level 3 Unit 4 Arduino Coding & Pin Mapping Walkthrough' },
  { id: 'CNT-605-T', title: 'Class 6 - Unit 5: Obstacle Rover Project (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit5-teacher.pdf', description: 'Level 4 Unit 5 2WD Obstacle Avoiding Rover Assembly Rubric' },
  { id: 'CNT-606-T', title: 'Class 6 - Unit 6: Smart Lab Capstone (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit6-teacher.pdf', description: 'Level 5 Unit 6 Capstone Evaluation & Certification Rubric' },

  // Class 7 (Level 2) Teacher Masters
  { id: 'CNT-701-T', title: 'Class 7 - Unit 1: C++ Fundamentals (Teacher Master)', type: 'PDF', level: null, class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit1-teacher.pdf', description: 'Instructor lesson plan and code walkthroughs for AVR microcontrollers' },
  { id: 'CNT-702-T', title: 'Class 7 - Unit 2: Analog Sensor Interfacing (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit2-teacher.pdf', description: 'Level 1 Unit 2 Instructor Calibration & ADC Lesson Plan' },
  { id: 'CNT-703-T', title: 'Class 7 - Unit 3: I2C LCD Display (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit3-teacher.pdf', description: 'Level 2 Unit 3 I2C Addressing & Telemetry Display Guide' },
  { id: 'CNT-704-T', title: 'Class 7 - Unit 4: Line Follower Robot (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit4-teacher.pdf', description: 'Level 3 Unit 4 Dual IR Comparator & Line Follower Troubleshooting' },
  { id: 'CNT-705-T', title: 'Class 7 - Unit 5: Smart Irrigation System (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit5-teacher.pdf', description: 'Level 4 Unit 5 Soil Moisture Probe & Submersible Pump Guide' },
  { id: 'CNT-706-T', title: 'Class 7 - Unit 6: Multi-Sensor Capstone (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit6-teacher.pdf', description: 'Level 5 Unit 6 Capstone Project Evaluation & Scorecard' },

  // Class 8 (Level 3) Teacher Masters
  { id: 'CNT-801-T', title: 'Class 8 - Unit 1: PWM Motor Control (Teacher Master)', type: 'PDF', level: null, class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit1-teacher.pdf', description: 'Instructor driver schematics and PWM waveform calibration guide' },
  { id: 'CNT-802-T', title: 'Class 8 - Unit 2: Ultrasonic Echo Mapping (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit2-teacher.pdf', description: 'Level 1 Unit 2 Instructor Echo Timing & Sonar Radar Guide' },
  { id: 'CNT-803-T', title: 'Class 8 - Unit 3: Bluetooth Remote Control (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit3-teacher.pdf', description: 'Level 2 Unit 3 HC-05 Wireless UART & App Command Parsing' },
  { id: 'CNT-804-T', title: 'Class 8 - Unit 4: PID Line Tracking (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit4-teacher.pdf', description: 'Level 3 Unit 4 PID Mathematical Model & Gain Tuning Rubric' },
  { id: 'CNT-805-T', title: 'Class 8 - Unit 5: IoT Cloud Data Logging (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit5-teacher.pdf', description: 'Level 4 Unit 5 Cloud Telemetry Dashboard Integration Guide' },
  { id: 'CNT-806-T', title: 'Class 8 - Unit 6: Combat Bot Capstone (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit6-teacher.pdf', description: 'Level 5 Unit 6 4WD Combat Bot Final Build & Defense Rubric' },

  // Class 9 (Level 4) Teacher Masters
  { id: 'CNT-901-T', title: 'Class 9 - Unit 1: ESP32 IoT Microcontrollers (Teacher Master)', type: 'PDF', level: null, class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit1-teacher.pdf', description: 'Instructor IoT toolchain and ESP-IDF/Arduino network architecture' },
  { id: 'CNT-902-T', title: 'Class 9 - Unit 2: HTTP & MQTT Cloud Protocols (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit2-teacher.pdf', description: 'Level 1 Unit 2 MQTT PubSub Broker & Cloud Gateway Lesson Plan' },
  { id: 'CNT-903-T', title: 'Class 9 - Unit 3: MPU6050 Gyro Sensor Fusion (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit3-teacher.pdf', description: 'Level 2 Unit 3 6-DOF IMU Complementary Filter Calculations' },
  { id: 'CNT-904-T', title: 'Class 9 - Unit 4: WebSockets & Cloud Actuation (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit4-teacher.pdf', description: 'Level 3 Unit 4 Bi-directional WebSocket Control Server Guide' },
  { id: 'CNT-905-T', title: 'Class 9 - Unit 5: Smart Campus IoT Architecture (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit5-teacher.pdf', description: 'Level 4 Unit 5 Mesh Gateway & Webhook Alert Automation' },
  { id: 'CNT-906-T', title: 'Class 9 - Unit 6: IoT Weather Station Capstone (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit6-teacher.pdf', description: 'Level 5 Unit 6 Full-Stack Industrial IoT Capstone Audit' },

  // Class 11 (Level 5) Teacher Masters
  { id: 'CNT-1101-T', title: 'Class 11 - Unit 1: Python OpenCV Vision (Teacher Master)', type: 'PDF', level: null, class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit1-teacher.pdf', description: 'Instructor camera pipeline, color space transforms and FPS optimization deck' },
  { id: 'CNT-1102-T', title: 'Class 11 - Unit 2: Object Contour Tracking (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit2-teacher.pdf', description: 'Level 1 Unit 2 Morphological Operations & Centroid Tracking Guide' },
  { id: 'CNT-1103-T', title: 'Class 11 - Unit 3: Haar Cascades Facial Recognition (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit3-teacher.pdf', description: 'Level 2 Unit 3 Haar Cascades Multi-Face Detection Pipeline Guide' },
  { id: 'CNT-1104-T', title: 'Class 11 - Unit 4: YOLOv8 Neural Object Detection (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit4-teacher.pdf', description: 'Level 3 Unit 4 Edge AI Deep Learning Inferencing Lesson Plan' },
  { id: 'CNT-1105-T', title: 'Class 11 - Unit 5: MediaPipe Edge AI Gesture Mapping (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit5-teacher.pdf', description: 'Level 4 Unit 5 21-Point Hand Landmark Detection & Command Mapping' },
  { id: 'CNT-1106-T', title: 'Class 11 - Unit 6: Vision AI Rover Capstone (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit6-teacher.pdf', description: 'Level 5 Unit 6 Autonomous Vision Surveillance Rover Defense Rubric' },

  // ==================== STUDENT STUDY GUIDES (ALL 30 UNITS - CLASSES 6, 7, 8, 9, 11) ====================
  // Class 6 Student Guides
  { id: 'CNT-601-S', title: 'Class 6 - Unit 1: Basic Circuits (Student Edition)', type: 'PDF', level: 'Level 0', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit1-student-watermarked.pdf', file_url: '/materials/class6-unit1-student-watermarked.pdf', description: 'Foundational electronics, LEDs, breadboard wiring and series/parallel circuits' },
  { id: 'CNT-602-S', title: 'Class 6 - Unit 2: Sensors LDR & IR (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit2-student-watermarked.pdf', file_url: '/materials/class6-unit2-student-watermarked.pdf', description: 'Level 1 Unit 2 Light & Obstacle Sensor Manual with Circuit Schematics' },
  { id: 'CNT-603-S', title: 'Class 6 - Unit 3: Motors & Actuators (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit3-student-watermarked.pdf', file_url: '/materials/class6-unit3-student-watermarked.pdf', description: 'Level 2 Unit 3 Motors, Buzzers & Relay Driver Build Walkthrough' },
  { id: 'CNT-604-S', title: 'Class 6 - Unit 4: Microcontroller Programming (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit4-student-watermarked.pdf', file_url: '/materials/class6-unit4-student-watermarked.pdf', description: 'Level 3 Unit 4 Arduino Coding & Pin Mapping Student Guide' },
  { id: 'CNT-605-S', title: 'Class 6 - Unit 5: Obstacle Avoiding Rover (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit5-student-watermarked.pdf', file_url: '/materials/class6-unit5-student-watermarked.pdf', description: 'Level 4 Unit 5 2WD Obstacle Avoiding Rover Assembly Guide' },
  { id: 'CNT-606-S', title: 'Class 6 - Unit 6: Smart Lab Capstone (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit6-student-watermarked.pdf', file_url: '/materials/class6-unit6-student-watermarked.pdf', description: 'Level 5 Unit 6 Capstone Project Workbook & Presentation Guide' },

  // Class 7 Student Guides
  { id: 'CNT-701-S', title: 'Class 7 - Unit 1: C++ Fundamentals (Student Edition)', type: 'PDF', level: 'Level 0', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit1-student-watermarked.pdf', file_url: '/materials/class7-unit1-student-watermarked.pdf', description: 'Logic structures, conditional statements, variables and microcontroller syntax' },
  { id: 'CNT-702-S', title: 'Class 7 - Unit 2: Analog Sensor Interfacing (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit2-student-watermarked.pdf', file_url: '/materials/class7-unit2-student-watermarked.pdf', description: 'Level 1 Unit 2 Analog vs Digital Sensors & Signal Interfacing' },
  { id: 'CNT-703-S', title: 'Class 7 - Unit 3: I2C LCD Display (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit3-student-watermarked.pdf', file_url: '/materials/class7-unit3-student-watermarked.pdf', description: 'Level 2 Unit 3 I2C Addressing & Telemetry Display Guide' },
  { id: 'CNT-704-S', title: 'Class 7 - Unit 4: Line Follower Robot (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit4-student-watermarked.pdf', file_url: '/materials/class7-unit4-student-watermarked.pdf', description: 'Level 3 Unit 4 Dual IR Comparator & Line Follower Troubleshooting' },
  { id: 'CNT-705-S', title: 'Class 7 - Unit 5: Smart Irrigation System (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit5-student-watermarked.pdf', file_url: '/materials/class7-unit5-student-watermarked.pdf', description: 'Level 4 Unit 5 Soil Moisture Probe & Submersible Pump Guide' },
  { id: 'CNT-706-S', title: 'Class 7 - Unit 6: Multi-Sensor Capstone (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit6-student-watermarked.pdf', file_url: '/materials/class7-unit6-student-watermarked.pdf', description: 'Level 5 Unit 6 Capstone Project Workbook & Autonomous Rover' },

  // Class 8 Student Guides
  { id: 'CNT-801-S', title: 'Class 8 - Unit 1: PWM Motor Control (Student Edition)', type: 'PDF', level: 'Level 0', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit1-student-watermarked.pdf', file_url: '/materials/class8-unit1-student-watermarked.pdf', description: 'H-bridge motor drivers, duty cycles, speed modulation and differential steering' },
  { id: 'CNT-802-S', title: 'Class 8 - Unit 2: Ultrasonic Echo Mapping (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit2-student-watermarked.pdf', file_url: '/materials/class8-unit2-student-watermarked.pdf', description: 'Level 1 Unit 2 Ultrasonic Echo Mapping & Collision Prevention' },
  { id: 'CNT-803-S', title: 'Class 8 - Unit 3: Bluetooth Remote Control (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit3-student-watermarked.pdf', file_url: '/materials/class8-unit3-student-watermarked.pdf', description: 'Level 2 Unit 3 HC-05 Wireless UART & App Command Parsing' },
  { id: 'CNT-804-S', title: 'Class 8 - Unit 4: PID Line Tracking (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit4-student-watermarked.pdf', file_url: '/materials/class8-unit4-student-watermarked.pdf', description: 'Level 3 Unit 4 PID Mathematical Model & Gain Tuning Rubric' },
  { id: 'CNT-805-S', title: 'Class 8 - Unit 5: IoT Cloud Data Logging (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit5-student-watermarked.pdf', file_url: '/materials/class8-unit5-student-watermarked.pdf', description: 'Level 4 Unit 5 Cloud Telemetry Dashboard Integration Guide' },
  { id: 'CNT-806-S', title: 'Class 8 - Unit 6: Combat Bot Capstone (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit6-student-watermarked.pdf', file_url: '/materials/class8-unit6-student-watermarked.pdf', description: 'Level 5 Unit 6 4WD Combat Bot Final Build & Defense Rubric' },

  // Class 9 Student Guides
  { id: 'CNT-901-S', title: 'Class 9 - Unit 1: ESP32 IoT Microcontrollers (Student Edition)', type: 'PDF', level: 'Level 0', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit1-student-watermarked.pdf', file_url: '/materials/class9-unit1-student-watermarked.pdf', description: 'ESP32 Dual-Core architecture, Wi-Fi station setup and embedded web server' },
  { id: 'CNT-902-S', title: 'Class 9 - Unit 2: HTTP & MQTT Cloud Protocols (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit2-student-watermarked.pdf', file_url: '/materials/class9-unit2-student-watermarked.pdf', description: 'Level 1 Unit 2 Wi-Fi HTTP / MQTT Cloud Telemetry' },
  { id: 'CNT-903-S', title: 'Class 9 - Unit 3: MPU6050 Gyro Sensor Fusion (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit3-student-watermarked.pdf', file_url: '/materials/class9-unit3-student-watermarked.pdf', description: 'Level 2 Unit 3 6-DOF IMU Complementary Filter Calculations' },
  { id: 'CNT-904-S', title: 'Class 9 - Unit 4: WebSockets & Cloud Actuation (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit4-student-watermarked.pdf', file_url: '/materials/class9-unit4-student-watermarked.pdf', description: 'Level 3 Unit 4 Bi-directional WebSocket Control Server Guide' },
  { id: 'CNT-905-S', title: 'Class 9 - Unit 5: Smart Campus IoT Architecture (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit5-student-watermarked.pdf', file_url: '/materials/class9-unit5-student-watermarked.pdf', description: 'Level 4 Unit 5 Mesh Gateway & Webhook Alert Automation' },
  { id: 'CNT-906-S', title: 'Class 9 - Unit 6: IoT Weather Station Capstone (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit6-student-watermarked.pdf', file_url: '/materials/class9-unit6-student-watermarked.pdf', description: 'Level 5 Unit 6 Full-Stack Industrial IoT Capstone Workbook' },

  // Class 11 Student Guides
  { id: 'CNT-1101-S', title: 'Class 11 - Unit 1: Python OpenCV Vision (Student Edition)', type: 'PDF', level: 'Level 0', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit1-student-watermarked.pdf', file_url: '/materials/class11-unit1-student-watermarked.pdf', description: 'OpenCV matrix operations, video stream capture, color filters and convolutions' },
  { id: 'CNT-1102-S', title: 'Class 11 - Unit 2: Object Contour Tracking (Student Edition)', type: 'PDF', level: 'Level 1', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit2-student-watermarked.pdf', file_url: '/materials/class11-unit2-student-watermarked.pdf', description: 'Level 1 Unit 2 OpenCV Color Masking & Contour Object Tracking' },
  { id: 'CNT-1103-S', title: 'Class 11 - Unit 3: Haar Cascades Facial Recognition (Student Edition)', type: 'PDF', level: 'Level 2', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit3-student-watermarked.pdf', file_url: '/materials/class11-unit3-student-watermarked.pdf', description: 'Level 2 Unit 3 Haar Cascades Multi-Face Detection Pipeline Guide' },
  { id: 'CNT-1104-S', title: 'Class 11 - Unit 4: YOLOv8 Neural Object Detection (Student Edition)', type: 'PDF', level: 'Level 3', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit4-student-watermarked.pdf', file_url: '/materials/class11-unit4-student-watermarked.pdf', description: 'Level 3 Unit 4 Edge AI Deep Learning Inferencing Lesson Plan' },
  { id: 'CNT-1105-S', title: 'Class 11 - Unit 5: MediaPipe Edge AI Gesture Mapping (Student Edition)', type: 'PDF', level: 'Level 4', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit5-student-watermarked.pdf', file_url: '/materials/class11-unit5-student-watermarked.pdf', description: 'Level 4 Unit 5 21-Point Hand Landmark Detection & Command Mapping' },
  { id: 'CNT-1106-S', title: 'Class 11 - Unit 6: Vision AI Rover Capstone (Student Edition)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit6-student-watermarked.pdf', file_url: '/materials/class11-unit6-student-watermarked.pdf', description: 'Level 5 Unit 6 Autonomous Vision Surveillance Rover Workbook' }
];

// End-of-Unit Student Reviews by Trainers (Initialized Empty - Evaluated live by Trainers)
export const SEED_STUDENT_REVIEWS = [];
