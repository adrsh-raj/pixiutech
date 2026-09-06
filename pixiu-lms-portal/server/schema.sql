CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL, -- 'admin', 'trainer', 'student'
      related_id TEXT,
      name TEXT NOT NULL,
      school_id TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      principal TEXT,
      contact TEXT,
      status TEXT DEFAULT 'Active',
      contract_start TEXT,
      renewal_date TEXT,
      expected_revenue INTEGER DEFAULT 0
    );

CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      grade TEXT NOT NULL,
      section TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id)
    );

CREATE TABLE IF NOT EXISTS students (
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
    );

CREATE TABLE IF NOT EXISTS trainers (
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
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS sessions (
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
    );

CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (student_id) REFERENCES students(student_id),
      UNIQUE(session_id, student_id)
    );

CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      city TEXT,
      stage TEXT DEFAULT 'Contacted',
      expected_value INTEGER DEFAULT 0,
      notes TEXT,
      last_contact TEXT
    );

CREATE TABLE IF NOT EXISTS content (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'PDF',
      level TEXT DEFAULT 'Level 1',
      class_grade TEXT DEFAULT '6',
      target TEXT DEFAULT 'Student', -- 'Student' (Watermarked) | 'Trainer' (No Watermark)
      url TEXT,
      is_watermarked INTEGER DEFAULT 1,
      description TEXT
    );

CREATE TABLE IF NOT EXISTS curriculum (
      id TEXT PRIMARY KEY,
      week TEXT NOT NULL,
      level TEXT NOT NULL,
      topic TEXT NOT NULL,
      objectives TEXT NOT NULL,
      status TEXT DEFAULT 'Upcoming'
    );

CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT DEFAULT 'Level 1',
      school_id TEXT,
      assigned_student_id TEXT,
      status TEXT DEFAULT 'Healthy',
      last_checked TEXT,
      issue_notes TEXT
    );

CREATE TABLE IF NOT EXISTS billing (
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
    );

CREATE TABLE IF NOT EXISTS comms_logs (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      recipient TEXT NOT NULL,
      template TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'Delivered'
    );

CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'Completed',
      score INTEGER DEFAULT 10,
      evidence_note TEXT,
      image_url TEXT,
      date_completed TEXT,
      FOREIGN KEY (student_id) REFERENCES students(student_id)
    );

CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      related_id TEXT,
      action_label TEXT,
      action_type TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_classes TEXT,
      target_trainer_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      template_type TEXT,
      scheduled_date TEXT,
      scheduled_time TEXT,
      severity TEXT DEFAULT 'info',
      status TEXT DEFAULT 'Active',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      target_school_id TEXT,
      type TEXT DEFAULT 'announcement'
    );

CREATE TABLE IF NOT EXISTS audit_logs (
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
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS student_reviews (
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
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS notification_reads (
      id TEXT PRIMARY KEY,
      notification_id TEXT NOT NULL,
      user_key TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(notification_id, user_key)
    );

CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      class_grade TEXT NOT NULL,
      level TEXT NOT NULL,
      unit_code TEXT,
      duration_minutes INTEGER DEFAULT 10,
      total_marks INTEGER DEFAULT 10,
      created_by TEXT DEFAULT 'Pixiu Academic Faculty',
      status TEXT DEFAULT 'Active',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      question_order INTEGER DEFAULT 1,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      explanation TEXT NOT NULL,
      points INTEGER DEFAULT 2,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS quiz_submissions (
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
      answers_json TEXT,
      time_taken_seconds INTEGER DEFAULT 0,
      violation_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Completed',
      reattempt_allowed INTEGER DEFAULT 0,
      completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(quiz_id, student_id)
    );

CREATE TABLE IF NOT EXISTS _pixiu_migrations (
  id TEXT PRIMARY KEY,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_school_role ON users (school_id, role);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes (school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students (school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_school_date ON sessions (school_id, date);
CREATE INDEX IF NOT EXISTS idx_sessions_class_date ON sessions (class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads (stage);
CREATE INDEX IF NOT EXISTS idx_content_grade_level ON content (class_grade, level);
CREATE INDEX IF NOT EXISTS idx_inventory_school_status ON inventory (school_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_student ON inventory (assigned_student_id);
CREATE INDEX IF NOT EXISTS idx_billing_school_status ON billing (school_id, status);
CREATE INDEX IF NOT EXISTS idx_comms_student_sent ON comms_logs (student_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_projects_student ON projects (student_id);
CREATE INDEX IF NOT EXISTS idx_alerts_read_created ON alerts (is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_school_status ON notifications (target_school_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_schedule ON notifications (scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_school_created ON audit_logs (school_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_student_created ON student_reviews (student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads (user_key, created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_order ON quiz_questions (quiz_id, question_order);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student ON quiz_submissions (student_id, completed_at);
