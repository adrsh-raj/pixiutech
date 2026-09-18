const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#039;' }[c]));
const norm = value => String(value ?? '').trim().toLowerCase();
const identityKeys = student => [student?.id, student?.student_id, student?.studentId].filter(Boolean).map(norm);
const sameStudent = (row, student) => {
  const keys = identityKeys(student);
  const rowKeys = [row?.id, row?.student_id, row?.studentId, row?.student].filter(Boolean).map(norm);
  return rowKeys.some(key => keys.includes(key));
};
const gradeOf = student => String(student?.grade || student?.class_grade || student?.classGrade || student?.class_name || '').match(/\d+/)?.[0] || '';
const score10 = row => {
  const score = Number(row?.score);
  if (Number.isFinite(score)) return Math.max(0, Math.min(10, score <= 10 ? score : score / 10));
  const rating = Number(row?.rating);
  return Number.isFinite(rating) ? Math.max(0, Math.min(10, rating * 2)) : null;
};

function openPrint(title, body) {
  const popup = window.open('', '_blank', 'width=1100,height=850');
  if (!popup) { window.alert('Please allow popups to view the progress report.'); return; }
  try { popup.opener = null; } catch (_) { /* browser may already isolate the opener */ }
  popup.document.open();
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page{size:A4;margin:12mm 14mm}*{box-sizing:border-box}body{margin:0;color:#0f172a;background:#fff;font-family:Segoe UI,Arial,sans-serif;font-size:11px;line-height:1.45}.toolbar{max-width:900px;margin:0 auto 12px;display:flex;justify-content:flex-end;gap:8px}.btn{border:0;border-radius:9px;padding:8px 13px;font-size:11px;font-weight:800;cursor:pointer}.print{background:#1768ff;color:#fff}.close{background:#eef2f7;color:#334155}.sheet{max-width:900px;margin:0 auto;border:2px solid #0a1a33;border-radius:14px;padding:24px}.header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:2px solid #1768ff;padding-bottom:16px}.brand-title{font-size:23px;font-weight:900;letter-spacing:.4px}.brand-title span{color:#1768ff}.muted{color:#64748b}.badge{padding:5px 9px;border-radius:999px;font-weight:900;font-size:9px;text-transform:uppercase;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}.profile,.kpis{display:grid;gap:10px}.profile{grid-template-columns:1fr 1fr;margin-top:16px}.meta-list{display:grid;gap:8px;margin-top:8px}.meta-row{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px;align-items:start}.meta-row .label{font-size:7px}.meta-row .muted{font-size:10px}.card{border:1px solid #e2e8f0;border-radius:10px;padding:11px;background:#fff}.label{font-size:8px;text-transform:uppercase;font-weight:900;letter-spacing:.14em;color:#64748b}.value{font-size:12px;font-weight:800}.kpis{grid-template-columns:repeat(4,1fr);margin-top:14px}.kpi{text-align:center;border:1px solid #dbe3ef;border-radius:10px;padding:10px}.kpi .n{font-size:17px;font-weight:900;color:#1768ff;margin-top:2px}.section{margin-top:18px}.section h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #dbe3ef;padding-bottom:5px;margin:0 0 8px}.table{width:100%;border-collapse:collapse;font-size:9.5px}.table th{background:#0a1a33;color:#fff;text-align:left;padding:7px}.table td{border:1px solid #e2e8f0;padding:7px;vertical-align:top}.pill{display:inline-block;padding:2px 6px;border-radius:5px;font-weight:800;font-size:8px;text-transform:uppercase;background:#f1f5f9;color:#475569}.verified{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}.failed{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}.pending{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:26px}.line{border-top:1px solid #94a3b8;padding-top:6px;font-weight:800}.footer{text-align:center;border-top:1px dashed #cbd5e1;margin-top:16px;padding-top:9px;color:#94a3b8;font-size:8px}@media print{.toolbar{display:none}.sheet{border:0;padding:0}}
  </style></head><body><div class="toolbar"><button class="btn close" onclick="window.close()">Close</button><button class="btn print" onclick="window.print()">Print / Save PDF</button></div>${body}<script>window.focus();</script></body></html>`);
  popup.document.close();
  popup.focus();
}

function unitRowsFor({ student, studentReviews = [], curriculum = [] }) {
  const grade = gradeOf(student);
  const curriculumRows = Array.isArray(curriculum)
    ? curriculum
        .filter(row => !grade || !row?.grade || String(row.grade) === grade)
        .filter(row => !['draft', 'archived', 'inactive'].includes(norm(row?.status)))
        .map(row => ({
          level: row.level || 'Level',
          unit_code: row.unit_code || row.unitCode || 'Unit',
          title: row.title || row.topic || row.unit_code || 'Learning Unit',
          status: row.status || 'published',
        }))
    : [];
  const reviews = (studentReviews || []).filter(row => sameStudent(row, student));
  return curriculumRows.map(unit => {
    const candidates = reviews.filter(row => norm(row.level) === norm(unit.level) || norm(row.unit_code || row.unitCode) === norm(unit.unit_code));
    const review = candidates[0] || null;
    return { ...unit, review, score: score10(review), status: review?.status || 'Pending Evaluation' };
  });
}

function completionRows(completion) {
  const units = Array.isArray(completion?.units) ? completion.units : [];
  return units.map((unit, index) => ({
    level: unit.level || 'Programme',
    unit_code: unit.unit_code || `UNIT-${index + 1}`,
    title: unit.title || unit.topic || 'Learning Unit',
    score: unit.score == null ? null : Number(unit.score) / 10,
    raw_score: unit.score == null ? null : Number(unit.score),
    sessions: Number(unit.completed_sessions ?? unit.sessions_count ?? 0),
    sessions_count: Number(unit.sessions_count ?? 0),
    status: unit.status === 'passed' || unit.status === 'failed' ? unit.status : 'pending',
    technology: unit.technology || 'Technology',
    feedback: Array.isArray(unit.reasons) && unit.reasons.length ? unit.reasons.join(' ') : '',
  }));
}

export function generateStudentProgressPDF({ student, school, attendanceRate = 0, studentReviews = [], projects = [], curriculum = [], completion = null } = {}) {
  if (!student || typeof window === 'undefined') return;

  const serverRows = completionRows(completion);
  const usingServer = Boolean(completion && Array.isArray(completion.units));
  const rows = usingServer ? serverRows : unitRowsFor({ student, studentReviews, curriculum });
  const evaluated = usingServer
    ? rows.filter(row => row.status !== 'pending' && row.raw_score !== null)
    : rows.filter(row => row.score !== null && norm(row.status) !== 'draft');
  const serverScore = completion?.overall_score == null ? null : Number(completion.overall_score);
  const totalScore = serverScore != null ? serverScore : evaluated.reduce((sum, row) => sum + row.score, 0);
  const totalPossible = usingServer ? rows.length * 100 : rows.length * 10;
  const clientProjectsForStudent = (projects || []).filter(project => sameStudent(project, student));
  const grade = gradeOf(student);
  const effectiveAttendance = completion?.attendance?.percentage ?? completion?.checklist?.attendance?.percentage ?? attendanceRate;
  const evaluationState = completion?.evaluation_state || completion?.state || (serverScore != null && serverScore >= 70 ? 'passed' : 'pending');
  const stateLabel = evaluationState === 'passed' ? 'Passed' : evaluationState === 'not_passed' ? 'Not Passed' : 'Evaluation Pending';
  const stateClass = evaluationState === 'passed' ? 'verified' : evaluationState === 'not_passed' ? 'failed' : 'pending';
  const reportTrainer = completion?.trainer_name || student?.trainer_name || 'Trainer not assigned';
  const completionTechnologies = Array.isArray(completion?.technologies) ? completion.technologies : [];
  const technologyNames = completionTechnologies.map(item => typeof item === 'string' ? item : item?.name || item?.technology || '').map(String).map(v => v.trim()).filter(Boolean);
  const derivedTechnologies = technologyNames.length ? [...new Set(technologyNames)] : [...new Set(rows.map(row => row.technology).filter(Boolean))];
  const technologyLabel = derivedTechnologies.length ? derivedTechnologies.join(' · ') : 'STEM Programme';
  const reportUpdatedAt = completion?.report_updated_at ? new Date(completion.report_updated_at) : new Date();
  const reportUpdatedText = Number.isNaN(reportUpdatedAt.getTime()) ? 'Current LMS record' : reportUpdatedAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const projectsForReport = usingServer
    ? (completion?.project && typeof completion.project === 'object' ? [completion.project] : [])
    : clientProjectsForStudent;

  const reviewRows = rows.length
    ? rows.map(row => {
        const scoreText = usingServer
          ? (row.raw_score == null ? '<span class="pill pending">—</span>' : `<b>${row.raw_score.toFixed(2)}%</b>`)
          : (row.score === null ? '<span class="pill pending">Pending</span>' : `<b>${row.score.toFixed(1)}/10</b>`);
        const status = usingServer ? (row.status === 'passed' ? 'Passed' : row.status === 'failed' ? 'Not Passed' : 'Pending Evaluation') : (row.status || 'Pending Evaluation');
        const pill = status === 'Passed' ? 'verified' : status === 'Not Passed' ? 'failed' : 'pending';
        const sessions = usingServer ? `${row.sessions}/${row.sessions_count || row.sessions}` : 'Recorded in LMS';
        return `<tr><td><b>${esc(row.technology || row.level)}</b></td><td>${esc(row.unit_code)}</td><td><b>${esc(row.title)}</b></td><td>${scoreText}</td><td>${esc(sessions)}</td><td><span class="pill ${pill}">${esc(status)}</span></td><td>${esc(row.feedback || (status === 'Pending Evaluation' ? 'Trainer evaluation or required activity pending.' : 'Evaluation recorded in the LMS.'))}</td></tr>`;
      }).join('')
    : '<tr><td colspan="7" style="text-align:center;color:#94a3b8">No taught programme units have been recorded for this student.</td></tr>';

  const projectRows = projectsForReport.length
    ? projectsForReport.map(project => `<tr><td>${esc(project.title || 'Project')}</td><td>${esc(project.score ?? '—')}</td><td><span class="pill ${norm(project.status) === 'completed' ? 'verified' : 'pending'}">${esc(project.status || '—')}</span></td><td>${esc(project.trainer_feedback || project.feedback || project.description || '—')}</td></tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No project records recorded.</td></tr>';

  const blockerText = Array.isArray(completion?.blockers) && completion.blockers.length
    ? completion.blockers.join(' ')
    : Array.isArray(completion?.checklist?.blockers) && completion.checklist.blockers.length
      ? completion.checklist.blockers.join(' ')
      : '';

  const body = `<div class="sheet"><div class="header"><div><div class="brand-title">PIXIU <span>TECH</span></div><div class="muted">Robotics • AI • IoT • STEM Education</div></div><div style="text-align:right"><span class="badge">Student Progress Report</span><div class="muted" style="margin-top:5px">Report ID: ${esc(student.student_id || student.id || '—')}</div></div></div><div style="text-align:center;margin:16px 0"><h1 style="margin:0;font-size:19px;text-transform:uppercase">STEM & Robotics Laboratory Progress Report</h1><p class="muted" style="margin:4px 0">Server-authoritative academic record generated from the Pixiu Tech LMS.</p></div><div class="profile"><div class="card"><div class="label">Student</div><div class="value">${esc(student.name || completion?.student_name || '—')}</div><div class="meta-list"><div class="meta-row"><span class="label">Student ID</span><span class="muted">${esc(student.student_id || completion?.student_id || student.id || '—')}</span></div><div class="meta-row"><span class="label">Class</span><span class="muted">${esc(student.class_name || completion?.class_name || '—')}</span></div><div class="meta-row"><span class="label">Grade</span><span class="muted">${esc(grade || '—')}</span></div></div></div><div class="card"><div class="label">Partner School</div><div class="value">${esc(typeof school === 'string' ? school : school?.name || completion?.school_name || student.school_name || 'PIXIU Tech Partner School')}</div><div class="meta-list"><div class="meta-row"><span class="label">School Code</span><span class="muted">${esc(student.school_code || school?.school_code || completion?.school_code || '—')}</span></div><div class="meta-row"><span class="label">Technologies</span><span class="muted">${esc(technologyLabel)}</span></div><div class="meta-row"><span class="label">Evaluation</span><span><span class="pill ${stateClass}">${esc(stateLabel)}</span></span></div></div></div></div><div class="kpis"><div class="kpi"><div class="label">Lab Attendance</div><div class="n">${esc(Number(effectiveAttendance || 0).toFixed(0))}%</div></div><div class="kpi"><div class="label">Programme Score</div><div class="n">${serverScore == null ? '—' : `${serverScore.toFixed(2)}%`}</div></div><div class="kpi"><div class="label">Evaluated Units</div><div class="n">${evaluated.length} / ${rows.length}</div></div><div class="kpi"><div class="label">Result</div><div class="n" style="font-size:14px">${esc(stateLabel)}</div></div></div>${blockerText ? `<div class="card" style="margin-top:12px;background:#fff7ed;border-color:#fed7aa"><div class="label" style="color:#9a3412">Evaluation Notes</div><div style="margin-top:4px;color:#7c2d12;font-size:10px">${esc(blockerText)}</div></div>` : ''}<div class="section"><h2>Technology & Unit Evaluation</h2><table class="table"><thead><tr><th>Technology</th><th>Unit</th><th>Module</th><th>Score</th><th>Sessions</th><th>Status</th><th>Trainer Evaluation</th></tr></thead><tbody>${reviewRows}</tbody></table></div><div class="section"><h2>Laboratory Projects</h2><table class="table"><thead><tr><th>Project</th><th>Score</th><th>Status</th><th>Technical Evidence / Feedback</th></tr></thead><tbody>${projectRows}</tbody></table></div><div class="sig"><div><div class="line">${esc(reportTrainer)}</div><div class="muted">Trainer / Faculty</div></div><div style="text-align:right"><div class="line">Authorized Signatory</div><div class="muted">PIXIU Tech LLP</div></div></div><div class="footer">PIXIU Tech LLP · Generated from the current server-authoritative LMS record · Last updated: ${esc(reportUpdatedText)} · ${usingServer ? 'Evaluation data: live class-wide completion engine' : 'Legacy client report fallback'}</div></div>`;
  openPrint(`Progress Report — ${student.name || 'Student'}`, body);
}

export function generateSchoolProgressPDF({ school, students = [], classes = [], getStudentAttendance } = {}) {
  if (!students.length || typeof window === 'undefined') return;
  const schoolName = typeof school === 'string' ? school : school?.name || 'PIXIU Tech Partner School';
  const rows = students.map(student => `<tr><td>${esc(student.student_id || student.id || '—')}</td><td>${esc(student.name || '—')}</td><td>${esc(student.class_name || '—')}</td><td>${esc(student.current_level || '—')}</td><td>${esc(getStudentAttendance ? getStudentAttendance(student.student_id || student.id) : 0)}%</td></tr>`).join('');
  openPrint(`School Progress Report — ${schoolName}`, `<div class="sheet"><div class="header"><div><div class="brand-title">PIXIU <span>TECH</span></div><div class="muted">School Progress Report</div></div><span class="badge">School Report</span></div><div style="text-align:center;margin:16px 0"><h1 style="margin:0;font-size:19px;text-transform:uppercase">STEM & Robotics School Progress Report</h1><p class="muted" style="margin:4px 0">${esc(schoolName)}</p></div><div class="profile"><div class="card"><div class="label">Active Students</div><div class="value">${students.length}</div></div><div class="card"><div class="label">Active Classes</div><div class="value">${classes.length}</div></div></div><div class="section"><h2>Student Overview</h2><table class="table"><thead><tr><th>Student ID</th><th>Name</th><th>Class</th><th>Level</th><th>Attendance</th></tr></thead><tbody>${rows}</tbody></table></div><div class="footer">PIXIU Tech LLP · Generated from the current server-authoritative LMS record</div></div>`);
}
