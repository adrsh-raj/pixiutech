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
const fallbackUnits = grade => Array.from({ length: 6 }, (_, i) => ({
  level: `Level ${i}`,
  unit_code: `Unit ${i + 1}`,
  title: `Grade ${grade || '—'} Learning Unit ${i + 1}`,
}));

function openPrint(title, body) {
  const popup = window.open('', '_blank', 'width=1100,height=850');
  if (!popup) { window.alert('Please allow popups to view the progress report.'); return; }
  try { popup.opener = null; } catch (_) { /* browser may already isolate the opener */ }
  popup.document.open();
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page{size:A4;margin:12mm 14mm}*{box-sizing:border-box}body{margin:0;color:#0f172a;background:#fff;font-family:Segoe UI,Arial,sans-serif;font-size:11px;line-height:1.45}.toolbar{max-width:900px;margin:0 auto 12px;display:flex;justify-content:flex-end;gap:8px}.btn{border:0;border-radius:9px;padding:8px 13px;font-size:11px;font-weight:800;cursor:pointer}.print{background:#1768ff;color:#fff}.close{background:#eef2f7;color:#334155}.sheet{max-width:900px;margin:0 auto;border:2px solid #0a1a33;border-radius:14px;padding:24px}.header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:2px solid #1768ff;padding-bottom:16px}.brand-title{font-size:23px;font-weight:900;letter-spacing:.4px}.brand-title span{color:#1768ff}.muted{color:#64748b}.badge{padding:5px 9px;border-radius:999px;font-weight:900;font-size:9px;text-transform:uppercase;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}.profile,.kpis{display:grid;gap:10px}.profile{grid-template-columns:1fr 1fr;margin-top:16px}.card{border:1px solid #e2e8f0;border-radius:10px;padding:11px;background:#fff}.label{font-size:8px;text-transform:uppercase;font-weight:900;letter-spacing:.14em;color:#64748b}.value{font-size:12px;font-weight:800}.kpis{grid-template-columns:repeat(4,1fr);margin-top:14px}.kpi{text-align:center;border:1px solid #dbe3ef;border-radius:10px;padding:10px}.kpi .n{font-size:17px;font-weight:900;color:#1768ff;margin-top:2px}.section{margin-top:18px}.section h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #dbe3ef;padding-bottom:5px;margin:0 0 8px}.table{width:100%;border-collapse:collapse;font-size:9.5px}.table th{background:#0a1a33;color:#fff;text-align:left;padding:7px}.table td{border:1px solid #e2e8f0;padding:7px;vertical-align:top}.pill{display:inline-block;padding:2px 6px;border-radius:5px;font-weight:800;font-size:8px;text-transform:uppercase;background:#f1f5f9;color:#475569}.verified{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}.pending{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:26px}.line{border-top:1px solid #94a3b8;padding-top:6px;font-weight:800}.footer{text-align:center;border-top:1px dashed #cbd5e1;margin-top:16px;padding-top:9px;color:#94a3b8;font-size:8px}@media print{.toolbar{display:none}.sheet{border:0;padding:0}}
  </style></head><body><div class="toolbar"><button class="btn close" onclick="window.close()">Close</button><button class="btn print" onclick="window.print()">Print / Save PDF</button></div>${body}<script>window.focus();</script></body></html>`);
  popup.document.close();
  popup.focus();
}

function unitRowsFor({ student, studentReviews = [], curriculum = [] }) {
  const grade = gradeOf(student);
  const curriculumRows = Array.isArray(curriculum) ? curriculum.filter(row => !grade || !row?.grade || String(row.grade) === grade).map(row => ({ level: row.level || 'Level', unit_code: row.unit_code || row.unitCode || 'Unit', title: row.title || row.topic || row.unit_code || 'Learning Unit' })) : [];
  const units = curriculumRows.length ? curriculumRows : fallbackUnits(grade);
  const reviews = (studentReviews || []).filter(row => sameStudent(row, student));
  return units.map(unit => {
    const candidates = reviews.filter(row => norm(row.level) === norm(unit.level) || norm(row.unit_code || row.unitCode) === norm(unit.unit_code));
    const review = candidates[0] || null;
    return { ...unit, review, score: score10(review), status: review?.status || 'Pending Evaluation' };
  });
}

export function generateStudentProgressPDF({ student, school, attendanceRate = 0, studentReviews = [], projects = [], curriculum = [] } = {}) {
  if (!student || typeof window === 'undefined') return;
  const rows = unitRowsFor({ student, studentReviews, curriculum });
  const evaluated = rows.filter(row => row.score !== null && norm(row.status) !== 'draft');
  const totalScore = evaluated.reduce((sum, row) => sum + row.score, 0);
  const projectsForStudent = (projects || []).filter(project => sameStudent(project, student));
  const grade = gradeOf(student);
  const reviewRows = rows.map(row => `<tr><td><b>${esc(row.level)}</b></td><td>${esc(row.unit_code)}</td><td><b>${esc(row.title)}</b></td><td>${row.score === null ? '<span class="pill pending">Pending</span>' : `<b>${row.score.toFixed(1)}/10</b>`}</td><td><span class="pill ${row.score !== null ? 'verified' : 'pending'}">${esc(row.status)}</span></td><td>${esc(row.review?.feedback || (row.score === null ? 'Trainer evaluation pending.' : 'Competency evaluated and recorded in the LMS.'))}</td></tr>`).join('');
  const projectRows = projectsForStudent.length ? projectsForStudent.map(project => `<tr><td>${esc(project.title || 'Project')}</td><td>${esc(project.score ?? '—')}</td><td><span class="pill ${norm(project.status) === 'completed' ? 'verified' : ''}">${esc(project.status || '—')}</span></td><td>${esc(project.trainer_feedback || project.description || '—')}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:#94a3b8">No project records recorded.</td></tr>';
  const body = `<div class="sheet"><div class="header"><div><div class="brand-title">PIXIU <span>TECH</span></div><div class="muted">Robotics • AI • IoT • STEM Education</div></div><div style="text-align:right"><span class="badge">Student Progress Report</span><div class="muted" style="margin-top:5px">Report ID: ${esc(student.student_id || student.id || '—')}</div></div></div><div style="text-align:center;margin:16px 0"><h1 style="margin:0;font-size:19px;text-transform:uppercase">STEM & Robotics Laboratory Progress Report</h1><p class="muted" style="margin:4px 0">Current academic progress generated from recorded LMS activity.</p></div><div class="profile"><div class="card"><div class="label">Student</div><div class="value">${esc(student.name || '—')}</div><div class="muted">ID: ${esc(student.student_id || student.id || '—')}</div><div class="muted">Class: ${esc(student.class_name || '—')}</div><div class="muted">Grade: ${esc(grade || '—')}</div></div><div class="card"><div class="label">Partner Institution</div><div class="value">${esc(typeof school === 'string' ? school : school?.name || student.school_name || 'PIXIU Tech Partner School')}</div><div class="muted">School Code: ${esc(student.school_code || school?.school_code || '—')}</div><div class="muted">Academic Year: 2026–2027</div></div></div><div class="kpis"><div class="kpi"><div class="label">Lab Attendance</div><div class="n">${esc(attendanceRate)}%</div></div><div class="kpi"><div class="label">Mastery Level</div><div class="n">${esc(student.current_level || student.tech_level || 'Level 0')}</div></div><div class="kpi"><div class="label">Cumulative Score</div><div class="n">${totalScore.toFixed(1)} / ${rows.length * 10}</div></div><div class="kpi"><div class="label">Units Evaluated</div><div class="n">${evaluated.length} / ${rows.length}</div></div></div><div class="section"><h2>Unit & Level Competency Progression</h2><table class="table"><thead><tr><th>Level</th><th>Unit</th><th>Module</th><th>Score</th><th>Status</th><th>Trainer Evaluation</th></tr></thead><tbody>${reviewRows}</tbody></table></div><div class="section"><h2>Laboratory Projects</h2><table class="table"><thead><tr><th>Project</th><th>Score</th><th>Status</th><th>Technical Evidence / Feedback</th></tr></thead><tbody>${projectRows}</tbody></table></div><div class="sig"><div><div class="line">${esc(student.trainer_name || 'Trainer Faculty')}</div><div class="muted">Trainer / Faculty</div></div><div style="text-align:right"><div class="line">Authorized Signatory</div><div class="muted">PIXIU Tech LLP</div></div></div><div class="footer">PIXIU Tech LLP · Generated from the current server-authoritative LMS record</div></div>`;
  openPrint(`Progress Report — ${student.name || 'Student'}`, body);
}

export function generateSchoolProgressPDF({ school, students = [], classes = [], getStudentAttendance } = {}) {
  if (!students.length || typeof window === 'undefined') return;
  const schoolName = typeof school === 'string' ? school : school?.name || 'PIXIU Tech Partner School';
  const rows = students.map(student => `<tr><td>${esc(student.student_id || student.id || '—')}</td><td>${esc(student.name || '—')}</td><td>${esc(student.class_name || '—')}</td><td>${esc(student.current_level || '—')}</td><td>${esc(getStudentAttendance ? getStudentAttendance(student.student_id || student.id) : 0)}%</td></tr>`).join('');
  openPrint(`School Progress Report — ${schoolName}`, `<div class="sheet"><div class="header"><div><div class="brand-title">PIXIU <span>TECH</span></div><div class="muted">School Progress Report</div></div><span class="badge">School Report</span></div><div style="text-align:center;margin:16px 0"><h1 style="margin:0;font-size:19px;text-transform:uppercase">STEM & Robotics School Progress Report</h1><p class="muted" style="margin:4px 0">${esc(schoolName)}</p></div><div class="profile"><div class="card"><div class="label">Active Students</div><div class="value">${students.length}</div></div><div class="card"><div class="label">Active Classes</div><div class="value">${classes.length}</div></div></div><div class="section"><h2>Student Overview</h2><table class="table"><thead><tr><th>Student ID</th><th>Name</th><th>Class</th><th>Level</th><th>Attendance</th></tr></thead><tbody>${rows}</tbody></table></div><div class="footer">PIXIU Tech LLP · Generated from the current server-authoritative LMS record</div></div>`);
}
