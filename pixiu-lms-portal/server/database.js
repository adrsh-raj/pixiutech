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

    // 15. Admin Broadcast Notifications & Class Announcements (Multi-Class 6, 7, 8, 9, 11 & Trainers)
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL, -- 'All_Students', 'Specific_Class', 'All_Trainers', 'Universal', 'School'
      target_classes TEXT,        -- e.g. "6,7,8,9,11" or "6"
      target_trainer_id TEXT,     -- e.g. "TR-01" or "All"
      target_school_id TEXT,      -- e.g. "ZPS", "XYZ", "ADMIN"
      type TEXT DEFAULT 'announcement', -- 'announcement', 'payment_claim', 'payment_matched'
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      template_type TEXT,        -- 'next_class', 'revision', 'kit_prep', 'general'
      scheduled_date TEXT,
      scheduled_time TEXT,
      severity TEXT DEFAULT 'info', -- 'info', 'important', 'urgent'
      status TEXT DEFAULT 'Active', -- 'Active', 'Archived'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
      // Safe non-breaking migrations for existing SQLite files
      db.run("ALTER TABLE notifications ADD COLUMN target_school_id TEXT", () => {});
      db.run("ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'announcement'", () => {});
    });

    // 16. Audit Logs for Security & User Logins
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      date TEXT,
      time TEXT,
      user_id TEXT,
      name TEXT,
      role TEXT,
      school_id TEXT,
      event_type TEXT DEFAULT 'Login',
      status TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 17. Student Reviews (Trainer Unit Reviews & Skill Assessments)
    db.run(`CREATE TABLE IF NOT EXISTS student_reviews (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      student_name TEXT,
      class_grade TEXT,
      unit_code TEXT,
      level TEXT,
      unit_title TEXT,
      score REAL,
      rating REAL,
      status TEXT,
      review TEXT,
      comment TEXT,
      trainer_name TEXT,
      verified_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 18. Notification Reads (Per-User Read Tracking to persist read state across devices & history clear)
    db.run(`CREATE TABLE IF NOT EXISTS notification_reads (
      id TEXT PRIMARY KEY,
      notification_id TEXT NOT NULL,
      user_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(notification_id, user_key)
    )`);

    // 19. Online Lab Quizzes & MCQs Engine
    db.run(`CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      class_grade TEXT NOT NULL, -- '6', '7', '8', '9', '11', 'ALL'
      level TEXT NOT NULL,       -- 'Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6'
      unit_code TEXT,            -- 'Unit 1', 'Unit 2', etc.
      duration_minutes INTEGER DEFAULT 10,
      total_marks INTEGER DEFAULT 10,
      created_by TEXT DEFAULT 'Pixiu Academic Faculty',
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 20. Quiz Questions with 4 Choices & Pedagogical Reasoning
    db.run(`CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      question_order INTEGER DEFAULT 1,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL, -- 'A', 'B', 'C', 'D'
      explanation TEXT NOT NULL,     -- Detailed reasoning shown post-quiz
      points INTEGER DEFAULT 2,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 21. Student Quiz Submissions with Proctoring Audit & Single-Attempt Lock
    db.run(`CREATE TABLE IF NOT EXISTS quiz_submissions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT,
      class_grade TEXT,
      level TEXT,
      score REAL DEFAULT 0,
      total_marks REAL DEFAULT 10,
      percentage REAL DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      attempted_count INTEGER DEFAULT 0,
      total_questions INTEGER DEFAULT 0,
      answers_json TEXT,             -- Serialized student answers map
      time_taken_seconds INTEGER DEFAULT 0,
      violation_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Completed', -- 'Completed', 'Terminated_Violation', 'Timed_Out'
      reattempt_allowed INTEGER DEFAULT 0, -- 1 if trainer granted reattempt
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(quiz_id, student_id)
    )`);

    // Seed default level-wise quizzes and questions if empty
    db.get("SELECT COUNT(*) as count FROM quizzes", (err, row) => {
      if (!err && row && row.count === 0) {
        console.log("📝 Seeding Official Curriculum Quizzes & Question Banks...");
        const qzStmt = db.prepare("INSERT INTO quizzes (id, title, class_grade, level, unit_code, duration_minutes, total_marks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        
        // Level 0 Quiz
        qzStmt.run('QUIZ-L0', 'Level 0 Assessment: Fundamentals of Electronics & Breadboards', '6', 'Level 0', 'Unit 1', 10, 10, 'Pixiu Academic Faculty');
        // Level 1 Quiz
        qzStmt.run('QUIZ-L1', 'Level 1 Assessment: Arduino IDE, GPIO & C++ Programming', '6', 'Level 1', 'Unit 2', 10, 10, 'Pixiu Academic Faculty');
        // Level 2 Quiz
        qzStmt.run('QUIZ-L2', 'Level 2 Assessment: Traffic Light Sequencer & Digital Logic', '6', 'Level 2', 'Unit 3', 10, 10, 'Pixiu Academic Faculty');
        // Level 3 Quiz
        qzStmt.run('QUIZ-L3', 'Level 3 Assessment: LDR Sensors, ADC & Automatic Lighting', '6', 'Level 3', 'Unit 4', 10, 10, 'Pixiu Academic Faculty');
        // Level 4 Quiz
        qzStmt.run('QUIZ-L4', 'Level 4 Assessment: Ultrasonic Sensing & Servo Barrier Toll', '6', 'Level 4', 'Unit 5', 10, 10, 'Pixiu Academic Faculty');
        // Level 5 Quiz
        qzStmt.run('QUIZ-L5', 'Level 5 Assessment: Robotics Capstone, Motors & Troubleshooting', '6', 'Level 5', 'Unit 6', 10, 10, 'Pixiu Academic Faculty');
        qzStmt.finalize();

        // Seed Questions
        const qStmt = db.prepare("INSERT INTO quiz_questions (id, quiz_id, question_order, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        // Level 0 Questions
        qStmt.run('Q-L0-1', 'QUIZ-L0', 1, 'What is the primary role of a current-limiting resistor connected in series with an LED?', 'To increase the supply voltage', 'To protect the LED from burning out due to excessive current', 'To invert direct current into AC power', 'To amplify brightness indefinitely', 'B', 'LEDs have very low internal resistance when forward-biased. A series resistor limits current to safe operating levels (typically 15-20mA), preventing thermal runaway and permanent burn-out.', 2);
        qStmt.run('Q-L0-2', 'QUIZ-L0', 2, 'On a standard solderless breadboard, how are the power rail holes connected?', 'Diagonally across the center divider', 'Horizontally in groups of 5 holes', 'Vertically throughout the entire continuous strip (+ and -)', 'They are completely isolated from each other', 'C', 'Breadboard power rails (+ and -) run in continuous vertical columns along the outer edges to distribute VCC and GND across the entire board conveniently.', 2);
        qStmt.run('Q-L0-3', 'QUIZ-L0', 3, 'Which fundamental electrical law states the relationship V = I × R?', 'Faradays Law of Induction', 'Ohms Law', 'Coulombs Electrostatic Law', 'Kirchhoffs Current Law', 'B', 'Ohms Law states that voltage (V) equals current (I) multiplied by resistance (R). It is the fundamental equation used to calculate resistor values in circuits.', 2);
        qStmt.run('Q-L0-4', 'QUIZ-L0', 4, 'How can you identify the positive terminal (Anode) of a brand new 5mm LED?', 'The anode has a shorter leg and flat rim notch', 'The anode has the longer leg and circular collar', 'The anode is always coated in black silicone', 'Both legs are always completely identical', 'B', 'New LEDs have a longer lead for the Anode (positive) and a shorter lead with a flat notch on the plastic casing for the Cathode (negative/GND).', 2);
        qStmt.run('Q-L0-5', 'QUIZ-L0', 5, 'If two 220Ω resistors are connected in a single SERIES line, what is the total equivalent resistance?', '110Ω', '440Ω', '0Ω', '220Ω', 'B', 'In a series circuit, individual resistances add up directly: R_total = R1 + R2 = 220Ω + 220Ω = 440Ω.', 2);

        // Level 1 Questions
        qStmt.run('Q-L1-1', 'QUIZ-L1', 1, 'In an Arduino sketch, what is the key characteristic of the setup() function?', 'It repeats continuously in an infinite cycle', 'It runs exactly once when the board powers up or is reset', 'It is used only for drawing graphics on screen', 'It cannot configure digital pin directions', 'B', 'setup() is called once when the sketch starts. It is used to initialize pin modes (pinMode), set baud rates (Serial.begin), and set initial variables.', 2);
        qStmt.run('Q-L1-2', 'QUIZ-L1', 2, 'Which Arduino C++ function configures digital pin 13 to supply power to an LED?', 'digitalRead(13, INPUT)', 'pinMode(13, OUTPUT)', 'analogWrite(13, 255)', 'setPinMode(13, HIGH)', 'B', 'pinMode(pinNumber, OUTPUT) configures the specified digital pin to provide voltage output (+5V).', 2);
        qStmt.run('Q-L1-3', 'QUIZ-L1', 3, 'What does the function delay(1000) do in an Arduino sketch?', 'Pauses the processor execution for 1 second (1000 milliseconds)', 'Pauses the processor for 1 microsecond', 'Cycles an LED 1000 times', 'Increases the processor clock speed to 1000 MHz', 'A', 'The parameter for delay() is specified in milliseconds. 1000 milliseconds equals exactly 1 second.', 2);
        qStmt.run('Q-L1-4', 'QUIZ-L1', 4, 'What voltage is present on digital pin 8 after calling digitalWrite(8, HIGH) on Arduino Uno?', '0 Volts (GND)', '3.3 Volts', '5.0 Volts', '12.0 Volts', 'C', 'On 5V ATmega328P Arduino boards like the Uno and Nano, HIGH outputs +5V, while LOW outputs 0V (Ground).', 2);
        qStmt.run('Q-L1-5', 'QUIZ-L1', 5, 'Which punctuation mark is mandatory at the end of every executable instruction in Arduino C++?', 'A colon (:)', 'A semicolon (;)', 'A period (.)', 'An exclamation point (!)', 'B', 'Every standalone C/C++ statement in Arduino must terminate with a semicolon (;), otherwise the compiler throws a syntax error.', 2);

        // Level 2 Questions
        qStmt.run('Q-L2-1', 'QUIZ-L2', 1, 'In an Indian standard 3-color traffic light sequencer, what is the correct state transition sequence?', 'Red -> Yellow -> Green -> Red', 'Red -> Green -> Yellow -> Red', 'Green -> Red -> Yellow -> Green', 'Yellow -> Red -> Green -> Yellow', 'B', 'Standard traffic sequencing stops vehicles on Red, transitions to Green to allow movement, alerts drivers to prepare to stop on Yellow/Amber, then cycles back to Red.', 2);
        qStmt.run('Q-L2-2', 'QUIZ-L2', 2, 'Why is using long blocking delay() calls problematic in advanced robotics systems?', 'It reduces the flash memory of the microcontroller', 'It completely freezes the CPU, preventing sensors and emergency stops from responding', 'It drains the battery five times faster', 'It flips the polarity of the power supply', 'B', 'delay() halts the CPU clock from processing any subsequent sensor readings or interrupts until the delay time completes, causing the robot to be blind to obstacles.', 2);
        qStmt.run('Q-L2-3', 'QUIZ-L2', 3, 'How many digital I/O pins are available on an Arduino Uno board?', '8 pins (0 to 7)', '14 pins (0 to 13)', '20 pins (0 to 19)', '6 pins (A0 to A5)', 'B', 'The Arduino Uno has 14 digital input/output pins numbered 0 to 13 (of which 6 can also provide PWM output).', 2);
        qStmt.run('Q-L2-4', 'QUIZ-L2', 4, 'What role do pins 0 (RX) and 1 (TX) play on the Arduino board?', 'Analog audio inputs', 'Hardware Serial UART communication with PC over USB', 'Motor high-voltage drivers', 'Oscillator crystal connections', 'B', 'Pins 0 (Receive) and 1 (Transmit) are dedicated to the ATmega hardware UART serial interface, connecting to the USB bridge chip.', 2);
        qStmt.run('Q-L2-5', 'QUIZ-L2', 5, 'What is the purpose of an active buzzer versus a passive buzzer in a pedestrian crosswalk circuit?', 'Active buzzers require no external frequency sketch; they sound immediately when given 5V', 'Passive buzzers are louder than active buzzers', 'Active buzzers only run on AC household current', 'There is no functional difference between them', 'A', 'An active buzzer contains an internal oscillating circuit, producing a tone automatically when powered by DC 5V. A passive buzzer requires PWM tone() frequencies.', 2);

        // Level 3 Questions
        qStmt.run('Q-L3-1', 'QUIZ-L3', 1, 'How does the resistance of a Light Dependent Resistor (LDR / Photoresistor) change in the dark?', 'Its resistance drops to nearly zero ohms', 'Its resistance increases dramatically (often up to mega-ohms)', 'Its resistance remains constant at 100 ohms', 'Its resistance turns negative', 'B', 'In the dark, fewer photons hit the semiconductor crystal, releasing fewer electron-hole pairs, causing LDR resistance to rise into hundreds of kilo-ohms or mega-ohms.', 2);
        qStmt.run('Q-L3-2', 'QUIZ-L3', 2, 'What integer range of values is returned by the Arduino analogRead() function?', '0 to 255 (8-bit)', '0 to 1023 (10-bit)', '0 to 65535 (16-bit)', '0 to 100 (percentage)', 'B', 'The Arduino Uno ADC (Analog-to-Digital Converter) has 10-bit resolution, translating 0V to 5V into integer values from 0 to 1023 (2^10 = 1024 steps).', 2);
        qStmt.run('Q-L3-3', 'QUIZ-L3', 3, 'Why must an LDR be paired with a fixed resistor in a voltage divider circuit?', 'To protect the LDR from excessive sunlight', 'Microcontrollers can only measure voltage, not raw resistance directly', 'To step down 220V AC current', 'To prevent radio interference', 'B', 'The Arduino analog pins measure voltage (0 to 5V). A voltage divider circuit converts the LDR variable resistance into a proportional variable voltage that analogRead() can digitize.', 2);
        qStmt.run('Q-L3-4', 'QUIZ-L3', 4, 'If analogRead(A0) outputs 300 in darkness and 850 in daylight, what is an optimal threshold to switch on a night lamp?', '100', '550', '950', '0', 'B', 'A midpoint threshold around 550 ((300 + 850) / 2) creates a reliable switching boundary between daytime and night.', 2);
        qStmt.run('Q-L3-5', 'QUIZ-L3', 5, 'Which Arduino function outputs an 8-bit simulated analog voltage using Pulse Width Modulation (PWM)?', 'analogRead(pin)', 'analogWrite(pin, value)', 'pwmSet(pin, hz)', 'digitalWrite(pin, ANALOG)', 'B', 'analogWrite(pin, 0-255) generates a PWM square wave on compatible pins (~3, ~5, ~6, ~9, ~10, ~11) to control LED brightness or motor speeds.', 2);

        // Level 4 Questions
        qStmt.run('Q-L4-1', 'QUIZ-L4', 1, 'On an HC-SR04 Ultrasonic distance sensor, what is the function of the Trig pin?', 'It sends out a 10-microsecond ultrasonic pulse trigger', 'It receives the reflected sonic echo', 'It powers the internal crystal oscillator', 'It connects to GND', 'A', 'Sending a 10µs HIGH pulse to the Trig pin causes the sensor transmitter to emit an 8-cycle sonic burst at 40 kHz.', 2);
        qStmt.run('Q-L4-2', 'QUIZ-L4', 2, 'Why is the round-trip time returned by pulseIn(echoPin, HIGH) divided by 2 when calculating distance?', 'Because sound travels at half speed through air', 'Because the sound wave travels forward to the object and bounces back, doubling the distance', 'Because the Arduino clock runs at half speed', 'Because the echo pin has 50% duty cycle', 'B', 'The sound wave travels to the obstacle and returns to the receiver. Dividing by 2 isolates the one-way distance to the target.', 2);
        qStmt.run('Q-L4-3', 'QUIZ-L4', 3, 'What type of motor is commonly used to actuate a smart toll booth barrier arm with precise angle control (0° to 90°)?', 'DC Motor without feedback', 'Stepper Motor with H-bridge', 'SG90 Micro Servo Motor', 'Solenoid valve', 'C', 'Micro servo motors (like SG90) contain an internal potentiometer and feedback control circuit, allowing programmers to set exact barrier angles using servo.write(angle).', 2);
        qStmt.run('Q-L4-4', 'QUIZ-L4', 4, 'What library must be included in an Arduino sketch to control a standard servo motor?', '<EEPROM.h>', '<Servo.h>', '<Wire.h>', '<SoftwareSerial.h>', 'B', 'The official <Servo.h> library generates the 50 Hz PWM pulse train required to position servo motors smoothly between 0° and 180°.', 2);
        qStmt.run('Q-L4-5', 'QUIZ-L4', 5, 'What is the speed of sound in dry air at room temperature (~20°C)?', '300,000 km/s', '343 meters per second (approx. 0.0343 cm/µs)', '1500 meters per second', '100 meters per second', 'B', 'Sound travels at approximately 343 m/s (or ~29.1 microseconds per centimeter), which is the constant used in ultrasonic obstacle math.', 2);

        // Level 5 Questions
        qStmt.run('Q-L5-1', 'QUIZ-L5', 1, 'In an autonomous line-follower robot, how does an IR sensor differentiate between a black track and white floor?', 'Black lines absorb infrared light, while white surfaces reflect infrared light back to the photodiode', 'Black lines generate higher voltage than white surfaces', 'White surfaces block magnetic fields', 'IR sensors cannot detect black surfaces', 'A', 'Dark/black pigments absorb infrared radiation, resulting in negligible reflection to the phototransistor, while white surfaces reflect infrared strongly.', 2);
        qStmt.run('Q-L5-2', 'QUIZ-L5', 2, 'Why cannot high-power DC gear motors be powered directly from an Arduino digital pin?', 'Arduino digital pins can only supply up to 20-40mA, whereas motors draw hundreds of milliamperes, risking microcontroller burnout', 'Arduino digital pins only output AC voltage', 'Motors require negative voltage to turn', 'Digital pins do not support GND', 'A', 'Microcontroller pins are low-current logic signals. Connecting a motor directly will exceed the ATmega pin current rating (40mA max) and destroy the chip. An H-bridge motor driver (like L298N or L293D) is required.', 2);
        qStmt.run('Q-L5-3', 'QUIZ-L5', 3, 'What circuit topology allows an H-bridge driver to reverse the rotational direction of a DC motor?', 'Four switching transistors arranged like the letter H that reverse the polarity across the motor terminals', 'A single diode connected in parallel', 'A potentiometer that changes resistance', 'A high-pass filter', 'A', 'An H-bridge uses 4 switches (transistors/MOSFETs). Activating diagonal pairs flips current direction through the motor coils, reversing direction of rotation.', 2);
        qStmt.run('Q-L5-4', 'QUIZ-L5', 4, 'If your robot turns uncontrollably in circles when both motors are commanded forward, what is the most likely wiring cause?', 'The Arduino code has a syntax error', 'One motor polarity is inverted (+ and - reversed on the driver terminal)', 'The battery is at 100% capacity', 'The breadboard has too many jumper wires', 'B', 'DC motors spin in reverse when their supply polarity is swapped. If one motor runs forward and the other runs backward, the robot spins in place.', 2);
        qStmt.run('Q-L5-5', 'QUIZ-L5', 5, 'What component protects microcontroller circuits from inductive voltage spikes generated when motor coils are turned off?', 'Flyback (Freewheeling) Diodes', 'Electrolytic capacitors only', 'Ceramic resistors', 'Light emitting diodes', 'A', 'Inductive motor windings produce reverse high-voltage spikes (back-EMF) when current is cut. Flyback diodes safely redirect this energy back to the power rail.', 2);

        qStmt.finalize();
      }
    });

    // Ensure notifications table has seed data if empty
    db.get("SELECT COUNT(*) as count FROM notifications", (err, row) => {
      if (!err && row && row.count === 0) {
        const notifStmt = db.prepare("INSERT INTO notifications VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        notifStmt.run('NOTIF-001', 'Universal', '6,7,8,9,11', 'All', '🚀 Term 1 Robotics Lab Sessions Live', 'Welcome to Pixiu Tech Innovation Lab! Friday and Saturday hands-on lab sessions are active for Classes 6A to 11A.', 'next_class', 'Friday, 04 Sep 2026', '10:00 AM', 'info', 'Active', '2026-08-31 22:40:00', '2026-08-31 22:40:00');
        notifStmt.run('NOTIF-002', 'All_Students', '6,7,8,9,11', 'All', '📝 Unit 1 Concept Revision & Circuit Viva Notice', 'Attention All Classes (6, 7, 8, 9, 11): Unit 1 concept revision and hands-on circuit viva checks will be held in Friday session. Please study the Unit 1 guides in your Student Portal.', 'revision', 'Friday, 04 Sep 2026', '11:00 AM', 'important', 'Active', '2026-08-31 22:41:00', '2026-08-31 22:41:00');
        notifStmt.run('NOTIF-003', 'All_Trainers', '6,7,8,9,11', 'TR-01', '🛠️ Trainer Directive: Prepare Level 1 Unit 2 Sensor Kits', 'Trainer Vikas Pandey: Please inspect and calibrate the LDR, IR and ultrasonic sensors for Classes 6A to 11A before Friday morning session.', 'kit_prep', 'Friday, 04 Sep 2026', '09:30 AM', 'urgent', 'Active', '2026-08-31 22:42:00', '2026-08-31 22:42:00');
        notifStmt.finalize();
      }
    });

    // Ensure student_reviews table has seed data if empty
    db.get("SELECT COUNT(*) as count FROM student_reviews", (err, row) => {
      if (!err && row && row.count === 0) {
        console.log("⭐ Seeding Baseline Faculty Student Reviews & Competency Evaluations...");
        const revStmt = db.prepare(`INSERT INTO student_reviews (
          id, student_id, student_name, class_grade, unit_code, level, unit_title,
          score, rating, status, review, comment, trainer_name, verified_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        // ZPS6A 01 - Aarav Sharma (Class 6 - Level 0, Level 1, Level 2 Mastered)
        revStmt.run(
          'REV-ZPS6A01-U1', 'ZPS6A 01', 'Aarav Sharma', '6', 'Unit 1', 'Level 0',
          'Introduction to Robotics & Electronics',
          9.5, 5, 'Mastered',
          'Aarav demonstrated exemplary understanding of electronic components, breadboard continuity, and Ohm’s Law. Completed all hands-on exercises flawlessly.',
          'Aarav demonstrated exemplary understanding of electronic components, breadboard continuity, and Ohm’s Law. Completed all hands-on exercises flawlessly.',
          'Vikas Pandey (Lead Instructor)', '22 Aug 2026'
        );
        revStmt.run(
          'REV-ZPS6A01-U2', 'ZPS6A 01', 'Aarav Sharma', '6', 'Unit 2', 'Level 1',
          'The Arduino IDE',
          9.2, 5, 'Mastered',
          'Strong grasp of Arduino C++ syntax, GPIO pin modes, and delay cycles. Uploaded and debugged sketches independently on hardware.',
          'Strong grasp of Arduino C++ syntax, GPIO pin modes, and delay cycles. Uploaded and debugged sketches independently on hardware.',
          'Vikas Pandey (Lead Instructor)', '26 Aug 2026'
        );
        revStmt.run(
          'REV-ZPS6A01-U3', 'ZPS6A 01', 'Aarav Sharma', '6', 'Unit 3', 'Level 2',
          'Basic Project: Traffic Light Signal Controller',
          9.8, 5, 'Mastered',
          'Outstanding execution of the 3-state traffic controller project. Clean jumper routing, correct resistor placement, and excellent code commentary.',
          'Outstanding execution of the 3-state traffic controller project. Clean jumper routing, correct resistor placement, and excellent code commentary.',
          'Vikas Pandey (Lead Instructor)', '29 Aug 2026'
        );

        // ZPS6A 02 - Priya Patel (Class 6 - Level 0 Mastered)
        revStmt.run(
          'REV-ZPS6A02-U1', 'ZPS6A 02', 'Priya Patel', '6', 'Unit 1', 'Level 0',
          'Introduction to Robotics & Electronics',
          9.0, 5, 'Mastered',
          'Excellent hands-on circuit wiring skills. Quickly grasped LED polarity and series resistance concepts.',
          'Excellent hands-on circuit wiring skills. Quickly grasped LED polarity and series resistance concepts.',
          'Vikas Pandey (Lead Instructor)', '22 Aug 2026'
        );

        // ZPS6A 03 - Rohan Gupta (Class 6 - Level 0 Competent)
        revStmt.run(
          'REV-ZPS6A03-U1', 'ZPS6A 03', 'Rohan Gupta', '6', 'Unit 1', 'Level 0',
          'Introduction to Robotics & Electronics',
          8.8, 4, 'Competent',
          'Solid performance in breadboard assembly and component identification. Shows keen interest in hands-on building.',
          'Solid performance in breadboard assembly and component identification. Shows keen interest in hands-on building.',
          'Vikas Pandey (Lead Instructor)', '22 Aug 2026'
        );

        // ZPS7A 01 - Devansh Tiwari (Class 7 - Level 0 Mastered)
        revStmt.run(
          'REV-ZPS7A01-U1', 'ZPS7A 01', 'Devansh Tiwari', '7', 'Unit 1', 'Level 0',
          'Introduction to Analog & Digital Electronics',
          9.6, 5, 'Mastered',
          'Deep comprehension of analog voltage dividers and digital logic levels. Demonstrated great problem-solving aptitude.',
          'Deep comprehension of analog voltage dividers and digital logic levels. Demonstrated great problem-solving aptitude.',
          'Vikas Pandey (Lead Instructor)', '23 Aug 2026'
        );

        // ZPS8A 01 - Yash Srivastava (Class 8 - Level 0 Mastered)
        revStmt.run(
          'REV-ZPS8A01-U1', 'ZPS8A 01', 'Yash Srivastava', '8', 'Unit 1', 'Level 0',
          'Introduction to Waves & Distance Measurement',
          9.4, 5, 'Mastered',
          'Thorough understanding of acoustic wave propagation and sensor calibration for HC-SR04 ultrasonic modules.',
          'Thorough understanding of acoustic wave propagation and sensor calibration for HC-SR04 ultrasonic modules.',
          'Vikas Pandey (Lead Instructor)', '24 Aug 2026'
        );

        // ZPS9A 01 - Ayush Kushwaha (Class 9 - Level 0 Mastered)
        revStmt.run(
          'REV-ZPS9A01-U1', 'ZPS9A 01', 'Ayush Kushwaha', '9', 'Unit 1', 'Level 0',
          'Introduction to Industrial Sensors & Displays',
          9.5, 5, 'Mastered',
          'Superb precision in wiring I2C LCD displays and temperature sensor interfaces. Excellent circuit cleanliness.',
          'Superb precision in wiring I2C LCD displays and temperature sensor interfaces. Excellent circuit cleanliness.',
          'Vikas Pandey (Lead Instructor)', '24 Aug 2026'
        );

        // ZPS11A 01 - Siddharth Pandey (Class 11 - Level 0 Mastered)
        revStmt.run(
          'REV-ZPS11A01-U1', 'ZPS11A 01', 'Siddharth Pandey', '11', 'Unit 1', 'Level 0',
          'Introduction to Engineering Specs & Optics',
          9.8, 5, 'Mastered',
          'Exceptional grasp of computer vision fundamentals, camera matrix calibrations, and edge computing concepts.',
          'Exceptional grasp of computer vision fundamentals, camera matrix calibrations, and edge computing concepts.',
          'Vikas Pandey (Lead Instructor)', '25 Aug 2026'
        );

        // XYZ6A 01 - Aayush Maurya (XYZ Academy - Level 0 Mastered)
        revStmt.run(
          'REV-XYZ6A01-U1', 'XYZ6A 01', 'Aayush Maurya', '6', 'Unit 1', 'Level 0',
          'Introduction to Robotics & Electronics',
          9.2, 5, 'Mastered',
          'Great enthusiastic participation in robotics lab fundamentals and breadboard wiring.',
          'Great enthusiastic participation in robotics lab fundamentals and breadboard wiring.',
          'Akash Sharma (Senior Robotics Faculty)', '26 Aug 2026'
        );

        revStmt.finalize();
      }
    });

    // Seed database if empty
    db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
      if (row && row.count === 0) {
        console.log("🔐 Seeding Authentication Users with BCrypt Password Hashes...");

        // Generate BCrypt Hashes using environment variables
        const adminPass = process.env.ADMIN_SEED_PASS || 'Adarsg@pixiutech';
        const trainerPass = process.env.TRAINER_SEED_PASS || 'Vikad@pixiutech';
        const s6Pass = process.env.STUDENT_SEED_PASS_6 || 'ZPSzenith6@hata';
        const s7Pass = process.env.STUDENT_SEED_PASS_7 || 'ZPSzenith7@hata';
        const s8Pass = process.env.STUDENT_SEED_PASS_8 || 'ZPSzenith8@hata';
        const s9Pass = process.env.STUDENT_SEED_PASS_9 || 'ZPSzenith9@hata';
        const s11Pass = process.env.STUDENT_SEED_PASS_11 || 'ZPSzenith11@hata';

        const adminHash = await bcrypt.hash(adminPass, 10);
        const trainerHash = await bcrypt.hash(trainerPass, 10);
        const studentHash6 = await bcrypt.hash(s6Pass, 10);
        const studentHash7 = await bcrypt.hash(s7Pass, 10);
        const studentHash8 = await bcrypt.hash(s8Pass, 10);
        const studentHash9 = await bcrypt.hash(s9Pass, 10);
        const studentHash11 = await bcrypt.hash(s11Pass, 10);

        const uStmt = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        
        // 1. Super Admin
        uStmt.run('USR-ADMIN', 'adarshraj', adminHash, 'admin', 'ADM-01', 'Adarsh Raj (Founder & Admin)', 'ALL', new Date().toISOString());
        uStmt.run('USR-ADMIN-ALT', 'admin', adminHash, 'admin', 'ADM-01', 'Adarsh Raj (Founder & Admin)', 'ALL', new Date().toISOString());

        // 2. Primary Trainer Vikas Pandey
        uStmt.run('USR-TR01', 'vikaspandey', trainerHash, 'trainer', 'TR-01', 'Vikas Pandey', 'ZPS', new Date().toISOString());
        uStmt.run('USR-TR01-ALT', 'TR-01', trainerHash, 'trainer', 'TR-01', 'Vikas Pandey', 'ZPS', new Date().toISOString());
        
        // 3. Seed student logins for ALL 25 students
        ['ZPS6A 01', 'ZPS6A 02', 'ZPS6A 03', 'ZPS6A 04', 'ZPS6A 05'].forEach(sId => {
          uStmt.run(`USR-${sId.replace(/\s+/g, '')}`, sId, studentHash6, 'student', sId, `Student ${sId}`, 'ZPS', new Date().toISOString());
        });
        ['ZPS7A 01', 'ZPS7A 02', 'ZPS7A 03', 'ZPS7A 04', 'ZPS7A 05'].forEach(sId => {
          uStmt.run(`USR-${sId.replace(/\s+/g, '')}`, sId, studentHash7, 'student', sId, `Student ${sId}`, 'ZPS', new Date().toISOString());
        });
        ['ZPS8A 01', 'ZPS8A 02', 'ZPS8A 03', 'ZPS8A 04', 'ZPS8A 05'].forEach(sId => {
          uStmt.run(`USR-${sId.replace(/\s+/g, '')}`, sId, studentHash8, 'student', sId, `Student ${sId}`, 'ZPS', new Date().toISOString());
        });
        ['ZPS9A 01', 'ZPS9A 02', 'ZPS9A 03', 'ZPS9A 04', 'ZPS9A 05'].forEach(sId => {
          uStmt.run(`USR-${sId.replace(/\s+/g, '')}`, sId, studentHash9, 'student', sId, `Student ${sId}`, 'ZPS', new Date().toISOString());
        });
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

        // Planned Sessions (Clean slate ready for live real-time attendance)
        const sesStmt = db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        sesStmt.run('SES-001', 'ZPS', 'CLS-ZPS-6A', 'TR-01', 'Upcoming', 'Live Session', 'Unit 2: Sensors: Light (LDR) & Obstacle (IR)', 'Planned', 'Level 1 Unit 2 Lab build.', 0);
        sesStmt.run('SES-002', 'ZPS', 'CLS-ZPS-7A', 'TR-01', 'Upcoming', 'Live Session', 'Unit 2: Analog vs Digital Sensors & Signal Interfacing', 'Planned', 'Level 1 Unit 2 Sensor signals.', 0);
        sesStmt.run('SES-003', 'ZPS', 'CLS-ZPS-8A', 'TR-01', 'Upcoming', 'Live Session', 'Unit 2: Ultrasonic Echo Mapping & Collision Prevention', 'Planned', 'Level 1 Unit 2 Distance radar sweep.', 0);
        sesStmt.run('SES-004', 'ZPS', 'CLS-ZPS-9A', 'TR-01', 'Upcoming', 'Live Session', 'Unit 2: Wi-Fi HTTP / MQTT Cloud Telemetry', 'Planned', 'Level 1 Unit 2 Cloud teleoperation.', 0);
        sesStmt.run('SES-005', 'ZPS', 'CLS-ZPS-11A', 'TR-01', 'Upcoming', 'Live Session', 'Unit 2: OpenCV Color Masking & Contour Object Tracking', 'Planned', 'Level 1 Unit 2 Vision edge detection.', 0);
        sesStmt.finalize();

        // Attendance Records: Clean (0 records) - Real-time day, date, and time will be recorded upon taking live attendance.

        // Leads (CRM)
        const ldStmt = db.prepare("INSERT INTO leads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        ldStmt.run('L-001', 'Delhi Public School, RKP', 'Dr. Meenakshi', '9198760000', 'New Delhi', 'Demo Scheduled', 250000, 'Demo requested for 6th to 8th grades.', '2026-08-28');
        ldStmt.run('L-002', 'Mount Carmel School', 'Fr. James', '9198760001', 'Dwarka', 'Negotiation', 180000, 'Proposal sent for 120 students.', '2026-08-30');
        ldStmt.finalize();

        // Content Hub: 30 Clean Teacher Master Packs (Units 1-6 for Classes 6, 7, 8, 9, 11) + Student Watermarked Editions
        const cntStmt = db.prepare("INSERT INTO content VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        // Class 6 Teacher Masters (Units 1 to 6)
        cntStmt.run('CNT-601-T', 'Class 6 - Unit 1: Basic Circuits (Teacher Master)', 'PDF', null, '6', 'Trainer', '/materials/class6-unit1-teacher.pdf', 0, 'Clean instructor guide, circuit schematics & viva questions for Unit 1');
        cntStmt.run('CNT-602-T', 'Class 6 - Unit 2: Sensors LDR & IR (Teacher Master)', 'PDF', 'Level 1', '6', 'Trainer', '/materials/class6-unit2-teacher.pdf', 0, 'Level 1 Unit 2 Instructor Calibration & Sensor Circuit Guide');
        cntStmt.run('CNT-603-T', 'Class 6 - Unit 3: Motors & Actuators (Teacher Master)', 'PDF', 'Level 2', '6', 'Trainer', '/materials/class6-unit3-teacher.pdf', 0, 'Level 2 Unit 3 Motors, Buzzers & Relay Driver Lesson Plan');
        cntStmt.run('CNT-604-T', 'Class 6 - Unit 4: Microcontroller Intro (Teacher Master)', 'PDF', 'Level 3', '6', 'Trainer', '/materials/class6-unit4-teacher.pdf', 0, 'Level 3 Unit 4 Arduino Coding & Pin Mapping Walkthrough');
        cntStmt.run('CNT-605-T', 'Class 6 - Unit 5: Obstacle Rover Project (Teacher Master)', 'PDF', 'Level 4', '6', 'Trainer', '/materials/class6-unit5-teacher.pdf', 0, 'Level 4 Unit 5 2WD Obstacle Avoiding Rover Assembly Rubric');
        cntStmt.run('CNT-606-T', 'Class 6 - Unit 6: Smart Lab Capstone (Teacher Master)', 'PDF', 'Level 5', '6', 'Trainer', '/materials/class6-unit6-teacher.pdf', 0, 'Level 5 Unit 6 Capstone Evaluation & Certification Rubric');

        // Class 7 Teacher Masters (Units 1 to 6)
        cntStmt.run('CNT-701-T', 'Class 7 - Unit 1: C++ Fundamentals (Teacher Master)', 'PDF', null, '7', 'Trainer', '/materials/class7-unit1-teacher.pdf', 0, 'Instructor lesson plan and code walkthroughs for AVR microcontrollers');
        cntStmt.run('CNT-702-T', 'Class 7 - Unit 2: Analog Sensor Interfacing (Teacher Master)', 'PDF', 'Level 1', '7', 'Trainer', '/materials/class7-unit2-teacher.pdf', 0, 'Level 1 Unit 2 Instructor Calibration & ADC Lesson Plan');
        cntStmt.run('CNT-703-T', 'Class 7 - Unit 3: I2C LCD Display (Teacher Master)', 'PDF', 'Level 2', '7', 'Trainer', '/materials/class7-unit3-teacher.pdf', 0, 'Level 2 Unit 3 I2C Addressing & Telemetry Display Guide');
        cntStmt.run('CNT-704-T', 'Class 7 - Unit 4: Line Follower Robot (Teacher Master)', 'PDF', 'Level 3', '7', 'Trainer', '/materials/class7-unit4-teacher.pdf', 0, 'Level 3 Unit 4 Dual IR Comparator & Line Follower Troubleshooting');
        cntStmt.run('CNT-705-T', 'Class 7 - Unit 5: Smart Irrigation System (Teacher Master)', 'PDF', 'Level 4', '7', 'Trainer', '/materials/class7-unit5-teacher.pdf', 0, 'Level 4 Unit 5 Soil Moisture Probe & Submersible Pump Guide');
        cntStmt.run('CNT-706-T', 'Class 7 - Unit 6: Multi-Sensor Capstone (Teacher Master)', 'PDF', 'Level 5', '7', 'Trainer', '/materials/class7-unit6-teacher.pdf', 0, 'Level 5 Unit 6 Capstone Project Evaluation & Scorecard');

        // Class 8 Teacher Masters (Units 1 to 6)
        cntStmt.run('CNT-801-T', 'Class 8 - Unit 1: PWM Motor Control (Teacher Master)', 'PDF', null, '8', 'Trainer', '/materials/class8-unit1-teacher.pdf', 0, 'Instructor driver schematics and PWM waveform calibration guide');
        cntStmt.run('CNT-802-T', 'Class 8 - Unit 2: Ultrasonic Echo Mapping (Teacher Master)', 'PDF', 'Level 1', '8', 'Trainer', '/materials/class8-unit2-teacher.pdf', 0, 'Level 1 Unit 2 Instructor Echo Timing & Sonar Radar Guide');
        cntStmt.run('CNT-803-T', 'Class 8 - Unit 3: Bluetooth Remote Control (Teacher Master)', 'PDF', 'Level 2', '8', 'Trainer', '/materials/class8-unit3-teacher.pdf', 0, 'Level 2 Unit 3 HC-05 Wireless UART & App Command Parsing');
        cntStmt.run('CNT-804-T', 'Class 8 - Unit 4: PID Line Tracking (Teacher Master)', 'PDF', 'Level 3', '8', 'Trainer', '/materials/class8-unit4-teacher.pdf', 0, 'Level 3 Unit 4 PID Mathematical Model & Gain Tuning Rubric');
        cntStmt.run('CNT-805-T', 'Class 8 - Unit 5: IoT Cloud Data Logging (Teacher Master)', 'PDF', 'Level 4', '8', 'Trainer', '/materials/class8-unit5-teacher.pdf', 0, 'Level 4 Unit 5 Cloud Telemetry Dashboard Integration Guide');
        cntStmt.run('CNT-806-T', 'Class 8 - Unit 6: Combat Bot Capstone (Teacher Master)', 'PDF', 'Level 5', '8', 'Trainer', '/materials/class8-unit6-teacher.pdf', 0, 'Level 5 Unit 6 4WD Combat Bot Final Build & Defense Rubric');

        // Class 9 Teacher Masters (Units 1 to 6)
        cntStmt.run('CNT-901-T', 'Class 9 - Unit 1: ESP32 IoT Microcontrollers (Teacher Master)', 'PDF', null, '9', 'Trainer', '/materials/class9-unit1-teacher.pdf', 0, 'Instructor IoT toolchain and ESP-IDF/Arduino network architecture');
        cntStmt.run('CNT-902-T', 'Class 9 - Unit 2: HTTP & MQTT Cloud Protocols (Teacher Master)', 'PDF', 'Level 1', '9', 'Trainer', '/materials/class9-unit2-teacher.pdf', 0, 'Level 1 Unit 2 MQTT PubSub Broker & Cloud Gateway Lesson Plan');
        cntStmt.run('CNT-903-T', 'Class 9 - Unit 3: MPU6050 Gyro Sensor Fusion (Teacher Master)', 'PDF', 'Level 2', '9', 'Trainer', '/materials/class9-unit3-teacher.pdf', 0, 'Level 2 Unit 3 6-DOF IMU Complementary Filter Calculations');
        cntStmt.run('CNT-904-T', 'Class 9 - Unit 4: WebSockets & Cloud Actuation (Teacher Master)', 'PDF', 'Level 3', '9', 'Trainer', '/materials/class9-unit4-teacher.pdf', 0, 'Level 3 Unit 4 Bi-directional WebSocket Control Server Guide');
        cntStmt.run('CNT-905-T', 'Class 9 - Unit 5: Smart Campus IoT Architecture (Teacher Master)', 'PDF', 'Level 4', '9', 'Trainer', '/materials/class9-unit5-teacher.pdf', 0, 'Level 4 Unit 5 Mesh Gateway & Webhook Alert Automation');
        cntStmt.run('CNT-906-T', 'Class 9 - Unit 6: IoT Weather Station Capstone (Teacher Master)', 'PDF', 'Level 5', '9', 'Trainer', '/materials/class9-unit6-teacher.pdf', 0, 'Level 5 Unit 6 Full-Stack Industrial IoT Capstone Audit');

        // Class 11 Teacher Masters (Units 1 to 6)
        cntStmt.run('CNT-1101-T', 'Class 11 - Unit 1: Python OpenCV Vision (Teacher Master)', 'PDF', null, '11', 'Trainer', '/materials/class11-unit1-teacher.pdf', 0, 'Instructor camera pipeline, color space transforms and FPS optimization deck');
        cntStmt.run('CNT-1102-T', 'Class 11 - Unit 2: Object Contour Tracking (Teacher Master)', 'PDF', 'Level 1', '11', 'Trainer', '/materials/class11-unit2-teacher.pdf', 0, 'Level 1 Unit 2 Morphological Operations & Centroid Tracking Guide');
        cntStmt.run('CNT-1103-T', 'Class 11 - Unit 3: Haar Cascades Facial Recognition (Teacher Master)', 'PDF', 'Level 2', '11', 'Trainer', '/materials/class11-unit3-teacher.pdf', 0, 'Level 2 Unit 3 Haar Cascades Multi-Face Detection Pipeline Guide');
        cntStmt.run('CNT-1104-T', 'Class 11 - Unit 4: YOLOv8 Neural Object Detection (Teacher Master)', 'PDF', 'Level 3', '11', 'Trainer', '/materials/class11-unit4-teacher.pdf', 0, 'Level 3 Unit 4 Edge AI Deep Learning Inferencing Lesson Plan');
        cntStmt.run('CNT-1105-T', 'Class 11 - Unit 5: MediaPipe Edge AI Gesture Mapping (Teacher Master)', 'PDF', 'Level 4', '11', 'Trainer', '/materials/class11-unit5-teacher.pdf', 0, 'Level 4 Unit 5 21-Point Hand Landmark Detection & Command Mapping');
        cntStmt.run('CNT-1106-T', 'Class 11 - Unit 6: Vision AI Rover Capstone (Teacher Master)', 'PDF', 'Level 5', '11', 'Trainer', '/materials/class11-unit6-teacher.pdf', 0, 'Level 5 Unit 6 Autonomous Vision Surveillance Rover Defense Rubric');

        // Student Guides (Units 1 & 2 for student portal)
        cntStmt.run('CNT-601-S', 'Class 6 - Unit 1: Basic Circuits (Student Edition)', 'PDF', null, '6', 'Student', '/materials/class6-unit1-student-watermarked.pdf', 1, 'Foundational electronics, LEDs, breadboard wiring and series/parallel circuits');
        cntStmt.run('CNT-602-S', 'Class 6 - Unit 2: Sensors LDR & IR (Student Edition)', 'PDF', 'Level 1', '6', 'Student', '/materials/class6-unit2-student-watermarked.pdf', 1, 'Level 1 Unit 2 Light & Obstacle Sensor Manual with Circuit Schematics');
        cntStmt.run('CNT-701-S', 'Class 7 - Unit 1: C++ Fundamentals (Student Edition)', 'PDF', null, '7', 'Student', '/materials/class7-unit1-student-watermarked.pdf', 1, 'Logic structures, conditional statements, variables and microcontroller syntax');
        cntStmt.run('CNT-702-S', 'Class 7 - Unit 2: Analog Sensor Interfacing (Student Edition)', 'PDF', 'Level 1', '7', 'Student', '/materials/class7-unit2-student-watermarked.pdf', 1, 'Level 1 Unit 2 Analog vs Digital Sensors & Signal Interfacing');
        cntStmt.run('CNT-801-S', 'Class 8 - Unit 1: PWM Motor Control (Student Edition)', 'PDF', null, '8', 'Student', '/materials/class8-unit1-student-watermarked.pdf', 1, 'H-bridge motor drivers, duty cycles, speed modulation and differential steering');
        cntStmt.run('CNT-802-S', 'Class 8 - Unit 2: Ultrasonic Echo Mapping (Student Edition)', 'PDF', 'Level 1', '8', 'Student', '/materials/class8-unit2-student-watermarked.pdf', 1, 'Level 1 Unit 2 Ultrasonic Echo Mapping & Collision Prevention');
        cntStmt.run('CNT-901-S', 'Class 9 - Unit 1: ESP32 IoT Microcontrollers (Student Edition)', 'PDF', null, '9', 'Student', '/materials/class9-unit1-student-watermarked.pdf', 1, 'ESP32 Dual-Core architecture, Wi-Fi station setup and embedded web server');
        cntStmt.run('CNT-902-S', 'Class 9 - Unit 2: HTTP & MQTT Cloud Protocols (Student Edition)', 'PDF', 'Level 1', '9', 'Student', '/materials/class9-unit2-student-watermarked.pdf', 1, 'Level 1 Unit 2 Wi-Fi HTTP / MQTT Cloud Telemetry');
        cntStmt.run('CNT-1101-S', 'Class 11 - Unit 1: Python OpenCV Vision (Student Edition)', 'PDF', null, '11', 'Student', '/materials/class11-unit1-student-watermarked.pdf', 1, 'OpenCV matrix operations, video stream capture, color filters and convolutions');
        cntStmt.run('CNT-1102-S', 'Class 11 - Unit 2: Object Contour Tracking (Student Edition)', 'PDF', 'Level 1', '11', 'Student', '/materials/class11-unit2-student-watermarked.pdf', 1, 'Level 1 Unit 2 OpenCV Color Masking & Contour Object Tracking');

        cntStmt.finalize();

        // Structured Class Curriculum Plans (Units 1-6 mapped to Levels: Unit 1 Intro Level 0, Unit 2 Level 1, etc.)
        const curStmt = db.prepare("INSERT INTO curriculum VALUES (?, ?, ?, ?, ?, ?)");
        
        // Class 6
        curStmt.run('CUR-101', 'Unit 1', 'Level 0', 'Introduction to Electricity & Basic Circuits', 'Understand current, voltage, breadboards and series/parallel LEDs', 'Completed');
        curStmt.run('CUR-102', 'Unit 2', 'Level 1', 'Sensors: Light (LDR) & Obstacle (IR)', 'Analog vs digital inputs, calibration and sensor signal wiring', 'Upcoming');
        curStmt.run('CUR-103', 'Unit 3', 'Level 2', 'Actuators: Motors, Buzzers & Relays', 'Transistor switches, relay driver circuits, and sound actuation', 'Upcoming');
        curStmt.run('CUR-104', 'Unit 4', 'Level 3', 'Microcontroller (Arduino) Programming Basics', 'Digital output pin modes, delay timing, and serial monitor debugging', 'Upcoming');
        curStmt.run('CUR-105', 'Unit 5', 'Level 4', 'Project Building: Smart Obstacle Avoiding Rover', 'Assemble 2WD chassis, L298N motor driver, and ultrasonic avoidance algorithm', 'Upcoming');
        curStmt.run('CUR-106', 'Unit 6', 'Level 5', 'Capstone Project: Automated Smart Lab Environment', 'Final end-of-term presentation and smart automation build', 'Upcoming');

        // Class 7
        curStmt.run('CUR-201', 'Unit 1', 'Level 0', 'C++ Coding Fundamentals & Logic Gates', 'Microcontroller architecture, IDE setup, variables and conditional logic', 'Completed');
        curStmt.run('CUR-202', 'Unit 2', 'Level 1', 'Analog vs Digital Sensors & Signal Interfacing', 'ADC resolution, potentiometer voltage divider and threshold comparator', 'Upcoming');
        curStmt.run('CUR-203', 'Unit 3', 'Level 2', 'LCD Display & Sensor Data Visualization', 'I2C 16x2 LCD interface, custom character generation and live telemetry', 'Upcoming');
        curStmt.run('CUR-204', 'Unit 4', 'Level 3', 'Autonomous Line Follower Robotics', 'Dual IR reflectance arrays, Differential drive control and track optimization', 'Upcoming');
        curStmt.run('CUR-205', 'Unit 5', 'Level 4', 'Smart Irrigation & Environmental Telemetry', 'Soil moisture capacitive probes, submersible pump relay control', 'Upcoming');
        curStmt.run('CUR-206', 'Unit 6', 'Level 5', 'Capstone Project: Multi-Sensor Autonomous Rover', 'Integration of ultrasonic radar, line tracking, and autonomous pathfinding', 'Upcoming');

        // Class 8
        curStmt.run('CUR-301', 'Unit 1', 'Level 0', 'PWM Motor Control & High-Speed Steering', 'H-bridge motor drivers, PWM speed control and encoder feedback', 'Completed');
        curStmt.run('CUR-302', 'Unit 2', 'Level 1', 'Ultrasonic Echo Mapping & Collision Prevention', 'HC-SR04 pulse timing, servo radar sweep and distance mapping', 'Upcoming');
        curStmt.run('CUR-303', 'Unit 3', 'Level 2', 'Bluetooth Wireless Remote Teleoperation', 'HC-05 serial pairing, smartphone app control and command parsing', 'Upcoming');
        curStmt.run('CUR-304', 'Unit 4', 'Level 3', 'Advanced PID Line Follower System', 'Proportional-Integral-Derivative tuning for smooth high-speed curve navigation', 'Upcoming');
        curStmt.run('CUR-305', 'Unit 5', 'Level 4', 'IoT Sensor Logging & Real-time Web Monitoring', 'Cloud telemetry logging, sensor dashboard, and remote threshold alerting', 'Upcoming');
        curStmt.run('CUR-306', 'Unit 6', 'Level 5', 'Capstone Project: Bluetooth Combat / Surveillance Bot', 'High-torque 4WD chassis with wireless command link and modular payload', 'Upcoming');

        // Class 9
        curStmt.run('CUR-401', 'Unit 1', 'Level 0', 'ESP32 & Wireless IoT Microcontrollers', 'ESP32 architecture, Wi-Fi station mode, web server and telemetry', 'Completed');
        curStmt.run('CUR-402', 'Unit 2', 'Level 1', 'Wi-Fi HTTP / MQTT Cloud Telemetry', 'REST API webhooks, MQTT publish/subscribe pubsub broker integration', 'Upcoming');
        curStmt.run('CUR-403', 'Unit 3', 'Level 2', 'Advanced Sensor Fusion & Gyro / Accelerometer', 'MPU6050 I2C communication, pitch-roll angle filtering and stabilization', 'Upcoming');
        curStmt.run('CUR-404', 'Unit 4', 'Level 3', 'Web Dashboard Integration & Remote Relay Control', 'Interactive WebSocket control interface for remote industrial actuation', 'Upcoming');
        curStmt.run('CUR-405', 'Unit 5', 'Level 4', 'Smart Campus IoT Gateway Architecture', 'Multi-node sensor network with centralized coordinator hub', 'Upcoming');
        curStmt.run('CUR-406', 'Unit 6', 'Level 5', 'Capstone Project: Full-Stack IoT Weather Station & Surveillance', 'Solar powered weather sensing node sending telemetry to cloud dashboard', 'Upcoming');

        // Class 11
        curStmt.run('CUR-501', 'Unit 1', 'Level 0', 'Python for Computer Vision & Machine Intelligence', 'OpenCV basics, video stream capture, color masking and edge detection', 'Completed');
        curStmt.run('CUR-502', 'Unit 2', 'Level 1', 'OpenCV Color Masking & Contour Object Tracking', 'HSV color space calibration, morphological filters and centroid calculation', 'Upcoming');
        curStmt.run('CUR-503', 'Unit 3', 'Level 2', 'Haar Cascade Facial Recognition & Surveillance', 'Pretrained Haar cascades, multi-face tracking and attendance logging', 'Upcoming');
        curStmt.run('CUR-504', 'Unit 4', 'Level 3', 'YOLO Object Detection & Neural Network Inferencing', 'YOLOv8 deep learning model on edge devices, bounding box parsing', 'Upcoming');
        curStmt.run('CUR-505', 'Unit 5', 'Level 4', 'MediaPipe Edge AI Gesture Mapping', 'Hand landmark detection and gesture-controlled robotic actuation', 'Upcoming');
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
        
        billStmt.run('INV-ZPS-01', 'ZPS', 'Zenith Public School', 1, 'Tranche 1: Lab Setup & Hardware Kit Dispatch (40%)', 40000, 100000, '2026-08-01', '2026-09-15', null, null, 'Hata, Uttar Pradesh', 'Pending', null, 0);
        
        billStmt.run('INV-ZPS-02', 'ZPS', 'Zenith Public School', 2, 'Tranche 2: Mid-Term Curriculum Delivery & IoT Integration (30%)', 30000, 100000, '2026-08-25', '2026-10-15', null, null, 'Hata, Uttar Pradesh', 'Pending', null, 0);
        
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

        // Broadcast Notifications & Class Announcements
        const notifStmt = db.prepare("INSERT INTO notifications VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        notifStmt.run('NOTIF-001', 'All_Students', '6,7,8,9,11', 'All', '📢 Next Robotics Lab Class Scheduled', 'Dear Students & Faculty, the upcoming practical robotics session for Classes 6, 7, 8, 9, 11 will be held on Wednesday, 02 Sep 2026. Please ensure all student workbooks are brought to class.', 'next_class', 'Wednesday, 02 Sep 2026', '10:00 AM', 'info', 'Active', '2026-08-31 22:15:00', '2026-08-31 22:15:00');
        notifStmt.run('NOTIF-002', 'All_Students', '6,7,8,9,11', 'All', '📝 Unit 1 Revision & Circuit Viva Notice', 'Attention All Classes (6, 7, 8, 9, 11): Unit 1 concept revision and hands-on circuit viva checks will be held in the upcoming class. Please study the Unit 1 guides in your Student Portal.', 'revision', 'Wednesday, 02 Sep 2026', '11:00 AM', 'important', 'Active', '2026-08-31 22:16:00', '2026-08-31 22:16:00');
        notifStmt.run('NOTIF-003', 'All_Trainers', '6,7,8,9,11', 'TR-01', '🛠️ Trainer Directive: Prepare Level 1 Unit 2 Sensor Kits', 'Trainer Vikas Pandey: Please inspect and calibrate the LDR, IR and ultrasonic sensors for Classes 6A to 11A before Wednesday morning session.', 'kit_prep', 'Wednesday, 02 Sep 2026', '09:30 AM', 'urgent', 'Active', '2026-08-31 22:17:00', '2026-08-31 22:17:00');
        notifStmt.finalize();
      }
    });
  });
}

module.exports = db;
