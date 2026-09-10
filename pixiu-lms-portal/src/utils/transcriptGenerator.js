function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function openPrintDocument(title, body) {
  if (typeof window === 'undefined') return;
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!printWindow) return;
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{font-family:Arial,sans-serif;color:#111827;padding:32px;line-height:1.45}h1{font-size:22px;margin:0 0 6px}h2{font-size:15px;margin:20px 0 8px}p{margin:4px 0}.meta{color:#4b5563;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:11px}th,td{border:1px solid #d1d5db;padding:7px;text-align:left;vertical-align:top}th{background:#f3f4f6}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.card{border:1px solid #d1d5db;border-radius:8px;padding:10px}.small{font-size:10px;color:#6b7280}@media print{body{padding:12px}}
  </style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),150)</script></body></html>`);
  printWindow.document.close();
}

export function generateStudentTranscriptPDF({ student, school, attendanceRate = 0, studentReviews = [], projects = [], curriculum = [] } = {}) {
  if (!student) return;
  const schoolName = typeof school === 'string' ? school : school?.name || 'PIXIU Tech Partner School';
  const rows = (studentReviews || []).map(review => `<tr><td>${escapeHtml(review.unit_code || review.unit || '')}</td><td>${escapeHtml(review.unit_title || review.title || '')}</td><td>${escapeHtml(review.level || '')}</td><td>${escapeHtml(review.score ?? '')}</td><td>${escapeHtml(review.status || '')}</td></tr>`).join('');
  const projectRows = (projects || []).map(project => `<tr><td>${escapeHtml(project.title || '')}</td><td>${escapeHtml(project.score ?? '')}</td><td>${escapeHtml(project.status || 'Completed')}</td><td>${escapeHtml(project.date_completed || '')}</td></tr>`).join('');
  const body = `<h1>PIXIU TECH — Student Progress Transcript</h1><p class="meta">Official academic progress record</p><div class="summary"><div class="card"><b>Student</b><br>${escapeHtml(student.name)}</div><div class="card"><b>Student ID</b><br>${escapeHtml(student.student_id)}</div><div class="card"><b>School</b><br>${escapeHtml(schoolName)}</div><div class="card"><b>Current Level</b><br>${escapeHtml(student.current_level || student.tech_level || '—')}</div><div class="card"><b>Attendance</b><br>${escapeHtml(attendanceRate)}%</div><div class="card"><b>Reviews</b><br>${studentReviews.length}</div></div><h2>Academic Reviews</h2><table><thead><tr><th>Unit</th><th>Topic</th><th>Level</th><th>Score</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No reviews recorded.</td></tr>'}</tbody></table><h2>Project Portfolio</h2><table><thead><tr><th>Project</th><th>Score</th><th>Status</th><th>Completed</th></tr></thead><tbody>${projectRows || '<tr><td colspan="4">No projects recorded.</td></tr>'}</tbody></table><p class="small">Generated from the current server-authoritative LMS record. Curriculum catalogue items: ${curriculum.length}.</p>`;
  openPrintDocument(`${student.name} — Pixiu Tech Progress Transcript`, body);
}

export function generateClassCohortTranscriptPDF({ classGrade, classSection, school, students = [], studentReviews = [], projects = [], getStudentAttendance } = {}) {
  const schoolName = typeof school === 'string' ? school : school?.name || 'PIXIU Tech Partner School';
  const rows = students.map(student => {
    const reviews = studentReviews.filter(review => String(review.student_id || review.student) === String(student.student_id || student.id));
    const projectCount = projects.filter(project => String(project.student_id || project.student) === String(student.student_id || student.id)).length;
    const attendance = typeof getStudentAttendance === 'function' ? getStudentAttendance(student.student_id || student.id) : 0;
    return `<tr><td>${escapeHtml(student.student_id)}</td><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.current_level || student.tech_level || '')}</td><td>${escapeHtml(attendance)}%</td><td>${reviews.length}</td><td>${projectCount}</td></tr>`;
  }).join('');
  const body = `<h1>PIXIU TECH — Class Cohort Progress Report</h1><p class="meta">${escapeHtml(schoolName)} • Class ${escapeHtml(classGrade)}${escapeHtml(classSection || '')}</p><table><thead><tr><th>Student ID</th><th>Student</th><th>Level</th><th>Attendance</th><th>Reviews</th><th>Projects</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No students found.</td></tr>'}</tbody></table>`;
  openPrintDocument(`Class ${classGrade}${classSection || ''} — Pixiu Tech Report`, body);
}

export function generateSchoolProgressPDF({ school, students = [], classes = [], getStudentAttendance } = {}) {
  const schoolName = typeof school === 'string' ? school : school?.name || 'PIXIU Tech Partner School';
  const activeStudents = students.filter(student => !['inactive', 'graduated', 'withdrawn'].includes(String(student.status || '').toLowerCase()));
  const activeClasses = classes.filter(item => !['inactive', 'archived', 'cancelled'].includes(String(item.status || '').toLowerCase()));
  const attendanceValues = activeStudents.map(student => Number(getStudentAttendance?.(student.student_id || student.id) || 0)).filter(value => Number.isFinite(value));
  const schoolAttendance = attendanceValues.length ? Math.round(attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length) : 0;
  const rows = activeStudents.map(student => `<tr><td>${escapeHtml(student.student_id)}</td><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.class_name || student.class_display_name || '')}</td><td>${escapeHtml(student.current_level || student.tech_level || '')}</td><td>${escapeHtml(getStudentAttendance?.(student.student_id || student.id) ?? 0)}%</td><td>${escapeHtml(student.status || '')}</td></tr>`).join('');
  const body = `<h1>PIXIU TECH — Whole School Progress Report</h1><p class="meta">${escapeHtml(schoolName)} · Official school progress snapshot</p><div class="summary"><div class="card"><b>Active students</b><br>${activeStudents.length}</div><div class="card"><b>Active classes</b><br>${activeClasses.length}</div><div class="card"><b>Average attendance</b><br>${schoolAttendance}%</div></div><h2>Student Progress Register</h2><table><thead><tr><th>Student ID</th><th>Student</th><th>Class</th><th>Level</th><th>Attendance</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No active students found.</td></tr>'}</tbody></table><p class="small">Generated from the current server-authoritative school scope.</p>`;
  openPrintDocument(`${schoolName} — Pixiu Tech Whole School Progress`, body);
}
