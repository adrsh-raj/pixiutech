// Master Initial Seed Data for Multi-School Pixiu Tech OS

export const SEED_SCHOOLS = [
  { id: 'ZPS', name: 'Zenith Public School', code: 'ZPS', city: 'Hata', tier: 'Tier 2 Partner', status: 'Active', contract_type: 'Full STEM Lab Suite', principal_name: 'Dr. R.K. Mishra', principal_phone: '+91 94151 22334', lab_room: 'Block B - Innovation Lab 102', enrolled_classes: ['6A', '7A', '8A', '9A', '11A'], created_at: '2026-08-01' }
];

export const SEED_CLASSES = [
  { id: 'CLS-ZPS-6A', school_id: 'ZPS', grade: '6', section: 'A', stream: 'Robotics & Foundation', student_count: 5, lead_trainer_id: 'TR-01', day: 'Friday', time_slot: '09:00 AM - 10:30 AM' },
  { id: 'CLS-ZPS-7A', school_id: 'ZPS', grade: '7', section: 'A', stream: 'Robotics & Logic Circuits', student_count: 5, lead_trainer_id: 'TR-01', day: 'Friday', time_slot: '10:45 AM - 12:15 PM' },
  { id: 'CLS-ZPS-8A', school_id: 'ZPS', grade: '8', section: 'A', stream: 'Robotics & Microcontrollers', student_count: 5, lead_trainer_id: 'TR-01', day: 'Saturday', time_slot: '09:00 AM - 10:30 AM' },
  { id: 'CLS-ZPS-9A', school_id: 'ZPS', grade: '9', section: 'A', stream: 'IoT & Embedded Sensors', student_count: 5, lead_trainer_id: 'TR-01', day: 'Saturday', time_slot: '10:45 AM - 12:15 PM' },
  { id: 'CLS-ZPS-11A', school_id: 'ZPS', grade: '11', section: 'A', stream: 'AI Vision & Autonomous Robotics', student_count: 5, lead_trainer_id: 'TR-01', day: 'Saturday', time_slot: '01:00 PM - 02:30 PM' },
];

export const SEED_STUDENTS = [
  // Class 6A
  { id: 'STU-601', student_id: 'ZPS6A 01', name: 'Aarav Sharma', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', tech_level: 'Level 0', parent_name: 'Sanjay Sharma', parent_phone: '+91 98390 11221', assigned_kit_id: 'KIT-ZPS-01', status: 'Active' },
  { id: 'STU-602', student_id: 'ZPS6A 02', name: 'Priya Patel', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', tech_level: 'Level 0', parent_name: 'Manoj Patel', parent_phone: '+91 98390 11222', assigned_kit_id: 'KIT-ZPS-02', status: 'Active' },
  { id: 'STU-603', student_id: 'ZPS6A 03', name: 'Rohan Gupta', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', tech_level: 'Level 0', parent_name: 'Rajesh Gupta', parent_phone: '+91 98390 11223', assigned_kit_id: 'KIT-ZPS-03', status: 'Active' },
  { id: 'STU-604', student_id: 'ZPS6A 04', name: 'Ananya Verma', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', tech_level: 'Level 0', parent_name: 'Alok Verma', parent_phone: '+91 98390 11224', assigned_kit_id: 'KIT-ZPS-04', status: 'Active' },
  { id: 'STU-605', student_id: 'ZPS6A 05', name: 'Kabir Singh', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', tech_level: 'Level 0', parent_name: 'Harpreet Singh', parent_phone: '+91 98390 11225', assigned_kit_id: 'KIT-ZPS-05', status: 'Active' },

  // Class 7A
  { id: 'STU-701', student_id: 'ZPS7A 01', name: 'Devansh Tiwari', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', tech_level: 'Level 0', parent_name: 'V.K. Tiwari', parent_phone: '+91 98390 22331', assigned_kit_id: 'KIT-ZPS-06', status: 'Active' },
  { id: 'STU-702', student_id: 'ZPS7A 02', name: 'Ishita Mishra', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', tech_level: 'Level 0', parent_name: 'Sudhir Mishra', parent_phone: '+91 98390 22332', assigned_kit_id: 'KIT-ZPS-07', status: 'Active' },
  { id: 'STU-703', student_id: 'ZPS7A 03', name: 'Atharva Dubey', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', tech_level: 'Level 0', parent_name: 'Pradeep Dubey', parent_phone: '+91 98390 22333', assigned_kit_id: 'KIT-ZPS-08', status: 'Active' },
  { id: 'STU-704', student_id: 'ZPS7A 04', name: 'Suhani Rao', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', tech_level: 'Level 0', parent_name: 'N.K. Rao', parent_phone: '+91 98390 22334', assigned_kit_id: 'KIT-ZPS-09', status: 'Active' },
  { id: 'STU-705', student_id: 'ZPS7A 05', name: 'Aryan Chaurasia', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', tech_level: 'Level 0', parent_name: 'Dinesh Chaurasia', parent_phone: '+91 98390 22335', assigned_kit_id: 'KIT-ZPS-10', status: 'Active' },

  // Class 8A
  { id: 'STU-801', student_id: 'ZPS8A 01', name: 'Yash Srivastava', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', tech_level: 'Level 0', parent_name: 'Anil Srivastava', parent_phone: '+91 98390 33441', assigned_kit_id: 'KIT-ZPS-11', status: 'Active' },
  { id: 'STU-802', student_id: 'ZPS8A 02', name: 'Tanvi Pandey', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', tech_level: 'Level 0', parent_name: 'Umesh Pandey', parent_phone: '+91 98390 33442', assigned_kit_id: 'KIT-ZPS-12', status: 'Active' },
  { id: 'STU-803', student_id: 'ZPS8A 03', name: 'Aditya Yadav', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', tech_level: 'Level 0', parent_name: 'Ramakant Yadav', parent_phone: '+91 98390 33443', assigned_kit_id: 'KIT-ZPS-13', status: 'Active' },
  { id: 'STU-804', student_id: 'ZPS8A 04', name: 'Kavya Jaiswal', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', tech_level: 'Level 0', parent_name: 'Pramod Jaiswal', parent_phone: '+91 98390 33444', assigned_kit_id: 'KIT-ZPS-14', status: 'Active' },
  { id: 'STU-805', student_id: 'ZPS8A 05', name: 'Manish Gond', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', tech_level: 'Level 0', parent_name: 'Brijesh Gond', parent_phone: '+91 98390 33445', assigned_kit_id: 'KIT-ZPS-15', status: 'Active' },

  // Class 9A
  { id: 'STU-901', student_id: 'ZPS9A 01', name: 'Ayush Kushwaha', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', tech_level: 'Level 0', parent_name: 'Santosh Kushwaha', parent_phone: '+91 98390 44551', assigned_kit_id: 'KIT-ZPS-16', status: 'Active' },
  { id: 'STU-902', student_id: 'ZPS9A 02', name: 'Sneha Shahi', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', tech_level: 'Level 0', parent_name: 'Arvind Shahi', parent_phone: '+91 98390 44552', assigned_kit_id: 'KIT-ZPS-17', status: 'Active' },
  { id: 'STU-903', student_id: 'ZPS9A 03', name: 'Rishi Vishwakarma', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', tech_level: 'Level 0', parent_name: 'Mohan Vishwakarma', parent_phone: '+91 98390 44553', assigned_kit_id: 'KIT-ZPS-18', status: 'Active' },
  { id: 'STU-904', student_id: 'ZPS9A 04', name: 'Riya Tripathi', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', tech_level: 'Level 0', parent_name: 'G.P. Tripathi', parent_phone: '+91 98390 44554', assigned_kit_id: 'KIT-ZPS-19', status: 'Active' },
  { id: 'STU-905', student_id: 'ZPS9A 05', name: 'Utkarsh Singh', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', tech_level: 'Level 0', parent_name: 'Vinod Singh', parent_phone: '+91 98390 44555', assigned_kit_id: 'KIT-ZPS-20', status: 'Active' },

  // Class 11A
  { id: 'STU-1101', student_id: 'ZPS11A 01', name: 'Siddharth Pandey', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', tech_level: 'Level 0', parent_name: 'K.K. Pandey', parent_phone: '+91 98390 55661', assigned_kit_id: 'KIT-ZPS-21', status: 'Active' },
  { id: 'STU-1102', student_id: 'ZPS11A 02', name: 'Anushka Roy', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', tech_level: 'Level 0', parent_name: 'B.N. Roy', parent_phone: '+91 98390 55662', assigned_kit_id: 'KIT-ZPS-22', status: 'Active' },
  { id: 'STU-1103', student_id: 'ZPS11A 03', name: 'Harshita Malviya', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', tech_level: 'Level 0', parent_name: 'S.P. Malviya', parent_phone: '+91 98390 55663', assigned_kit_id: 'KIT-ZPS-23', status: 'Active' },
  { id: 'STU-1104', student_id: 'ZPS11A 04', name: 'Shashank Shukla', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', tech_level: 'Level 0', parent_name: 'Awadhesh Shukla', parent_phone: '+91 98390 55664', assigned_kit_id: 'KIT-ZPS-24', status: 'Active' },
  { id: 'STU-1105', student_id: 'ZPS11A 05', name: 'Divya Upadhyay', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', tech_level: 'Level 0', parent_name: 'Radheyshyam Upadhyay', parent_phone: '+91 98390 55665', assigned_kit_id: 'KIT-ZPS-25', status: 'Active' },
];

export const SEED_TRAINERS = [
  { 
    id: 'TR-01', 
    name: 'Vikas Pandey', 
    phone: '+91 94500 88991', 
    role: 'Lead STEM & Robotics Trainer', 
    status: 'Active', 
    assigned_schools: 'ZPS', 
    rating: 5.0, 
    daily_rate: 600,
    weekly_days: 2
  }
];

export const SEED_SESSIONS = [
  { id: 'SES-601', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', trainer_id: 'TR-01', date: '2026-08-28', time: '09:00 AM - 10:30 AM', topic: 'Unit 1: Introduction to Robotics & Electronics', is_locked: 1, notes: 'Introductory lab session on breadboard wiring and series circuits.' },
  { id: 'SES-701', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', trainer_id: 'TR-01', date: '2026-08-28', time: '10:45 AM - 12:15 PM', topic: 'Unit 1: Introduction to Analog & Digital Electronics', is_locked: 1, notes: 'Logic levels, voltage dividers, and potentiometer calibration.' },
  { id: 'SES-801', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', trainer_id: 'TR-01', date: '2026-08-29', time: '09:00 AM - 10:30 AM', topic: 'Unit 1: Introduction to Distance Measurement & Waves', is_locked: 1, notes: 'Sound wave reflection and ultrasonic pulse timing foundations.' },
  { id: 'SES-901', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', trainer_id: 'TR-01', date: '2026-08-29', time: '10:45 AM - 12:15 PM', topic: 'Unit 1: Introduction to Industrial Sensors & Displays', is_locked: 1, notes: 'Flame phototransistors, 16x2 LCD bus, and sensor reliability.' },
  { id: 'SES-1101', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', trainer_id: 'TR-01', date: '2026-08-29', time: '01:00 PM - 02:30 PM', topic: 'Unit 1: Introduction to Engineering Specs & Optics', is_locked: 1, notes: 'Laser optical collimation, spec definitions, and error characterization.' }
];

export const SEED_ATTENDANCE = [
  // Class 6A Session 1 (All Present)
  { session_id: 'SES-601', student_id: 'ZPS6A 01', status: 'Present' },
  { session_id: 'SES-601', student_id: 'ZPS6A 02', status: 'Present' },
  { session_id: 'SES-601', student_id: 'ZPS6A 03', status: 'Present' },
  { session_id: 'SES-601', student_id: 'ZPS6A 04', status: 'Present' },
  { session_id: 'SES-601', student_id: 'ZPS6A 05', status: 'Present' },

  // Class 7A Session 1
  { session_id: 'SES-701', student_id: 'ZPS7A 01', status: 'Present' },
  { session_id: 'SES-701', student_id: 'ZPS7A 02', status: 'Present' },
  { session_id: 'SES-701', student_id: 'ZPS7A 03', status: 'Present' },
  { session_id: 'SES-701', student_id: 'ZPS7A 04', status: 'Present' },
  { session_id: 'SES-701', student_id: 'ZPS7A 05', status: 'Present' },

  // Class 8A Session 1
  { session_id: 'SES-801', student_id: 'ZPS8A 01', status: 'Present' },
  { session_id: 'SES-801', student_id: 'ZPS8A 02', status: 'Present' },
  { session_id: 'SES-801', student_id: 'ZPS8A 03', status: 'Present' },
  { session_id: 'SES-801', student_id: 'ZPS8A 04', status: 'Present' },
  { session_id: 'SES-801', student_id: 'ZPS8A 05', status: 'Present' },

  // Class 9A Session 1
  { session_id: 'SES-901', student_id: 'ZPS9A 01', status: 'Present' },
  { session_id: 'SES-901', student_id: 'ZPS9A 02', status: 'Present' },
  { session_id: 'SES-901', student_id: 'ZPS9A 03', status: 'Present' },
  { session_id: 'SES-901', student_id: 'ZPS9A 04', status: 'Present' },
  { session_id: 'SES-901', student_id: 'ZPS9A 05', status: 'Present' },

  // Class 11A Session 1
  { session_id: 'SES-1101', student_id: 'ZPS11A 01', status: 'Present' },
  { session_id: 'SES-1101', student_id: 'ZPS11A 02', status: 'Present' },
  { session_id: 'SES-1101', student_id: 'ZPS11A 03', status: 'Present' },
  { session_id: 'SES-1101', student_id: 'ZPS11A 04', status: 'Present' },
  { session_id: 'SES-1101', student_id: 'ZPS11A 05', status: 'Present' }
];

export const SEED_INVENTORY = [
  { id: 'KIT-ZPS-01', school_id: 'ZPS', name: 'Pixiu Discovery STEM Hardware Kit #01', assigned_to: 'ZPS6A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-02', school_id: 'ZPS', name: 'Pixiu Discovery STEM Hardware Kit #02', assigned_to: 'ZPS6A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-03', school_id: 'ZPS', name: 'Pixiu Discovery STEM Hardware Kit #03', assigned_to: 'ZPS6A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-04', school_id: 'ZPS', name: 'Pixiu Discovery STEM Hardware Kit #04', assigned_to: 'ZPS6A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-05', school_id: 'ZPS', name: 'Pixiu Discovery STEM Hardware Kit #05', assigned_to: 'ZPS6A 05', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
];

export const SEED_BILLING = [
  { id: 'INV-2026-001', school_id: 'ZPS', amount: 45000, due_date: '2026-09-10', status: 'Pending', invoice_date: '2026-08-25', description: 'Term 1 STEM & Robotics Multi-Grade Lab Operations (Classes 6 to 11)' }
];

export const SEED_ALERTS = [
  {
    id: 'ALT-001',
    type: 'billing_due',
    severity: 'warning',
    message: 'Invoice INV-2026-001 for Zenith Public School (₹45,000) is scheduled for receipt follow-up.',
    action_type: 'view_billing',
    related_id: 'INV-2026-001',
    created_at: '2026-08-30'
  }
];

export const SEED_NOTIFICATIONS = [
  {
    id: 'NOTIF-001',
    target_type: 'Universal',
    target_classes: '6,7,8,9,11',
    target_trainer_id: 'All',
    title: '🚀 Term 1 Robotics Lab Sessions Live',
    message: 'Welcome to Pixiu Tech Innovation Lab! Friday and Saturday hands-on lab sessions are active for Classes 6A to 11A.',
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
    title: '📝 Unit 1 Concept Revision & Circuit Viva Notice',
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

// Structured Class Syllabus (Real Chapters from Official Pixiu Tech Robotics Books)
export const SEED_CURRICULUM = [
  // ==================== CLASS 6 ====================
  { id: 'CUR-101', week: 'Unit 1', level: 'Level 0', class_grade: '6', topic: 'Introduction to Robotics & Basic Electronics', objectives: 'Understand current, voltage, breadboards and series/parallel circuits', status: 'Completed' },
  { id: 'CUR-102', week: 'Unit 2', level: 'Level 1', class_grade: '6', topic: 'The Arduino IDE & Programming Fundamentals', objectives: 'Install Arduino IDE, board/port setup, digital I/O and blink sketches', status: 'Upcoming' },
  { id: 'CUR-103', week: 'Unit 3', level: 'Level 2', class_grade: '6', topic: 'Basic Project: Traffic Light Signal Controller', objectives: 'Multi-LED state machine, timing intervals, and traffic sequencer build', status: 'Upcoming' },
  { id: 'CUR-104', week: 'Unit 4', level: 'Level 3', class_grade: '6', topic: 'Intermediate Project: Automatic Night Lamp', objectives: 'LDR analog sensor reading, threshold comparison, and auto illumination', status: 'Upcoming' },
  { id: 'CUR-105', week: 'Unit 5', level: 'Level 4', class_grade: '6', topic: 'Final Project: Smart Toll Booth', objectives: 'Ultrasonic distance sensing, servo barrier gate actuation, and vehicle buzzer', status: 'Upcoming' },
  { id: 'CUR-106', week: 'Unit 6', level: 'Level 5', class_grade: '6', topic: 'Extra Challenges, Glossary & Project Log', objectives: 'Capstone extension challenges, troubleshooting checklist and engineering log', status: 'Upcoming' },

  // ==================== CLASS 7 ====================
  { id: 'CUR-201', week: 'Unit 1', level: 'Level 0', class_grade: '7', topic: 'Introduction to Analog & Digital Electronics', objectives: 'Continuous vs discrete signals, voltage dividers, and potentiometer calibration', status: 'Completed' },
  { id: 'CUR-202', week: 'Unit 2', level: 'Level 1', class_grade: '7', topic: 'The Arduino IDE & Serial Communication', objectives: 'Serial monitor debugging, analogRead() 10-bit resolution, and variables', status: 'Upcoming' },
  { id: 'CUR-203', week: 'Unit 3', level: 'Level 2', class_grade: '7', topic: 'Basic Project: LED Dimmer and Mood Light', objectives: 'PWM pulse width modulation, duty cycle control, and smooth dimming', status: 'Upcoming' },
  { id: 'CUR-204', week: 'Unit 4', level: 'Level 3', class_grade: '7', topic: 'Intermediate Project: Temperature and Humidity Monitor', objectives: 'DHT11 sensor interfacing, digital single-wire protocol, and climate telemetry', status: 'Upcoming' },
  { id: 'CUR-205', week: 'Unit 5', level: 'Level 4', class_grade: '7', topic: 'Final Project: Smart Rain Alarm System', objectives: 'Raindrop sensor plate, water conductivity detection, and buzzer alert system', status: 'Upcoming' },
  { id: 'CUR-206', week: 'Unit 6', level: 'Level 5', class_grade: '7', topic: 'Extra Challenges, Glossary & Project Log', objectives: 'Capstone extension challenges, troubleshooting checklist and project log', status: 'Upcoming' },

  // ==================== CLASS 8 ====================
  { id: 'CUR-301', week: 'Unit 1', level: 'Level 0', class_grade: '8', topic: 'Introduction to Distance Measurement & Waves', objectives: 'Sound wave reflection, echo pulse timing, and microsecond precision', status: 'Completed' },
  { id: 'CUR-302', week: 'Unit 2', level: 'Level 1', class_grade: '8', topic: 'The Arduino IDE & Sensor Libraries', objectives: 'External library integration, modular functions, and trigonometric math', status: 'Upcoming' },
  { id: 'CUR-303', week: 'Unit 3', level: 'Level 2', class_grade: '8', topic: 'Basic Project: Height Measurement Station', objectives: 'HC-SR04 ultrasonic echo timing, stand height calibration, and live height computation', status: 'Upcoming' },
  { id: 'CUR-304', week: 'Unit 4', level: 'Level 3', class_grade: '8', topic: 'Intermediate Project: Smart Contactless Dustbin', objectives: 'Proximity detection, SG90 servo lid opening, and automated hygiene control', status: 'Upcoming' },
  { id: 'CUR-305', week: 'Unit 5', level: 'Level 4', class_grade: '8', topic: 'Final Project: Obstacle-Avoiding Robot', objectives: '2WD chassis assembly, L298N H-bridge motor driver, and collision avoidance', status: 'Upcoming' },
  { id: 'CUR-306', week: 'Unit 6', level: 'Level 5', class_grade: '8', topic: 'Extra Challenges, Glossary & Project Log', objectives: 'Capstone extension challenges, troubleshooting checklist and project log', status: 'Upcoming' },

  // ==================== CLASS 9 ====================
  { id: 'CUR-401', week: 'Unit 1', level: 'Level 0', class_grade: '9', topic: 'Introduction to Industrial Sensors & Displays', objectives: 'Infrared flame spectrum, LCD controllers, and multi-sensor reliability', status: 'Completed' },
  { id: 'CUR-402', week: 'Unit 2', level: 'Level 1', class_grade: '9', topic: 'The Arduino IDE & Memory Architecture', objectives: 'SRAM optimization, EEPROM storage, and embedded systems architecture', status: 'Upcoming' },
  { id: 'CUR-403', week: 'Unit 3', level: 'Level 2', class_grade: '9', topic: 'Basic Project: Fire Security Alarm System', objectives: 'Flame sensor phototransistor calibration, thermal cross-check, and siren trigger', status: 'Upcoming' },
  { id: 'CUR-404', week: 'Unit 4', level: 'Level 3', class_grade: '9', topic: 'Intermediate Project: Smart 16x2 LCD Weather System', objectives: 'Parallel / I2C 16x2 LCD display, live temperature/humidity readouts, and custom chars', status: 'Upcoming' },
  { id: 'CUR-405', week: 'Unit 5', level: 'Level 4', class_grade: '9', topic: 'Final Project: Line Following Robot', objectives: 'Dual IR reflectance array, Differential drive steering, and track following PID', status: 'Upcoming' },
  { id: 'CUR-406', week: 'Unit 6', level: 'Level 5', class_grade: '9', topic: 'Extra Challenges, Wiring Reference & Project Log', objectives: 'Full circuit wiring reference, glossary, and capstone project log', status: 'Upcoming' },

  // ==================== CLASS 11 ====================
  { id: 'CUR-501', week: 'Unit 1', level: 'Level 0', class_grade: '11', topic: 'Introduction to Engineering Specs & Optics', objectives: 'Precision instrumentation, laser collimation, error analysis, and formal specs', status: 'Completed' },
  { id: 'CUR-502', week: 'Unit 2', level: 'Level 1', class_grade: '11', topic: 'The Arduino IDE & Advanced Microcontroller Control', objectives: 'Hardware timers, interrupts, state machines, and register-level programming', status: 'Upcoming' },
  { id: 'CUR-503', week: 'Unit 3', level: 'Level 2', class_grade: '11', topic: 'Basic Project: Laser Security System', objectives: '650nm laser tripwire, optical alignment, LDR receiver stage, and latching alarm', status: 'Upcoming' },
  { id: 'CUR-504', week: 'Unit 4', level: 'Level 3', class_grade: '11', topic: 'Intermediate Project: Ultrasonic Measurement & Calibration', objectives: 'Temperature-compensated speed of sound, error characterization, and millimeter telemetry', status: 'Upcoming' },
  { id: 'CUR-505', week: 'Unit 5', level: 'Level 4', class_grade: '11', topic: 'Capstone Project: Maze Solver Robot', objectives: 'Multi-sensor boundary tracing, left-hand wall-following algorithm, and autonomous maze solver', status: 'Upcoming' },
  { id: 'CUR-506', week: 'Unit 6', level: 'Level 5', class_grade: '11', topic: 'Engineering Reference, Glossary & Engineering Log', objectives: 'Full system wiring reference, component pinouts, and formal engineering log', status: 'Upcoming' }
];

// Content Assets: All 30 Unwatermarked Teacher Master Units + 30 Student Editions
export const SEED_CONTENT = [
  // ==================== TEACHER MASTER PACKS (30 UNITS - ALL CLASSES 6, 7, 8, 9, 11) ====================
  // Class 6 Teacher Masters
  { id: 'CNT-601-T', title: 'Class 6 - Unit 1: Introduction to Robotics & Electronics (Teacher Master)', type: 'PDF', level: 'Level 0', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit1-teacher.pdf', file_url: '/materials/class6-unit1-teacher.pdf', description: 'Instructor guide, circuit schematics & viva questions for Unit 1' },
  { id: 'CNT-602-T', title: 'Class 6 - Unit 2: The Arduino IDE (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit2-teacher.pdf', file_url: '/materials/class6-unit2-teacher.pdf', description: 'Instructor IDE setup, driver installation and Blink sketch lesson plan' },
  { id: 'CNT-603-T', title: 'Class 6 - Unit 3: Basic Project - Traffic Light Signal (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit3-teacher.pdf', file_url: '/materials/class6-unit3-teacher.pdf', description: 'Traffic sequencer circuit schematics, timing rubrics, and code walkthrough' },
  { id: 'CNT-604-T', title: 'Class 6 - Unit 4: Intermediate Project - Automatic Night Lamp (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit4-teacher.pdf', file_url: '/materials/class6-unit4-teacher.pdf', description: 'LDR voltage divider lesson plan, threshold calibration, and night lamp build' },
  { id: 'CNT-605-T', title: 'Class 6 - Unit 5: Final Project - Smart Toll Booth (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit5-teacher.pdf', file_url: '/materials/class6-unit5-teacher.pdf', description: 'Ultrasonic + Servo barrier integration rubric and live evaluation guide' },
  { id: 'CNT-606-T', title: 'Class 6 - Unit 6: Capstone Challenges & Project Log (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '6', target: 'Teacher', is_watermarked: 0, url: '/materials/class6-unit6-teacher.pdf', file_url: '/materials/class6-unit6-teacher.pdf', description: 'Extension challenges, answer key, and end-of-term certification audit' },

  // Class 7 Teacher Masters
  { id: 'CNT-701-T', title: 'Class 7 - Unit 1: Introduction to Analog & Digital (Teacher Master)', type: 'PDF', level: 'Level 0', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit1-teacher.pdf', file_url: '/materials/class7-unit1-teacher.pdf', description: 'Analog vs digital concepts, voltage dividers, and potentiometer lesson plan' },
  { id: 'CNT-702-T', title: 'Class 7 - Unit 2: The Arduino IDE & Serial Monitor (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit2-teacher.pdf', file_url: '/materials/class7-unit2-teacher.pdf', description: 'Serial communication baud rates and 10-bit analogRead() walkthrough' },
  { id: 'CNT-703-T', title: 'Class 7 - Unit 3: Basic Project - LED Dimmer & Mood Light (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit3-teacher.pdf', file_url: '/materials/class7-unit3-teacher.pdf', description: 'PWM analogWrite() duty cycles and potentiometer dimming schematics' },
  { id: 'CNT-704-T', title: 'Class 7 - Unit 4: Intermediate Project - Temp & Humidity (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit4-teacher.pdf', file_url: '/materials/class7-unit4-teacher.pdf', description: 'DHT11 library integration, digital timing, and serial telemetry lesson' },
  { id: 'CNT-705-T', title: 'Class 7 - Unit 5: Final Project - Smart Rain Alarm (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit5-teacher.pdf', file_url: '/materials/class7-unit5-teacher.pdf', description: 'Water conductivity detection board, buzzer driver, and evaluation rubric' },
  { id: 'CNT-706-T', title: 'Class 7 - Unit 6: Capstone Challenges & Project Log (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '7', target: 'Teacher', is_watermarked: 0, url: '/materials/class7-unit6-teacher.pdf', file_url: '/materials/class7-unit6-teacher.pdf', description: 'Extension challenges, answer key, and end-of-term certification audit' },

  // Class 8 Teacher Masters
  { id: 'CNT-801-T', title: 'Class 8 - Unit 1: Introduction to Waves & Distance (Teacher Master)', type: 'PDF', level: 'Level 0', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit1-teacher.pdf', file_url: '/materials/class8-unit1-teacher.pdf', description: 'Sound wave physics, ultrasonic echo reflections, and circuit loops' },
  { id: 'CNT-802-T', title: 'Class 8 - Unit 2: The Arduino IDE & Math Libraries (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit2-teacher.pdf', file_url: '/materials/class8-unit2-teacher.pdf', description: 'Microsecond pulse timing, pulseIn() calculation, and speed of sound' },
  { id: 'CNT-803-T', title: 'Class 8 - Unit 3: Basic Project - Height Measurement (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit3-teacher.pdf', file_url: '/materials/class8-unit3-teacher.pdf', description: 'Height station build schematics, stand height calibration and accuracy' },
  { id: 'CNT-804-T', title: 'Class 8 - Unit 4: Intermediate Project - Contactless Dustbin (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit4-teacher.pdf', file_url: '/materials/class8-unit4-teacher.pdf', description: 'Servo position control, automated lid actuation and proximity thresholds' },
  { id: 'CNT-805-T', title: 'Class 8 - Unit 5: Final Project - Obstacle-Avoiding Robot (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit5-teacher.pdf', file_url: '/materials/class8-unit5-teacher.pdf', description: 'H-bridge motor driver, 2WD robotic chassis, and autonomous steering' },
  { id: 'CNT-806-T', title: 'Class 8 - Unit 6: Capstone Challenges & Project Log (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '8', target: 'Teacher', is_watermarked: 0, url: '/materials/class8-unit6-teacher.pdf', file_url: '/materials/class8-unit6-teacher.pdf', description: 'Extension challenges, answer key, and end-of-term certification audit' },

  // Class 9 Teacher Masters
  { id: 'CNT-901-T', title: 'Class 9 - Unit 1: Introduction to Sensors & Displays (Teacher Master)', type: 'PDF', level: 'Level 0', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit1-teacher.pdf', file_url: '/materials/class9-unit1-teacher.pdf', description: 'Infrared flame spectrum, LCD controllers, and sensor cross-confirmation' },
  { id: 'CNT-902-T', title: 'Class 9 - Unit 2: The Arduino IDE & Memory Management (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit2-teacher.pdf', file_url: '/materials/class9-unit2-teacher.pdf', description: 'ATmega328P SRAM optimization, Ohm\'s law verification, and registers' },
  { id: 'CNT-903-T', title: 'Class 9 - Unit 3: Basic Project - Fire Security Alarm (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit3-teacher.pdf', file_url: '/materials/class9-unit3-teacher.pdf', description: 'Flame sensor phototransistor calibration and dual-confirmation siren build' },
  { id: 'CNT-904-T', title: 'Class 9 - Unit 4: Intermediate Project - Smart 16x2 LCD (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit4-teacher.pdf', file_url: '/materials/class9-unit4-teacher.pdf', description: 'LiquidCrystal library, 4-bit bus wiring, and weather telemetry interface' },
  { id: 'CNT-905-T', title: 'Class 9 - Unit 5: Final Project - Line Following Robot (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit5-teacher.pdf', file_url: '/materials/class9-unit5-teacher.pdf', description: 'Dual IR reflectance tracking, differential motor drive, and track PID rubric' },
  { id: 'CNT-906-T', title: 'Class 9 - Unit 6: Capstone Challenges & Wiring Reference (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '9', target: 'Teacher', is_watermarked: 0, url: '/materials/class9-unit6-teacher.pdf', file_url: '/materials/class9-unit6-teacher.pdf', description: 'Wiring reference for all 3 projects, answer key, and project log' },

  // Class 11 Teacher Masters
  { id: 'CNT-1101-T', title: 'Class 11 - Unit 1: Introduction to Engineering Specs (Teacher Master)', type: 'PDF', level: 'Level 0', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit1-teacher.pdf', file_url: '/materials/class11-unit1-teacher.pdf', description: 'Laser optical collimation, spec definitions, and error characterization' },
  { id: 'CNT-1102-T', title: 'Class 11 - Unit 2: The Arduino IDE & Advanced Control (Teacher Master)', type: 'PDF', level: 'Level 1', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit2-teacher.pdf', file_url: '/materials/class11-unit2-teacher.pdf', description: 'Hardware interrupts, state machine architectures, and timer PWM' },
  { id: 'CNT-1103-T', title: 'Class 11 - Unit 3: Basic Project - Laser Security System (Teacher Master)', type: 'PDF', level: 'Level 2', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit3-teacher.pdf', file_url: '/materials/class11-unit3-teacher.pdf', description: '650nm laser tripwire, receiver optical alignment, and latching alarm' },
  { id: 'CNT-1104-T', title: 'Class 11 - Unit 4: Intermediate Project - Ultrasonic Calibration (Teacher Master)', type: 'PDF', level: 'Level 3', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit4-teacher.pdf', file_url: '/materials/class11-unit4-teacher.pdf', description: 'Temperature-compensated speed of sound and millimeter error modeling' },
  { id: 'CNT-1105-T', title: 'Class 11 - Unit 5: Capstone Project - Maze Solver Robot (Teacher Master)', type: 'PDF', level: 'Level 4', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit5-teacher.pdf', file_url: '/materials/class11-unit5-teacher.pdf', description: 'Left-hand wall-following algorithm, triple sensor fusion, and maze solver' },
  { id: 'CNT-1106-T', title: 'Class 11 - Unit 6: Engineering Reference & Log (Teacher Master)', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Teacher', is_watermarked: 0, url: '/materials/class11-unit6-teacher.pdf', file_url: '/materials/class11-unit6-teacher.pdf', description: 'System wiring reference, component pinouts, and formal engineering log' },

  // ==================== STUDENT STUDY GUIDES (ALL 30 UNITS - CLASSES 6, 7, 8, 9, 11) ====================
  // Class 6 Student Guides
  { id: 'CNT-601-S', title: 'Class 6 - Unit 1: Introduction to Robotics & Electronics', type: 'PDF', level: 'Level 0', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit1-student-watermarked.pdf', file_url: '/materials/class6-unit1-student-watermarked.pdf', description: 'Foundational electronics, LEDs, breadboard wiring and series/parallel circuits' },
  { id: 'CNT-602-S', title: 'Class 6 - Unit 2: The Arduino IDE', type: 'PDF', level: 'Level 1', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit2-student-watermarked.pdf', file_url: '/materials/class6-unit2-student-watermarked.pdf', description: 'Setting up the Arduino IDE, board & port configuration, and Blink sketch' },
  { id: 'CNT-603-S', title: 'Class 6 - Unit 3: Basic Project - Traffic Light Signal Controller', type: 'PDF', level: 'Level 2', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit3-student-watermarked.pdf', file_url: '/materials/class6-unit3-student-watermarked.pdf', description: 'Build a multi-LED traffic sequencer with automated timing intervals' },
  { id: 'CNT-604-S', title: 'Class 6 - Unit 4: Intermediate Project - Automatic Night Lamp', type: 'PDF', level: 'Level 3', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit4-student-watermarked.pdf', file_url: '/materials/class6-unit4-student-watermarked.pdf', description: 'Build an ambient-light sensing automatic lamp using LDR voltage dividers' },
  { id: 'CNT-605-S', title: 'Class 6 - Unit 5: Final Project - Smart Toll Booth', type: 'PDF', level: 'Level 4', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit5-student-watermarked.pdf', file_url: '/materials/class6-unit5-student-watermarked.pdf', description: 'Build an autonomous toll gate with ultrasonic vehicle detection & servo barrier' },
  { id: 'CNT-606-S', title: 'Class 6 - Unit 6: Extra Challenges & Project Log', type: 'PDF', level: 'Level 5', class_grade: '6', target: 'Student', is_watermarked: 1, url: '/materials/class6-unit6-student-watermarked.pdf', file_url: '/materials/class6-unit6-student-watermarked.pdf', description: 'Extension lab challenges, electronics glossary, and project log' },

  // Class 7 Student Guides
  { id: 'CNT-701-S', title: 'Class 7 - Unit 1: Introduction to Analog & Digital Electronics', type: 'PDF', level: 'Level 0', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit1-student-watermarked.pdf', file_url: '/materials/class7-unit1-student-watermarked.pdf', description: 'Analog vs digital signals, voltage divider circuits, and potentiometer calibration' },
  { id: 'CNT-702-S', title: 'Class 7 - Unit 2: The Arduino IDE & Serial Monitor', type: 'PDF', level: 'Level 1', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit2-student-watermarked.pdf', file_url: '/materials/class7-unit2-student-watermarked.pdf', description: 'Serial monitor telemetry, 10-bit analogRead() resolution, and data graphing' },
  { id: 'CNT-703-S', title: 'Class 7 - Unit 3: Basic Project - LED Dimmer and Mood Light', type: 'PDF', level: 'Level 2', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit3-student-watermarked.pdf', file_url: '/materials/class7-unit3-student-watermarked.pdf', description: 'PWM duty cycle brightness control and interactive potentiometer mood light' },
  { id: 'CNT-704-S', title: 'Class 7 - Unit 4: Intermediate Project - Temperature & Humidity Monitor', type: 'PDF', level: 'Level 3', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit4-student-watermarked.pdf', file_url: '/materials/class7-unit4-student-watermarked.pdf', description: 'Digital DHT11 sensor wiring, timing library integration, and live telemetry' },
  { id: 'CNT-705-S', title: 'Class 7 - Unit 5: Final Project - Smart Rain Alarm System', type: 'PDF', level: 'Level 4', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit5-student-watermarked.pdf', file_url: '/materials/class7-unit5-student-watermarked.pdf', description: 'Water conductivity sensor plate, threshold buzzer alert, and automated protection' },
  { id: 'CNT-706-S', title: 'Class 7 - Unit 6: Extra Challenges & Project Log', type: 'PDF', level: 'Level 5', class_grade: '7', target: 'Student', is_watermarked: 1, url: '/materials/class7-unit6-student-watermarked.pdf', file_url: '/materials/class7-unit6-student-watermarked.pdf', description: 'Extension lab challenges, electronics glossary, and project log' },

  // Class 8 Student Guides
  { id: 'CNT-801-S', title: 'Class 8 - Unit 1: Introduction to Waves & Distance Measurement', type: 'PDF', level: 'Level 0', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit1-student-watermarked.pdf', file_url: '/materials/class8-unit1-student-watermarked.pdf', description: 'Sound wave physics, ultrasonic echo reflection, and circuit loops' },
  { id: 'CNT-802-S', title: 'Class 8 - Unit 2: The Arduino IDE & Sensor Libraries', type: 'PDF', level: 'Level 1', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit2-student-watermarked.pdf', file_url: '/materials/class8-unit2-student-watermarked.pdf', description: 'Microsecond pulse timing, pulseIn() calculation, and math functions' },
  { id: 'CNT-803-S', title: 'Class 8 - Unit 3: Basic Project - Height Measurement Station', type: 'PDF', level: 'Level 2', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit3-student-watermarked.pdf', file_url: '/materials/class8-unit3-student-watermarked.pdf', description: 'HC-SR04 ultrasonic echo timing, stand calibration, and real-time height readout' },
  { id: 'CNT-804-S', title: 'Class 8 - Unit 4: Intermediate Project - Smart Contactless Dustbin', type: 'PDF', level: 'Level 3', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit4-student-watermarked.pdf', file_url: '/materials/class8-unit4-student-watermarked.pdf', description: 'Proximity detection, SG90 servo position angle control, and automated lid' },
  { id: 'CNT-805-S', title: 'Class 8 - Unit 5: Final Project - Obstacle-Avoiding Robot', type: 'PDF', level: 'Level 4', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit5-student-watermarked.pdf', file_url: '/materials/class8-unit5-student-watermarked.pdf', description: '2WD robotic chassis, L298N H-bridge motor driver, and autonomous avoidance' },
  { id: 'CNT-806-S', title: 'Class 8 - Unit 6: Extra Challenges & Project Log', type: 'PDF', level: 'Level 5', class_grade: '8', target: 'Student', is_watermarked: 1, url: '/materials/class8-unit6-student-watermarked.pdf', file_url: '/materials/class8-unit6-student-watermarked.pdf', description: 'Extension lab challenges, robotics glossary, and project log' },

  // Class 9 Student Guides
  { id: 'CNT-901-S', title: 'Class 9 - Unit 1: Introduction to Industrial Sensors & Displays', type: 'PDF', level: 'Level 0', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit1-student-watermarked.pdf', file_url: '/materials/class9-unit1-student-watermarked.pdf', description: 'Infrared flame detection, LCD displays, and sensor cross-confirmation' },
  { id: 'CNT-902-S', title: 'Class 9 - Unit 2: The Arduino IDE & Memory Architecture', type: 'PDF', level: 'Level 1', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit2-student-watermarked.pdf', file_url: '/materials/class9-unit2-student-watermarked.pdf', description: 'ATmega328P SRAM optimization, Ohm\'s law verification, and registers' },
  { id: 'CNT-903-S', title: 'Class 9 - Unit 3: Basic Project - Fire Security Alarm System', type: 'PDF', level: 'Level 2', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit3-student-watermarked.pdf', file_url: '/materials/class9-unit3-student-watermarked.pdf', description: 'Flame sensor phototransistor calibration, thermal confirmation, and siren alarm' },
  { id: 'CNT-904-S', title: 'Class 9 - Unit 4: Intermediate Project - Smart 16x2 LCD Weather System', type: 'PDF', level: 'Level 3', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit4-student-watermarked.pdf', file_url: '/materials/class9-unit4-student-watermarked.pdf', description: '16x2 LCD 4-bit bus interface, live climate telemetry, and custom characters' },
  { id: 'CNT-905-S', title: 'Class 9 - Unit 5: Final Project - Line Following Robot', type: 'PDF', level: 'Level 4', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit5-student-watermarked.pdf', file_url: '/materials/class9-unit5-student-watermarked.pdf', description: 'Dual IR reflectance tracking, differential motor drive, and track PID rubric' },
  { id: 'CNT-906-S', title: 'Class 9 - Unit 6: Extra Challenges & Wiring Reference', type: 'PDF', level: 'Level 5', class_grade: '9', target: 'Student', is_watermarked: 1, url: '/materials/class9-unit6-student-watermarked.pdf', file_url: '/materials/class9-unit6-student-watermarked.pdf', description: 'Wiring reference for all 3 projects, answer key, and project log' },

  // Class 11 Student Guides
  { id: 'CNT-1101-S', title: 'Class 11 - Unit 1: Introduction to Engineering Specs & Optics', type: 'PDF', level: 'Level 0', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit1-student-watermarked.pdf', file_url: '/materials/class11-unit1-student-watermarked.pdf', description: 'Laser optical collimation, spec definitions, and error characterization' },
  { id: 'CNT-1102-S', title: 'Class 11 - Unit 2: The Arduino IDE & Advanced Control', type: 'PDF', level: 'Level 1', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit2-student-watermarked.pdf', file_url: '/materials/class11-unit2-student-watermarked.pdf', description: 'Hardware interrupts, state machine architectures, and timer PWM' },
  { id: 'CNT-1103-S', title: 'Class 11 - Unit 3: Basic Project - Laser Security System', type: 'PDF', level: 'Level 2', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit3-student-watermarked.pdf', file_url: '/materials/class11-unit3-student-watermarked.pdf', description: '650nm laser tripwire, optical alignment, LDR receiver stage, and latching alarm' },
  { id: 'CNT-1104-S', title: 'Class 11 - Unit 4: Intermediate Project - Ultrasonic Calibration', type: 'PDF', level: 'Level 3', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit4-student-watermarked.pdf', file_url: '/materials/class11-unit4-student-watermarked.pdf', description: 'Temperature-compensated speed of sound and millimeter error modeling' },
  { id: 'CNT-1105-S', title: 'Class 11 - Unit 5: Capstone Project - Maze Solver Robot', type: 'PDF', level: 'Level 4', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit5-student-watermarked.pdf', file_url: '/materials/class11-unit5-student-watermarked.pdf', description: 'Left-hand wall-following algorithm, triple sensor fusion, and maze solver' },
  { id: 'CNT-1106-S', title: 'Class 11 - Unit 6: Engineering Reference & Log', type: 'PDF', level: 'Level 5', class_grade: '11', target: 'Student', is_watermarked: 1, url: '/materials/class11-unit6-student-watermarked.pdf', file_url: '/materials/class11-unit6-student-watermarked.pdf', description: 'System wiring reference, component pinouts, and formal engineering log' }
];

// End-of-Unit Student Reviews by Trainers (Initialized Empty - Evaluated live by Trainers)
export const SEED_STUDENT_REVIEWS = [];
