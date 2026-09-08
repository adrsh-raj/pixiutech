import { useEffect, useMemo, useState } from 'react';
import { Activity, Building2, Check, Download, Edit, FileText, MessageCircle, Plus, Search, Trash2, User } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { generateStudentTranscriptPDF, generateClassCohortTranscriptPDF } from '../utils/transcriptGenerator';
import Modal from '../components/ui/Modal';

const normalizeStatus = value => String(value ?? '').toLowerCase();
const schoolKey = school => String(school?.id || '');
const classSchoolId = cls => String(cls?.school || cls?.school_id || '');

export default function Students() {
  const {
    schools = [], classes = [], students = [], projects = [], studentReviews = [], curriculum = [],
    addStudent, updateStudent, deleteStudent, getNextRollNumber, getStudentAttendance,
  } = useData();
  const { role, user } = useAuth();
  const toast = useToast();

  const isAdmin = role === 'admin' || role === 'superadmin';
  const isTrainer = role === 'trainer';
  const trainerSchoolId = String(user?.school_id || '');

  const visibleSchools = useMemo(
    () => isTrainer ? schools.filter(s => schoolKey(s) === trainerSchoolId) : schools,
    [isTrainer, schools, trainerSchoolId],
  );

  const scopedStudents = useMemo(
    () => isTrainer ? students.filter(s => String(s.school_code || s.school_id || '') === String(user?.school_code || trainerSchoolId)) : students,
    [isTrainer, students, user, trainerSchoolId],
  );

  const scopedClasses = useMemo(
    () => isTrainer ? classes.filter(c => classSchoolId(c) === trainerSchoolId || String(c.school_code || '') === String(user?.school_code || '')) : classes,
    [classes, isTrainer, trainerSchoolId, user],
  );

  const [selectedSchool, setSelectedSchool] = useState(() => isTrainer ? trainerSchoolId : 'all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStudent, setActiveStudent] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ school_class: '', roll_number: '', name: '', guardian_name: '', guardian_phone: '', guardian_email: '', email: '', phone: '', date_of_birth: '', gender: '', address: '', current_level: '', status: 'active' });
  const [editFormData, setEditFormData] = useState({ name: '', guardian_name: '', guardian_phone: '', guardian_email: '', email: '', phone: '', date_of_birth: '', gender: '', address: '', current_level: '', status: 'active' });

  const classesForSchool = useMemo(() => {
    if (selectedSchool === 'all') return scopedClasses;
    return scopedClasses.filter(c => classSchoolId(c) === selectedSchool || String(c.school_code || '') === selectedSchool);
  }, [scopedClasses, selectedSchool]);

  const filteredStudents = useMemo(() => scopedStudents.filter(student => {
    const studentSchool = String(student.school_id || student.school_code || '');
    const studentClass = String(student.school_class || student.class_id || '');
    const matchesSchool = selectedSchool === 'all' || studentSchool === selectedSchool;
    const matchesClass = selectedClass === 'all' || studentClass === selectedClass;
    const haystack = [student.name, student.student_id, student.guardian_name, student.guardian_phone, student.class_name, student.school_name]
      .filter(Boolean).join(' ').toLowerCase();
    return matchesSchool && matchesClass && (!searchTerm || haystack.includes(searchTerm.toLowerCase()));
  }), [scopedStudents, selectedSchool, selectedClass, searchTerm]);

  useEffect(() => {
    if (!isAddOpen) return;
    const fallbackSchool = isTrainer ? visibleSchools[0] : visibleSchools[0];
    const school = visibleSchools.find(s => schoolKey(s) === selectedSchool) || fallbackSchool;
    const available = classesForSchool.filter(c => normalizeStatus(c.status) !== 'inactive');
    const selected = available.find(c => String(c.id) === String(formData.school_class));
    const nextClass = selected || available[0];
    const schoolCode = school?.school_code || school?.code || school?.school_id || '';
    const nextRoll = nextClass && schoolCode ? getNextRollNumber(schoolCode, nextClass.grade, nextClass.section) : '';
    setFormData(prev => ({ ...prev, school_class: nextClass?.id || '', roll_number: nextRoll }));
  }, [isAddOpen, isTrainer, visibleSchools, selectedSchool, classesForSchool, formData.school_class, getNextRollNumber]);

  const openAdd = () => {
    const firstSchool = visibleSchools[0];
    const firstClass = (firstSchool ? scopedClasses.filter(c => classSchoolId(c) === schoolKey(firstSchool)) : scopedClasses)[0];
    setSelectedSchool(isTrainer ? trainerSchoolId : firstSchool ? schoolKey(firstSchool) : 'all');
    setSelectedClass('all');
    setFormData(prev => ({ ...prev, school_class: firstClass?.id || '', roll_number: '', name: '', guardian_name: '', guardian_phone: '', guardian_email: '', email: '', phone: '', date_of_birth: '', gender: '', address: '', current_level: '', status: 'active' }));
    setIsAddOpen(true);
  };

  const handleAdd = async event => {
    event.preventDefault();
    setSaving(true);
    const result = await addStudent(formData);
    setSaving(false);
    if (!result?.success) {
      toast.error(result?.error || 'Student registration failed.');
      return;
    }
    const student = result.data || {};
    const credentialNote = student.initial_password ? ` Initial password: ${student.initial_password}` : '';
    toast.success(`Student ${student.name || formData.name} enrolled.${credentialNote}`, 'Student Registered');
    setIsAddOpen(false);
  };

  const openEdit = (event, student) => {
    event.stopPropagation();
    setEditingStudent(student);
    setEditFormData({
      name: student.name || '',
      guardian_name: student.guardian_name || '',
      guardian_phone: student.guardian_phone || '',
      guardian_email: student.guardian_email || '',
      email: student.email || '',
      phone: student.phone || '',
      date_of_birth: student.date_of_birth || '',
      gender: student.gender || '',
      address: student.address || '',
      current_level: student.current_level || '',
      status: normalizeStatus(student.status || 'active'),
    });
  };

  const handleEdit = async event => {
    event.preventDefault();
    if (!editingStudent) return;
    setSaving(true);
    const result = await updateStudent(editingStudent.id || editingStudent.student_id, editFormData);
    setSaving(false);
    if (!result?.success) {
      toast.error(result?.error || 'Student update failed.');
      return;
    }
    setActiveStudent(prev => prev && String(prev.id || prev.student_id) === String(editingStudent.id || editingStudent.student_id) ? { ...prev, ...editFormData } : prev);
    setEditingStudent(null);
    toast.success('Student record updated.', 'Profile Updated');
  };

  const removeStudent = async (event, student) => {
    event.stopPropagation();
    if (!window.confirm(`Deactivate ${student.name}?`)) return;
    const result = await deleteStudent(student.id || student.student_id);
    if (!result?.success) toast.error(result?.error || 'Student could not be deactivated.');
    else toast.success(`${student.name} was deactivated.`, 'Student Updated');
  };

  const openWhatsApp = (event, phone, name) => {
    event.stopPropagation();
    const clean = String(phone || '').replace(/\D/g, '');
    if (!clean) return toast.error('No guardian phone number is stored for this student.');
    const message = encodeURIComponent(`Hello, this is an update from Pixiu Tech regarding ${name}'s learning progress.`);
    window.open(`https://wa.me/${clean}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const studentProjects = student => projects.filter(p => String(p.student || p.student_id || '') === String(student.id || student.student_id));
  const schoolForStudent = student => schools.find(s => String(s.id) === String(student.school_id)) || null;
  const classForStudent = student => classes.find(c => String(c.id) === String(student.school_class || student.class_id)) || null;

  const printStudent = (event, student) => {
    if (event?.stopPropagation) event.stopPropagation();
    generateStudentTranscriptPDF({
      student,
      school: student.school_name || schoolForStudent(student)?.name || '—',
      attendanceRate: getStudentAttendance(student.id || student.student_id),
      studentReviews: studentReviews || [],
      projects: studentProjects(student),
      curriculum: curriculum || [],
    });
  };

  const printClass = () => {
    const chosenClass = classes.find(c => String(c.id) === String(selectedClass));
    const chosenSchool = schools.find(s => String(s.id) === String(selectedSchool));
    generateClassCohortTranscriptPDF({
      classGrade: chosenClass?.grade || '',
      classSection: chosenClass?.section || '',
      school: chosenSchool || { name: '—' },
      students: filteredStudents,
      studentReviews,
      projects,
      curriculum,
      getStudentAttendance,
      userRole: role,
    });
  };

  if (activeStudent) {
    const school = schoolForStudent(activeStudent);
    const cls = classForStudent(activeStudent);
    const attendance = getStudentAttendance(activeStudent.id || activeStudent.student_id);
    const projectsForStudent = studentProjects(activeStudent);
    return (
      <div className="space-y-6 pb-10">
        <button type="button" onClick={() => setActiveStudent(null)} className="text-sm font-bold text-slate-500 hover:text-slate-800">← Back to Students</button>
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-slate-900 text-white flex items-center justify-center text-2xl font-black"><User size={28}/></div>
            <div className="text-center mt-4"><h1 className="text-xl font-black text-slate-900">{activeStudent.name}</h1><p className="font-mono text-xs text-blue-600 mt-1">{activeStudent.student_id || '—'}</p><span className="inline-block mt-3 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold capitalize">{activeStudent.status}</span></div>
            <div className="border-t border-slate-100 mt-6 pt-5 space-y-4 text-xs">
              <div><p className="text-slate-400 font-black uppercase">School & Class</p><p className="mt-1 font-bold text-slate-800">{activeStudent.school_name || school?.name || '—'} · {activeStudent.class_name || (cls ? `${cls.grade} ${cls.section}` : '—')}</p></div>
              <div><p className="text-slate-400 font-black uppercase">Guardian</p><p className="mt-1 font-bold text-slate-800">{activeStudent.guardian_name || '—'}</p><p className="text-slate-500 mt-0.5">{activeStudent.guardian_phone || 'No phone stored'}</p></div>
              <div><p className="text-slate-400 font-black uppercase">Current Level</p><p className="mt-1 font-bold text-slate-800">{activeStudent.current_level || '—'}</p></div>
            </div>
            <div className="border-t border-slate-100 mt-6 pt-5 space-y-2">
              <button type="button" onClick={e => openEdit(e, activeStudent)} className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black inline-flex items-center justify-center gap-2"><Edit size={14}/> Edit Profile</button>
              <button type="button" onClick={e => printStudent(e, activeStudent)} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black inline-flex items-center justify-center gap-2"><FileText size={14}/> Progress Card PDF</button>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-[10px] uppercase font-black text-slate-400">Attendance</p><p className="text-3xl font-black text-slate-900 mt-2">{attendance}%</p></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-[10px] uppercase font-black text-slate-400">Projects</p><p className="text-3xl font-black text-slate-900 mt-2">{projectsForStudent.length}</p></div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4"><div><p className="text-[10px] uppercase font-black text-blue-600">Academic evidence</p><h2 className="text-lg font-black text-slate-900 mt-1">Projects & Builds</h2></div><Activity size={20} className="text-slate-300"/></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projectsForStudent.map(project => <div key={project.id} className="border border-slate-200 rounded-xl p-4"><h3 className="font-black text-slate-900 text-sm">{project.title}</h3><p className="text-xs text-slate-500 mt-1 capitalize">{normalizeStatus(project.status)}</p>{project.score != null && <p className="text-xs font-bold text-slate-700 mt-2">Score: {project.score}</p>}</div>)}
                {!projectsForStudent.length && <div className="col-span-full border border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">No project records are stored for this student yet.</div>}
              </div>
            </div>
          </div>
        </section>
        <EditStudentModal student={editingStudent} form={editFormData} setForm={setEditFormData} open={!!editingStudent} onClose={() => setEditingStudent(null)} onSubmit={handleEdit} saving={saving}/>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600">Academics</p><h1 className="text-2xl font-black text-slate-900 mt-1">Student Directory</h1><p className="text-sm text-slate-500 mt-1">Live student records from the Django academic registry.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={selectedClass === 'all' || !filteredStudents.length} onClick={printClass} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-40 inline-flex items-center gap-2"><Download size={14}/> Class Report PDF</button>
          <button type="button" onClick={openAdd} disabled={!visibleSchools.length || !scopedClasses.length} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-40 inline-flex items-center gap-2"><Plus size={15}/> Enroll Student</button>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {isAdmin && <div><label className="block text-[10px] uppercase font-black text-slate-400 mb-1">School</label><select value={selectedSchool} onChange={e => { setSelectedSchool(e.target.value); setSelectedClass('all'); }} className="field"><option value="all">All schools</option>{visibleSchools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select></div>}
        <div><label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Class</label><select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="field"><option value="all">All classes</option>{classesForSchool.map(c => <option key={c.id} value={c.id}>{c.display_name || `${c.grade} ${c.section}`}</option>)}</select></div>
        <div className={isAdmin ? '' : 'md:col-span-2'}><label className="block text-[10px] uppercase font-black text-slate-400 mb-1">Search</label><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Student, ID, guardian or class" className="field pl-9"/></div></div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 border-b border-slate-200"><tr>{['Student','School / Class','Guardian','Level','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-black">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.map(student => <tr key={student.id || student.student_id} onClick={() => setActiveStudent(student)} className="hover:bg-slate-50 cursor-pointer">
              <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-700">{String(student.name || '?').split(' ').map(w => w[0]).join('').slice(0,2)}</div><div><p className="font-black text-slate-900">{student.name}</p><p className="font-mono text-[10px] text-blue-600 mt-0.5">{student.student_id || '—'} · Roll {student.roll_number ?? '—'}</p></div></div></td>
              <td className="px-4 py-4"><p className="font-bold text-slate-800">{student.school_name || '—'}</p><p className="text-xs text-slate-500 mt-0.5">{student.class_name || '—'}</p></td>
              <td className="px-4 py-4"><p className="font-bold text-slate-800">{student.guardian_name || '—'}</p><div className="flex items-center gap-2 mt-1"><span className="text-xs text-slate-500">{student.guardian_phone || 'No phone'}</span>{student.guardian_phone && <button type="button" onClick={e => openWhatsApp(e, student.guardian_phone, student.name)} className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50"><MessageCircle size={14}/></button>}</div></td>
              <td className="px-4 py-4"><span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black">{student.current_level || '—'}</span></td>
              <td className="px-4 py-4"><span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black capitalize">{student.status || '—'}</span></td>
              <td className="px-4 py-4" onClick={e => e.stopPropagation()}><div className="flex items-center gap-1"><button type="button" onClick={e => openEdit(e, student)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit"><Edit size={15}/></button><button type="button" onClick={e => printStudent(e, student)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Progress card"><FileText size={15}/></button><button type="button" onClick={e => removeStudent(e, student)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Deactivate"><Trash2 size={15}/></button></div></td>
            </tr>)}
            {!filteredStudents.length && <tr><td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400">No student records match the current filters.</td></tr>}
          </tbody>
        </table></div>
      </section>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Enroll Student" size="md">
        <form onSubmit={handleAdd} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isAdmin && <Field label="School"><select value={selectedSchool === 'all' ? '' : selectedSchool} onChange={e => { setSelectedSchool(e.target.value); setFormData(prev => ({ ...prev, school_class: '' })); }} className="field" required><option value="">Select school</option>{visibleSchools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select></Field>}
            <Field label="Class"><select value={formData.school_class} onChange={e => setFormData(prev => ({ ...prev, school_class: e.target.value }))} className="field" required><option value="">Select class</option>{classesForSchool.map(c => <option key={c.id} value={c.id}>{c.display_name || `${c.grade} ${c.section}`}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Roll number"><input value={formData.roll_number} onChange={e => setFormData(prev => ({ ...prev, roll_number: e.target.value }))} type="number" min="1" className="field" required/></Field><Field label="Student name"><input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="field" required/></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Guardian name"><input value={formData.guardian_name} onChange={e => setFormData(prev => ({ ...prev, guardian_name: e.target.value }))} className="field"/></Field><Field label="Guardian phone"><input value={formData.guardian_phone} onChange={e => setFormData(prev => ({ ...prev, guardian_phone: e.target.value }))} className="field"/></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Guardian email"><input value={formData.guardian_email} onChange={e => setFormData(prev => ({ ...prev, guardian_email: e.target.value }))} type="email" className="field"/></Field><Field label="Student email"><input value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} type="email" className="field"/></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Student phone"><input value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} className="field"/></Field><Field label="Current level"><input value={formData.current_level} onChange={e => setFormData(prev => ({ ...prev, current_level: e.target.value }))} placeholder="Optional" className="field"/></Field></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Date of birth"><input value={formData.date_of_birth} onChange={e => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))} type="date" className="field"/></Field><Field label="Gender"><input value={formData.gender} onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))} className="field"/></Field></div>
          <Field label="Address"><textarea value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} rows="3" className="field"/></Field>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100">Cancel</button><button type="submit" disabled={saving} className="px-5 py-2 rounded-xl text-xs font-black text-white bg-blue-600 disabled:opacity-50 inline-flex items-center gap-2"><Plus size={14}/> {saving ? 'Saving…' : 'Enroll Student'}</button></div>
        </form>
      </Modal>

      <EditStudentModal student={editingStudent} form={editFormData} setForm={setEditFormData} open={!!editingStudent} onClose={() => setEditingStudent(null)} onSubmit={handleEdit} saving={saving}/>
      <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;color:#334155;background:white;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}`}</style>
    </div>
  );
}

function Field({ label, children }) { return <div><label className="block mb-1 text-[10px] uppercase font-black tracking-wide text-slate-400">{label}</label>{children}</div>; }

function EditStudentModal({ student, form, setForm, open, onClose, onSubmit, saving }) {
  return <Modal isOpen={open} onClose={onClose} title="Edit Student" size="md">
    {student && <form onSubmit={onSubmit} className="space-y-4 text-xs">
      <p className="font-mono text-[11px] text-blue-600">{student.student_id || student.id}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Student name"><input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className="field" required/></Field><Field label="Current level"><input value={form.current_level} onChange={e => setForm(v => ({ ...v, current_level: e.target.value }))} className="field"/></Field></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Guardian name"><input value={form.guardian_name} onChange={e => setForm(v => ({ ...v, guardian_name: e.target.value }))} className="field"/></Field><Field label="Guardian phone"><input value={form.guardian_phone} onChange={e => setForm(v => ({ ...v, guardian_phone: e.target.value }))} className="field"/></Field></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Guardian email"><input value={form.guardian_email} onChange={e => setForm(v => ({ ...v, guardian_email: e.target.value }))} type="email" className="field"/></Field><Field label="Student email"><input value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} type="email" className="field"/></Field></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Student phone"><input value={form.phone} onChange={e => setForm(v => ({ ...v, phone: e.target.value }))} className="field"/></Field><Field label="Status"><select value={normalizeStatus(form.status)} onChange={e => setForm(v => ({ ...v, status: e.target.value }))} className="field"><option value="active">Active</option><option value="inactive">Inactive</option><option value="graduated">Graduated</option></select></Field></div>
      <Field label="Address"><textarea value={form.address} onChange={e => setForm(v => ({ ...v, address: e.target.value }))} rows="3" className="field"/></Field>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">Cancel</button><button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-50 inline-flex items-center gap-2"><Check size={14}/> {saving ? 'Saving…' : 'Save Changes'}</button></div>
    </form>}
  </Modal>;
}
