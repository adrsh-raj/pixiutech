import { useState, useEffect } from 'react';
import { Search, Plus, MoreVertical, MessageCircle, Building2, X, FileText, ChevronRight, User, Award, Activity, Box, Trash2, Edit, Check, Phone, GraduationCap } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { generateStudentTranscriptPDF } from '../utils/transcriptGenerator';

const generateId = (schoolCode, cls, sec, roll) => {
  return `${schoolCode}${cls}${sec ? sec : ''} ${roll}`;
};

export default function Students() {
  const { schools, classes, students, projects, studentReviews, curriculum, addStudent, updateStudent, deleteStudent, getNextRollNumber, getStudentAttendance } = useData();
  const toast = useToast();
  
  const [selectedSchool, setSelectedSchool] = useState('All');
  const [selectedClassFilter, setSelectedClassFilter] = useState('All');
  const [activeStudent, setActiveStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    schoolCode: 'ZPS', class: '6', section: 'A', roll: '', name: '', parent: '', phone: '', level: 'Level 1', assigned_kit_id: 'KIT-6001'
  });

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '', parent_name: '', parent_whatsapp: '', tech_level: 'Level 1', status: 'Active', assigned_kit_id: ''
  });

  useEffect(() => {
    if (isAddModalOpen) {
      const nextRoll = getNextRollNumber(formData.schoolCode, formData.class, formData.section);
      setFormData(prev => ({ ...prev, roll: nextRoll }));
    }
  }, [formData.schoolCode, formData.class, formData.section, isAddModalOpen]);

  const filteredStudents = students.filter(s => {
    const matchesSchool = selectedSchool === 'All' || s.school_id === selectedSchool;
    const matchesClass = selectedClassFilter === 'All' || s.class_id === selectedClassFilter;
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.student_id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSchool && matchesClass && matchesSearch;
  });

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const newId = generateId(formData.schoolCode, formData.class, formData.section, formData.roll);
    
    await addStudent({
      student_id: newId, 
      school_id: formData.schoolCode, 
      class_id: `CLS-${formData.schoolCode}-${formData.class}${formData.section}`,
      name: formData.name,
      parent_name: formData.parent, 
      parent_whatsapp: formData.phone, 
      tech_level: formData.level,
      assigned_kit_id: formData.assigned_kit_id,
      status: 'Active'
    });
    
    toast.success(`Student ${formData.name} enrolled with ID "${newId}"!`, 'Student Registered');
    setIsAddModalOpen(false);
    setFormData(prev => ({ ...prev, name: '', parent: '', phone: '' }));
  };

  const handleOpenEdit = (e, student) => {
    e.stopPropagation();
    setEditingStudent(student);
    setEditFormData({
      name: student.name || '',
      parent_name: student.parent_name || '',
      parent_whatsapp: student.parent_whatsapp || '',
      tech_level: student.tech_level || 'Level 1',
      status: student.status || 'Active',
      assigned_kit_id: student.assigned_kit_id || ''
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    await updateStudent(editingStudent.student_id, editFormData);
    toast.success(`Student "${editFormData.name}" (${editingStudent.student_id}) details updated!`, 'Profile Updated');
    
    if (activeStudent && activeStudent.student_id === editingStudent.student_id) {
      setActiveStudent(prev => ({ ...prev, ...editFormData }));
    }
    
    setEditingStudent(null);
  };

  const openWhatsApp = (e, phone, name) => {
    e.stopPropagation();
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const text = encodeURIComponent(`Hello, this is an update from Pixiu Tech regarding ${name}'s robotics lab performance.`);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const handlePrintPDF = (e, student) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const schoolName = schools.find(s => s.id === student.school_id)?.name || 'Zenith Public School';
    const studentProjects = projects.filter(p => p.student_id === student.student_id);
    const attendancePercentage = getStudentAttendance(student.student_id);

    generateStudentTranscriptPDF({
      student,
      school: schoolName,
      attendanceRate: attendancePercentage,
      studentReviews: studentReviews || [],
      projects: studentProjects,
      curriculum: curriculum || []
    });
  };

  // View: Single Student Profile Detailed Screen
  if (activeStudent) {
    const schoolName = schools.find(s => s.id === activeStudent.school_id)?.name || 'Zenith Public School';
    const classObj = classes.find(c => c.id === activeStudent.class_id);
    const attendancePercentage = getStudentAttendance(activeStudent.student_id);
    const cleanActiveId = (activeStudent.student_id || '').trim().replace(/\s+/g, ' ');
    const studentProjects = projects.filter(p => (p.student_id || '').trim().replace(/\s+/g, ' ') === cleanActiveId);

    return (
      <div className="pb-10">
        <button 
          onClick={() => setActiveStudent(null)}
          className="mb-6 text-sm text-slate-500 hover:text-slate-800 flex items-center gap-2 cursor-pointer font-bold"
        >
          ← Back to Students Directory
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-slate-900 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-md">
                {activeStudent.name.split(' ').map(w => w[0]).join('')}
              </div>
              <h2 className="text-xl font-bold text-slate-800">{activeStudent.name}</h2>
              <p className="font-mono text-pixiu-blue font-bold text-xs mt-0.5">{activeStudent.student_id}</p>
              <span className="inline-block mt-2 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                {activeStudent.status} Student
              </span>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
              <div>
                <p className="text-slate-400 font-bold uppercase">School & Class</p>
                <p className="font-bold text-slate-700 mt-0.5">{schoolName} • Class {classObj ? `${classObj.grade} ${classObj.section}` : '6A'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase">Parent Contact</p>
                <p className="font-bold text-slate-700 mt-0.5">{activeStudent.parent_name || 'Ravi Sharma'} ({activeStudent.parent_whatsapp || '919876543210'})</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase">Assigned Hardware Kit</p>
                <p className="font-bold font-mono text-slate-700 mt-0.5">{activeStudent.assigned_kit_id || 'KIT-6001'}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
              <button 
                onClick={(e) => handleOpenEdit(e, activeStudent)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Edit size={14} /> Edit Student Details
              </button>
              <button 
                onClick={(e) => handlePrintPDF(e, activeStudent)}
                className="w-full bg-pixiu-blue hover:bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <FileText size={14} /> Generate Progress Card PDF
              </button>
            </div>
          </div>

          {/* Metrics & Projects Portfolio */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center"><Award size={24}/></div>
                <div><p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Current Level</p><p className="text-xl font-bold text-slate-800">{activeStudent.tech_level}</p></div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Activity size={24}/></div>
                <div><p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Attendance</p><p className="text-xl font-bold text-slate-800">{attendancePercentage}%</p></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Robotics Project Portfolio & Certified Builds</h3>
                <span className="text-xs font-bold bg-blue-50 text-pixiu-blue px-2.5 py-0.5 rounded-full border border-blue-100">
                  {studentProjects.length} Certified Builds
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {studentProjects.map(prj => (
                  <div key={prj.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-white transition-all shadow-xs">
                    {prj.image_url ? (
                      <div className="w-full h-36 rounded-lg overflow-hidden mb-3 border border-slate-200 bg-slate-900">
                        <img src={prj.image_url} alt={prj.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-28 bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-slate-400 text-xs font-bold uppercase">
                        🤖 Circuit & Hardware Build
                      </div>
                    )}
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{prj.title}</h4>
                        {prj.evidence_note && <p className="text-xs text-slate-500 mt-0.5">{prj.evidence_note}</p>}
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md shrink-0">
                        {prj.score || 10}/10
                      </span>
                    </div>
                    {prj.date_completed && (
                      <p className="text-[10px] text-slate-400 mt-2 font-mono">Completed: {prj.date_completed}</p>
                    )}
                  </div>
                ))}

                {studentProjects.length === 0 && (
                  <div className="col-span-2 p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    No hardware projects uploaded yet for this student. Use the Trainer Session Runner to snap and upload robot builds!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Student Directory & Academic Records</h1>
          <p className="text-slate-500">Manage enrolled student rosters, edit details, and track hands-on kit allocations.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-pixiu-blue text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={18} /> Enroll New Student
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* School Selector */}
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-pixiu-blue" />
            <select 
              value={selectedSchool}
              onChange={(e) => {
                setSelectedSchool(e.target.value);
                setSelectedClassFilter('All');
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-pixiu-blue"
            >
              <option value="All">All Partner Schools</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          {/* Class Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button 
              onClick={() => setSelectedClassFilter('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedClassFilter === 'All' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Grades
            </button>
            {classes.filter(c => selectedSchool === 'All' || c.school_id === selectedSchool).map(c => (
              <button 
                key={c.id}
                onClick={() => setSelectedClassFilter(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedClassFilter === c.id ? 'bg-pixiu-blue text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Class {c.grade}{c.section}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search by student or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue"
          />
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4 pl-6">Student & Canonical ID</th>
                <th className="p-4">Class & School</th>
                <th className="p-4">Parent WhatsApp</th>
                <th className="p-4">Tech Level</th>
                <th className="p-4">Hardware Kit</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStudents.map(student => {
                const schoolObj = schools.find(s => s.id === student.school_id);
                return (
                  <tr 
                    key={student.student_id} 
                    onClick={() => setActiveStudent(student)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs group-hover:bg-pixiu-blue group-hover:text-white transition-colors">
                          {student.name.split(' ').map(w => w[0]).join('')}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{student.name}</p>
                          <span className="font-mono text-[10px] text-pixiu-blue font-bold tracking-tight">{student.student_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-700">
                      {schoolObj ? schoolObj.name : student.school_id}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-600">{student.parent_whatsapp || '919876543210'}</span>
                        <button 
                          onClick={(e) => openWhatsApp(e, student.parent_whatsapp, student.name)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                          title="Send WhatsApp Update"
                        >
                          <MessageCircle size={15}/>
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-pixiu-blue border border-blue-100">
                        {student.tech_level}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-600">
                      {student.assigned_kit_id || 'KIT-6001'}
                    </td>
                    <td className="p-4 text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Edit Button */}
                        <button 
                          onClick={(e) => handleOpenEdit(e, student)}
                          className="p-1.5 text-slate-500 hover:text-pixiu-blue hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Student Details"
                        >
                          <Edit size={15}/>
                        </button>

                        {/* PDF Report Button */}
                        <button 
                          onClick={(e) => handlePrintPDF(e, student)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Print Student Report"
                        >
                          <FileText size={15}/>
                        </button>

                        {/* Delete Button */}
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`Remove student ${student.name} (${student.student_id})?`)) {
                              await deleteStudent(student.student_id);
                              toast.info(`Student ${student.name} removed from registry`, 'Student Deleted');
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Student"
                        >
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400 text-xs">
                    No students found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">Edit Student Details</h3>
                <p className="text-xs font-mono text-pixiu-blue font-bold">{editingStudent.student_id}</p>
              </div>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18}/></button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Student Full Name *</label>
                <input 
                  type="text" 
                  value={editFormData.name} 
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} 
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Parent Name</label>
                  <input 
                    type="text" 
                    value={editFormData.parent_name} 
                    onChange={e => setEditFormData({ ...editFormData, parent_name: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Parent WhatsApp Phone</label>
                  <input 
                    type="text" 
                    value={editFormData.parent_whatsapp} 
                    onChange={e => setEditFormData({ ...editFormData, parent_whatsapp: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Tech Level</label>
                  <select 
                    value={editFormData.tech_level} 
                    onChange={e => setEditFormData({ ...editFormData, tech_level: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-pixiu-blue font-bold"
                  >
                    <option value="Level 1">Level 1 (Class 6 - Sensor Basics)</option>
                    <option value="Level 2">Level 2 (Class 7 - Microcontrollers)</option>
                    <option value="Level 3">Level 3 (Class 8 - PID Autonomous)</option>
                    <option value="Level 4">Level 4 (Class 9 - IoT & Cloud)</option>
                    <option value="Level 5">Level 5 (Class 11 - Advanced AI & Vision)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Assigned Kit ID</label>
                  <input 
                    type="text" 
                    value={editFormData.assigned_kit_id} 
                    onChange={e => setEditFormData({ ...editFormData, assigned_kit_id: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Enrollment Status</label>
                <select 
                  value={editFormData.status} 
                  onChange={e => setEditFormData({ ...editFormData, status: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-pixiu-blue"
                >
                  <option value="Active">Active</option>
                  <option value="Graduated">Graduated</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEditingStudent(null)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-xs shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14}/> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">Enroll New Student</h3>
                <p className="text-xs text-slate-500">Auto-assigns canonical roll number & login account</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18}/></button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">School</label>
                  <select 
                    value={formData.schoolCode} 
                    onChange={e => setFormData({ ...formData, schoolCode: e.target.value })} 
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-bold"
                  >
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Grade</label>
                  <select 
                    value={formData.class} 
                    onChange={e => setFormData({ ...formData, class: e.target.value })} 
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-bold"
                  >
                    <option value="6">Class 6</option>
                    <option value="7">Class 7</option>
                    <option value="8">Class 8</option>
                    <option value="9">Class 9</option>
                    <option value="11">Class 11</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Section</label>
                  <select 
                    value={formData.section} 
                    onChange={e => setFormData({ ...formData, section: e.target.value })} 
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white font-bold"
                  >
                    <option value="A">Section A</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Student Full Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Aarav Sharma" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Parent Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Ravi Sharma" 
                    value={formData.parent} 
                    onChange={e => setFormData({ ...formData, parent: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">WhatsApp Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 919876543210" 
                    value={formData.phone} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Tech Level</label>
                  <select 
                    value={formData.level} 
                    onChange={e => setFormData({ ...formData, level: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-bold"
                  >
                    <option value="Level 1">Level 1</option>
                    <option value="Level 2">Level 2</option>
                    <option value="Level 3">Level 3</option>
                    <option value="Level 4">Level 4</option>
                    <option value="Level 5">Level 5</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Assigned Kit ID</label>
                  <input 
                    type="text" 
                    value={formData.assigned_kit_id} 
                    onChange={e => setFormData({ ...formData, assigned_kit_id: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Enroll Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
