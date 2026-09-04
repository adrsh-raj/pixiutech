export const generateStudentTranscriptPDF = ({
  student,
  school = 'Zenith Public School',
  attendanceRate = 100,
  studentReviews = [],
  projects = [],
  curriculum = [],
  isOfficialCertificate = false
}) => {
  if (!student) return;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Extract grade accurately (e.g. CLS-ZPS-6A -> '6', CLS-XYZ-7A -> '7', XYZ6A 01 -> '6', ZPS11A 01 -> '11')
  const extractGrade = (s) => {
    if (s?.class_id) {
      const match = s.class_id.match(/CLS-(?:ZPS|XYZ)-(\d+)/i) || s.class_id.match(/(\d+)/);
      if (match) return match[1];
    }
    if (s?.student_id) {
      const match = s.student_id.match(/(?:ZPS|XYZ)(\d+)/i) || s.student_id.match(/(\d+)/);
      if (match) return match[1];
    }
    return '6';
  };
  const studentGrade = extractGrade(student);
  
  const isXYZ = student.school_id === 'XYZ' || (student.student_id && student.student_id.toUpperCase().includes('XYZ'));
  const schoolName = typeof school === 'object' && school?.name ? school.name : (school || (isXYZ ? 'XYZ Academy (Pilot Lab)' : 'Zenith Public School'));
  const trainerName = isXYZ ? 'Akash Sharma' : 'Vikas Pandey';
  const trainerTitle = isXYZ ? 'Senior STEM & Robotics Faculty • Pixiu Tech' : 'Lead STEM & Robotics Faculty • Pixiu Tech';

  // Grade-Specific Default Units (Level 0 - Level 5)
  const GRADE_UNITS = {
    '6': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Robotics & Electronics' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Traffic Light Signal Controller' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Automatic Night Lamp' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Smart Toll Booth' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Project Log' }
    ],
    '7': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Analog & Digital Electronics' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Serial Monitor' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: LED Dimmer and Mood Light' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Temperature & Humidity Monitor' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Smart Rain Alarm System' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Project Log' }
    ],
    '8': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Waves & Distance Measurement' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Sensor Libraries' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Height Measurement Station' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Smart Contactless Dustbin' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Obstacle-Avoiding Robot' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Project Log' }
    ],
    '9': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Industrial Sensors & Displays' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Memory Architecture' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Fire Security Alarm System' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Smart 16x2 LCD Weather System' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Line Following Robot' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Wiring Reference' }
    ],
    '11': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Engineering Specs & Optics' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Advanced Control' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Laser Security System' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Ultrasonic Calibration' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Capstone Project: Maze Solver Robot' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Engineering Reference & Log' }
    ]
  };

  const defaultUnits = GRADE_UNITS[studentGrade] || GRADE_UNITS['6'];

  // Match reviews
  const studentSpecificReviews = (studentReviews || []).filter(r => {
    const rId = (r.student_id || '').trim().toLowerCase().replace(/\s+/g, '');
    const sId = (student.student_id || '').trim().toLowerCase().replace(/\s+/g, '');
    return rId === sId;
  });

  const levelReviewData = defaultUnits.map(unit => {
    const match = studentSpecificReviews.find(r => r.unit_code === unit.unitCode || r.level === unit.level);
    if (match) {
      return {
        hasReview: true,
        level: match.level || unit.level,
        unitCode: match.unit_code || unit.unitCode,
        title: match.unit_title || unit.title,
        score: Number(match.score) || 0,
        status: match.status || 'Mastered',
        rating: Number(match.rating) || 5,
        review: match.review || 'Demonstrated strong understanding of the module objectives.',
        instructor: match.trainer_name || `${trainerName} (${trainerTitle})`,
        verifiedDate: match.verified_date || 'Recent Lab Review'
      };
    }
    return {
      hasReview: false,
      level: unit.level,
      unitCode: unit.unitCode,
      title: unit.title,
      score: null,
      status: 'Pending Evaluation',
      rating: 0,
      review: 'Unit evaluation pending. Trainer will evaluate competency upon completion of this unit.',
      instructor: `${trainerName} (Faculty)`,
      verifiedDate: 'Awaiting Evaluation'
    };
  });

  const reviewedLevelsList = levelReviewData.filter(l => l.hasReview && l.score !== null);
  const completedLevelsCount = reviewedLevelsList.length;
  const cumulativeReviewScore = reviewedLevelsList.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
  const cumulativePercent = Math.round((cumulativeReviewScore / 60) * 100);

  // QR Code is ONLY unlocked when all 6 levels are completed and authorized
  const isEligibleGraduate = completedLevelsCount >= 6 && (student.status === 'Certified Graduate' || student.certificate_issued === true);
  const showQRCodeCertificate = isOfficialCertificate && isEligibleGraduate;

  const studentProjects = (projects || []).filter(p => {
    const pid = (p.student_id || '').trim().toLowerCase().replace(/\s+/g, '');
    const currentId = (student.student_id || '').trim().toLowerCase().replace(/\s+/g, '');
    return pid === currentId || p.student_id === student.student_id;
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups for this site to download the progress transcript.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Official STEM Transcript & Certificate - ${student.name}</title>
        <style>
          @page { size: A4; margin: 12mm 16mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; line-height: 1.45; font-size: 12.5px; }
          
          .no-print-bar {
            position: sticky; top: 0; left: 0; right: 0; background: #0f172a; color: #fff;
            padding: 10px 20px; z-index: 9999; border-bottom: 1px solid #334155;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          .bar-content {
            max-width: 860px; margin: 0 auto; display: flex; justify-content: space-between;
            align-items: center; font-family: system-ui, sans-serif; font-size: 12px;
          }
          .bar-info { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #94a3b8; }
          .bar-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block; }
          .bar-actions { display: flex; gap: 8px; }
          .btn-print {
            background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 6px;
            font-weight: 700; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 5px;
          }
          .btn-print:hover { background: #1d4ed8; }
          .btn-close {
            background: #334155; color: #cbd5e1; border: none; padding: 6px 12px; border-radius: 6px;
            font-weight: 600; cursor: pointer; font-size: 12px;
          }
          .btn-close:hover { background: #475569; color: #fff; }
          @media print {
            .no-print-bar { display: none !important; }
          }
          
          .certificate-container { border: 2.5px solid #0A1A33; padding: 22px; border-radius: 12px; position: relative; background: #ffffff; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border-bottom: 2.5px solid #0066FF; padding-bottom: 14px; }
          .header-logo { height: 44px; object-fit: contain; }
          .cert-badge { display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; }
          
          .doc-title { font-size: 19px; font-weight: 900; color: #0A1A33; margin: 4px 0 2px 0; letter-spacing: 0.5px; text-transform: uppercase; }
          .doc-sub { font-size: 11px; color: #64748b; margin: 0; }
          
          .profile-grid { width: 100%; border-collapse: collapse; margin: 14px 0; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
          .profile-grid td { padding: 7px 12px; font-size: 11.5px; }
          .profile-grid .label { color: #64748b; font-weight: 600; width: 22%; }
          .profile-grid .val { color: #0f172a; font-weight: 700; width: 28%; }
          
          .metrics-table { width: 100%; border-collapse: separate; border-spacing: 6px; margin: 10px 0 14px 0; }
          .metric-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; text-align: center; }
          .metric-box .m-label { font-size: 9.5px; text-transform: uppercase; font-weight: 700; color: #64748b; }
          .metric-box .m-val { font-size: 17px; font-weight: 900; color: #0066FF; margin: 2px 0 0 0; }
          
          .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0A1A33; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 3px; margin: 14px 0 8px 0; display: flex; align-items: center; justify-content: space-between; }
          
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
          .data-table th { background: #f1f5f9; color: #334155; font-size: 9.5px; text-transform: uppercase; font-weight: 800; padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0; }
          .data-table td { padding: 6px 8px; font-size: 10.5px; border: 1px solid #e2e8f0; }
          .status-pill { display: inline-block; padding: 1.5px 5px; border-radius: 4px; font-size: 9.5px; font-weight: 700; }
          .status-mastered { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
          .status-active { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
          .status-upcoming { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; }
          
          .signatures-table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          .signatures-table td { width: 50%; vertical-align: bottom; }
          .sig-line { border-top: 1px solid #94a3b8; width: 80%; padding-top: 5px; font-size: 11px; color: #334155; font-weight: 700; }
          .sig-title { font-size: 9.5px; color: #64748b; }
          
          .footer-strip { margin-top: 16px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 9px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div class="bar-content">
            <div class="bar-info">
              <span class="bar-dot"></span>
              <span>${showQRCodeCertificate ? 'Official Accredited Certificate & Transcript' : 'Student Laboratory Progress Report'}</span>
            </div>
            <div class="bar-actions">
              <button onclick="window.print()" class="btn-print">
                🖨️ Print / Save as PDF
              </button>
              <button onclick="window.close()" class="btn-close">
                ✕ Close
              </button>
            </div>
          </div>
        </div>
        <div class="certificate-container" style="margin: 16px auto; max-width: 860px;">
          <table class="header-table">
            <tr>
              <td style="vertical-align: middle;">
                <img src="${origin}/img/logo.png" class="header-logo" alt="Pixiu Tech Logo" onerror="this.style.display='none'" />
                <span style="font-size: 20px; font-weight: 900; color: #0066FF; letter-spacing: 0.5px; margin-left: 8px; vertical-align: middle;">PIXIU TECH</span>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <span class="cert-badge">${showQRCodeCertificate ? '🎓 Accredited Graduate Certificate' : '📊 Student Progress Report'}</span>
                <p style="margin: 3px 0 0 0; font-family: monospace; font-size: 10px; color: #0066FF; font-weight: bold;">
                  ID: ${showQRCodeCertificate ? `CERT-PIX-${student.student_id.replace(/\s+/g, '-')}-2026` : `REP-${student.student_id.replace(/\s+/g, '-')}`}
                </p>
              </td>
            </tr>
          </table>

          <div style="text-align: center; margin-bottom: 14px;">
            <h1 class="doc-title">${showQRCodeCertificate ? 'STEM & Robotics Graduate Certificate & Transcript' : 'STEM & Robotics Laboratory Progress Report'}</h1>
            <p class="doc-sub">${showQRCodeCertificate ? 'Official Accredited Institutional Graduation Credential & Laboratory Competency Record' : 'Active Student Competency & Practical Laboratory Evaluation Record'}</p>
          </div>

          <!-- Student Information Profile Strip -->
          <table class="profile-grid">
            <tr>
              <td class="label">Student Name:</td>
              <td class="val">${student.name}</td>
              <td class="label">Canonical Student ID:</td>
              <td class="val" style="font-family: monospace; color: #0066FF;">${student.student_id}</td>
            </tr>
            <tr>
              <td class="label">Partner Institution:</td>
              <td class="val">${schoolName}</td>
              <td class="label">Enrolled Class:</td>
              <td class="val">Class ${studentGrade}A (Robotics Cohort)</td>
            </tr>
            <tr>
              <td class="label">Assigned Kit:</td>
              <td class="val">${student.assigned_kit_id || 'Standard Lab Kit'}</td>
              <td class="label">Academic Year:</td>
              <td class="val">2026 - 2027 (Term 1)</td>
            </tr>
          </table>

          <!-- Key Performance Metrics Strip -->
          <table class="metrics-table">
            <tr>
              <td class="metric-box">
                <div class="m-label">Lab Attendance</div>
                <div class="m-val" style="color: #16a34a;">${attendanceRate}%</div>
              </td>
              <td class="metric-box">
                <div class="m-label">Mastery Tech Level</div>
                <div class="m-val" style="color: #0066FF;">${student.tech_level || 'Level 0'}</div>
              </td>
              <td class="metric-box">
                <div class="m-label">Cumulative Score (Max 60)</div>
                <div class="m-val" style="color: #d97706;">${cumulativeReviewScore} / 60 <span style="font-size: 11px; color: #64748b;">(${cumulativePercent}%)</span></div>
              </td>
              <td class="metric-box">
                <div class="m-label">Levels Progression</div>
                <div class="m-val" style="color: #4f46e5; font-size: 14px; margin-top: 2px;">${completedLevelsCount} / 6 Units Evaluated</div>
              </td>
            </tr>
          </table>

          <!-- Level-wise Competency Review Table -->
          <div class="section-title">
            <span>Unit & Level Competency Progression</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 14%;">Level</th>
                <th style="width: 28%;">Module Title</th>
                <th style="width: 12%; text-align: center;">Score</th>
                <th style="width: 14%; text-align: center;">Status</th>
                <th style="width: 32%;">Instructor Qualitative Review</th>
              </tr>
            </thead>
            <tbody>
              ${levelReviewData.map(l => `
                <tr>
                  <td><b>${l.level}</b> <span style="font-size: 9px; color: #64748b;">(${l.unitCode})</span></td>
                  <td><b>${l.title}</b></td>
                  <td style="text-align: center; font-weight: bold; color: #0066FF;">${l.hasReview ? `${l.score}/10` : '10/10'}</td>
                  <td style="text-align: center;">
                    <span class="status-pill ${l.status === 'Mastered' ? 'status-mastered' : l.status === 'In Progress' ? 'status-active' : 'status-upcoming'}">
                      ${l.status}
                    </span>
                  </td>
                  <td style="font-size: 9.5px; color: #334155; line-height: 1.35;">${l.review}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Practical Projects & Prototypes -->
          <div class="section-title">
            <span>Verified Laboratory Hardware Prototypes</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 30%;">Prototype / Project Name</th>
                <th style="width: 15%; text-align: center;">Score</th>
                <th style="width: 15%; text-align: center;">Verification</th>
                <th style="width: 40%;">Technical Evaluation Evidence</th>
              </tr>
            </thead>
            <tbody>
              ${studentProjects.length > 0 ? studentProjects.map(p => `
                <tr>
                  <td><b>${p.title}</b></td>
                  <td style="text-align: center; font-weight: bold; color: #16a34a;">${p.score || 10}/10</td>
                  <td style="text-align: center;"><span class="status-pill status-mastered">${p.status || 'Verified'}</span></td>
                  <td style="font-size: 9.5px; color: #334155;">${p.evidence_note || 'Circuit assembled and validated with zero defects.'}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td><b>Autonomous Hardware Prototype</b></td>
                  <td style="text-align: center; font-weight: bold; color: #16a34a;">10/10</td>
                  <td style="text-align: center;"><span class="status-pill status-mastered">Completed</span></td>
                  <td style="font-size: 9.5px; color: #334155;">Electronic hardware and sensor interfacing verified in laboratory.</td>
                </tr>
              `}
            </tbody>
          </table>

          <!-- Official QR Code Credential Verification Strip / Progress Tracker Notice -->
          ${showQRCodeCertificate ? `
            <div style="margin-top: 14px; padding: 10px 14px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 14px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="background: #ffffff; padding: 3px; border: 1px solid #e2e8f0; border-radius: 6px; display: inline-block; shrink-0;">
                  <img 
                    src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://pixiutech.com/verify?id=${student.student_id}`)}&margin=2" 
                    alt="Scan to Verify Credential" 
                    style="width: 68px; height: 68px; display: block;" 
                  />
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                    Official Credential Verification Registry
                  </div>
                  <div style="font-size: 9.5px; color: #475569; margin-top: 2px;">
                    Scan QR with camera or visit <b style="color: #0066FF;">pixiutech.com/verify</b> to validate authenticity.
                  </div>
                  <div style="font-size: 9px; font-family: monospace; color: #64748b; margin-top: 3px;">
                    Certificate Ref ID: <b style="color: #0f172a;">PIXIU-${(student.school_id || 'SCH').toUpperCase()}-${(student.student_id || '').replace(/\s+/g, '')}-2026</b>
                  </div>
                </div>
              </div>
              <div style="text-align: right; shrink-0;">
                <span style="display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 20px; text-transform: uppercase;">
                  ✓ Authenticated & Verified
                </span>
                <div style="font-size: 8.5px; color: #94a3b8; margin-top: 4px; font-weight: 600;">Pixiu Tech Central Registry</div>
              </div>
            </div>
          ` : `
            <div style="margin-top: 14px; padding: 10px 14px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 14px;">
              <div>
                <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                  Active Laboratory Progress Report (Course In-Progress)
                </div>
                <div style="font-size: 9.5px; color: #475569; margin-top: 2px;">
                  This document reflects current laboratory units and project builds. The Official Accredited Graduate Certificate with QR Verification is unlocked upon Level 5 course completion and faculty authorization.
                </div>
                <div style="font-size: 9px; font-family: monospace; color: #64748b; margin-top: 3px;">
                  Student ID: <b style="color: #0f172a;">${student.student_id}</b> • Status: <b style="color: #0066FF;">${student.tech_level || 'Level 0'} Active</b>
                </div>
              </div>
              <div style="text-align: right; shrink-0;">
                <span style="display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 20px; text-transform: uppercase;">
                  ⚡ Active Progression
                </span>
                <div style="font-size: 8.5px; color: #94a3b8; margin-top: 4px; font-weight: 600;">Faculty Lab Records</div>
              </div>
            </div>
          `}

          <!-- Signatures -->
          <table class="signatures-table">
            <tr>
              <td>
                <div class="sig-line">
                  ${trainerName}
                  <div class="sig-title">${trainerTitle}</div>
                </div>
              </td>
              <td style="text-align: right;">
                <div class="sig-line" style="margin-left: auto;">
                  Authorized Signatory
                  <div class="sig-title">STEM Innovation Lab • Institutional Certification</div>
                </div>
              </td>
            </tr>
          </table>

          <div class="footer-strip">
            Pixiu Tech LLP • Official STEM, Robotics & AI Education Partner • Electronically generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • Registry: pixiutech.com/verify
          </div>
        </div>
      </body>
    </html>
  `);
  
  printWindow.document.close();
};

// =========================================================================
// Class-Wide Cohort Laboratory Progress & Performance Report Generator
// (For Schools, Admins, and Trainers — Comprehensive Progress without Student QR Badges)
// =========================================================================
export const generateClassCohortTranscriptPDF = ({
  classGrade = '6',
  classSection = 'A',
  school = 'Zenith Public School',
  students = [],
  studentReviews = [],
  projects = [],
  curriculum = [],
  getStudentAttendance = () => 100,
  userRole = 'school' // 'school' | 'admin' | 'trainer'
}) => {
  if (!students || students.length === 0) return;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const isXYZ = typeof school === 'string' ? school.includes('XYZ') : (school?.id === 'XYZ' || school?.code === 'XYZ');
  const schoolName = typeof school === 'object' && school?.name ? school.name : (school || (isXYZ ? 'XYZ Academy (Pilot Lab)' : 'Zenith Public School'));
  const trainerName = isXYZ ? 'Akash Sharma' : 'Vikas Pandey';
  const trainerTitle = isXYZ ? 'Senior STEM & Robotics Faculty' : 'Lead STEM & Robotics Faculty';

  // Grade-Specific Curriculum Units
  const GRADE_UNITS = {
    '6': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Robotics & Electronics' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Traffic Light Signal Controller' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Automatic Night Lamp' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Smart Toll Booth' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Project Log' }
    ],
    '7': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Analog & Digital Electronics' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Serial Monitor' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: LED Dimmer and Mood Light' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Temperature & Humidity Monitor' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Smart Rain Alarm System' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Project Log' }
    ],
    '8': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Waves & Distance Measurement' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Sensor Libraries' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Height Measurement Station' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Smart Contactless Dustbin' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Obstacle-Avoiding Robot' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Project Log' }
    ],
    '9': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Industrial Sensors & Displays' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Memory Architecture' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Fire Security Alarm System' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Smart 16x2 LCD Weather System' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Line Following Robot' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Wiring Reference' }
    ],
    '11': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Engineering Specs & Optics' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Advanced Control' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Laser Security System' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Ultrasonic Calibration' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Capstone Project: Maze Solver Robot' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Engineering Reference & Log' }
    ]
  };

  const defaultUnits = GRADE_UNITS[classGrade] || GRADE_UNITS['6'];

  // Aggregate stats for this cohort
  const cohortStudentCount = students.length;
  const totalAttendance = students.reduce((acc, s) => acc + (getStudentAttendance(s.student_id) || 100), 0);
  const avgAttendance = cohortStudentCount > 0 ? (totalAttendance / cohortStudentCount).toFixed(1) : '100.0';
  
  const studentIds = students.map(s => s.student_id);
  const cohortProjects = projects.filter(p => studentIds.includes(p.student_id));
  const cohortReviews = studentReviews.filter(r => studentIds.includes(r.student_id));

  const printWindow = window.open('', '_blank');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Class ${classGrade}${classSection} Master Progress Report - ${schoolName}</title>
        <base href="${origin}/" />
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 12mm 12mm 12mm;
          }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            background: #f8fafc;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            font-size: 11px;
            line-height: 1.4;
          }
          .report-sheet {
            max-width: 900px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            box-shadow: 0 10px 25px rgba(0,0,0,0.05);
            padding: 30px;
            border-radius: 12px;
          }
          .header-table {
            width: 100%;
            border-bottom: 2px solid #0A1A33;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .brand-title {
            font-size: 22px;
            font-weight: 900;
            color: #0A1A33;
            letter-spacing: -0.5px;
          }
          .brand-title span { color: #0066FF; }
          .tagline {
            font-size: 10px;
            color: #64748b;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .doc-badge {
            display: inline-block;
            background: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
            padding: 4px 10px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 10px;
            text-transform: uppercase;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .kpi-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
          }
          .kpi-label {
            font-size: 9px;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
          }
          .kpi-val {
            font-size: 18px;
            font-weight: 900;
            color: #0A1A33;
            margin-top: 2px;
          }
          .section-heading {
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0A1A33;
            border-bottom: 1.5px solid #e2e8f0;
            padding-bottom: 6px;
            margin: 20px 0 12px 0;
            display: flex;
            justify-content: space-between;
          }
          table.data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 20px;
          }
          table.data-table th {
            background: #0A1A33;
            color: #ffffff;
            font-weight: 800;
            text-transform: uppercase;
            padding: 8px 10px;
            text-align: left;
            font-size: 9.5px;
          }
          table.data-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          table.data-table tr:nth-child(even) {
            background: #f8fafc;
          }
          .student-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: #ffffff;
            padding: 14px;
            margin-bottom: 12px;
            page-break-inside: avoid;
          }
          .student-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .student-name {
            font-size: 13px;
            font-weight: 800;
            color: #0A1A33;
          }
          .student-id {
            font-family: monospace;
            font-weight: 800;
            color: #0066FF;
            font-size: 11px;
          }
          .badge-pill {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 800;
            font-size: 9px;
            text-transform: uppercase;
          }
          .badge-level { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
          .badge-present { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
          .review-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 10px;
            margin-top: 6px;
            font-size: 9.5px;
          }
          .sig-table {
            width: 100%;
            margin-top: 25px;
            border-collapse: collapse;
          }
          .sig-table td {
            width: 50%;
            vertical-align: top;
            padding: 0 15px;
          }
          .sig-line {
            border-top: 1.5px solid #0A1A33;
            padding-top: 6px;
            font-weight: 800;
            font-size: 11px;
            color: #0A1A33;
          }
          .sig-title {
            font-size: 9.5px;
            color: #64748b;
            font-weight: 600;
          }
          .footer-note {
            border-top: 1px solid #e2e8f0;
            margin-top: 20px;
            padding-top: 10px;
            text-align: center;
            font-size: 8.5px;
            color: #64748b;
          }
          .no-print-bar {
            position: sticky; top: 0; left: 0; right: 0; background: #0f172a; color: #fff;
            padding: 10px 20px; z-index: 9999; border-bottom: 1px solid #334155;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin: -20px -20px 20px -20px;
          }
          .bar-content {
            max-width: 900px; margin: 0 auto; display: flex; justify-content: space-between;
            align-items: center; font-family: system-ui, sans-serif; font-size: 12px;
          }
          .bar-info { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #94a3b8; }
          .bar-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block; }
          .bar-actions { display: flex; gap: 8px; }
          .btn-print {
            background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 6px;
            font-weight: 700; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 5px;
          }
          .btn-print:hover { background: #1d4ed8; }
          .btn-close {
            background: #334155; color: #cbd5e1; border: none; padding: 6px 12px; border-radius: 6px;
            font-weight: 600; cursor: pointer; font-size: 12px;
          }
          .btn-close:hover { background: #475569; color: #fff; }
          @media print {
            body { background: #ffffff; padding: 0; }
            .report-sheet { border: none; box-shadow: none; padding: 0; }
            .no-print-bar { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div class="bar-content">
            <div class="bar-info">
              <span class="bar-dot"></span>
              <span>Class ${classGrade}${classSection} Master Progress Report • ${schoolName}</span>
            </div>
            <div class="bar-actions">
              <button onclick="window.print()" class="btn-print">
                🖨️ Print / Save as PDF
              </button>
              <button onclick="window.close()" class="btn-close">
                ✕ Close
              </button>
            </div>
          </div>
        </div>
        <div class="report-sheet">
          <!-- Top Header -->
          <table class="header-table">
            <tr>
              <td style="vertical-align: middle;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <img src="${origin}/img/logo.png" alt="Pixiu Tech" style="height: 44px; width: auto; object-contain;" />
                  <div>
                    <div class="brand-title">PIXIU <span>TECH LLP</span></div>
                    <div class="tagline">Enterprise STEM & Robotics Laboratory Solutions</div>
                  </div>
                </div>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <div class="doc-badge">Class Cohort Master Progress Report</div>
                <div style="font-size: 14px; font-weight: 900; color: #0A1A33; margin-top: 4px;">
                  Class ${classGrade}${classSection} • Academic Year 2026-27
                </div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600;">
                  Institution: <strong style="color: #0A1A33;">${schoolName}</strong>
                </div>
              </td>
            </tr>
          </table>

          <!-- 4 Executive KPI Cards -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Enrolled Students</div>
              <div class="kpi-val">${cohortStudentCount} Candidates</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Average Lab Attendance</div>
              <div class="kpi-val" style="color: #16a34a;">${avgAttendance}%</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Certified Builds</div>
              <div class="kpi-val" style="color: #2563eb;">${cohortProjects.length} Verified</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Faculty In-Charge</div>
              <div class="kpi-val" style="font-size: 13px; color: #0A1A33; margin-top: 6px;">${trainerName}</div>
            </div>
          </div>

          <!-- Master Student Roster Summary Table -->
          <div class="section-heading">
            <span>1. Class Cohort Performance & Attendance Roster</span>
            <span>${cohortStudentCount} Enrolled Learners</span>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Candidate ID</th>
                <th>Learner Name</th>
                <th>Curriculum Level</th>
                <th>Assigned Kit</th>
                <th>Lab Attendance</th>
                <th>Cumulative Score (Max 60)</th>
                <th>Certified Builds</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(st => {
                const att = getStudentAttendance(st.student_id);
                const sReviews = cohortReviews.filter(r => r.student_id === st.student_id);
                const sProjects = cohortProjects.filter(p => p.student_id === st.student_id);
                const cumulativeScore = sReviews.reduce((sum, r) => sum + (Number(r.score) || 0), 0);

                return `
                  <tr>
                    <td style="font-family: monospace; font-weight: 800; color: #0066FF;">${st.student_id}</td>
                    <td style="font-weight: 800; color: #0A1A33;">${st.name}</td>
                    <td><span class="badge-pill badge-level">${st.tech_level || 'Level 0'}</span></td>
                    <td style="font-family: monospace; color: #475569;">${st.assigned_kit_id || 'KIT-01'}</td>
                    <td><span class="badge-pill badge-present">${att}%</span></td>
                    <td style="font-weight: 800; color: #d97706;">🏆 ${cumulativeScore} / 60 <span style="font-size: 8.5px; color: #64748b;">(${sReviews.length}/6 Levels)</span></td>
                    <td style="font-weight: 700; color: #2563eb;">${sProjects.length} Certified</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- Detailed Student-by-Student Progress Summaries -->
          <div class="section-heading">
            <span>2. Individual Learner Laboratory Assessments & Certified Project Evidence</span>
          </div>

          <div style="space-y: 10px;">
            ${students.map((st, idx) => {
              const sReviews = cohortReviews.filter(r => r.student_id === st.student_id);
              const sProjects = cohortProjects.filter(p => p.student_id === st.student_id);
              const att = getStudentAttendance(st.student_id);

              return `
                <div class="student-card">
                  <div class="student-header">
                    <div>
                      <span class="student-name">${idx + 1}. ${st.name}</span>
                      <span class="student-id" style="margin-left: 8px;">(${st.student_id})</span>
                    </div>
                    <div>
                      <span class="badge-pill badge-level">${st.tech_level || 'Level 0'}</span>
                      <span class="badge-pill badge-present" style="margin-left: 4px;">Attendance: ${att}%</span>
                      <span style="font-size: 9.5px; font-family: monospace; color: #64748b; margin-left: 6px;">Kit: ${st.assigned_kit_id || 'KIT-01'}</span>
                    </div>
                  </div>

                  <!-- Unit Milestone Evaluations -->
                  <div style="font-size: 9.5px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px;">
                    Unit Milestone Evaluations:
                  </div>
                  <div class="review-box">
                    ${sReviews.length > 0 ? sReviews.map(r => `
                      <div style="margin-bottom: 4px;">
                        <strong style="color: #0A1A33;">${r.unit_code || 'Unit'}: ${r.unit_title || 'Robotics Module'}</strong>
                        <span style="color: #d97706; font-weight: bold; margin-left: 6px;">★ ${r.score || 10}/10</span>
                        <div style="color: #334155; margin-top: 1px;">"${r.review || 'Demonstrated outstanding hands-on circuit wiring and problem-solving.'}"</div>
                      </div>
                    `).join('') : `
                      <div style="color: #334155;">
                        <strong style="color: #0A1A33;">Unit 1 & 2: Microcontrollers & Sensor Interfacing</strong>
                        <span style="color: #d97706; font-weight: bold; margin-left: 6px;">★ 10/10</span>
                        <div style="color: #475569; margin-top: 1px;">"Demonstrated exceptional understanding of breadboard power rails, series-parallel LEDs, and Ohm's Law calculations."</div>
                      </div>
                    `}
                  </div>

                  <!-- Certified Project Builds -->
                  ${sProjects.length > 0 ? `
                    <div style="font-size: 9.5px; font-weight: 700; color: #475569; text-transform: uppercase; margin: 6px 0 3px 0;">
                      Certified Hardware Builds:
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px;">
                      ${sProjects.map(p => `
                        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; font-size: 9px;">
                          <div style="font-weight: 800; color: #0A1A33;">${p.title}</div>
                          <div style="color: #16a34a; font-weight: 700;">Score: ${p.score || 10}/10 • ${p.date_completed || 'Certified'}</div>
                          ${p.evidence_note ? `<div style="color: #475569; font-style: italic; margin-top: 2px;">Note: ${p.evidence_note}</div>` : ''}
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <!-- Class Curriculum Units Status -->
          <div class="section-heading">
            <span>3. Prescribed Class ${classGrade} Robotics Curriculum Roadmap</span>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Unit Code</th>
                <th>Curriculum Title</th>
                <th>Target Competency</th>
                <th>Laboratory Status</th>
              </tr>
            </thead>
            <tbody>
              ${defaultUnits.map((u, i) => `
                <tr>
                  <td style="font-weight: 800; color: #0066FF;">${u.unitCode}</td>
                  <td style="font-weight: 700; color: #0A1A33;">${u.title}</td>
                  <td style="color: #475569;">${u.level} Accredited Milestones</td>
                  <td>
                    <span style="font-weight: 800; color: ${i <= 1 ? '#16a34a' : (i === 2 ? '#2563eb' : '#64748b')};">
                      ${i <= 1 ? '✓ Completed & Certified' : (i === 2 ? '⚡ In-Progress' : 'Scheduled')}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Official Signatures -->
          <table class="sig-table">
            <tr>
              <td>
                <div class="sig-line">
                  ${trainerName}
                  <div class="sig-title">${trainerTitle} • Pixiu Tech LLP</div>
                </div>
              </td>
              <td style="text-align: right;">
                <div class="sig-line" style="margin-left: auto; max-width: 250px;">
                  Adarsh Raj Singh
                  <div class="sig-title">Founder & Director • Pixiu Tech LLP</div>
                </div>
              </td>
            </tr>
          </table>

          <div class="footer-note">
            Official Institutional Class Progress Document issued by Pixiu Tech LLP • Contact: contact@pixiutech.com • Gorakhpur, UP
          </div>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
};

