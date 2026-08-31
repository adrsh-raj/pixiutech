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
  { id: 'SES-006', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', trainer_id: 'TR-01', date: '2026-09-04', time: '10:00 AM', topic: 'Ultrasonic Distance Sensor & Smart Buzzer Alarm', status: 'Planned', notes: 'Prepare ultrasonic kits.', is_locked: 0 },
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
  { id: 'CUR-101', week: 'Unit 1', level: 'Level 1', topic: 'Introduction to Electricity & Basic Circuits', objectives: 'Understand current, voltage, breadboards and series/parallel LEDs', status: 'Completed' },
  { id: 'CUR-102', week: 'Unit 2', level: 'Level 1', topic: 'Sensors: Light (LDR) & Obstacle (IR)', objectives: 'Analog vs digital inputs, calibration and wiring', status: 'Completed' },
  { id: 'CUR-201', week: 'Unit 1', level: 'Level 2', topic: 'Microcontrollers & C++ Coding Fundamentals', objectives: 'Microcontroller architecture, IDE setup, variables and conditional logic', status: 'Completed' },
  { id: 'CUR-301', week: 'Unit 1', level: 'Level 3', topic: 'PWM Motor Control & High-Speed Differential Steering', objectives: 'H-bridge motor drivers, PWM speed control and encoder feedback', status: 'Completed' },
  { id: 'CUR-401', week: 'Unit 1', level: 'Level 4', topic: 'ESP32 & Wireless IoT Microcontrollers', objectives: 'ESP32 architecture, Wi-Fi station mode, web server and telemetry', status: 'Completed' },
  { id: 'CUR-501', week: 'Unit 1', level: 'Level 5', topic: 'Python for Computer Vision & Machine Intelligence', objectives: 'OpenCV basics, video stream capture, color masking and edge detection', status: 'Completed' },
];

export const SEED_CONTENT = [
  // Class 6 (Level 1)
  { id: 'CNT-601-S', title: 'Class 6 - Unit 1 (Student Workbook)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Student', url: '/materials/class6-unit1-student-watermarked.pdf', description: 'Level 1 Unit 1 Student Study Material' },
  { id: 'CNT-601-T', title: 'Class 6 - Unit 1 (Teacher Master Pack)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Teacher', url: '/materials/class6-unit1-teacher.pdf', description: 'Level 1 Unit 1 Instructor Guide' },
  // Class 7 (Level 2)
  { id: 'CNT-701-S', title: 'Class 7 - Unit 1 (Student Workbook)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Student', url: '/materials/class7-unit1-student-watermarked.pdf', description: 'Level 2 Unit 1 Student Study Material' },
  { id: 'CNT-701-T', title: 'Class 7 - Unit 1 (Teacher Master Pack)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Teacher', url: '/materials/class7-unit1-teacher.pdf', description: 'Level 2 Unit 1 Instructor Guide' },
  // Class 8 (Level 3)
  { id: 'CNT-801-S', title: 'Class 8 - Unit 1 (Student Workbook)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Student', url: '/materials/class8-unit1-student-watermarked.pdf', description: 'Level 3 Unit 1 Student Study Material' },
  { id: 'CNT-801-T', title: 'Class 8 - Unit 1 (Teacher Master Pack)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Teacher', url: '/materials/class8-unit1-teacher.pdf', description: 'Level 3 Unit 1 Instructor Guide' },
  // Class 9 (Level 4)
  { id: 'CNT-901-S', title: 'Class 9 - Unit 1 (Student Workbook)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Student', url: '/materials/class9-unit1-student-watermarked.pdf', description: 'Level 4 Unit 1 Student Study Material' },
  { id: 'CNT-901-T', title: 'Class 9 - Unit 1 (Teacher Master Pack)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Teacher', url: '/materials/class9-unit1-teacher.pdf', description: 'Level 4 Unit 1 Instructor Guide' },
  // Class 11 (Level 5)
  { id: 'CNT-1101-S', title: 'Class 11 - Unit 1 (Student Workbook)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Student', url: '/materials/class11-unit1-student-watermarked.pdf', description: 'Level 5 Unit 1 Student Study Material' },
  { id: 'CNT-1101-T', title: 'Class 11 - Unit 1 (Teacher Master Pack)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Teacher', url: '/materials/class11-unit1-teacher.pdf', description: 'Level 5 Unit 1 Instructor Guide' },
];
