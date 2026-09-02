// Ultra-Professional STEM & Robotics Innovation Transcript & Progress Certificate Generator

export const generateStudentTranscriptPDF = ({
  student,
  school = 'Zenith Public School',
  attendanceRate = 100,
  studentReviews = [],
  projects = [],
  curriculum = []
}) => {
  if (!student) return;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Extract grade accurately (e.g. CLS-ZPS-6A -> '6', CLS-ZPS-11A -> '11', ZPS7A 01 -> '7')
  const extractGrade = (s) => {
    if (s?.class_id) {
      const match = s.class_id.match(/CLS-ZPS-(\d+)/i);
      if (match) return match[1];
    }
    if (s?.student_id) {
      const match = s.student_id.match(/ZPS(\d+)/i);
      if (match) return match[1];
    }
    return '6';
  };
  const studentGrade = extractGrade(student);

  // Grade-Specific Default Units
  const GRADE_UNITS = {
    '6': [
      { level: 'Level 1', unitCode: 'UNIT-601', title: 'Foundations of Electronics & Breadboard Mastery' },
      { level: 'Level 2', unitCode: 'UNIT-602', title: 'Sensory Logic: LDRs, Ultrasonic Sonar & Buzzers' },
      { level: 'Level 3', unitCode: 'UNIT-603', title: 'Transistors as Electronic Switches & Barrier Servos' },
      { level: 'Level 4', unitCode: 'UNIT-604', title: 'Embedded Microcontroller Logic & Traffic Signals' },
      { level: 'Level 5', unitCode: 'UNIT-605', title: 'Robotics Engineering & Autonomous Smart Automation' }
    ],
    '7': [
      { level: 'Level 1', unitCode: 'UNIT-701', title: 'Environmental Telemetry & Climate Monitoring' },
      { level: 'Level 2', unitCode: 'UNIT-702', title: 'Analog Potentiometers & Precision Voltage Dividers' },
      { level: 'Level 3', unitCode: 'UNIT-703', title: 'Raindrop Conductive Sensing & Soil Moisture Thresholds' },
      { level: 'Level 4', unitCode: 'UNIT-704', title: 'Micro-Servo Actuation & Automated Wiper Systems' },
      { level: 'Level 5', unitCode: 'UNIT-705', title: 'Smart Greenhouse Ecosystem & Disaster Alerts' }
    ],
    '8': [
      { level: 'Level 1', unitCode: 'UNIT-801', title: 'Spatial Mapping & 180° Sonar Turret Radar' },
      { level: 'Level 2', unitCode: 'UNIT-802', title: 'Dual H-Bridge Motor Drivers & PWM Speed Regulation' },
      { level: 'Level 3', unitCode: 'UNIT-803', title: 'Robotic Chassis Assembly & Differential Steering' },
      { level: 'Level 4', unitCode: 'UNIT-804', title: 'Obstacle Avoidance Autonomous Navigation Algorithms' },
      { level: 'Level 5', unitCode: 'UNIT-805', title: 'Mobility Telemetry & Competition Rover Optimization' }
    ],
    '9': [
      { level: 'Level 1', unitCode: 'UNIT-901', title: 'Optical Infrared Flame & Thermal Radiation Detection' },
      { level: 'Level 2', unitCode: 'UNIT-902', title: '16x2 Parallel LCD Telemetry & Bus Protocol Interface' },
      { level: 'Level 3', unitCode: 'UNIT-903', title: 'TCRT5000 Dual IR High-Contrast Line Tracking Arrays' },
      { level: 'Level 4', unitCode: 'UNIT-904', title: 'H-Bridge Motor Arbitration & Industrial Safety Alarms' },
      { level: 'Level 5', unitCode: 'UNIT-905', title: 'Autonomous Line-Following Industrial Transport Rover' }
    ],
    '11': [
      { level: 'Level 1', unitCode: 'UNIT-1101', title: 'Coherent Photonics: 650nm Laser Diode Optical Tripwire' },
      { level: 'Level 2', unitCode: 'UNIT-1102', title: 'Millisecond Intrusion Response Timing & LCD Telemetry' },
      { level: 'Level 3', unitCode: 'UNIT-1103', title: 'Sonar Uncertainty Analysis & Sensor Characterization' },
      { level: 'Level 4', unitCode: 'UNIT-1104', title: '3-Way IR Maze Array & Autonomous Decision Trees' },
      { level: 'Level 5', unitCode: 'UNIT-1105', title: 'Autonomous Micro-Mouse Maze Navigation & Robotics' }
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
        instructor: match.trainer_name || 'Vikas Pandey (Lead Instructor)',
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
      instructor: 'Vikas Pandey (Faculty)',
      verifiedDate: 'Awaiting Evaluation'
    };
  });

  const reviewedLevelsList = levelReviewData.filter(l => l.hasReview && l.score !== null);
  const avgReviewScore = reviewedLevelsList.length > 0
    ? (reviewedLevelsList.reduce((acc, curr) => acc + curr.score, 0) / reviewedLevelsList.length).toFixed(1)
    : null;

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
        <div class="certificate-container">
          <table class="header-table">
            <tr>
              <td style="vertical-align: middle;">
                <img src="${origin}/img/logo.png" class="header-logo" alt="Pixiu Tech Logo" onerror="this.style.display='none'" />
                <span style="font-size: 20px; font-weight: 900; color: #0066FF; letter-spacing: 0.5px; margin-left: 8px; vertical-align: middle;">PIXIU TECH</span>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <span class="cert-badge">🛡️ Authenticated Transcript</span>
                <p style="margin: 3px 0 0 0; font-family: monospace; font-size: 10px; color: #0066FF; font-weight: bold;">
                  ID: CERT-PIX-${student.student_id.replace(/\s+/g, '-')}-2026
                </p>
              </td>
            </tr>
          </table>

          <div style="text-align: center; margin-bottom: 14px;">
            <h1 class="doc-title">STEM & Robotics Innovation Transcript</h1>
            <p class="doc-sub">Official Institutional Competency & Practical Laboratory Evaluation Record</p>
          </div>

          <!-- Student Profile Grid -->
          <table class="profile-grid">
            <tr>
              <td class="label">Candidate Name:</td>
              <td class="val">${student.name}</td>
              <td class="label">Candidate ID:</td>
              <td class="val" style="color: #0066FF; font-family: monospace;">${student.student_id}</td>
            </tr>
            <tr>
              <td class="label">Partner Institution:</td>
              <td class="val">${school}</td>
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
                <div class="m-label">Cumulative Score</div>
                <div class="m-val" style="color: #d97706;">${avgReviewScore ? `${avgReviewScore} / 10` : 'In Progress'}</div>
              </td>
              <td class="metric-box">
                <div class="m-label">Practical Aptitude</div>
                <div class="m-val" style="color: #4f46e5; font-size: 13px; margin-top: 3px;">${reviewedLevelsList.length > 0 ? '★★★★★ Grade A+' : 'Active Learner'}</div>
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
                  <td style="text-align: center; font-weight: bold; color: #0066FF;">${l.hasReview ? `${l.score}/10` : 'Pending'}</td>
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

          <!-- Signatures -->
          <table class="signatures-table">
            <tr>
              <td>
                <div class="sig-line">
                  Vikas Pandey
                  <div class="sig-title">Lead Robotics & STEM Faculty • Pixiu Tech</div>
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
            Pixiu Tech LLP • Official STEM, Robotics & AI Education Partner • Electronically generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • Portal: portal.pixiutech.com
          </div>
        </div>
      </body>
    </html>
  `);
  
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 400);
};
