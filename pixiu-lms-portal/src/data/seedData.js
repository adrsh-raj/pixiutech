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
  // Level 1: Unit 2
  { id: 'CUR-102', week: 'Unit 2', level: 'Level 1', topic: 'Sensors: Light (LDR) & Obstacle (IR)', objectives: 'Analog vs digital inputs, calibration and sensor signal wiring', status: 'Completed' },
  { id: 'CUR-202', week: 'Unit 2', level: 'Level 1', topic: 'Analog vs Digital Sensors & Signal Interfacing', objectives: 'ADC resolution, potentiometer voltage divider and threshold comparator', status: 'Completed' },
  { id: 'CUR-302', week: 'Unit 2', level: 'Level 1', topic: 'Ultrasonic Echo Mapping & Collision Prevention', objectives: 'HC-SR04 pulse timing, servo radar sweep and distance mapping', status: 'Completed' },
  { id: 'CUR-402', week: 'Unit 2', level: 'Level 1', topic: 'Wi-Fi HTTP / MQTT Cloud Telemetry', objectives: 'REST API webhooks, MQTT publish/subscribe pubsub broker integration', status: 'Completed' },
  { id: 'CUR-502', week: 'Unit 2', level: 'Level 1', topic: 'OpenCV Color Masking & Contour Object Tracking', objectives: 'HSV color space calibration, morphological filters and centroid calculation', status: 'Completed' }
];

// Currently Uploaded Materials: ONLY UNIT 2 (Level 1) for Classes 6, 7, 8, 9, 11
export const SEED_CONTENT = [
  // Class 6 (Level 1 - Unit 2)
  { 
    id: 'CNT-602-S', 
    title: 'Class 6 - Unit 2: Sensors LDR & IR (Student Edition)', 
    type: 'PDF', 
    level: 'Level 1', 
    class_grade: '6', 
    target: 'Student', 
    url: '/materials/class6-unit2-student-watermarked.pdf', 
    description: 'Level 1 Unit 2 Light & Obstacle Sensor Manual with Circuit Schematics' 
  },
  { 
    id: 'CNT-602-T', 
    title: 'Class 6 - Unit 2: Sensors LDR & IR (Teacher Master)', 
    type: 'PDF', 
    level: 'Level 1', 
    class_grade: '6', 
    target: 'Teacher', 
    url: '/materials/class6-unit2-teacher.pdf', 
    description: 'Level 1 Unit 2 Instructor Calibration Guide' 
  },

  // Class 7 (Level 1 - Unit 2)
  { 
    id: 'CNT-702-S', 
    title: 'Class 7 - Unit 2: Analog Sensor Interfacing (Student Edition)', 
    type: 'PDF', 
    level: 'Level 1', 
    class_grade: '7', 
    target: 'Student', 
    url: '/materials/class7-unit2-student-watermarked.pdf', 
    description: 'Level 1 Unit 2 Analog vs Digital Sensors & Signal Interfacing' 
  },
  { 
    id: 'CNT-702-T', 
    title: 'Class 7 - Unit 2: Analog Sensor Interfacing (Teacher Master)', 
    type: 'PDF', 
    level: 'Level 1', 
    class_grade: '7', 
    target: 'Teacher', 
    url: '/materials/class7-unit2-teacher.pdf', 
    description: 'Level 1 Unit 2 Instructor Calibration Lesson Plan' 
  },

  // Class 8 (Level 1 - Unit 2)
  { 
    id: 'CNT-802-S', 
    title: 'Class 8 - Unit 2: Ultrasonic Echo Mapping (Student Edition)', 
    type: 'PDF', 
    level: 'Level 1', 
    class_grade: '8', 
    target: 'Student', 
    url: '/materials/class8-unit2-student-watermarked.pdf', 
    description: 'Level 1 Unit 2 Ultrasonic Echo Mapping & Collision Prevention' 
  },
  { 
    id: 'CNT-802-T', 
    title: 'Class 8 - Unit 2: Ultrasonic Echo Mapping (Teacher Master)', 
    type: 'PDF', 
    level: 'Level 1', 
    class_grade: '8', 
    target: 'Teacher', 
    url: '/materials/class8-unit2-teacher.pdf', 
    description: 'Level 1 Unit 2 Instructor Echo Timing Guide' 
  },

  // Class 9 (Level 1 - Unit 2)
  { 
    id: 'CNT-902-S', 
    title: 'Class 9 - Unit 2: HTTP & MQTT Cloud Protocols (Student Edition)', 
    type: 'PDF', 
    level: 'Level 1', 
    class_grade: '9', 
    target: 'Student', 
    url: '/materials/class9-unit2-student-watermarked.pdf', 
    description: 'Level 1 Unit 2 Wi-Fi HTTP / MQTT Cloud Telemetry' 
  },
  { 
    id: 'CNT-902-T', 
    title: 'Class 9 - Unit 2: HTTP & MQTT Cloud Protocols (Teacher Master)', 
    type: 'PDF', 
    level: 'Level 1', 
    class_grade: '9', 
    target: 'Teacher', 
    url: '/materials/class9-unit2-teacher.pdf', 
    description: 'Level 1 Unit 2 Cloud Telemetry Lesson Plan' 
  },

  // Class 11 (Level 1 - Unit 2)
  { 
    id: 'CNT-1102-S', 
    title: 'Class 11 - Unit 2: Object Contour Tracking (Student Edition)', 
    type: 'PDF', 
    level: 'Level 1', 
    class_grade: '11', 
    target: 'Student', 
    url: '/materials/class11-unit2-student-watermarked.pdf', 
    description: 'Level 1 Unit 2 OpenCV Color Masking & Contour Object Tracking' 
  },
  { 
    id: 'CNT-1102-T', 
    title: 'Class 11 - Unit 2: Object Contour Tracking (Teacher Master)', 
    type: 'PDF', 
    level: 'Level 1', 
    class_grade: '11', 
    target: 'Teacher', 
    url: '/materials/class11-unit2-teacher.pdf', 
    description: 'Level 1 Unit 2 Contour Tracking Instructor Guide' 
  }
];
