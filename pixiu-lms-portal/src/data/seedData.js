// Master Initial Seed Data for Multi-School Pixiu Tech OS

export const SEED_SCHOOLS = [
  { id: 'ZPS', name: 'Zenith Public School', code: 'ZPS', city: 'Hata', tier: 'Tier 2 Partner', status: 'Active', contract_type: 'Full STEM Lab Suite', principal_name: 'Dr. R.K. Mishra', principal_phone: '+91 94151 22334', lab_room: 'Block B - Innovation Lab 102', enrolled_classes: ['6A', '7A', '8A', '9A', '11A'], created_at: '2026-08-01', lead_trainer: 'Vikas Pandey', trainer_id: 'TR-01' },
  { id: 'XYZ', name: 'XYZ Academy (Pilot Lab)', code: 'XYZ', city: 'Gorakhpur', tier: 'Tier 1 Partner', status: 'Active', contract_type: 'Robotics & STEM Lab Suite', principal_name: 'Prof. S.N. Verma', principal_phone: '+91 94151 88776', lab_room: 'Block C - Advanced Robotics Lab 204', enrolled_classes: ['6A', '7A', '8A', '9A', '11A'], created_at: '2026-08-15', lead_trainer: 'Akash Sharma', trainer_id: 'TR-02' }
];

export const SEED_CLASSES = [
  // Zenith Public School Classes
  { id: 'CLS-ZPS-6A', school_id: 'ZPS', grade: '6', section: 'A', stream: 'Robotics & Foundation', student_count: 5, lead_trainer_id: 'TR-01', day: 'Friday', time_slot: '09:00 AM - 10:30 AM' },
  { id: 'CLS-ZPS-7A', school_id: 'ZPS', grade: '7', section: 'A', stream: 'Robotics & Logic Circuits', student_count: 5, lead_trainer_id: 'TR-01', day: 'Friday', time_slot: '10:45 AM - 12:15 PM' },
  { id: 'CLS-ZPS-8A', school_id: 'ZPS', grade: '8', section: 'A', stream: 'Robotics & Microcontrollers', student_count: 5, lead_trainer_id: 'TR-01', day: 'Saturday', time_slot: '09:00 AM - 10:30 AM' },
  { id: 'CLS-ZPS-9A', school_id: 'ZPS', grade: '9', section: 'A', stream: 'IoT & Embedded Sensors', student_count: 5, lead_trainer_id: 'TR-01', day: 'Saturday', time_slot: '10:45 AM - 12:15 PM' },
  { id: 'CLS-ZPS-11A', school_id: 'ZPS', grade: '11', section: 'A', stream: 'AI Vision & Autonomous Robotics', student_count: 5, lead_trainer_id: 'TR-01', day: 'Saturday', time_slot: '01:00 PM - 02:30 PM' },

  // XYZ Academy Classes (4 Students Each)
  { id: 'CLS-XYZ-6A', school_id: 'XYZ', grade: '6', section: 'A', stream: 'Robotics & Electronic Basics', student_count: 4, lead_trainer_id: 'TR-02', day: 'Monday', time_slot: '09:00 AM - 10:30 AM' },
  { id: 'CLS-XYZ-7A', school_id: 'XYZ', grade: '7', section: 'A', stream: 'Robotics & Sensory Actuation', student_count: 4, lead_trainer_id: 'TR-02', day: 'Monday', time_slot: '10:45 AM - 12:15 PM' },
  { id: 'CLS-XYZ-8A', school_id: 'XYZ', grade: '8', section: 'A', stream: 'Autonomous Mobile Robotics', student_count: 4, lead_trainer_id: 'TR-02', day: 'Tuesday', time_slot: '09:00 AM - 10:30 AM' },
  { id: 'CLS-XYZ-9A', school_id: 'XYZ', grade: '9', section: 'A', stream: 'Opto-Electronics & Display Systems', student_count: 4, lead_trainer_id: 'TR-02', day: 'Tuesday', time_slot: '10:45 AM - 12:15 PM' },
  { id: 'CLS-XYZ-11A', school_id: 'XYZ', grade: '11', section: 'A', stream: 'Laser Optics & Capstone Robotics', student_count: 4, lead_trainer_id: 'TR-02', day: 'Tuesday', time_slot: '01:00 PM - 02:30 PM' },
];

export const SEED_STUDENTS = [
  // ==================== ZENITH PUBLIC SCHOOL (ZPS) ====================
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

  // ==================== XYZ ACADEMY (DUMMY / PILOT LAB - 4 STUDENTS PER CLASS) ====================
  // Class 6A
  { id: 'STU-XYZ-601', student_id: 'XYZ6A 01', name: 'Manish Rawat', school_id: 'XYZ', class_id: 'CLS-XYZ-6A', tech_level: 'Level 0', parent_name: 'Prakash Rawat', parent_phone: '+91 98390 66111', assigned_kit_id: 'KIT-XYZ-01', status: 'Active' },
  { id: 'STU-XYZ-602', student_id: 'XYZ6A 02', name: 'Kavita Saxena', school_id: 'XYZ', class_id: 'CLS-XYZ-6A', tech_level: 'Level 0', parent_name: 'Sunil Saxena', parent_phone: '+91 98390 66112', assigned_kit_id: 'KIT-XYZ-02', status: 'Active' },
  { id: 'STU-XYZ-603', student_id: 'XYZ6A 03', name: 'Ayushmann Jha', school_id: 'XYZ', class_id: 'CLS-XYZ-6A', tech_level: 'Level 0', parent_name: 'R.K. Jha', parent_phone: '+91 98390 66113', assigned_kit_id: 'KIT-XYZ-03', status: 'Active' },
  { id: 'STU-XYZ-604', student_id: 'XYZ6A 04', name: 'Ritika Sen', school_id: 'XYZ', class_id: 'CLS-XYZ-6A', tech_level: 'Level 0', parent_name: 'Debashish Sen', parent_phone: '+91 98390 66114', assigned_kit_id: 'KIT-XYZ-04', status: 'Active' },

  // Class 7A
  { id: 'STU-XYZ-701', student_id: 'XYZ7A 01', name: 'Pranav Bhatt', school_id: 'XYZ', class_id: 'CLS-XYZ-7A', tech_level: 'Level 0', parent_name: 'G.S. Bhatt', parent_phone: '+91 98390 66221', assigned_kit_id: 'KIT-XYZ-05', status: 'Active' },
  { id: 'STU-XYZ-702', student_id: 'XYZ7A 02', name: 'Ananya Deshmukh', school_id: 'XYZ', class_id: 'CLS-XYZ-7A', tech_level: 'Level 0', parent_name: 'V.D. Deshmukh', parent_phone: '+91 98390 66222', assigned_kit_id: 'KIT-XYZ-06', status: 'Active' },
  { id: 'STU-XYZ-703', student_id: 'XYZ7A 03', name: 'Sameer Khan', school_id: 'XYZ', class_id: 'CLS-XYZ-7A', tech_level: 'Level 0', parent_name: 'Imran Khan', parent_phone: '+91 98390 66223', assigned_kit_id: 'KIT-XYZ-07', status: 'Active' },
  { id: 'STU-XYZ-704', student_id: 'XYZ7A 04', name: 'Pooja Hegde', school_id: 'XYZ', class_id: 'CLS-XYZ-7A', tech_level: 'Level 0', parent_name: 'K. Hegde', parent_phone: '+91 98390 66224', assigned_kit_id: 'KIT-XYZ-08', status: 'Active' },

  // Class 8A
  { id: 'STU-XYZ-801', student_id: 'XYZ8A 01', name: 'Varun Nair', school_id: 'XYZ', class_id: 'CLS-XYZ-8A', tech_level: 'Level 0', parent_name: 'M. Nair', parent_phone: '+91 98390 66331', assigned_kit_id: 'KIT-XYZ-09', status: 'Active' },
  { id: 'STU-XYZ-802', student_id: 'XYZ8A 02', name: 'Tanya Roy', school_id: 'XYZ', class_id: 'CLS-XYZ-8A', tech_level: 'Level 0', parent_name: 'Subhash Roy', parent_phone: '+91 98390 66332', assigned_kit_id: 'KIT-XYZ-10', status: 'Active' },
  { id: 'STU-XYZ-803', student_id: 'XYZ8A 03', name: 'Aman Deep', school_id: 'XYZ', class_id: 'CLS-XYZ-8A', tech_level: 'Level 0', parent_name: 'Gurmeet Singh', parent_phone: '+91 98390 66333', assigned_kit_id: 'KIT-XYZ-11', status: 'Active' },
  { id: 'STU-XYZ-804', student_id: 'XYZ8A 04', name: 'Nisha Pillai', school_id: 'XYZ', class_id: 'CLS-XYZ-8A', tech_level: 'Level 0', parent_name: 'R. Pillai', parent_phone: '+91 98390 66334', assigned_kit_id: 'KIT-XYZ-12', status: 'Active' },

  // Class 9A
  { id: 'STU-XYZ-901', student_id: 'XYZ9A 01', name: 'Gaurav Kulkarni', school_id: 'XYZ', class_id: 'CLS-XYZ-9A', tech_level: 'Level 0', parent_name: 'A. Kulkarni', parent_phone: '+91 98390 66441', assigned_kit_id: 'KIT-XYZ-13', status: 'Active' },
  { id: 'STU-XYZ-902', student_id: 'XYZ9A 02', name: 'Swati Chawla', school_id: 'XYZ', class_id: 'CLS-XYZ-9A', tech_level: 'Level 0', parent_name: 'D. Chawla', parent_phone: '+91 98390 66442', assigned_kit_id: 'KIT-XYZ-14', status: 'Active' },
  { id: 'STU-XYZ-903', student_id: 'XYZ9A 03', name: 'Kunal Kapoor', school_id: 'XYZ', class_id: 'CLS-XYZ-9A', tech_level: 'Level 0', parent_name: 'S. Kapoor', parent_phone: '+91 98390 66443', assigned_kit_id: 'KIT-XYZ-15', status: 'Active' },
  { id: 'STU-XYZ-904', student_id: 'XYZ9A 04', name: 'Shruti Iyer', school_id: 'XYZ', class_id: 'CLS-XYZ-9A', tech_level: 'Level 0', parent_name: 'N. Iyer', parent_phone: '+91 98390 66444', assigned_kit_id: 'KIT-XYZ-16', status: 'Active' },

  // Class 11A
  { id: 'STU-XYZ-1101', student_id: 'XYZ11A 01', name: 'Harshit Chauhan', school_id: 'XYZ', class_id: 'CLS-XYZ-11A', tech_level: 'Level 0', parent_name: 'R.P. Chauhan', parent_phone: '+91 98390 66551', assigned_kit_id: 'KIT-XYZ-17', status: 'Active' },
  { id: 'STU-XYZ-1102', student_id: 'XYZ11A 02', name: 'Bhavna Menon', school_id: 'XYZ', class_id: 'CLS-XYZ-11A', tech_level: 'Level 0', parent_name: 'S. Menon', parent_phone: '+91 98390 66552', assigned_kit_id: 'KIT-XYZ-18', status: 'Active' },
  { id: 'STU-XYZ-1103', student_id: 'XYZ11A 03', name: 'Kartik Somani', school_id: 'XYZ', class_id: 'CLS-XYZ-11A', tech_level: 'Level 0', parent_name: 'M. Somani', parent_phone: '+91 98390 66553', assigned_kit_id: 'KIT-XYZ-19', status: 'Active' },
  { id: 'STU-XYZ-1104', student_id: 'XYZ11A 04', name: 'Divyanka Rao', school_id: 'XYZ', class_id: 'CLS-XYZ-11A', tech_level: 'Level 0', parent_name: 'T. Rao', parent_phone: '+91 98390 66554', assigned_kit_id: 'KIT-XYZ-20', status: 'Active' },
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
  },
  { 
    id: 'TR-02', 
    name: 'Akash Sharma', 
    phone: '+91 94500 77882', 
    role: 'Senior STEM & Robotics Trainer', 
    status: 'Active', 
    assigned_schools: 'XYZ', 
    rating: 4.9, 
    daily_rate: 600,
    weekly_days: 2
  }
];

export const SEED_SESSIONS = [
  // Class 6A - Unit 1 (2 Completed Classes)
  { id: 'SES-601', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', trainer_id: 'TR-01', date: '2026-08-25', time: '09:00 AM - 10:30 AM', unit_code: 'Unit 1', level: 'Level 0', session_no: 1, total_sessions: 2, topic: 'Unit 1 (Class 1/2): Introduction to Robotics & Electronics - Breadboard & Components', is_locked: 1, notes: 'Hands-on breadboard anatomy, resistor color coding, and power rail connections.' },
  { id: 'SES-602', school_id: 'ZPS', class_id: 'CLS-ZPS-6A', trainer_id: 'TR-01', date: '2026-08-28', time: '09:00 AM - 10:30 AM', unit_code: 'Unit 1', level: 'Level 0', session_no: 2, total_sessions: 2, topic: 'Unit 1 (Class 2/2): Introduction to Robotics & Electronics - Series Circuits & LED Wiring', is_locked: 1, notes: 'Built closed-loop series circuits with LEDs, tactile push buttons, and 9V power supplies.' },

  // Class 7A - Unit 1 (2 Completed Classes)
  { id: 'SES-701', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', trainer_id: 'TR-01', date: '2026-08-25', time: '10:45 AM - 12:15 PM', unit_code: 'Unit 1', level: 'Level 0', session_no: 1, total_sessions: 2, topic: 'Unit 1 (Class 1/2): Introduction to Analog & Digital Electronics - Logic Levels & Voltage Dividers', is_locked: 1, notes: 'Explored digital HIGH/LOW states, analog voltage dividers, and potentiometer calibration.' },
  { id: 'SES-702', school_id: 'ZPS', class_id: 'CLS-ZPS-7A', trainer_id: 'TR-01', date: '2026-08-28', time: '10:45 AM - 12:15 PM', unit_code: 'Unit 1', level: 'Level 0', session_no: 2, total_sessions: 2, topic: 'Unit 1 (Class 2/2): Introduction to Analog & Digital Electronics - Sensor Voltage Measurements', is_locked: 1, notes: 'Calibrated analog LDRs and measured multi-meter voltage drops across breadboard circuits.' },

  // Class 8A - Unit 1 (2 Completed Classes)
  { id: 'SES-801', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', trainer_id: 'TR-01', date: '2026-08-26', time: '09:00 AM - 10:30 AM', unit_code: 'Unit 1', level: 'Level 0', session_no: 1, total_sessions: 2, topic: 'Unit 1 (Class 1/2): Introduction to Waves & Distance Measurement - Sound Reflection Principles', is_locked: 1, notes: 'Studied ultrasonic wave propagation, speed of sound in air, and obstacle echo timing.' },
  { id: 'SES-802', school_id: 'ZPS', class_id: 'CLS-ZPS-8A', trainer_id: 'TR-01', date: '2026-08-29', time: '09:00 AM - 10:30 AM', unit_code: 'Unit 1', level: 'Level 0', session_no: 2, total_sessions: 2, topic: 'Unit 1 (Class 2/2): Introduction to Waves & Distance Measurement - Ultrasonic Pulse & Timing Setup', is_locked: 1, notes: 'Trigger and Echo pulse wiring on breadboard with HC-SR04 ultrasonic transducer.' },

  // Class 9A - Unit 1 (2 Completed Classes)
  { id: 'SES-901', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', trainer_id: 'TR-01', date: '2026-08-26', time: '10:45 AM - 12:15 PM', unit_code: 'Unit 1', level: 'Level 0', session_no: 1, total_sessions: 2, topic: 'Unit 1 (Class 1/2): Introduction to Industrial Sensors & Displays - Flame Phototransistors & Thresholds', is_locked: 1, notes: 'Explored infrared flame spectral detection, comparator thresholds, and sensitivity tuning.' },
  { id: 'SES-902', school_id: 'ZPS', class_id: 'CLS-ZPS-9A', trainer_id: 'TR-01', date: '2026-08-29', time: '10:45 AM - 12:15 PM', unit_code: 'Unit 1', level: 'Level 0', session_no: 2, total_sessions: 2, topic: 'Unit 1 (Class 2/2): Introduction to Industrial Sensors & Displays - 16x2 LCD Parallel Bus Wiring', is_locked: 1, notes: 'Connected HD44780 16x2 LCD 4-bit data bus and potentiometer contrast circuitry.' },

  // Class 11A - Unit 1 (2 Completed Classes)
  { id: 'SES-1101', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', trainer_id: 'TR-01', date: '2026-08-26', time: '01:00 PM - 02:30 PM', unit_code: 'Unit 1', level: 'Level 0', session_no: 1, total_sessions: 2, topic: 'Unit 1 (Class 1/2): Introduction to Engineering Specs & Optics - Optical Collimation & Lasers', is_locked: 1, notes: 'Focused semiconductor laser diode collimation, beam convergence, and alignment optics.' },
  { id: 'SES-1102', school_id: 'ZPS', class_id: 'CLS-ZPS-11A', trainer_id: 'TR-01', date: '2026-08-29', time: '01:00 PM - 02:30 PM', unit_code: 'Unit 1', level: 'Level 0', session_no: 2, total_sessions: 2, topic: 'Unit 1 (Class 2/2): Introduction to Engineering Specs & Optics - Sensor Specs & Error Characterization', is_locked: 1, notes: 'Measured optical trip response time and documented engineering specification tolerances.' }
];

export const SEED_ATTENDANCE = [
  // Class 6A (Session 1 & Session 2)
  { session_id: 'SES-601', student_id: 'ZPS6A 01', status: 'Present' },
  { session_id: 'SES-601', student_id: 'ZPS6A 02', status: 'Present' },
  { session_id: 'SES-601', student_id: 'ZPS6A 03', status: 'Present' },
  { session_id: 'SES-601', student_id: 'ZPS6A 04', status: 'Present' },
  { session_id: 'SES-601', student_id: 'ZPS6A 05', status: 'Present' },
  { session_id: 'SES-602', student_id: 'ZPS6A 01', status: 'Present' },
  { session_id: 'SES-602', student_id: 'ZPS6A 02', status: 'Present' },
  { session_id: 'SES-602', student_id: 'ZPS6A 03', status: 'Present' },
  { session_id: 'SES-602', student_id: 'ZPS6A 04', status: 'Present' },
  { session_id: 'SES-602', student_id: 'ZPS6A 05', status: 'Present' },

  // Class 7A (Session 1 & Session 2)
  { session_id: 'SES-701', student_id: 'ZPS7A 01', status: 'Present' },
  { session_id: 'SES-701', student_id: 'ZPS7A 02', status: 'Present' },
  { session_id: 'SES-701', student_id: 'ZPS7A 03', status: 'Present' },
  { session_id: 'SES-701', student_id: 'ZPS7A 04', status: 'Present' },
  { session_id: 'SES-701', student_id: 'ZPS7A 05', status: 'Present' },
  { session_id: 'SES-702', student_id: 'ZPS7A 01', status: 'Present' },
  { session_id: 'SES-702', student_id: 'ZPS7A 02', status: 'Present' },
  { session_id: 'SES-702', student_id: 'ZPS7A 03', status: 'Present' },
  { session_id: 'SES-702', student_id: 'ZPS7A 04', status: 'Present' },
  { session_id: 'SES-702', student_id: 'ZPS7A 05', status: 'Present' },

  // Class 8A (Session 1 & Session 2)
  { session_id: 'SES-801', student_id: 'ZPS8A 01', status: 'Present' },
  { session_id: 'SES-801', student_id: 'ZPS8A 02', status: 'Present' },
  { session_id: 'SES-801', student_id: 'ZPS8A 03', status: 'Present' },
  { session_id: 'SES-801', student_id: 'ZPS8A 04', status: 'Present' },
  { session_id: 'SES-801', student_id: 'ZPS8A 05', status: 'Present' },
  { session_id: 'SES-802', student_id: 'ZPS8A 01', status: 'Present' },
  { session_id: 'SES-802', student_id: 'ZPS8A 02', status: 'Present' },
  { session_id: 'SES-802', student_id: 'ZPS8A 03', status: 'Present' },
  { session_id: 'SES-802', student_id: 'ZPS8A 04', status: 'Present' },
  { session_id: 'SES-802', student_id: 'ZPS8A 05', status: 'Present' },

  // Class 9A (Session 1 & Session 2)
  { session_id: 'SES-901', student_id: 'ZPS9A 01', status: 'Present' },
  { session_id: 'SES-901', student_id: 'ZPS9A 02', status: 'Present' },
  { session_id: 'SES-901', student_id: 'ZPS9A 03', status: 'Present' },
  { session_id: 'SES-901', student_id: 'ZPS9A 04', status: 'Present' },
  { session_id: 'SES-901', student_id: 'ZPS9A 05', status: 'Present' },
  { session_id: 'SES-902', student_id: 'ZPS9A 01', status: 'Present' },
  { session_id: 'SES-902', student_id: 'ZPS9A 02', status: 'Present' },
  { session_id: 'SES-902', student_id: 'ZPS9A 03', status: 'Present' },
  { session_id: 'SES-902', student_id: 'ZPS9A 04', status: 'Present' },
  { session_id: 'SES-902', student_id: 'ZPS9A 05', status: 'Present' },

  // Class 11A (Session 1 & Session 2)
  { session_id: 'SES-1101', student_id: 'ZPS11A 01', status: 'Present' },
  { session_id: 'SES-1101', student_id: 'ZPS11A 02', status: 'Present' },
  { session_id: 'SES-1101', student_id: 'ZPS11A 03', status: 'Present' },
  { session_id: 'SES-1101', student_id: 'ZPS11A 04', status: 'Present' },
  { session_id: 'SES-1101', student_id: 'ZPS11A 05', status: 'Present' },
  { session_id: 'SES-1102', student_id: 'ZPS11A 01', status: 'Present' },
  { session_id: 'SES-1102', student_id: 'ZPS11A 02', status: 'Present' },
  { session_id: 'SES-1102', student_id: 'ZPS11A 03', status: 'Present' },
  { session_id: 'SES-1102', student_id: 'ZPS11A 04', status: 'Present' },
  { session_id: 'SES-1102', student_id: 'ZPS11A 05', status: 'Present' }
];

export const CLASS_KITS = {
  '6': {
    class_grade: '6',
    kit_id: 'KIT-ZPS-6',
    name: 'Pixiu Discovery STEM & Robotics Core Kit (Class 6)',
    overview_image: '/img/kits/class6_p2_img1_1536x1024.jpeg',
    tagline: 'Microcontrollers, Traffic Signals, Light Sensors & Servo Barrier Systems',
    total_components: 12,
    components: [
      {
        id: 'C6-01',
        name: 'Arduino Uno R3 Microcontroller Board',
        image: '/img/kits/components/class6_part_1.jpg',
        qty: '1 Unit',
        role: 'The Brain. It remembers your program and runs it forever, even after power has been turned off.',
        session: 'Session 3',
        category: 'Controller',
        specs: 'ATmega328P, 5V Operating Voltage, 14 Digital I/O Pins, 6 Analog Inputs'
      },
      {
        id: 'C6-02',
        name: 'USB Type A-B Programming Cable',
        image: '/img/kits/components/class6_part_2.jpg',
        qty: '1 Pc',
        role: 'Carries your program from the laptop into the board, and powers the board while you test.',
        session: 'Session 3',
        category: 'Interface',
        specs: 'High-speed shielded USB-A to USB-B data interface'
      },
      {
        id: 'C6-03',
        name: '400-Point Solderless Breadboard',
        image: '/img/kits/components/class6_part_3.jpg',
        qty: '1 Pc',
        role: 'A plastic block full of holes that joins parts together without any soldering.',
        session: 'Session 2',
        category: 'Prototyping',
        specs: '400 tie points with central divider channel and twin power distribution rails'
      },
      {
        id: 'C6-04',
        name: 'Multi-Color Jumper Wire Harness',
        image: '/img/kits/components/class6_part_4.jpg',
        qty: '1 Set (30 Pcs)',
        role: 'The roads between parts. Male-to-male, male-to-female, and female-to-female jumpers.',
        session: 'Session 2',
        category: 'Wiring',
        specs: '20cm multi-colored ribbon jumpers with molded pin headers'
      },
      {
        id: 'C6-05',
        name: '5mm Diffused LEDs (Red, Yellow, Green)',
        image: '/img/kits/components/class6_part_5.jpg',
        qty: '5 Pcs',
        role: 'Tiny lamps. They glow only one way round (long leg anode towards +).',
        session: 'Session 2',
        category: 'Visual Output',
        specs: '5mm round diffused lens, 2.0V forward voltage drop, 20mA max'
      },
      {
        id: 'C6-06',
        name: '220Ω & 10KΩ Carbon Film Resistors',
        image: '/img/kits/components/class6_part_6.jpg',
        qty: '10 Pcs',
        role: 'Slow the current down so LEDs and sensors are protected from electrical damage.',
        session: 'Session 2',
        category: 'Passive Component',
        specs: '1/4 Watt, 5% tolerance with 4-band color code identification'
      },
      {
        id: 'C6-07',
        name: 'Integrated Traffic Light Signal Module',
        image: '/img/kits/components/class6_part_7.jpg',
        qty: '1 Unit',
        role: 'Red, yellow and green lamps built onto one ready-made PCB for automated signal logic.',
        session: 'Session 7',
        category: 'Actuator / Display',
        specs: 'Common cathode configuration with dedicated onboard current resistors'
      },
      {
        id: 'C6-08',
        name: 'LDR Ambient Light Sensor Module',
        image: '/img/kits/components/class6_part_8.jpg',
        qty: '1 Unit',
        role: 'Feels how bright the room is and turns ambient light into an analog number.',
        session: 'Session 9',
        category: 'Sensor',
        specs: 'Photoresistor with onboard LM393 voltage comparator and sensitivity dial'
      },
      {
        id: 'C6-09',
        name: 'HC-SR04 Ultrasonic Sonar Sensor',
        image: '/img/kits/components/class6_part_9.jpg',
        qty: '1 Unit',
        role: 'Measures how far away an object is non-contact by timing high-frequency acoustic echo waves.',
        session: 'Session 12',
        category: 'Sensor',
        specs: '2cm to 400cm range, 3mm resolution, 5V DC trigger & echo logic'
      },
      {
        id: 'C6-10',
        name: 'SG90 Micro Servo Motor 90-180°',
        image: '/img/kits/components/class6_part_10.jpg',
        qty: '1 Unit',
        role: 'Turns to an exact angle and holds it. Operates as the automated barrier arm.',
        session: 'Session 12',
        category: 'Mechanical Actuator',
        specs: '9g mini servo, 1.8 kg/cm torque at 4.8V, PWM duty cycle positioning'
      },
      {
        id: 'C6-11',
        name: 'Piezoelectric Audio Buzzer Module',
        image: '/img/kits/components/class6_part_11.jpg',
        qty: '1 Unit',
        role: 'Makes acoustic sound so your machine can warn people during emergency alerts.',
        session: 'Session 13',
        category: 'Audio Output',
        specs: '5V active buzzer module with internal oscillating circuit'
      },
      {
        id: 'C6-12',
        name: 'Tactile Momentary Push Switch',
        image: '/img/kits/components/class6_part_12.jpg',
        qty: '2 Pcs',
        role: 'Lets human operator send a digital ON/OFF pulse input to trigger operations.',
        session: 'Challenge Work',
        category: 'Input Switch',
        specs: '12mm x 12mm 4-pin breadboard-friendly tactile button switch'
      }
    ]
  },
  '7': {
    class_grade: '7',
    kit_id: 'KIT-ZPS-7',
    name: 'Pixiu Environmental & Smart Automation Lab Kit (Class 7)',
    overview_image: '/img/kits/class7_p3_img1_1536x1024.jpeg',
    tagline: 'Climate Telemetry, Raindrop Sensors, Potentiometers & Servos',
    total_components: 12,
    components: [
      { id: 'C7-01', name: 'Arduino Uno R3 Board', image: '/img/kits/components/class7_part_1.jpg', qty: '1 Unit', role: 'The Brain controller for environmental and smart automation logic.', session: 'Session 3', category: 'Controller', specs: 'ATmega328P, 16 MHz crystal oscillator, 5V regulated' },
      { id: 'C7-02', name: 'USB A-B Cable', image: '/img/kits/components/class7_part_2.jpg', qty: '1 Pc', role: 'Carries code program into the board and powers it during lab sessions.', session: 'Session 3', category: 'Interface', specs: 'Standard USB 2.0 A-B data lead' },
      { id: 'C7-03', name: '400-Point Breadboard', image: '/img/kits/components/class7_part_3.jpg', qty: '1 Pc', role: 'Solderless prototyping circuit base with dual power rails.', session: 'Session 2', category: 'Prototyping', specs: 'ABS thermoplastic block with nickel-plated spring contacts' },
      { id: 'C7-04', name: 'Jumper Wire Set', image: '/img/kits/components/class7_part_4.jpg', qty: '1 Set (30 Pcs)', role: 'Circuit links for sensor modules, potentiometers and actuators.', session: 'Session 2', category: 'Wiring', specs: 'Male-to-Male and Male-to-Female flexible jumpers' },
      { id: 'C7-05', name: '5mm LED Indicators', image: '/img/kits/components/class7_part_5.jpg', qty: '5 Pcs', role: 'Status indicator lamps for alarm thresholds and environmental indicators.', session: 'Session 2', category: 'Visual Output', specs: '5mm high-efficiency semiconductor LEDs' },
      { id: 'C7-06', name: '220Ω Resistors', image: '/img/kits/components/class7_part_6.jpg', qty: '10 Pcs', role: 'Current limiters protecting indicator diodes from burn-out.', session: 'Session 2', category: 'Passive', specs: '220 Ohm, 0.25W metal film resistor pack' },
      { id: 'C7-07', name: '10KΩ Rotary Potentiometer', image: '/img/kits/components/class7_part_7.jpg', qty: '1 Unit', role: 'A knob that gives a smoothly changing 0-5V voltage level - your first analog input.', session: 'Session 6', category: 'Analog Input', specs: 'Linear taper 10K Ohm pot with 3-pin solderless headers' },
      { id: 'C7-08', name: 'DHT11 Temperature & Humidity Sensor', image: '/img/kits/components/class7_part_8.jpg', qty: '1 Unit', role: 'Measures ambient room temperature (0-50°C) and relative humidity (20-90%), both from one sensor.', session: 'Session 9', category: 'Sensor', specs: 'Single-bus digital signal output, calibrated NTC thermistor & capacitive polymer' },
      { id: 'C7-09', name: 'Active Piezo Buzzer Module', image: '/img/kits/components/class7_part_9.jpg', qty: '1 Unit', role: 'Produces high-pitch acoustic sirens when environmental thresholds trigger.', session: 'Session 11', category: 'Audio Output', specs: 'Active 5V audio transducer with onboard drive transistor' },
      { id: 'C7-10', name: 'Raindrop & Moisture Detection Plate', image: '/img/kits/components/class7_part_10.jpg', qty: '1 Unit', role: 'Dual-sided conductive nickel grid tracking rain droplets and surface moisture.', session: 'Session 12', category: 'Sensor', specs: 'FR-04 gold-plated rain sensor board + LM393 comparator module' },
      { id: 'C7-11', name: 'LDR Ambient Light Sensor Module', image: '/img/kits/components/class7_part_11.jpg', qty: '1 Unit', role: 'Light dependent resistor module detecting sunrise, dusk and illumination levels.', session: 'Session 13', category: 'Sensor', specs: 'Photo-conductive cadmium sulfide sensor with analog/digital output' },
      { id: 'C7-12', name: 'SG90 Micro Servo Actuator', image: '/img/kits/components/class7_part_12.jpg', qty: '1 Unit', role: 'Geared motor rotating to precise angular positions for automated smart wipers & flaps.', session: 'Session 15', category: 'Actuator', specs: '9g servo, nylon gear train, 180° rotation angle' }
    ]
  },
  '8': {
    class_grade: '8',
    kit_id: 'KIT-ZPS-8',
    name: 'Pixiu Autonomous Robotics & Mobility Kit (Class 8)',
    overview_image: '/img/kits/class8_p2_img1_1536x1024.jpeg',
    tagline: 'Ultrasonic Sonar Scanning, Motor Drivers, BO Motors & Robotic Chassis',
    total_components: 12,
    components: [
      { id: 'C8-01', name: 'Arduino Uno R3 Board', image: '/img/kits/components/class8_part_1.jpg', qty: '1 Unit', role: 'Central robotics controller running navigation and motor algorithms.', session: 'Session 3', category: 'Controller', specs: 'Microchip ATmega328P with 32KB flash memory' },
      { id: 'C8-02', name: 'USB A-B Cable', image: '/img/kits/components/class8_part_2.jpg', qty: '1 Pc', role: 'High-speed interface for firmware upload and debugging.', session: 'Session 3', category: 'Interface', specs: 'Shielded USB-A to USB-B cable' },
      { id: 'C8-03', name: '400-Point Breadboard', image: '/img/kits/components/class8_part_3.jpg', qty: '1 Pc', role: 'Wiring board for sonar sensor and motor driver connections.', session: 'Session 2', category: 'Prototyping', specs: '400 tie-point prototyping platform' },
      { id: 'C8-04', name: 'Jumper Wire Set', image: '/img/kits/components/class8_part_4.jpg', qty: '1 Set (30 Pcs)', role: 'Signal interconnect cables between Arduino, motor driver and sensors.', session: 'Session 2', category: 'Wiring', specs: 'Ribbon jumper pack with durable male/female crimped pins' },
      { id: 'C8-05', name: '5mm LED Bar Array', image: '/img/kits/components/class8_part_5.jpg', qty: '5 Pcs', role: 'Visual distance gauge indicating approaching obstacles in real-time.', session: 'Session 2', category: 'Visual Output', specs: '5mm diffused colored diodes' },
      { id: 'C8-06', name: '220Ω Resistors', image: '/img/kits/components/class8_part_6.jpg', qty: '10 Pcs', role: 'Limits drive current to status indicators.', session: 'Session 2', category: 'Passive', specs: '220 Ohm metal film resistors' },
      { id: 'C8-07', name: 'HC-SR04 Sonar Ultrasonic Sensor', image: '/img/kits/components/class8_part_7.jpg', qty: '1 Unit', role: 'Measures spatial distance by timing high-frequency acoustic echo pulses. The star of this book.', session: 'Session 6', category: 'Sensor', specs: '40 kHz ultrasound transducer pair, 2cm-400cm sensing distance' },
      { id: 'C8-08', name: 'SG90 Sonar Turret Servo Motor', image: '/img/kits/components/class8_part_8.jpg', qty: '1 Unit', role: 'Rotates the ultrasonic sensor across 180° to scan for obstacles left and right.', session: 'Session 9', category: 'Actuator', specs: 'Micro servo with horns and mounting screws' },
      { id: 'C8-09', name: 'Buzzer Warning Module', image: '/img/kits/components/class8_part_9.jpg', qty: '1 Unit', role: 'Emits proximity warning tone as obstacles get closer.', session: 'Session 10', category: 'Audio Output', specs: 'Piezo buzzer unit' },
      { id: 'C8-10', name: 'L298N Dual H-Bridge Motor Driver', image: '/img/kits/components/class8_part_10.jpg', qty: '1 Unit', role: 'High-current power amplifier driving dual DC gear motors with direction & speed PWM.', session: 'Session 12', category: 'Motor Driver', specs: 'Dual full-bridge driver, 2A peak per channel, heavy aluminum heatsink' },
      { id: 'C8-11', name: '100 RPM Geared BO Motors & Wheels (x2)', image: '/img/kits/components/class8_part_11.jpg', qty: '2 Motors + 2 Wheels', role: 'Dual drive motors delivering high torque for robot movement.', session: 'Session 13', category: 'Motors & Wheels', specs: 'Dual-shaft 3-6V DC gear motors with rubber grip traction wheels' },
      { id: 'C8-12', name: 'Robot Chassis, Caster Wheel & Battery Pack', image: '/img/kits/components/class8_part_12.jpg', qty: '1 Set', role: 'Laser-cut acrylic robot chassis, omni caster, switch & battery holder.', session: 'Session 13', category: 'Mechanical Chassis', specs: 'Acrylic base, metal ball caster wheel, 4xAA battery enclosure' }
    ]
  },
  '9': {
    class_grade: '9',
    kit_id: 'KIT-ZPS-9',
    name: 'Pixiu Industrial Sensors & Autonomous Line Rover Kit (Class 9)',
    overview_image: '/img/kits/class9_p2_img1_1536x1024.jpeg',
    tagline: 'Infrared Flame Detectors, 16x2 LCD Telemetry, Dual IR Line Trackers & Rover',
    total_components: 16,
    components: [
      { id: 'C9-01', name: 'Arduino Uno R3 Board', image: '/img/kits/components/class9_part_1.jpg', qty: '1 Unit', role: 'Central processing unit executing multi-sensor arbitration and line tracking loops.', session: 'Session 3', category: 'Controller', specs: 'ATmega328P 8-bit RISC processor' },
      { id: 'C9-02', name: 'USB A-B Cable', image: '/img/kits/components/class9_part_2.jpg', qty: '1 Pc', role: 'High integrity programming and serial data communication cable.', session: 'Session 3', category: 'Interface', specs: 'Full speed USB 2.0 interface' },
      { id: 'C9-03', name: '400-Point Breadboard', image: '/img/kits/components/class9_part_3.jpg', qty: '1 Pc', role: 'High quality solderless platform for LCD and sensor wiring.', session: 'Session 2', category: 'Prototyping', specs: '400 tie-points' },
      { id: 'C9-04', name: 'Jumper Wire Harness', image: '/img/kits/components/class9_part_4.jpg', qty: '1 Set (40 Pcs)', role: 'Interconnection ribbon with multi-pin jumper connections.', session: 'Session 2', category: 'Wiring', specs: 'Premium jumper wires' },
      { id: 'C9-05', name: '5mm Status LEDs', image: '/img/kits/components/class9_part_5.jpg', qty: '5 Pcs', role: 'Fire, line tracking, and operational status indication.', session: 'Session 2', category: 'Visual Output', specs: 'Diffused 5mm LEDs' },
      { id: 'C9-06', name: '220Ω & 10KΩ Resistors', image: '/img/kits/components/class9_part_6.jpg', qty: '10 Pcs', role: 'Current limiters and pull-down network for manual switches.', session: 'Session 2', category: 'Passive', specs: 'Metal film resistors' },
      { id: 'C9-07', name: 'Optical Infrared Flame Sensor Module', image: '/img/kits/components/class9_part_7.jpg', qty: '1 Unit', role: 'Detects 760nm - 1100nm infrared radiation emitted by real flame sources.', session: 'Session 6', category: 'Sensor', specs: 'High-sensitivity phototransistor with LM393 threshold comparator' },
      { id: 'C9-08', name: 'DHT11 Temp & Humidity Module', image: '/img/kits/components/class9_part_8.jpg', qty: '1 Unit', role: 'Secondary environmental confirmation telemetry to verify what the flame sensor saw.', session: 'Session 7', category: 'Sensor', specs: 'Digital temperature & relative humidity sensor' },
      { id: 'C9-09', name: 'Active Alarm Buzzer Module', image: '/img/kits/components/class9_part_9.jpg', qty: '1 Unit', role: 'Acoustic siren alerting emergency conditions.', session: 'Session 7', category: 'Audio Output', specs: 'Active 5V piezo sounder' },
      { id: 'C9-10', name: '2-Pin Reset Push Switch', image: '/img/kits/components/class9_part_10.jpg', qty: '2 Pcs', role: 'Human override switch to clear latched alarms and start runs.', session: 'Session 8', category: 'Input Switch', specs: 'Tactile switch' },
      { id: 'C9-11', name: '16x2 Alphanumeric LCD Display', image: '/img/kits/components/class9_part_11.jpg', qty: '1 Unit', role: 'Displays real-time sensor readings and robot telemetry without needing a laptop.', session: 'Session 9', category: 'Display', specs: 'HD44780 standard parallel LCD, 16 characters x 2 rows, blue backlight' },
      { id: 'C9-12', name: '10K LCD Contrast Potentiometer', image: '/img/kits/components/class9_part_12.jpg', qty: '1 Unit', role: 'Calibrates the LCD V0 bias contrast voltage for razor-sharp character visibility.', session: 'Session 10', category: 'Analog Input', specs: '10K rotary trimmer potentiometer' },
      { id: 'C9-13', name: 'LDR Ambient Light Sensor', image: '/img/kits/components/class9_part_13.jpg', qty: '1 Unit', role: 'Evaluates ambient lux and room lighting conditions.', session: 'Session 11', category: 'Sensor', specs: 'Cadmium sulfide photoresistor module' },
      { id: 'C9-14', name: 'Dual TCRT5000 IR Line Sensor Modules', image: '/img/kits/components/class9_part_14.jpg', qty: '2 Units (L & R)', role: 'Infrared reflective sensors tracking black/white track contrast on the ground.', session: 'Session 12', category: 'Navigation Sensor', specs: 'TCRT5000 infrared emitter-phototransistor pair with comparator' },
      { id: 'C9-15', name: 'L298N Dual Motor Driver Module', image: '/img/kits/components/class9_part_15.jpg', qty: '1 Unit', role: 'H-bridge motor driver managing forward, reverse, and differential steering.', session: 'Session 12', category: 'Motor Driver', specs: 'Dual H-Bridge driver with 5V onboard regulator' },
      { id: 'C9-16', name: 'Line Follower Robot Chassis, Wheels & Power', image: '/img/kits/components/class9_part_16.jpg', qty: '1 Set', role: 'Mobile robot base with twin drive motors, wheels, and battery harness.', session: 'Session 13', category: 'Chassis & Power', specs: 'Acrylic platform, 2x BO motors, caster & 4xAA battery pack' }
    ]
  },
  '11': {
    class_grade: '11',
    kit_id: 'KIT-ZPS-11',
    name: 'Pixiu Advanced Photonics & Autonomous Maze Rover Kit (Class 11)',
    overview_image: '/img/kits/class11_p2_img1_1536x1024.jpeg',
    tagline: 'Collimated Laser Tripwires, Sonar Characterization, 3-Way Maze Array & Precision Rover',
    total_components: 16,
    components: [
      { id: 'C11-01', name: 'Arduino Uno R3 Microcontroller', image: '/img/kits/components/class11_part_1.jpg', qty: '1 Unit', role: 'Industrial-grade MCU managing laser trip timing, characterization, and maze solver algorithms.', session: 'Session 3', category: 'Controller', specs: 'ATmega328P 16MHz processor' },
      { id: 'C11-02', name: 'USB A-B Interface Cable', image: '/img/kits/components/class11_part_2.jpg', qty: '1 Pc', role: 'Serial telemetry transmission and programming lead.', session: 'Session 3', category: 'Interface', specs: 'High-speed shielded A-B cable' },
      { id: 'C11-03', name: '400-Point Breadboard', image: '/img/kits/components/class11_part_3.jpg', qty: '1 Pc', role: 'Prototyping platform with high contact reliability.', session: 'Session 2', category: 'Prototyping', specs: '400 tie points' },
      { id: 'C11-04', name: 'Precision Jumper Wire Harness', image: '/img/kits/components/class11_part_4.jpg', qty: '1 Set (40 Pcs)', role: 'Interconnect wires for sensor arrays and logic stages.', session: 'Session 2', category: 'Wiring', specs: 'Male-Male, Male-Female, Female-Female' },
      { id: 'C11-05', name: '5mm Multi-State Indication LEDs', image: '/img/kits/components/class11_part_5.jpg', qty: '5 Pcs', role: 'System status indicators: Armed, Warning, Alarm and Running.', session: 'Session 2', category: 'Visual Output', specs: '5mm high brightness LEDs' },
      { id: 'C11-06', name: '220Ω & 10KΩ Precision Resistors', image: '/img/kits/components/class11_part_6.jpg', qty: '10 Pcs', role: 'Current limiting and pull-down network resistors.', session: 'Session 2', category: 'Passive', specs: '1% metal film precision resistors' },
      { id: 'C11-07', name: '5V 650nm Red Laser Dot Diode Module', image: '/img/kits/components/class11_part_7.jpg', qty: '1 Unit', role: 'Emits a tight, collimated 650nm coherent red optical beam for perimeter tripwire defense.', session: 'Session 6', category: 'Optics / Emitter', specs: '650nm red semiconductor laser diode, 5mW, adjustable brass collimating lens' },
      { id: 'C11-08', name: 'High-Sensitivity Optical LDR Receiver', image: '/img/kits/components/class11_part_8.jpg', qty: '1 Unit', role: 'High-speed light sensor aligned with the laser beam to instantly detect tripwire breaks.', session: 'Session 6', category: 'Optics / Sensor', specs: 'Photoresistor module with adjustable comparator threshold' },
      { id: 'C11-09', name: '16x2 Telemetry LCD Display', image: '/img/kits/components/class11_part_9.jpg', qty: '1 Unit', role: 'Live engineering screen displaying trip counts, response time in milliseconds & distance.', session: 'Session 7', category: 'Display', specs: '16x2 HD44780 LCD module' },
      { id: 'C11-10', name: '10K Contrast Potentiometer', image: '/img/kits/components/class11_part_10.jpg', qty: '1 Unit', role: 'Fine-tunes display contrast voltage.', session: 'Session 7', category: 'Analog Input', specs: 'Precision 10K pot' },
      { id: 'C11-11', name: 'High-Decibel Siren Buzzer', image: '/img/kits/components/class11_part_11.jpg', qty: '1 Unit', role: 'Acoustic intrusion and alarm annunciator.', session: 'Session 7', category: 'Audio Output', specs: 'Active 5V piezo siren' },
      { id: 'C11-12', name: 'Tactile Latch Clear Switch', image: '/img/kits/components/class11_part_12.jpg', qty: '2 Pcs', role: 'Human push button to reset latched alarm states.', session: 'Session 8', category: 'Input Switch', specs: '12mm tactile button' },
      { id: 'C11-13', name: 'HC-SR04 Sonar Distance Sensor', image: '/img/kits/components/class11_part_13.jpg', qty: '1 Unit', role: 'Instrument characterised in Unit 4 for error, precision, systematic drift, and uncertainty.', session: 'Session 9', category: 'Sensor', specs: 'Precision ultrasonic sensor module' },
      { id: 'C11-14', name: 'Triple IR Maze Sensor Array (Left, Centre, Right)', image: '/img/kits/components/class11_part_14.jpg', qty: '1 Set (3 Array)', role: 'Three dedicated infrared reflective sensors that detect maze walls and paths in real-time.', session: 'Session 12', category: 'Navigation Sensor Array', specs: '3x TCRT5000 sensors with independent sensitivity adjustments' },
      { id: 'C11-15', name: 'L298N High-Torque Motor Driver', image: '/img/kits/components/class11_part_15.jpg', qty: '1 Unit', role: 'Power stage providing bidirectional PWM speed and direction control to drive motors.', session: 'Session 13', category: 'Motor Driver', specs: 'Dual H-bridge driver with thermal overload protection' },
      { id: 'C11-16', name: 'Autonomous Maze Solver Chassis & Battery Power', image: '/img/kits/components/class11_part_16.jpg', qty: '1 Set', role: 'High-rigidity chassis, dual DC motors, precision caster wheel & high-capacity battery holder.', session: 'Session 13', category: 'Chassis & Power', specs: 'Heavy-duty acrylic chassis, 2x gear motors, rubber wheels, 4xAA power unit' }
    ]
  }
};

export const SEED_INVENTORY = [
  // Class 6 Kits
  { id: 'KIT-ZPS-01', school_id: 'ZPS', class_grade: '6', name: 'Pixiu Discovery STEM Hardware Kit #01', assigned_to: 'ZPS6A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-02', school_id: 'ZPS', class_grade: '6', name: 'Pixiu Discovery STEM Hardware Kit #02', assigned_to: 'ZPS6A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-03', school_id: 'ZPS', class_grade: '6', name: 'Pixiu Discovery STEM Hardware Kit #03', assigned_to: 'ZPS6A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-04', school_id: 'ZPS', class_grade: '6', name: 'Pixiu Discovery STEM Hardware Kit #04', assigned_to: 'ZPS6A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-05', school_id: 'ZPS', class_grade: '6', name: 'Pixiu Discovery STEM Hardware Kit #05', assigned_to: 'ZPS6A 05', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },

  // Class 7 Kits
  { id: 'KIT-ZPS-06', school_id: 'ZPS', class_grade: '7', name: 'Pixiu Environmental & Sensor Kit #06', assigned_to: 'ZPS7A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-07', school_id: 'ZPS', class_grade: '7', name: 'Pixiu Environmental & Sensor Kit #07', assigned_to: 'ZPS7A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-08', school_id: 'ZPS', class_grade: '7', name: 'Pixiu Environmental & Sensor Kit #08', assigned_to: 'ZPS7A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-09', school_id: 'ZPS', class_grade: '7', name: 'Pixiu Environmental & Sensor Kit #09', assigned_to: 'ZPS7A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-10', school_id: 'ZPS', class_grade: '7', name: 'Pixiu Environmental & Sensor Kit #10', assigned_to: 'ZPS7A 05', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },

  // Class 8 Kits
  { id: 'KIT-ZPS-11', school_id: 'ZPS', class_grade: '8', name: 'Pixiu Mobility & Obstacle Rover Kit #11', assigned_to: 'ZPS8A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-12', school_id: 'ZPS', class_grade: '8', name: 'Pixiu Mobility & Obstacle Rover Kit #12', assigned_to: 'ZPS8A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-13', school_id: 'ZPS', class_grade: '8', name: 'Pixiu Mobility & Obstacle Rover Kit #13', assigned_to: 'ZPS8A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-14', school_id: 'ZPS', class_grade: '8', name: 'Pixiu Mobility & Obstacle Rover Kit #14', assigned_to: 'ZPS8A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-15', school_id: 'ZPS', class_grade: '8', name: 'Pixiu Mobility & Obstacle Rover Kit #15', assigned_to: 'ZPS8A 05', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },

  // Class 9 Kits
  { id: 'KIT-ZPS-16', school_id: 'ZPS', class_grade: '9', name: 'Pixiu Industrial Flame & Line Rover Kit #16', assigned_to: 'ZPS9A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-17', school_id: 'ZPS', class_grade: '9', name: 'Pixiu Industrial Flame & Line Rover Kit #17', assigned_to: 'ZPS9A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-18', school_id: 'ZPS', class_grade: '9', name: 'Pixiu Industrial Flame & Line Rover Kit #18', assigned_to: 'ZPS9A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-19', school_id: 'ZPS', class_grade: '9', name: 'Pixiu Industrial Flame & Line Rover Kit #19', assigned_to: 'ZPS9A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-20', school_id: 'ZPS', class_grade: '9', name: 'Pixiu Industrial Flame & Line Rover Kit #20', assigned_to: 'ZPS9A 05', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },

  // Class 11 Kits (ZPS)
  { id: 'KIT-ZPS-21', school_id: 'ZPS', class_grade: '11', name: 'Pixiu Photonics & Maze Solver Rover Kit #21', assigned_to: 'ZPS11A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-22', school_id: 'ZPS', class_grade: '11', name: 'Pixiu Photonics & Maze Solver Rover Kit #22', assigned_to: 'ZPS11A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-23', school_id: 'ZPS', class_grade: '11', name: 'Pixiu Photonics & Maze Solver Rover Kit #23', assigned_to: 'ZPS11A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-24', school_id: 'ZPS', class_grade: '11', name: 'Pixiu Photonics & Maze Solver Rover Kit #24', assigned_to: 'ZPS11A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-ZPS-25', school_id: 'ZPS', class_grade: '11', name: 'Pixiu Photonics & Maze Solver Rover Kit #25', assigned_to: 'ZPS11A 05', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },

  // ==================== XYZ ACADEMY KITS (KIT-XYZ-01 to KIT-XYZ-20) ====================
  // Class 6 Kits (XYZ)
  { id: 'KIT-XYZ-01', school_id: 'XYZ', class_grade: '6', name: 'Pixiu Discovery STEM Hardware Kit #01', assigned_to: 'XYZ6A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-02', school_id: 'XYZ', class_grade: '6', name: 'Pixiu Discovery STEM Hardware Kit #02', assigned_to: 'XYZ6A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-03', school_id: 'XYZ', class_grade: '6', name: 'Pixiu Discovery STEM Hardware Kit #03', assigned_to: 'XYZ6A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-04', school_id: 'XYZ', class_grade: '6', name: 'Pixiu Discovery STEM Hardware Kit #04', assigned_to: 'XYZ6A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },

  // Class 7 Kits (XYZ)
  { id: 'KIT-XYZ-05', school_id: 'XYZ', class_grade: '7', name: 'Pixiu Environmental & Sensor Kit #05', assigned_to: 'XYZ7A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-06', school_id: 'XYZ', class_grade: '7', name: 'Pixiu Environmental & Sensor Kit #06', assigned_to: 'XYZ7A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-07', school_id: 'XYZ', class_grade: '7', name: 'Pixiu Environmental & Sensor Kit #07', assigned_to: 'XYZ7A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-08', school_id: 'XYZ', class_grade: '7', name: 'Pixiu Environmental & Sensor Kit #08', assigned_to: 'XYZ7A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },

  // Class 8 Kits (XYZ)
  { id: 'KIT-XYZ-09', school_id: 'XYZ', class_grade: '8', name: 'Pixiu Mobility & Obstacle Rover Kit #09', assigned_to: 'XYZ8A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-10', school_id: 'XYZ', class_grade: '8', name: 'Pixiu Mobility & Obstacle Rover Kit #10', assigned_to: 'XYZ8A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-11', school_id: 'XYZ', class_grade: '8', name: 'Pixiu Mobility & Obstacle Rover Kit #11', assigned_to: 'XYZ8A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-12', school_id: 'XYZ', class_grade: '8', name: 'Pixiu Mobility & Obstacle Rover Kit #12', assigned_to: 'XYZ8A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },

  // Class 9 Kits (XYZ)
  { id: 'KIT-XYZ-13', school_id: 'XYZ', class_grade: '9', name: 'Pixiu Industrial Flame & Line Rover Kit #13', assigned_to: 'XYZ9A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-14', school_id: 'XYZ', class_grade: '9', name: 'Pixiu Industrial Flame & Line Rover Kit #14', assigned_to: 'XYZ9A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-15', school_id: 'XYZ', class_grade: '9', name: 'Pixiu Industrial Flame & Line Rover Kit #15', assigned_to: 'XYZ9A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-16', school_id: 'XYZ', class_grade: '9', name: 'Pixiu Industrial Flame & Line Rover Kit #16', assigned_to: 'XYZ9A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },

  // Class 11 Kits (XYZ)
  { id: 'KIT-XYZ-17', school_id: 'XYZ', class_grade: '11', name: 'Pixiu Photonics & Maze Solver Rover Kit #17', assigned_to: 'XYZ11A 01', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-18', school_id: 'XYZ', class_grade: '11', name: 'Pixiu Photonics & Maze Solver Rover Kit #18', assigned_to: 'XYZ11A 02', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-19', school_id: 'XYZ', class_grade: '11', name: 'Pixiu Photonics & Maze Solver Rover Kit #19', assigned_to: 'XYZ11A 03', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
  { id: 'KIT-XYZ-20', school_id: 'XYZ', class_grade: '11', name: 'Pixiu Photonics & Maze Solver Rover Kit #20', assigned_to: 'XYZ11A 04', status: 'Assigned', condition: 'Good', last_audit: '2026-08-28' },
];

export const SEED_BILLING = [
  // Zenith Public School Invoices
  {
    id: 'INV-2026-001',
    school_id: 'ZPS',
    school_name: 'Zenith Public School',
    tranche_number: 1,
    tranche_title: 'Tranche 1: Lab Setup & Hardware Kit Dispatch (40%)',
    amount: 40000,
    total_contract_value: 100000,
    date_issued: '2026-08-25',
    invoice_date: '2026-08-25',
    due_date: '2026-09-10',
    place_of_supply: 'Hata, Uttar Pradesh',
    status: 'Pending',
    description: 'Initial STEM Lab Hardware Kit Dispatch, Component Sourcing, and Classroom Setup (40%)'
  },
  {
    id: 'INV-2026-002',
    school_id: 'ZPS',
    school_name: 'Zenith Public School',
    tranche_number: 2,
    tranche_title: 'Tranche 2: Mid-Term Curriculum Delivery & Practical Lab Sessions (30%)',
    amount: 30000,
    total_contract_value: 100000,
    date_issued: '2026-08-25',
    invoice_date: '2026-08-25',
    due_date: '2026-11-15',
    place_of_supply: 'Hata, Uttar Pradesh',
    status: 'Pending',
    description: 'Mid-Term Robotics & Embedded Curriculum Delivery, Trainer Deployments, and Practical Lab Sessions (30%)'
  },
  {
    id: 'INV-2026-003',
    school_id: 'ZPS',
    school_name: 'Zenith Public School',
    tranche_number: 3,
    tranche_title: 'Tranche 3: Final Capstone Exhibition & Certification (30%)',
    amount: 30000,
    total_contract_value: 100000,
    date_issued: '2026-08-25',
    invoice_date: '2026-08-25',
    due_date: '2027-01-20',
    place_of_supply: 'Hata, Uttar Pradesh',
    status: 'Pending',
    description: 'Final Capstone Exhibition, Student Progress Certification, and Year-End Term Review (30%)'
  },

  // XYZ Academy Invoices
  {
    id: 'INV-XYZ-001',
    school_id: 'XYZ',
    school_name: 'XYZ Academy (Pilot Lab)',
    tranche_number: 1,
    tranche_title: 'Tranche 1: Lab Deployment & Pilot Hardware Suite (50%)',
    amount: 35000,
    total_contract_value: 70000,
    date_issued: '2026-08-20',
    invoice_date: '2026-08-20',
    due_date: '2026-09-05',
    place_of_supply: 'Gorakhpur, Uttar Pradesh',
    status: 'Paid',
    description: 'Initial Lab Setup, 20x Modular Microcontroller Kits & Pilot Orientation Session'
  },
  {
    id: 'INV-XYZ-002',
    school_id: 'XYZ',
    school_name: 'XYZ Academy (Pilot Lab)',
    tranche_number: 2,
    tranche_title: 'Tranche 2: Mid-Term Curriculum Evaluation & Robotics Trainer Delivery (50%)',
    amount: 35000,
    total_contract_value: 70000,
    date_issued: '2026-08-20',
    invoice_date: '2026-08-20',
    due_date: '2026-11-20',
    place_of_supply: 'Gorakhpur, Uttar Pradesh',
    status: 'Pending',
    description: 'Term 1 Mid-Term Robotics Engineering Curriculum Delivery and Practical Assessments'
  }
];

export const SEED_ALERTS = [
  {
    id: 'ALT-001',
    type: 'billing_due',
    severity: 'warning',
    message: 'Tranche 1 Invoice INV-2026-001 for Zenith Public School (₹40,000) is scheduled for receipt follow-up.',
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
