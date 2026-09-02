import { useState } from 'react';
import { 
  Box, Search, Plus, Wrench, CheckCircle, AlertTriangle, Trash2, X, 
  Building2, User, Cpu, Sparkles, Edit3, Eye, Layers, ShieldCheck, 
  Sliders, ArrowRight, Check, Maximize2, ExternalLink
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function Inventory() {
  const { 
    inventory, schools, students, addInventoryKit, updateKitStatus, deleteKit,
    classKits = {}, updateClassKitComponent, addComponentToClassKit 
  } = useData();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('blueprints'); // 'blueprints' | 'allocations'
  const [selectedGrade, setSelectedGrade] = useState('6');

  // Search & Filter for Allocations Ledger
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [schoolFilter, setSchoolFilter] = useState('All');
  const [gradeFilter, setGradeFilter] = useState('All');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRmaModalOpen, setIsRmaModalOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState(null);
  const [editingComponent, setEditingComponent] = useState(null);
  const [isAddComponentModalOpen, setIsAddComponentModalOpen] = useState(false);
  const [isKitDiagramModalOpen, setIsKitDiagramModalOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: 'Pixiu Discovery STEM Hardware Kit',
    class_grade: '6',
    school_id: 'ZPS',
    assigned_student_id: '',
    status: 'Healthy',
    condition: 'Good',
    issue_notes: ''
  });

  const [rmaData, setRmaData] = useState({
    status: 'In Repair',
    condition: 'Damaged',
    issue_notes: ''
  });

  const [componentForm, setComponentForm] = useState({
    name: '',
    category: 'Sensor',
    role: '',
    session: 'Session 1',
    specs: '',
    image: '/img/kits/components/class6_part_1.jpg'
  });

  const healthyKits = inventory.filter(k => k.status === 'Healthy' || k.status === 'Assigned').length;
  const damagedKits = inventory.filter(k => k.status === 'Damaged' || k.status === 'In Repair').length;

  const currentClassKit = classKits[selectedGrade] || classKits['6'] || {};
  const currentComponents = currentClassKit.components || [];

  const filteredInventory = inventory.filter(kit => {
    const matchesSearch = (kit.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (kit.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ((kit.assigned_to || kit.assigned_student_id || '')).toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ((kit.issue_notes || '')).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || kit.status === statusFilter;
    const matchesSchool = schoolFilter === 'All' || kit.school_id === schoolFilter;
    const matchesGrade = gradeFilter === 'All' || kit.class_grade === gradeFilter;
    return matchesSearch && matchesStatus && matchesSchool && matchesGrade;
  });

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    await addInventoryKit({
      ...formData,
      assigned_to: formData.assigned_student_id
    });
    toast.success('New hardware kit registered and allocated!', 'Inventory Kit Added');
    setIsAddModalOpen(false);
  };

  const handleRmaSubmit = async (e) => {
    e.preventDefault();
    if (selectedKit) {
      await updateKitStatus(selectedKit.id, rmaData.status, rmaData.issue_notes);
      if (rmaData.status === 'Damaged') {
        toast.warning(`Kit ${selectedKit.id} flagged as Damaged. RMA Alert generated!`, 'RMA Workflow Triggered');
      } else {
        toast.success(`Kit ${selectedKit.id} status updated to ${rmaData.status}!`, 'Inventory Status Updated');
      }
      setIsRmaModalOpen(false);
      setSelectedKit(null);
    }
  };

  const openRmaModal = (kit) => {
    setSelectedKit(kit);
    setRmaData({
      status: kit.status === 'Healthy' || kit.status === 'Assigned' ? 'Damaged' : 'Healthy',
      condition: kit.condition || 'Good',
      issue_notes: kit.issue_notes || ''
    });
    setIsRmaModalOpen(true);
  };

  const handleSaveComponentEdit = (e) => {
    e.preventDefault();
    if (editingComponent) {
      updateClassKitComponent(selectedGrade, editingComponent.id, editingComponent);
      toast.success(`Updated ${editingComponent.name} for Class ${selectedGrade}!`, 'Kit Blueprint Saved');
      setEditingComponent(null);
    }
  };

  const handleAddComponentSubmit = (e) => {
    e.preventDefault();
    addComponentToClassKit(selectedGrade, componentForm);
    toast.success(`Added ${componentForm.name} to Class ${selectedGrade} Kit!`, 'Component Added');
    setIsAddComponentModalOpen(false);
    setComponentForm({
      name: '',
      category: 'Sensor',
      role: '',
      session: 'Session 1',
      specs: '',
      image: `/img/kits/components/class${selectedGrade}_part_1.jpg`
    });
  };

  return (
    <div className="pb-12 space-y-6">
      {/* Top Header & Master Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Hardware Kits & Curriculum Component Inventory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-pixiu-blue text-xs font-extrabold border border-blue-200">
              Admin Console
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Centrally manage curriculum kit blueprints extracted from official Unit 1 PDFs, assign physical kits to students, and track RMA repairs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-pixiu-blue hover:bg-blue-600 text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus size={16} /> Register Physical Kit
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex items-center justify-center text-pixiu-blue shrink-0">
            <Box size={22} />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">Total Physical Kits</p>
            <p className="text-lg sm:text-2xl font-black text-slate-800">{inventory.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">Healthy & In-Use</p>
            <p className="text-lg sm:text-2xl font-black text-emerald-600">{healthyKits}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Cpu size={22} />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">Class Kit Blueprints</p>
            <p className="text-lg sm:text-2xl font-black text-purple-600">5 Classes (6-11)</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider">Repair & RMA</p>
            <p className="text-lg sm:text-2xl font-black text-amber-600">{damagedKits}</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation: Class Kit Blueprints VS Physical Kit Allocations */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-2 max-w-md">
        <button
          onClick={() => setActiveTab('blueprints')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'blueprints'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={15} /> Class Kit Blueprints
        </button>
        <button
          onClick={() => setActiveTab('allocations')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'allocations'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Box size={15} /> Physical Allocations & RMA
        </button>
      </div>

      {/* ==================== TAB 1: CLASS KIT BLUEPRINTS ==================== */}
      {activeTab === 'blueprints' && (
        <div className="space-y-6">
          {/* Class Grade Selector Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Select Cohort:</span>
              {['6', '7', '8', '9', '11'].map(grade => (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedGrade === grade
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Cpu size={14} /> Class {grade}th Kit
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    selectedGrade === grade ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {classKits[grade]?.components?.length || 12}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsAddComponentModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus size={14} /> Add Component to Class {selectedGrade}
            </button>
          </div>

          {/* Master Overview Banner for Selected Grade */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-7 border border-slate-800 relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2 z-10 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-extrabold uppercase tracking-wider">
                  Official Unit 1 Intro PDF Extraction
                </span>
                <span className="text-slate-400 text-xs font-mono font-bold">
                  {currentClassKit.kit_id || `KIT-ZPS-${selectedGrade}`}
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white">
                {currentClassKit.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {currentClassKit.tagline}
              </p>
              <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
                <span>Total Components: <strong className="text-white">{currentComponents.length} Parts</strong></span>
                <span>•</span>
                <span>Active Cohort: <strong className="text-emerald-400">Class {selectedGrade}A Students</strong></span>
              </div>
            </div>

            {currentClassKit.overview_image && (
              <div className="relative group cursor-pointer shrink-0" onClick={() => setIsKitDiagramModalOpen(true)}>
                <img 
                  src={currentClassKit.overview_image} 
                  alt={currentClassKit.name}
                  className="w-full sm:w-80 h-44 object-cover rounded-2xl border border-white/10 shadow-2xl group-hover:scale-102 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-slate-950/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 text-xs font-bold flex items-center gap-1">
                    <Maximize2 size={12} /> Enlarge Diagram
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Grid of Individual Extracted Components */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Cpu size={16} className="text-pixiu-blue" />
                Class {selectedGrade} Component Ledger ({currentComponents.length} Extracted Items)
              </h3>
              <span className="text-xs text-slate-500">
                Visible only to enrolled Class {selectedGrade} students
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentComponents.map((comp) => (
                <div 
                  key={comp.id}
                  className="bg-white border border-slate-200 hover:border-pixiu-blue/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-xs hover:shadow-md transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3.5">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shrink-0 flex items-center justify-center p-1">
                        <img 
                          src={comp.image} 
                          alt={comp.name}
                          className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform"
                          onError={(e) => { e.target.src = currentClassKit.overview_image; }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 inline-block mb-1">
                          {comp.category || 'Component'}
                        </span>
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm leading-snug line-clamp-2">
                          {comp.name}
                        </h4>
                        <span className="text-[10px] text-pixiu-blue font-bold font-mono">
                          {comp.session || 'Unit 1'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] sm:text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                      {comp.role}
                    </p>

                    {comp.specs && (
                      <p className="text-[10px] text-slate-500 font-mono bg-blue-50/50 p-2 rounded-lg border border-blue-100 line-clamp-2">
                        ⚙️ {comp.specs}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-mono text-slate-400">ID: {comp.id}</span>
                    <button
                      onClick={() => setEditingComponent({ ...comp })}
                      className="text-xs font-bold text-pixiu-blue hover:text-blue-700 flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors"
                    >
                      <Edit3 size={12} /> Edit Blueprint
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: PHYSICAL ALLOCATIONS & RMA LEDGER ==================== */}
      {activeTab === 'allocations' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between bg-slate-50">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search Kit ID, student, school, notes..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-pixiu-blue bg-white" 
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                <span>Class:</span>
                <select 
                  value={gradeFilter}
                  onChange={e => setGradeFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-pixiu-blue cursor-pointer"
                >
                  <option value="All">All Classes</option>
                  <option value="6">Class 6</option>
                  <option value="7">Class 7</option>
                  <option value="8">Class 8</option>
                  <option value="9">Class 9</option>
                  <option value="11">Class 11</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                <span>Status:</span>
                <select 
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-pixiu-blue cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Assigned">Assigned & Active</option>
                  <option value="Healthy">Healthy</option>
                  <option value="In Repair">In Repair</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="font-semibold p-4">Kit Serial & Grade</th>
                  <th className="font-semibold p-4">Allocated Student & School</th>
                  <th className="font-semibold p-4">Audit Condition</th>
                  <th className="font-semibold p-4">Status & RMA Notes</th>
                  <th className="font-semibold p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.map(kit => {
                  const studentId = kit.assigned_to || kit.assigned_student_id;
                  const assignedStudent = students.find(s => s.student_id === studentId);
                  const assignedSchool = schools.find(s => s.id === kit.school_id);

                  return (
                    <tr key={kit.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-mono text-xs sm:text-sm font-bold text-pixiu-blue">{kit.id}</div>
                        <div className="text-xs font-semibold text-slate-700 mt-0.5">{kit.name}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-extrabold border border-blue-100">
                          Class {kit.class_grade || '6'}th Kit
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400"/> 
                          {assignedStudent ? `${assignedStudent.name}` : studentId || 'Unassigned Stock'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                          <Building2 size={11} className="text-slate-400"/> {assignedSchool ? assignedSchool.name : 'Zenith Public School'} • {studentId || 'Stock'}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ShieldCheck size={12} /> {kit.condition || 'Good'}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">Audit: {kit.last_audit || '2026-08-28'}</p>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          kit.status === 'Healthy' || kit.status === 'Assigned'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          kit.status === 'In Repair' 
                            ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                            : 'bg-rose-100 text-rose-700 border border-rose-200'
                        }`}>
                          {kit.status === 'Healthy' || kit.status === 'Assigned' ? <CheckCircle size={12}/> : <Wrench size={12}/>} 
                          {kit.status || 'Assigned'}
                        </span>
                        {kit.issue_notes && (
                          <p className="text-[11px] text-slate-500 mt-1 italic max-w-xs">{kit.issue_notes}</p>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button 
                            onClick={() => openRmaModal(kit)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Manage RMA / Report Damage"
                          >
                            <Wrench size={12}/> Status / RMA
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm(`Remove kit record ${kit.id}?`)) {
                                deleteKit(kit.id);
                              }
                            }}
                            className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Kit"
                          >
                            <Trash2 size={15}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredInventory.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs sm:text-sm">
              No matching physical kit records found.
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL 1: EDIT BLUEPRINT COMPONENT ==================== */}
      {editingComponent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">Edit Class {selectedGrade} Component</h2>
                <p className="text-xs text-slate-500">Modify description, role, pinouts or session introduced</p>
              </div>
              <button onClick={() => setEditingComponent(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>

            <form onSubmit={handleSaveComponentEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Component Name *</label>
                <input 
                  type="text" 
                  value={editingComponent.name} 
                  onChange={e => setEditingComponent({ ...editingComponent, name: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                  <select 
                    value={editingComponent.category || 'Sensor'} 
                    onChange={e => setEditingComponent({ ...editingComponent, category: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    <option value="Controller">Controller</option>
                    <option value="Sensor">Sensor</option>
                    <option value="Actuator">Actuator</option>
                    <option value="Display">Display</option>
                    <option value="Wiring">Wiring</option>
                    <option value="Passive Component">Passive Component</option>
                    <option value="Motor Driver">Motor Driver</option>
                    <option value="Mechanical Chassis">Mechanical Chassis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">First Used Session</label>
                  <input 
                    type="text" 
                    value={editingComponent.session} 
                    onChange={e => setEditingComponent({ ...editingComponent, session: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role / What It Does *</label>
                <textarea 
                  rows={2}
                  value={editingComponent.role} 
                  onChange={e => setEditingComponent({ ...editingComponent, role: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Electrical & Technical Specifications</label>
                <input 
                  type="text" 
                  value={editingComponent.specs || ''} 
                  onChange={e => setEditingComponent({ ...editingComponent, specs: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue font-mono"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEditingComponent(null)} 
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-xl text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Save Blueprint Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: ADD COMPONENT TO CLASS ==================== */}
      {isAddComponentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">Add New Component to Class {selectedGrade}</h2>
                <p className="text-xs text-slate-500">Insert new hardware module into this class's assigned kit</p>
              </div>
              <button onClick={() => setIsAddComponentModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>

            <form onSubmit={handleAddComponentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Component Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. MPU-6050 Gyroscope Module"
                  value={componentForm.name} 
                  onChange={e => setComponentForm({ ...componentForm, name: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                  <select 
                    value={componentForm.category} 
                    onChange={e => setComponentForm({ ...componentForm, category: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    <option value="Controller">Controller</option>
                    <option value="Sensor">Sensor</option>
                    <option value="Actuator">Actuator</option>
                    <option value="Display">Display</option>
                    <option value="Wiring">Wiring</option>
                    <option value="Passive Component">Passive Component</option>
                    <option value="Motor Driver">Motor Driver</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">First Used Session</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Session 14"
                    value={componentForm.session} 
                    onChange={e => setComponentForm({ ...componentForm, session: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">What It Does / Lab Role *</label>
                <textarea 
                  rows={2}
                  placeholder="Explain what the student builds with this module..."
                  value={componentForm.role} 
                  onChange={e => setComponentForm({ ...componentForm, role: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Technical Specs</label>
                <input 
                  type="text" 
                  placeholder="e.g. 3.3V-5V I2C digital motion processing"
                  value={componentForm.specs} 
                  onChange={e => setComponentForm({ ...componentForm, specs: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue font-mono"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsAddComponentModalOpen(false)} 
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  Add to Class {selectedGrade}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: REGISTER PHYSICAL KIT ==================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">Register Physical Hardware Kit</h2>
                <p className="text-xs text-slate-500">Allocate new box to a specific class cohort and student</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kit Name / Tag *</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Class Cohort</label>
                  <select 
                    value={formData.class_grade} 
                    onChange={e => setFormData({ ...formData, class_grade: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    <option value="6">Class 6</option>
                    <option value="7">Class 7</option>
                    <option value="8">Class 8</option>
                    <option value="9">Class 9</option>
                    <option value="11">Class 11</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({ ...formData, status: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    <option value="Assigned">Assigned & Active</option>
                    <option value="Healthy">Healthy (In Stock)</option>
                    <option value="In Repair">In Repair</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">School</label>
                  <select 
                    value={formData.school_id} 
                    onChange={e => setFormData({ ...formData, school_id: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign to Student</label>
                  <select
                    value={formData.assigned_student_id}
                    onChange={e => setFormData({ ...formData, assigned_student_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    <option value="">Select Student</option>
                    {students.map(s => (
                      <option key={s.id} value={s.student_id}>
                        {s.name} ({s.student_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-xl text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Register Kit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 4: RMA / STATUS UPDATE ==================== */}
      {isRmaModalOpen && selectedKit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">RMA & Maintenance Update</h2>
                <p className="text-xs text-slate-500">Managing Kit: <strong className="font-mono text-pixiu-blue">{selectedKit.id}</strong></p>
              </div>
              <button onClick={() => setIsRmaModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleRmaSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select New Status</label>
                <select 
                  value={rmaData.status} 
                  onChange={e => setRmaData({ ...rmaData, status: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                >
                  <option value="Assigned">Assigned (Operational & Verified)</option>
                  <option value="Healthy">Healthy (Central Stock)</option>
                  <option value="In Repair">In Repair (Technician Dispatched)</option>
                  <option value="Damaged">Damaged (Replacement Part Requested)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Issue / Maintenance Notes</label>
                <textarea 
                  rows={3}
                  placeholder="e.g. Ultrasonic sensor pin bent; replaced servo horn." 
                  value={rmaData.issue_notes} 
                  onChange={e => setRmaData({ ...rmaData, issue_notes: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsRmaModalOpen(false)} 
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-xl text-xs shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 5: ENLARGED KIT DIAGRAM ==================== */}
      {isKitDiagramModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800">
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base">
                  {currentClassKit.name}
                </h3>
                <p className="text-slate-400 text-xs">{currentClassKit.tagline}</p>
              </div>
              <button 
                onClick={() => setIsKitDiagramModalOpen(false)}
                className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 sm:p-6 bg-slate-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img 
                src={currentClassKit.overview_image} 
                alt="Kit Blueprint" 
                className="max-w-full max-h-[70vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
