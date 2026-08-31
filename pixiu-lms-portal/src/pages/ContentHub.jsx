import { useState } from 'react';
import { PlaySquare, FileText, Upload, Search, Filter, Trash2, X, ExternalLink, BookOpen, Layers, ShieldCheck, Eye, Download, GraduationCap } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function ContentHub() {
  const { content, uploadContent, deleteContent } = useData();
  const { role } = useAuth();
  const toast = useToast();
  
  const [filterTarget, setFilterTarget] = useState('Trainer'); // Default to Trainer / Teacher clean packs
  const [selectedClass, setSelectedClass] = useState('All'); // 'All' | '6' | '7' | '8' | '9' | '11'
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    type: 'PDF',
    level: 'Level 1',
    class_grade: '6',
    target: 'Teacher',
    url: '/materials/class6-unit1-teacher.pdf',
    is_watermarked: 0,
    description: ''
  });

  const filteredContent = content.filter(item => {
    const isTeacherMaster = item.target === 'Teacher' || item.target === 'Trainer';
    const matchesTarget = filterTarget === 'All' ? isTeacherMaster : (item.target === 'Teacher' || item.target === 'Trainer');
    const matchesClass = selectedClass === 'All' || item.class_grade === selectedClass;
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTarget && matchesClass && matchesSearch;
  });

  const levelMap = { '6': 'Level 1', '7': 'Level 2', '8': 'Level 3', '9': 'Level 4', '11': 'Level 5' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const computedLevel = levelMap[formData.class_grade] || 'Level 1';
    await uploadContent({
      ...formData,
      level: computedLevel,
      target: 'Teacher',
      is_watermarked: 0
    });
    toast.success(`"${formData.title}" published to Content Hub!`, 'Teacher Master Uploaded');
    setIsModalOpen(false);
    setFormData({
      title: '',
      type: 'PDF',
      level: 'Level 1',
      class_grade: '6',
      target: 'Teacher',
      url: '',
      is_watermarked: 0,
      description: ''
    });
  };

  const handleOpenMaterial = (url) => {
    if (!url) {
      toast.warning("File URL not configured.");
      return;
    }
    window.open(url, '_blank');
  };

  const teacherPacksCount = content.filter(c => c.target === 'Teacher' || c.target === 'Trainer').length;

  return (
    <div className="pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">Teacher Master Content Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Clean Master Edition (No Watermark)
            </span>
          </div>
          <p className="text-slate-500 mt-1">Official faculty teaching guides, circuit schematics, viva questions & solution code across Classes 6 to 11.</p>
        </div>
        {role !== 'student' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-pixiu-blue text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer text-sm"
          >
            <Upload size={18} /> Upload Master Guide
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 rounded-xl text-white shadow-sm flex justify-between items-center bg-gradient-to-br from-slate-900 to-slate-800">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Teacher Units</p>
            <p className="text-3xl font-bold">{teacherPacksCount} Units</p>
          </div>
          <div className="bg-white/10 p-3 rounded-xl"><BookOpen size={24} /></div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-xl text-slate-800 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Active Classes</p>
            <p className="text-2xl font-bold text-slate-800">5 Grades (6, 7, 8, 9, 11)</p>
          </div>
          <div className="bg-blue-50 text-pixiu-blue p-3 rounded-xl"><Layers size={24} /></div>
        </div>

        <div className="bg-white border border-amber-200 p-6 rounded-xl text-slate-800 shadow-sm flex justify-between items-center bg-amber-50/20">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck size={14} className="text-amber-600" />
              <p className="text-amber-900 text-xs font-bold uppercase tracking-wider">Master Guide Format</p>
            </div>
            <p className="text-sm font-bold text-slate-700">100% Unwatermarked Faculty PDFs</p>
          </div>
          <div className="bg-amber-100 text-amber-700 p-3 rounded-xl"><ShieldCheck size={24} /></div>
        </div>
      </div>

      {/* Class & Search Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <span className="text-xs font-bold uppercase text-slate-400 mr-2 shrink-0">Filter Grade:</span>
          {['All', '6', '7', '8', '9', '11'].map(grade => (
            <button
              key={grade}
              onClick={() => setSelectedClass(grade)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedClass === grade 
                  ? 'bg-pixiu-blue text-white shadow-xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {grade === 'All' ? 'All Classes' : `Class ${grade}`}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search documents or topics..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue"
          />
        </div>
      </div>

      {/* Material Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContent.map(item => {
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-md text-[10px] font-bold uppercase tracking-wider">
                      Class {item.class_grade || '6'}
                    </span>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                      {item.level || 'Level 1'}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    <ShieldCheck size={11} /> Teacher Master (No Watermark)
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-pixiu-blue transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                  {item.description || 'Comprehensive robotics curriculum guide with schematics and exercises.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button 
                  onClick={() => handleOpenMaterial(item.url)}
                  className="bg-pixiu-blue hover:bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Eye size={13} /> View & Read PDF
                </button>

                {role !== 'student' && (
                  <button 
                    onClick={async () => {
                      if (confirm(`Remove material "${item.title}"?`)) {
                        await deleteContent(item.id);
                        toast.info(`Removed "${item.title}" from repository.`);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Resource"
                  >
                    <Trash2 size={15}/>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredContent.length === 0 && (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
            No study materials match your selected filters.
          </div>
        )}
      </div>

      {/* Upload Material Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800">Publish Teacher Master Material</h3>
                <p className="text-xs text-slate-500">Upload clean unwatermarked faculty teaching guide or circuit schematic</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18}/></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Document Title *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Class 6 - Unit 3: Motors & Actuators (Teacher Master)" 
                  value={formData.title} 
                  onChange={e => setFormData({ ...formData, title: e.target.value })} 
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Document Edition</label>
                  <select 
                    value={formData.target} 
                    onChange={e => setFormData({ ...formData, target: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                  >
                    <option value="Teacher">Teacher Master (No Watermark)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Target Class</label>
                  <select 
                    value={formData.class_grade} 
                    onChange={e => setFormData({ ...formData, class_grade: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                  >
                    <option value="6">Class 6</option>
                    <option value="7">Class 7</option>
                    <option value="8">Class 8</option>
                    <option value="9">Class 9</option>
                    <option value="11">Class 11</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">PDF File Resource URL *</label>
                <input 
                  type="text" 
                  placeholder="/materials/class6-unit1-student-watermarked.pdf" 
                  value={formData.url} 
                  onChange={e => setFormData({ ...formData, url: e.target.value })} 
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Brief Description</label>
                <textarea 
                  rows="2" 
                  placeholder="Outline core objectives and hardware prerequisites..." 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-xs shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Upload size={14}/> Publish Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
