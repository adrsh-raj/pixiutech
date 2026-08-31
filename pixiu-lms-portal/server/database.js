const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'pixiu_lms.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database: pixiu_lms.db');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 0. Users Table (Authentication with BCrypt Password Hash)
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL, -- 'admin', 'trainer', 'student'
      related_id TEXT,
      name TEXT NOT NULL,
      school_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 1. Schools
    db.run(`CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      principal TEXT,
      contact TEXT,
      status TEXT DEFAULT 'Active',
      contract_start TEXT,
      renewal_date TEXT,
      expected_revenue INTEGER DEFAULT 0
    )`);

    // 2. Classes
    db.run(`CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      grade TEXT NOT NULL,
      section TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id)
    )`);

    // 3. Students
    db.run(`CREATE TABLE IF NOT EXISTS students (
      student_id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_name TEXT,
      parent_whatsapp TEXT,
      tech_level TEXT DEFAULT 'Level 1',
      status TEXT DEFAULT 'Active',
      dob TEXT,
      assigned_kit_id TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )`);

    // 4. Trainers / Instructors
    db.run(`CREATE TABLE IF NOT EXISTS trainers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      role TEXT NOT NULL,
      assigned_schools TEXT,
      daily_rate INTEGER DEFAULT 600,
      weekly_days INTEGER DEFAULT 2,
      rating REAL DEFAULT 5.0,
      status TEXT DEFAULT 'Active',
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Safety migrations for trainers table
    db.run("ALTER TABLE trainers ADD COLUMN daily_rate INTEGER DEFAULT 600", () => {});
    db.run("ALTER TABLE trainers ADD COLUMN weekly_days INTEGER DEFAULT 2", () => {});

    // 5. Sessions (With Date, Time, Topic, and Lock Status)
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      trainer_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT DEFAULT '10:00 AM',
      topic TEXT NOT NULL,
      status TEXT DEFAULT 'Planned',
      notes TEXT,
      is_locked INTEGER DEFAULT 0,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )`);

    // 6. Attendance (Date-wise with timestamp)
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (student_id) REFERENCES students(student_id),
      UNIQUE(session_id, student_id)
    )`);

    // 7. Leads (CRM)
    db.run(`CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      city TEXT,
      stage TEXT DEFAULT 'Contacted',
      expected_value INTEGER DEFAULT 0,
      notes TEXT,
      last_contact TEXT
    )`);

    // 8. Content Hub (With Class Grade, Target Audience, and Watermark Tag)
    db.run(`CREATE TABLE IF NOT EXISTS content (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'PDF',
      level TEXT DEFAULT 'Level 1',
      class_grade TEXT DEFAULT '6',
      target TEXT DEFAULT 'Student', -- 'Student' (Watermarked) | 'Trainer' (No Watermark)
      url TEXT,
      is_watermarked INTEGER DEFAULT 1,
      description TEXT
    )`);

    // Safety migrations
    db.run("ALTER TABLE sessions ADD COLUMN is_locked INTEGER DEFAULT 0", () => {});
    db.run("ALTER TABLE sessions ADD COLUMN time TEXT DEFAULT '10:00 AM'", () => {});
    db.run("ALTER TABLE content ADD COLUMN class_grade TEXT DEFAULT '6'", () => {});
    db.run("ALTER TABLE content ADD COLUMN is_watermarked INTEGER DEFAULT 1", () => {});

    // 9. Curriculum
    db.run(`CREATE TABLE IF NOT EXISTS curriculum (
      id TEXT PRIMARY KEY,
      week TEXT NOT NULL,
      level TEXT NOT NULL,
      topic TEXT NOT NULL,
      objectives TEXT NOT NULL,
      status TEXT DEFAULT 'Upcoming'
    )`);

    // 10. Inventory
    db.run(`CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT DEFAULT 'Level 1',
      school_id TEXT,
      assigned_student_id TEXT,
      status TEXT DEFAULT 'Healthy',
      last_checked TEXT,
      issue_notes TEXT
    )`);

    // 11. Billing
    db.run(`CREATE TABLE IF NOT EXISTS billing (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      school_name TEXT NOT NULL,
      tranche_number INTEGER DEFAULT 1,
      tranche_title TEXT NOT NULL,
      amount INTEGER NOT NULL,
      total_contract_value INTEGER DEFAULT 100000,
      date_issued TEXT NOT NULL,
      due_date TEXT NOT NULL,
      paid_date TEXT,
      payment_method TEXT,
      place_of_supply TEXT DEFAULT 'Hata, Uttar Pradesh',
      status TEXT DEFAULT 'Pending',
      receipt_no TEXT,
      is_confirmed INTEGER DEFAULT 0
    )`);

    // 12. Comms Logs
    db.run(`CREATE TABLE IF NOT EXISTS comms_logs (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      recipient TEXT NOT NULL,
      template TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Delivered'
    )`);

    // 13. Student Projects (With Real Build Evidence & Photos)
    db.run(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'Completed',
      score INTEGER DEFAULT 10,
      evidence_note TEXT,
      image_url TEXT,
      date_completed TEXT,
      FOREIGN KEY (student_id) REFERENCES students(student_id)
    )`);

    // 14. System Alerts & Operational Automation Engine
    db.run(`CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'hardware', 'renewal', 'attendance', 'billing'
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'warning', -- 'critical', 'warning', 'info'
      related_id TEXT,
      action_label TEXT,
      action_type TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed database if empty
    db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
      if (row && row.count === 0) {
        console.log("🔐 Seeding Authentication Users with BCrypt Password Hashes...");

        // Generate BCrypt Hashes for Requested Credentials
        const adminHash = await bcrypt.hash('Adarsg@pixiutech', 10);
        const trainerHash = await bcrypt.hash('Vikad@pixiutech', 10);
        
        const studentHash6 = await bcrypt.hash('ZPSzenith6@hata', 10);
        const studentHash7 = await bcrypt.hash('ZPSzenith7@hata', 10);
        const studentHash8 = await bcrypt.hash('ZPSzenith8@hata', 10);
        const studentHash9 = await bcrypt.hash('ZPSzenith9@hata', 10);
        const studentHash11 = await bcrypt.hash('ZPSzenith11@hata', 10);

        const uStmt = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        
        // 1. Super Admin (Username: adarshraj / Password: Adarsg@pixiutech)
        uStmt.run('USR-ADMIN', 'adarshraj', adminHash, 'admin', 'ADM-01', 'Adarsh Raj (Founder & Admin)', 'ALL', new Date().toISOString());
        // Also keep 'admin' alias
        uStmt.run('USR-ADMIN-ALT', 'admin', adminHash, 'admin', 'ADM-01', 'Adarsh Raj (Founder & Admin)', 'ALL', new Date().toISOString());

        // 2. Primary Trainer Vikas Pandey (Username: vikaspandey / Password: Vikad@pixiutech)
        uStmt.run('USR-TR01', 'vikaspandey', trainerHash, 'trainer', 'TR-01', 'Vikas Pandey', 'ZPS', new Date().toISOString());
        // Also keep 'TR-01' alias
        uStmt.run('USR-TR01-ALT', 'TR-01', trainerHash, 'trainer', 'TR-01', 'Vikas Pandey', 'ZPS', new Date().toISOString());
        
        // 3. Seed student logins for ALL 25 students with class-specific passwords
        // Class 6: ZPSzenith6@hata
        ['ZPS6A 01', 'ZPS6A 02', 'ZPS6A 03', 'ZPS6A 04', 'ZPS6A 05'].forEach(sId => {
          uStmt.run(`USR-${sId.replace(/\s+/g, '')}`, sId, studentHash6, 'student', sId, `Student ${sId}`, 'ZPS', new Date().toISOString());
        });
        // Class 7: ZPSzenith7@hata
        ['ZPS7A 01', 'ZPS7A 02', 'ZPS7A 03', 'ZPS7A 04', 'ZPS7A 05'].forEach(sId => {
          uStmt.run(`USR-${sId.replace(/\s+/g, '')}`, sId, studentHash7, 'student', sId, `Student ${sId}`, 'ZPS', new Date().toISOString());
        });
        // Class 8: ZPSzenith8@hata
        ['ZPS8A 01', 'ZPS8A 02', 'ZPS8A 03', 'ZPS8A 04', 'ZPS8A 05'].forEach(sId => {
          uStmt.run(`USR-${sId.replace(/\s+/g, '')}`, sId, studentHash8, 'student', sId, `Student ${sId}`, 'ZPS', new Date().toISOString());
        });
        // Class 9: ZPSzenith9@hata
        ['ZPS9A 01', 'ZPS9A 02', 'ZPS9A 03', 'ZPS9A 04', 'ZPS9A 05'].forEach(sId => {
          uStmt.run(`USR-${sId.replace(/\s+/g, '')}`, sId, studentHash9, 'student', sId, `Student ${sId}`, 'ZPS', new Date().toISOString());
        });
        // Class 11: ZPSzenith11@hata
        ['ZPS11A 01', 'ZPS11A 02', 'ZPS11A 03', 'ZPS11A 04', 'ZPS11A 05'].forEach(sId => {
          uStmt.run(`USR-${sId.replace(/\s+/g, '')}`, sId, studentHash11, 'student', sId, `Student ${sId}`, 'ZPS', new Date().toISOString());
        });

        uStmt.finalize();

        // Schools (ONLY Zenith Public School)
        const sStmt = db.prepare("INSERT INTO schools VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        sStmt.run('ZPS', 'Zenith Public School', 'ZPS', 'Dr. R.K. Sharma', '9876543210', 'Active', '2026-04-01', '2027-03-31', 180000);
        sStmt.finalize();

        // Classes (Zenith Public School: Class 6, 7, 8, 9, 11 - Section A)
        const cStmt = db.prepare("INSERT INTO classes VALUES (?, ?, ?, ?)");
        cStmt.run('CLS-ZPS-6A', 'ZPS', '6', 'A');
        cStmt.run('CLS-ZPS-7A', 'ZPS', '7', 'A');
        cStmt.run('CLS-ZPS-8A', 'ZPS', '8', 'A');
        cStmt.run('CLS-ZPS-9A', 'ZPS', '9', 'A');
        cStmt.run('CLS-ZPS-11A', 'ZPS', '11', 'A');
        cStmt.finalize();

        // Students (5 editable sample students per class: 6A, 7A, 8A, 9A, 11A)
        const stuStmt = db.prepare("INSERT INTO students VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        // Class 6A (5 Students)
        stuStmt.run('ZPS6A 01', 'ZPS', 'CLS-ZPS-6A', 'Aarav Sharma', 'Ravi Sharma', '919876543210', 'Level 1', 'Active', '2014-05-12', 'KIT-ZPS-01');
        stuStmt.run('ZPS6A 02', 'ZPS', 'CLS-ZPS-6A', 'Diya Patel', 'Meera Patel', '919876543211', 'Level 1', 'Active', '2014-08-20', 'KIT-ZPS-02');
        stuStmt.run('ZPS6A 03', 'ZPS', 'CLS-ZPS-6A', 'Rohan Verma', 'Sanjay Verma', '919876543212', 'Level 1', 'Active', '2014-02-14', 'KIT-ZPS-03');
        stuStmt.run('ZPS6A 04', 'ZPS', 'CLS-ZPS-6A', 'Ananya Gupta', 'Rajesh Gupta', '919876543213', 'Level 1', 'Active', '2014-07-09', 'KIT-ZPS-04');
        stuStmt.run('ZPS6A 05', 'ZPS', 'CLS-ZPS-6A', 'Kabir Singh', 'Gurpreet Singh', '919876543214', 'Level 1', 'Active', '2014-11-25', 'KIT-ZPS-05');

        // Class 7A (5 Students)
        stuStmt.run('ZPS7A 01', 'ZPS', 'CLS-ZPS-7A', 'Ishaan Kumar', 'Anil Kumar', '919876543220', 'Level 2', 'Active', '2013-03-15', 'KIT-ZPS-06');
        stuStmt.run('ZPS7A 02', 'ZPS', 'CLS-ZPS-7A', 'Meera Joshi', 'Alok Joshi', '919876543221', 'Level 2', 'Active', '2013-06-18', 'KIT-ZPS-07');
        stuStmt.run('ZPS7A 03', 'ZPS', 'CLS-ZPS-7A', 'Aditya Rao', 'Venkat Rao', '919876543222', 'Level 2', 'Active', '2013-09-22', 'KIT-ZPS-08');
        stuStmt.run('ZPS7A 04', 'ZPS', 'CLS-ZPS-7A', 'Tanvi Nair', 'Suresh Nair', '919876543223', 'Level 2', 'Active', '2013-12-04', 'KIT-ZPS-09');
        stuStmt.run('ZPS7A 05', 'ZPS', 'CLS-ZPS-7A', 'Vivaan Mehta', 'Samir Mehta', '919876543224', 'Level 2', 'Active', '2013-01-30', 'KIT-ZPS-10');

        // Class 8A (5 Students)
        stuStmt.run('ZPS8A 01', 'ZPS', 'CLS-ZPS-8A', 'Siddharth Roy', 'Debashish Roy', '919876543230', 'Level 3', 'Active', '2012-04-11', 'KIT-ZPS-11');
        stuStmt.run('ZPS8A 02', 'ZPS', 'CLS-ZPS-8A', 'Pooja Desai', 'Chetan Desai', '919876543231', 'Level 3', 'Active', '2012-07-19', 'KIT-ZPS-12');
        stuStmt.run('ZPS8A 03', 'ZPS', 'CLS-ZPS-8A', 'Arjun Bansal', 'Vikas Bansal', '919876543232', 'Level 3', 'Active', '2012-10-08', 'KIT-ZPS-13');
        stuStmt.run('ZPS8A 04', 'ZPS', 'CLS-ZPS-8A', 'Kavya Reddy', 'Krishna Reddy', '919876543233', 'Level 3', 'Active', '2012-02-17', 'KIT-ZPS-14');
        stuStmt.run('ZPS8A 05', 'ZPS', 'CLS-ZPS-8A', 'Reyansh Bose', 'Subhash Bose', '919876543234', 'Level 3', 'Active', '2012-08-29', 'KIT-ZPS-15');

        // Class 9A (5 Students)
        stuStmt.run('ZPS9A 01', 'ZPS', 'CLS-ZPS-9A', 'Aryan Malhotra', 'Sunil Malhotra', '919876543240', 'Level 4', 'Active', '2011-05-03', 'KIT-ZPS-16');
        stuStmt.run('ZPS9A 02', 'ZPS', 'CLS-ZPS-9A', 'Rhea Kapoor', 'Vikram Kapoor', '919876543241', 'Level 4', 'Active', '2011-09-14', 'KIT-ZPS-17');
        stuStmt.run('ZPS9A 03', 'ZPS', 'CLS-ZPS-9A', 'Devansh Saxena', 'Pradeep Saxena', '919876543242', 'Level 4', 'Active', '2011-12-21', 'KIT-ZPS-18');
        stuStmt.run('ZPS9A 04', 'ZPS', 'CLS-ZPS-9A', 'Sanya Mirza', 'Imran Mirza', '919876543243', 'Level 4', 'Active', '2011-03-27', 'KIT-ZPS-19');
        stuStmt.run('ZPS9A 05', 'ZPS', 'CLS-ZPS-9A', 'Manav Chopra', 'Amit Chopra', '919876543244', 'Level 4', 'Active', '2011-08-16', 'KIT-ZPS-20');

        // Class 11A (5 Students - Level 5)
        stuStmt.run('ZPS11A 01', 'ZPS', 'CLS-ZPS-11A', 'Karan Singhania', 'Rajiv Singhania', '919876543250', 'Level 5', 'Active', '2009-01-19', 'KIT-ZPS-21');
        stuStmt.run('ZPS11A 02', 'ZPS', 'CLS-ZPS-11A', 'Tara Sutaria', 'Anil Sutaria', '919876543251', 'Level 5', 'Active', '2009-06-25', 'KIT-ZPS-22');
        stuStmt.run('ZPS11A 03', 'ZPS', 'CLS-ZPS-11A', 'Nikhil Sen', 'Anirban Sen', '919876543252', 'Level 5', 'Active', '2009-10-12', 'KIT-ZPS-23');
        stuStmt.run('ZPS11A 04', 'ZPS', 'CLS-ZPS-11A', 'Priyanka Das', 'Biswajit Das', '919876543253', 'Level 5', 'Active', '2009-04-08', 'KIT-ZPS-24');
        stuStmt.run('ZPS11A 05', 'ZPS', 'CLS-ZPS-11A', 'Harsh Vardhan', 'R.K. Vardhan', '919876543254', 'Level 5', 'Active', '2009-11-30', 'KIT-ZPS-25');
        
        stuStmt.finalize();

        // Trainers (Primary: Vikas Pandey with ₹600/day salary, 2 sessions/week = ₹1,200/week)
        const trStmt = db.prepare("INSERT INTO trainers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        trStmt.run('TR-01', 'Vikas Pandey', '9811122233', 'Senior Robotics & AI Instructor', 'ZPS', 600, 2, 5.0, 'Active', 'vikas.pandey@pixiutech.com', new Date().toISOString());
        trStmt.finalize();

        // Sessions (Date-wise with Lock Status)
        const sesStmt = db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        sesStmt.run('SES-001', 'ZPS', 'CLS-ZPS-6A', 'TR-01', '2026-08-28', '10:00 AM', 'Unit 1: Introduction to Electronics & Sensor Logic', 'Completed', 'Breadboard wiring and sensor triggers verified.', 1);
        sesStmt.run('SES-002', 'ZPS', 'CLS-ZPS-7A', 'TR-01', '2026-08-30', '11:30 AM', 'Unit 1: Microcontrollers & Digital Output Flow', 'Completed', 'Digital pin configuration completed.', 1);
        sesStmt.run('SES-003', 'ZPS', 'CLS-ZPS-6A', 'TR-01', '2026-09-02', '10:30 AM', 'Unit 2: Line Follower Sensor Calibration & Tuning', 'Upcoming', 'Admin scheduled: Bring line follower test arena.', 0);
        sesStmt.finalize();

        // Attendance Records (Locked for past dates)
        const attStmt = db.prepare("INSERT INTO attendance VALUES (?, ?, ?, ?, ?)");
        // SES-001 Attendance (Class 6A - 2026-08-28)
        attStmt.run('ATT-001', 'SES-001', 'ZPS6A 01', 'Present', '2026-08-28 10:00:00');
        attStmt.run('ATT-002', 'SES-001', 'ZPS6A 02', 'Present', '2026-08-28 10:00:00');
        attStmt.run('ATT-003', 'SES-001', 'ZPS6A 03', 'Present', '2026-08-28 10:00:00');
        attStmt.run('ATT-004', 'SES-001', 'ZPS6A 04', 'Present', '2026-08-28 10:00:00');
        attStmt.run('ATT-005', 'SES-001', 'ZPS6A 05', 'Present', '2026-08-28 10:00:00');
        // SES-002 Attendance (Class 7A - 2026-08-30)
        attStmt.run('ATT-006', 'SES-002', 'ZPS7A 01', 'Present', '2026-08-30 11:30:00');
        attStmt.run('ATT-007', 'SES-002', 'ZPS7A 02', 'Present', '2026-08-30 11:30:00');
        attStmt.run('ATT-008', 'SES-002', 'ZPS7A 03', 'Present', '2026-08-30 11:30:00');
        attStmt.run('ATT-009', 'SES-002', 'ZPS7A 04', 'Absent', '2026-08-30 11:30:00');
        attStmt.run('ATT-010', 'SES-002', 'ZPS7A 05', 'Present', '2026-08-30 11:30:00');
        attStmt.finalize();

        // Leads (CRM)
        const ldStmt = db.prepare("INSERT INTO leads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        ldStmt.run('L-001', 'Delhi Public School, RKP', 'Dr. Meenakshi', '9198760000', 'New Delhi', 'Demo Scheduled', 250000, 'Demo requested for 6th to 8th grades.', '2026-08-28');
        ldStmt.run('L-002', 'Mount Carmel School', 'Fr. James', '9198760001', 'Dwarka', 'Negotiation', 180000, 'Proposal sent for 120 students.', '2026-08-30');
        ldStmt.finalize();

        // Content Hub (Complete Class 6, 7, 8, 9, 11 Curriculum PDFs - Student Watermarked & Teacher Clean)
        const cntStmt = db.prepare("INSERT INTO content VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        // ================= CLASS 6 (Level 1) =================
        cntStmt.run('C-601', 'Class 6 - Unit 1: Robotics & Sensor Basics (Student Edition)', 'PDF', 'Level 1', '6', 'Student', '/materials/class6-unit1-student-watermarked.pdf', 1, 'Student guide for electronic sensors, LEDs and circuit basics');
        cntStmt.run('C-602', 'Class 6 - Unit 1: Instructor Lesson Plan & Notes (Teacher Edition)', 'PDF', 'Level 1', '6', 'Trainer', '/materials/class6-unit1-teacher.pdf', 0, 'Clean master lesson plan, circuit schematics & viva questions for Unit 1');
        cntStmt.run('C-603', 'Class 6 - Unit 2: Motors & Motion Drivers (Student Edition)', 'PDF', 'Level 1', '6', 'Student', '/materials/class6-unit2-student-watermarked.pdf', 1, 'Student activity workbook for DC motor control and gearboxes');
        cntStmt.run('C-604', 'Class 6 - Unit 2: Instructor Master Guide (Teacher Edition)', 'PDF', 'Level 1', '6', 'Trainer', '/materials/class6-unit2-teacher.pdf', 0, 'Clean instructor presentation slide deck & motor driver troubleshooting');
        cntStmt.run('C-605', 'Class 6 - Unit 3: Smart Obstacle Avoidance (Student Edition)', 'PDF', 'Level 1', '6', 'Student', '/materials/class6-unit3-student-watermarked.pdf', 1, 'Student guide for ultrasonic sensor distance calculation');
        cntStmt.run('C-606', 'Class 6 - Unit 3: Teacher Theory & Lab Manual (Teacher Edition)', 'PDF', 'Level 1', '6', 'Trainer', '/materials/class6-unit3-teacher.pdf', 0, 'Clean instructor handbook for ultrasonic trigger and echo calibration');
        cntStmt.run('C-607', 'Class 6 - Unit 4: Autonomous Line Tracking Basics (Student Edition)', 'PDF', 'Level 1', '6', 'Student', '/materials/class6-unit4-student-watermarked.pdf', 1, 'Student workbook for IR sensor line detection circuits');
        cntStmt.run('C-608', 'Class 6 - Unit 4: Instructor Line Following Deck (Teacher Edition)', 'PDF', 'Level 1', '6', 'Trainer', '/materials/class6-unit4-teacher.pdf', 0, 'Clean teacher guide for analog comparator threshold tuning');
        cntStmt.run('C-609', 'Class 6 - Unit 5: Sound & Light Activated Systems (Student Edition)', 'PDF', 'Level 1', '6', 'Student', '/materials/class6-unit5-student-watermarked.pdf', 1, 'Student handbook for LDR and acoustic microphone triggers');
        cntStmt.run('C-610', 'Class 6 - Unit 5: Master Teacher Walkthrough (Teacher Edition)', 'PDF', 'Level 1', '6', 'Trainer', '/materials/class6-unit5-teacher.pdf', 0, 'Clean instructor schematics for sound-activated switching');
        cntStmt.run('C-611', 'Class 6 - Unit 6: Capstone Project - Autonomous Rover (Student Edition)', 'PDF', 'Level 1', '6', 'Student', '/materials/class6-unit6-student-watermarked.pdf', 1, 'Student capstone build manual for full chassis assembly');
        cntStmt.run('C-612', 'Class 6 - Unit 6: Capstone Instructor Evaluation Rubric (Teacher Edition)', 'PDF', 'Level 1', '6', 'Trainer', '/materials/class6-unit6-teacher.pdf', 0, 'Clean trainer project evaluation scorecard & build rubric');

        // ================= CLASS 7 (Level 2) =================
        cntStmt.run('C-701', 'Class 7 - Unit 1: Microcontroller Fundamentals (Student Edition)', 'PDF', 'Level 2', '7', 'Student', '/materials/class7-unit1-student-watermarked.pdf', 1, 'Student tutorial for Arduino programming and C++ syntax');
        cntStmt.run('C-702', 'Class 7 - Unit 1: Instructor Guide & Architecture (Teacher Edition)', 'PDF', 'Level 2', '7', 'Trainer', '/materials/class7-unit1-teacher.pdf', 0, 'Clean master lesson plan for AVR microcontrollers and bootloaders');
        cntStmt.run('C-703', 'Class 7 - Unit 2: Digital & Analog Sensor Interfacing (Student Edition)', 'PDF', 'Level 2', '7', 'Student', '/materials/class7-unit2-student-watermarked.pdf', 1, 'Student lab workbook for ADC readings and serial monitor debugging');
        cntStmt.run('C-704', 'Class 7 - Unit 2: Teacher Lab Master Pack (Teacher Edition)', 'PDF', 'Level 2', '7', 'Trainer', '/materials/class7-unit2-teacher.pdf', 0, 'Clean instructor notes for ADC voltage dividers and calibration');
        cntStmt.run('C-705', 'Class 7 - Unit 3: PWM Motor Speed Modulation (Student Edition)', 'PDF', 'Level 2', '7', 'Student', '/materials/class7-unit3-student-watermarked.pdf', 1, 'Student handbook for duty cycle and PWM motor acceleration');
        cntStmt.run('C-706', 'Class 7 - Unit 3: Instructor PWM Control Guide (Teacher Edition)', 'PDF', 'Level 2', '7', 'Trainer', '/materials/class7-unit3-teacher.pdf', 0, 'Clean instructor guide for timer-based PWM waveforms and H-bridge drivers');
        cntStmt.run('C-707', 'Class 7 - Unit 4: Ultrasonic Radar & Servo Sweeper (Student Edition)', 'PDF', 'Level 2', '7', 'Student', '/materials/class7-unit4-student-watermarked.pdf', 1, 'Student activity book for servo angle sweeps and sonar radar map');
        cntStmt.run('C-708', 'Class 7 - Unit 4: Teacher Sonar Navigation Pack (Teacher Edition)', 'PDF', 'Level 2', '7', 'Trainer', '/materials/class7-unit4-teacher.pdf', 0, 'Clean master deck for 180-degree sweep obstacle mapping');
        cntStmt.run('C-709', 'Class 7 - Unit 5: I2C LCD Display & Telemetry (Student Edition)', 'PDF', 'Level 2', '7', 'Student', '/materials/class7-unit5-student-watermarked.pdf', 1, 'Student workbook for 16x2 I2C display and telemetry status');
        cntStmt.run('C-710', 'Class 7 - Unit 5: Instructor I2C Bus Architecture (Teacher Edition)', 'PDF', 'Level 2', '7', 'Trainer', '/materials/class7-unit5-teacher.pdf', 0, 'Clean instructor manual for I2C addresses and bus pull-ups');
        cntStmt.run('C-711', 'Class 7 - Unit 6: Capstone Project - Multi-Sensor Bot (Student Edition)', 'PDF', 'Level 2', '7', 'Student', '/materials/class7-unit6-student-watermarked.pdf', 1, 'Student capstone project integration manual');
        cntStmt.run('C-712', 'Class 7 - Unit 6: Master Capstone Assessment (Teacher Edition)', 'PDF', 'Level 2', '7', 'Trainer', '/materials/class7-unit6-teacher.pdf', 0, 'Clean trainer certification test and capstone grading criteria');

        // ================= CLASS 8 (Level 3) =================
        cntStmt.run('C-801', 'Class 8 - Unit 1: Autonomous Line Tracker Systems (Student Edition)', 'PDF', 'Level 3', '8', 'Student', '/materials/class8-unit1-student-watermarked.pdf', 1, 'Student handbook for multi-channel IR array sensors');
        cntStmt.run('C-802', 'Class 8 - Unit 1: Teacher Master Pack & Algorithm Guide (Teacher Edition)', 'PDF', 'Level 3', '8', 'Trainer', '/materials/class8-unit1-teacher.pdf', 0, 'Clean instructor walkthrough for line tracking algorithms and error states');
        cntStmt.run('C-803', 'Class 8 - Unit 2: PID Control Algorithms for Robotics (Student Edition)', 'PDF', 'Level 3', '8', 'Student', '/materials/class8-unit2-student-watermarked.pdf', 1, 'Student guide for Proportional, Integral & Derivative error tuning');
        cntStmt.run('C-804', 'Class 8 - Unit 2: Instructor PID Mathematical Model (Teacher Edition)', 'PDF', 'Level 3', '8', 'Trainer', '/materials/class8-unit2-teacher.pdf', 0, 'Clean master deck for Kp, Ki, Kd coefficients tuning and oscillation dampening');
        cntStmt.run('C-805', 'Class 8 - Unit 3: Bluetooth & Wireless Robot Control (Student Edition)', 'PDF', 'Level 3', '8', 'Student', '/materials/class8-unit3-student-watermarked.pdf', 1, 'Student manual for HC-05 module and mobile app telemetry');
        cntStmt.run('C-806', 'Class 8 - Unit 3: Teacher Wireless UART Protocol (Teacher Edition)', 'PDF', 'Level 3', '8', 'Trainer', '/materials/class8-unit3-teacher.pdf', 0, 'Clean instructor packet for baud rate handshakes and AT commands');
        cntStmt.run('C-807', 'Class 8 - Unit 4: Robotic Arm Kinematics & Gripper (Student Edition)', 'PDF', 'Level 3', '8', 'Student', '/materials/class8-unit4-student-watermarked.pdf', 1, 'Student activity pack for 3-axis robotic arm degrees of freedom');
        cntStmt.run('C-808', 'Class 8 - Unit 4: Instructor Arm Kinematics Guide (Teacher Edition)', 'PDF', 'Level 3', '8', 'Trainer', '/materials/class8-unit4-teacher.pdf', 0, 'Clean instructor manual for forward kinematics and torque calculations');
        cntStmt.run('C-809', 'Class 8 - Unit 5: Gyroscope & Accelerometer Balance Logic (Student Edition)', 'PDF', 'Level 3', '8', 'Student', '/materials/class8-unit5-student-watermarked.pdf', 1, 'Student handbook for MPU6050 6-DOF IMU sensor interfacing');
        cntStmt.run('C-810', 'Class 8 - Unit 5: Instructor IMU Complementary Filter (Teacher Edition)', 'PDF', 'Level 3', '8', 'Trainer', '/materials/class8-unit5-teacher.pdf', 0, 'Clean trainer guide for pitch/roll complementary filters');
        cntStmt.run('C-811', 'Class 8 - Unit 6: Capstone Project - Self-Balancing Bot (Student Edition)', 'PDF', 'Level 3', '8', 'Student', '/materials/class8-unit6-student-watermarked.pdf', 1, 'Student final build guide for inverted pendulum two-wheel balance robot');
        cntStmt.run('C-812', 'Class 8 - Unit 6: Master Capstone Review & Rubric (Teacher Edition)', 'PDF', 'Level 3', '8', 'Trainer', '/materials/class8-unit6-teacher.pdf', 0, 'Clean trainer scorecard for balancing bot stability and speed');

        // ================= CLASS 9 (Level 4 - IoT & Edge) =================
        cntStmt.run('C-901', 'Class 9 - Unit 1: IoT & ESP32 Microcontrollers (Student Edition)', 'PDF', 'Level 4', '9', 'Student', '/materials/class9-unit1-student-watermarked.pdf', 1, 'Student manual for ESP32 Dual-Core WiFi/BLE SoC architecture');
        cntStmt.run('C-902', 'Class 9 - Unit 1: Instructor IoT Network Architecture (Teacher Edition)', 'PDF', 'Level 4', '9', 'Trainer', '/materials/class9-unit1-teacher.pdf', 0, 'Clean instructor guide for ESP-IDF/Arduino core wireless protocols');
        cntStmt.run('C-903', 'Class 9 - Unit 2: MQTT Telemetry & Cloud Messaging (Student Edition)', 'PDF', 'Level 4', '9', 'Student', '/materials/class9-unit2-student-watermarked.pdf', 1, 'Student guide for Publish-Subscribe MQTT telemetry protocols');
        cntStmt.run('C-904', 'Class 9 - Unit 2: Instructor Broker & Cloud Gateway (Teacher Edition)', 'PDF', 'Level 4', '9', 'Trainer', '/materials/class9-unit2-teacher.pdf', 0, 'Clean trainer packet for cloud brokers, QoS levels, and payload parsing');
        cntStmt.run('C-905', 'Class 9 - Unit 3: Smart Automation & Actuator Relays (Student Edition)', 'PDF', 'Level 4', '9', 'Student', '/materials/class9-unit3-student-watermarked.pdf', 1, 'Student project guide for optocoupler relays and high-voltage isolation');
        cntStmt.run('C-906', 'Class 9 - Unit 3: Instructor Power & Relay Safety (Teacher Edition)', 'PDF', 'Level 4', '9', 'Trainer', '/materials/class9-unit3-teacher.pdf', 0, 'Clean instructor electrical safety guide for AC/DC switching circuits');
        cntStmt.run('C-907', 'Class 9 - Unit 4: Environmental Telemetry & Web Servers (Student Edition)', 'PDF', 'Level 4', '9', 'Student', '/materials/class9-unit4-student-watermarked.pdf', 1, 'Student workbook for hosting web dashboards on embedded webservers');
        cntStmt.run('C-908', 'Class 9 - Unit 4: Instructor Async Web Server Deck (Teacher Edition)', 'PDF', 'Level 4', '9', 'Trainer', '/materials/class9-unit4-teacher.pdf', 0, 'Clean teacher guide for HTML/CSS frontend rendering on ESP32 flash');
        cntStmt.run('C-909', 'Class 9 - Unit 5: Edge Event Triggers & Cloud Alerts (Student Edition)', 'PDF', 'Level 4', '9', 'Student', '/materials/class9-unit5-student-watermarked.pdf', 1, 'Student handbook for automated Telegram & WhatsApp webhook alerts');
        cntStmt.run('C-910', 'Class 9 - Unit 5: Instructor Webhook Integration Manual (Teacher Edition)', 'PDF', 'Level 4', '9', 'Trainer', '/materials/class9-unit5-teacher.pdf', 0, 'Clean instructor walkthrough for HTTP POST webhooks and SSL/TLS handshakes');
        cntStmt.run('C-911', 'Class 9 - Unit 6: Capstone Project - Industrial IoT Node (Student Edition)', 'PDF', 'Level 4', '9', 'Student', '/materials/class9-unit6-student-watermarked.pdf', 1, 'Student capstone build manual for industrial smart factory monitoring node');
        cntStmt.run('C-912', 'Class 9 - Unit 6: Master Capstone Assessment & Audit (Teacher Edition)', 'PDF', 'Level 4', '9', 'Trainer', '/materials/class9-unit6-teacher.pdf', 0, 'Clean trainer certification test and cloud uptime audit scorecard');

        // ================= CLASS 11 (Level 5 - Advanced AI & Vision) =================
        cntStmt.run('C-1101', 'Class 11 - Unit 1: AI Vision & Embedded Neural Networks (Student Edition)', 'PDF', 'Level 5', '11', 'Student', '/materials/class11-unit1-student-watermarked.pdf', 1, 'Student guide for OpenCV image matrices, filters and convolutions');
        cntStmt.run('C-1102', 'Class 11 - Unit 1: Master Instructor Vision Toolkit (Teacher Edition)', 'PDF', 'Level 5', '11', 'Trainer', '/materials/class11-unit1-teacher.pdf', 0, 'Clean master deck for camera pipeline, color space transforms & FPS tuning');
        cntStmt.run('C-1103', 'Class 11 - Unit 2: Object Detection & Color Tracking (Student Edition)', 'PDF', 'Level 5', '11', 'Student', '/materials/class11-unit2-student-watermarked.pdf', 1, 'Student activity book for HSV mask thresholding and contour bounding boxes');
        cntStmt.run('C-1104', 'Class 11 - Unit 2: Instructor Contour Algorithm Guide (Teacher Edition)', 'PDF', 'Level 5', '11', 'Trainer', '/materials/class11-unit2-teacher.pdf', 0, 'Clean instructor notes for centroid calculation and spatial position tracking');
        cntStmt.run('C-1105', 'Class 11 - Unit 3: Face Recognition & Security Nodes (Student Edition)', 'PDF', 'Level 5', '11', 'Student', '/materials/class11-unit3-student-watermarked.pdf', 1, 'Student project guide for Haar Cascade classifiers and facial biometric nodes');
        cntStmt.run('C-1106', 'Class 11 - Unit 3: Instructor Classifier Training Pack (Teacher Edition)', 'PDF', 'Level 5', '11', 'Trainer', '/materials/class11-unit3-teacher.pdf', 0, 'Clean instructor packet for feature vector extraction and classifier weights');
        cntStmt.run('C-1107', 'Class 11 - Unit 4: Vision-Based Autonomous Navigation (Student Edition)', 'PDF', 'Level 5', '11', 'Student', '/materials/class11-unit4-student-watermarked.pdf', 1, 'Student workbook for optical line following and lane departure steering');
        cntStmt.run('C-1108', 'Class 11 - Unit 4: Instructor Optical Steering Model (Teacher Edition)', 'PDF', 'Level 5', '11', 'Trainer', '/materials/class11-unit4-teacher.pdf', 0, 'Clean instructor manual for perspective warping and optical vector calculation');
        cntStmt.run('C-1109', 'Class 11 - Unit 5: Gesture Controlled Robotics via Edge AI (Student Edition)', 'PDF', 'Level 5', '11', 'Student', '/materials/class11-unit5-student-watermarked.pdf', 1, 'Student handbook for MediaPipe hand tracking and gesture command mapping');
        cntStmt.run('C-1110', 'Class 11 - Unit 5: Instructor Edge AI Hand Tracking (Teacher Edition)', 'PDF', 'Level 5', '11', 'Trainer', '/materials/class11-unit5-teacher.pdf', 0, 'Clean trainer guide for landmark coordinates and gesture classifier state machine');
        cntStmt.run('C-1111', 'Class 11 - Unit 6: Capstone Project - AI Autonomous Drone/Rover (Student Edition)', 'PDF', 'Level 5', '11', 'Student', '/materials/class11-unit6-student-watermarked.pdf', 1, 'Student capstone build manual for AI vision autonomous surveillance rover');
        cntStmt.run('C-1112', 'Class 11 - Unit 6: Master Capstone Defense & Rubric (Teacher Edition)', 'PDF', 'Level 5', '11', 'Trainer', '/materials/class11-unit6-teacher.pdf', 0, 'Clean trainer evaluation rubric for latency, inference accuracy & autonomy');

        cntStmt.finalize();

        // 5-Level Structured Curriculum Plans (Mapping 5 Classes to 5 Levels)
        const curStmt = db.prepare("INSERT INTO curriculum VALUES (?, ?, ?, ?, ?, ?)");
        // Level 1 (Class 6)
        curStmt.run('CUR-101', 'Unit 1', 'Level 1', 'Robotics & Electronic Sensor Logic', 'Understand breadboards, IR & light sensors, build trigger circuits', 'Completed');
        curStmt.run('CUR-102', 'Unit 2', 'Level 1', 'Motors, Gearboxes & H-Bridge Drivers', 'Learn DC motor torque, direction switching and motor driver circuits', 'Current');
        curStmt.run('CUR-103', 'Unit 3', 'Level 1', 'Ultrasonic Distance & Obstacle Avoidance', 'Measure sonar bounce latency and trigger autonomous steering', 'Upcoming');
        curStmt.run('CUR-104', 'Unit 4', 'Level 1', 'Autonomous Line Tracker Construction', 'Calibrate dual IR comparators on dark tracking surfaces', 'Upcoming');
        curStmt.run('CUR-105', 'Unit 5', 'Level 1', 'Sound & Optical Sensor Circuits', 'Acoustic mic integration and light-dependent switching relays', 'Upcoming');
        curStmt.run('CUR-106', 'Unit 6', 'Level 1', 'Capstone Project: Smart Autonomous Rover', 'Final assembly, testing and circuit certification rubric', 'Upcoming');

        // Level 2 (Class 7)
        curStmt.run('CUR-201', 'Unit 1', 'Level 2', 'Microcontroller Architecture & C++ Fundamentals', 'AVR microcontroller anatomy, pinouts, and Arduino IDE code structure', 'Completed');
        curStmt.run('CUR-202', 'Unit 2', 'Level 2', 'Analog-to-Digital Converter & Sensor Interfacing', 'ADC voltage dividers, analogRead resolution, and serial plotting', 'Current');
        curStmt.run('CUR-203', 'Unit 3', 'Level 2', 'PWM Motor Speed Regulation', 'Duty cycle modulation, timer interrupts and speed ramping', 'Upcoming');
        curStmt.run('CUR-204', 'Unit 4', 'Level 2', 'Sonar Radar with 180° Servo Sweeper', 'Servo angular indexing and distance sweep visualization', 'Upcoming');
        curStmt.run('CUR-205', 'Unit 5', 'Level 2', 'I2C Bus Protocol & LCD Telemetry', 'I2C communication, address scanning and real-time status display', 'Upcoming');
        curStmt.run('CUR-206', 'Unit 6', 'Level 2', 'Capstone Project: Multi-Sensor Autonomous Bot', 'Full bot logic integration with LCD telemetry diagnostics', 'Upcoming');

        // Level 3 (Class 8)
        curStmt.run('CUR-301', 'Unit 1', 'Level 3', 'High-Speed Multi-Channel Line Tracking', '5-channel IR sensor arrays and digital state indexing', 'Completed');
        curStmt.run('CUR-302', 'Unit 2', 'Level 3', 'PID Closed-Loop Math Algorithms', 'Proportional, Integral, Derivative error calculations and tuning', 'Current');
        curStmt.run('CUR-303', 'Unit 3', 'Level 3', 'Wireless UART & Bluetooth Telemetry', 'HC-05 serial handshakes, packet parsing and smartphone control', 'Upcoming');
        curStmt.run('CUR-304', 'Unit 4', 'Level 3', '3-Axis Robotic Arm Kinematics', 'Forward kinematics, servo torque balancing and gripper payload control', 'Upcoming');
        curStmt.run('CUR-305', 'Unit 5', 'Level 3', '6-DOF IMU Gyro & Accelerometer Filters', 'MPU6050 complementary filters for pitch and roll stabilization', 'Upcoming');
        curStmt.run('CUR-306', 'Unit 6', 'Level 3', 'Capstone Project: Self-Balancing Inverted Pendulum', 'Two-wheel self-balancing inverted pendulum robot build', 'Upcoming');

        // Level 4 (Class 9 - IoT & Cloud)
        curStmt.run('CUR-401', 'Unit 1', 'Level 4', 'ESP32 Dual-Core Architecture & RTOS', 'Dual-core WiFi/BLE SoC, task pinning and memory management', 'Completed');
        curStmt.run('CUR-402', 'Unit 2', 'Level 4', 'MQTT Pub-Sub Cloud Telemetry', 'MQTT broker connection, QoS levels, and JSON telemetry transmission', 'Current');
        curStmt.run('CUR-403', 'Unit 3', 'Level 4', 'Smart Home Relay Actuation & Isolation', 'Optocoupler relays, AC load switching and electrical safety', 'Upcoming');
        curStmt.run('CUR-404', 'Unit 4', 'Level 4', 'Embedded Async Web Server & UI Dashboards', 'Serving HTML5/CSS dashboards directly from ESP32 flash memory', 'Upcoming');
        curStmt.run('CUR-405', 'Unit 5', 'Level 4', 'Edge Event Webhooks & Telegram/WhatsApp Alerts', 'HTTP POST webhooks and instant cloud notification triggers', 'Upcoming');
        curStmt.run('CUR-406', 'Unit 6', 'Level 4', 'Capstone Project: Industrial Smart Factory Node', 'Complete industrial telemetry station with remote dashboard & alerts', 'Upcoming');

        // Level 5 (Class 11 - Advanced AI & Vision)
        curStmt.run('CUR-501', 'Unit 1', 'Level 5', 'Computer Vision Matrices & OpenCV Image Pipelines', 'Color spaces, convolution kernels, Gaussian filters and edge detection', 'Completed');
        curStmt.run('CUR-502', 'Unit 2', 'Level 5', 'HSV Object Detection & Contour Tracking', 'HSV mask thresholding, bounding boxes and spatial centroid tracking', 'Current');
        curStmt.run('CUR-503', 'Unit 3', 'Level 5', 'Haar Cascade Classifiers & Facial Biometric Nodes', 'Feature vector extraction and real-time facial recognition verification', 'Upcoming');
        curStmt.run('CUR-504', 'Unit 4', 'Level 5', 'Vision-Based Autonomous Steering & Lane Tracking', 'Perspective transforms, polynomial lane fitting and steering angles', 'Upcoming');
        curStmt.run('CUR-505', 'Unit 5', 'Level 5', 'MediaPipe Edge AI Gesture Mapping', 'Hand landmark detection and gesture-controlled robotic actuation', 'Upcoming');
        curStmt.run('CUR-506', 'Unit 6', 'Level 5', 'Capstone Project: Autonomous Vision Surveillance Rover', 'Real-time object tracking and autonomous rover obstacle navigation', 'Upcoming');

        curStmt.finalize();

        // Standardized Hardware Kits (Zenith Public School Lab Inventory)
        const invStmt = db.prepare("INSERT INTO inventory VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        invStmt.run('KIT-ZPS-01', 'Standard Robotics Lab Kit (Uno + Dual Motor)', 'Level 1', 'ZPS', 'ZPS6A 01', 'Healthy', '2026-08-28', 'Standard Zenith Lab Kit assigned');
        invStmt.run('KIT-ZPS-02', 'Standard Robotics Lab Kit (Uno + Dual Motor)', 'Level 1', 'ZPS', 'ZPS6A 02', 'Healthy', '2026-08-28', 'Standard Zenith Lab Kit assigned');
        invStmt.run('KIT-ZPS-03', 'Standard Robotics Lab Kit (Uno + Dual Motor)', 'Level 1', 'ZPS', 'ZPS6A 03', 'Healthy', '2026-08-28', 'Standard Zenith Lab Kit assigned');
        invStmt.run('KIT-ZPS-04', 'Standard Robotics Lab Kit (Uno + Dual Motor)', 'Level 1', 'ZPS', 'ZPS6A 04', 'Healthy', '2026-08-28', 'Standard Zenith Lab Kit assigned');
        invStmt.run('KIT-ZPS-05', 'Standard Robotics Lab Kit (Uno + Dual Motor)', 'Level 1', 'ZPS', 'ZPS6A 05', 'Healthy', '2026-08-28', 'Standard Zenith Lab Kit assigned');
        invStmt.run('KIT-ZPS-06', 'Standard Robotics Lab Kit (Uno + Dual Motor)', 'Level 2', 'ZPS', 'ZPS7A 01', 'Healthy', '2026-08-28', 'Standard Zenith Lab Kit assigned');
        invStmt.run('KIT-ZPS-07', 'Standard Robotics Lab Kit (Uno + Dual Motor)', 'Level 2', 'ZPS', 'ZPS7A 02', 'Healthy', '2026-08-28', 'Standard Zenith Lab Kit assigned');
        invStmt.run('KIT-ZPS-08', 'Standard Robotics Lab Kit (Uno + Dual Motor)', 'Level 3', 'ZPS', 'ZPS8A 01', 'Healthy', '2026-08-28', 'Standard Zenith Lab Kit assigned');
        invStmt.run('KIT-ZPS-09', 'Standard Robotics Lab Kit (Uno + Dual Motor)', 'Level 4', 'ZPS', 'ZPS9A 01', 'Healthy', '2026-08-28', 'Standard Zenith Lab Kit assigned');
        invStmt.run('KIT-ZPS-10', 'Standard Robotics Lab Kit (Uno + Dual Motor)', 'Level 5', 'ZPS', 'ZPS11A 01', 'Healthy', '2026-08-28', 'Standard Zenith Lab Kit assigned');
        invStmt.finalize();

        // Billing (Zenith Public School ₹1,00,000 Total Contract in 3 Tranches: 40k, 30k, 30k)
        const billStmt = db.prepare("INSERT INTO billing (id, school_id, school_name, tranche_number, tranche_title, amount, total_contract_value, date_issued, due_date, paid_date, payment_method, place_of_supply, status, receipt_no, is_confirmed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        billStmt.run('INV-ZPS-01', 'ZPS', 'Zenith Public School', 1, 'Tranche 1: Lab Setup & Hardware Kit Dispatch (40%)', 40000, 100000, '2026-08-01', '2026-08-15', '2026-08-05', 'NEFT Bank Transfer', 'Hata, Uttar Pradesh', 'Paid', 'REC-ZPS-2026-01', 1);
        
        billStmt.run('INV-ZPS-02', 'ZPS', 'Zenith Public School', 2, 'Tranche 2: Mid-Term Curriculum Delivery & IoT Integration (30%)', 30000, 100000, '2026-08-25', '2026-09-15', null, null, 'Hata, Uttar Pradesh', 'Pending', null, 0);
        
        billStmt.run('INV-ZPS-03', 'ZPS', 'Zenith Public School', 3, 'Tranche 3: Final AI Capstone, Student Exhibition & Certification (30%)', 30000, 100000, '2026-08-25', '2026-11-30', null, null, 'Hata, Uttar Pradesh', 'Pending', null, 0);
        
        billStmt.finalize();

        // Projects
        const prjStmt = db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        prjStmt.run('PRJ-001', 'ZPS6A 01', 'Smart Touchless Dustbin', 'Completed', 10, 'Servo motor and ultrasonic sensor integrated cleanly on breadboard.', 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80', '2026-08-20');
        prjStmt.run('PRJ-002', 'ZPS6A 01', 'Autonomous Line Follower Robot', 'Completed', 9, 'Chassis assembled, dual IR comparator tuned for dark line track.', 'https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=600&q=80', '2026-08-28');
        prjStmt.run('PRJ-003', 'ZPS6A 02', 'Smart Home Light & Fan Automation', 'Completed', 10, 'LDR light sensor and relay circuit working perfectly.', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80', '2026-08-26');
        prjStmt.finalize();

        // Comms Logs
        const comStmt = db.prepare("INSERT INTO comms_logs VALUES (?, ?, ?, ?, ?, ?, ?)");
        comStmt.run('MSG-001', 'ZPS6A 01', '919876543210', 'Monthly Progress Report', 'Dear Ravi Sharma, Aarav Sharma has completed Level 1 with 95% attendance.', '2026-08-28 15:30:00', 'Delivered');
        comStmt.finalize();
      }
    });
  });
}

module.exports = db;
