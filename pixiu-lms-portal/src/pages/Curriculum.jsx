import { useState } from 'react';
import { BookOpen, Clock, Plus, Target, CheckCircle2, X, Layers, Check, Circle } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function Curriculum() {
  const { curriculum, addCurriculumPlan, updateCurriculumStatus } = useData();
  const toast = useToast();
  const [level, setLevel] = useState('Level 1');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const levelGradeMap = {
    'Level 1': 'Class 6',
    'Level 2': 'Class 7',
    'Level 3': 'Class 8',
    'Level 4': 'Class 9',
    'Level 5': 'Class 11',
  };

  const [formData, setFormData] = useState({
    week: 'Week 1',
    level: 'Level 1',
    topic: '',
    objectives: '',
    status: 'Upcoming'
  });

  const filteredCurriculum = curriculum.filter(c => c.level === level);

  const handleToggleStatus = async (session) => {
    const newStatus = session.status === 'Completed' ? 'Upcoming' : 'Completed';
    await updateCurriculumStatus(session.id, newStatus);
    if (newStatus === 'Completed') {
      toast.success(`"${session.topic}" marked as Taught!`, 'Curriculum Progress Updated');
    } else {
      toast.info(`"${session.topic}" set back to Untaught/Upcoming.`, 'Status Updated');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addCurriculumPlan({
      ...formData,
      level: level
    });
    setIsModalOpen(false);
    setFormData({
      week: `Week ${filteredCurriculum.length + 1}`,
      level: level,
      topic: '',
      objectives: '',
      status: 'Upcoming'
    });
  };

  return (
    <div className="pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Curriculum & Session Plans</h1>
          <p className="text-slate-500">Class-wise structured syllabus (Classes 6, 7, 8, 9, 11). Track taught units and lesson objectives.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-pixiu-blue text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={18} /> Add Session Plan
        </button>
      </div>

      {/* Level Tabs with Class Grade */}
      <div className="flex gap-2 mb-8 border-b border-slate-200 overflow-x-auto pb-1">
        {['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'].map(lvl => (
          <button 
            key={lvl}
            onClick={() => {
              setLevel(lvl);
              setFormData(prev => ({ ...prev, level: lvl }));
            }}
            className={`px-5 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              level === lvl 
                ? 'border-pixiu-blue text-pixiu-blue bg-blue-50/40 rounded-t-lg' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {lvl} ({levelGradeMap[lvl]}) • {curriculum.filter(c => c.level === lvl).length} Units
          </button>
        ))}
      </div>

      {/* Session Plan Cards */}
      <div className="max-w-4xl space-y-4">
        {filteredCurriculum.map((session, i) => (
          <div 
            key={session.id || i} 
            className={`p-6 rounded-2xl border transition-all ${
              session.status === 'Completed' 
                ? 'border-emerald-200 bg-white shadow-xs' 
                : 'border-slate-200 bg-white shadow-xs hover:border-slate-300'
            }`}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                  session.status === 'Completed' 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {session.week}
                </div>
                <h3 className="text-lg font-bold text-slate-800">{session.topic}</h3>
              </div>

              {/* Interactive Taught Toggle Button */}
              <button
                onClick={() => handleToggleStatus(session)}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border ${
                  session.status === 'Completed' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 shadow-xs' 
                    : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                }`}
                title={session.status === 'Completed' ? 'Click to mark Untaught' : 'Click to mark as Taught'}
              >
                {session.status === 'Completed' ? (
                  <>
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    <span>Taught (Completed)</span>
                  </>
                ) : (
                  <>
                    <Circle size={14} className="text-slate-400" />
                    <span>Untaught • Mark as Taught</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="pl-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Target size={14}/> Key Learning Objectives & Hands-on Activity
              </p>
              <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                {session.objectives}
              </div>
            </div>
          </div>
        ))}

        {filteredCurriculum.length === 0 && (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <BookOpen size={36} className="mx-auto text-slate-300 mb-3" />
            <h3 className="font-bold text-slate-700">No sessions defined for {level} yet</h3>
            <p className="text-sm text-slate-400 mt-1 mb-4">Add lesson objectives and hardware tasks for your trainers.</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-pixiu-blue text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm cursor-pointer"
            >
              + Create Week 1 Plan
            </button>
          </div>
        )}
      </div>

      {/* Add Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Add Session Plan ({level})</h2>
                <p className="text-xs text-slate-500">Define lesson objectives and required practical kit build</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Week / Session #</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Week 3" 
                    value={formData.week} 
                    onChange={e => setFormData({ ...formData, week: e.target.value })} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({ ...formData, status: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Current">Current (Active)</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Topic Title *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Obstacle Avoidance using Ultrasonic Sensor" 
                  value={formData.topic} 
                  onChange={e => setFormData({ ...formData, topic: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Learning Objectives & Practical Task *</label>
                <textarea 
                  rows={3}
                  placeholder="e.g. Understand echo/trigger pins, write conditional logic in Arduino IDE, assemble sensor mount." 
                  value={formData.objectives} 
                  onChange={e => setFormData({ ...formData, objectives: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 font-medium text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-sm shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Save Session Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
