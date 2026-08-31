import { useState } from 'react';
import { Box, Search, Plus, Wrench, CheckCircle, AlertTriangle, Trash2, X, Building2, User } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function Inventory() {
  const { inventory, schools, students, addInventoryKit, updateKitStatus, deleteKit } = useData();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [schoolFilter, setSchoolFilter] = useState('All');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRmaModalOpen, setIsRmaModalOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState(null);

  const [formData, setFormData] = useState({
    name: 'Level 1 Robotics Core Kit',
    level: 'Level 1',
    school_id: 'ZPS',
    assigned_student_id: '',
    status: 'Healthy',
    issue_notes: ''
  });

  const [rmaData, setRmaData] = useState({
    status: 'In Repair',
    issue_notes: ''
  });

  const healthyKits = inventory.filter(k => k.status === 'Healthy').length;
  const damagedKits = inventory.filter(k => k.status === 'Damaged' || k.status === 'In Repair').length;

  const filteredInventory = inventory.filter(kit => {
    const matchesSearch = kit.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          kit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (kit.issue_notes && kit.issue_notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || kit.status === statusFilter;
    const matchesSchool = schoolFilter === 'All' || kit.school_id === schoolFilter;
    return matchesSearch && matchesStatus && matchesSchool;
  });

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    await addInventoryKit(formData);
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
      status: kit.status === 'Healthy' ? 'Damaged' : 'Healthy',
      issue_notes: kit.issue_notes || ''
    });
    setIsRmaModalOpen(true);
  };

  return (
    <div className="pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hardware & Kit Inventory (RMA)</h1>
          <p className="text-slate-500">Track robotics kits, student allocations, and manage the repair & RMA lifecycle.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-pixiu-blue text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={18} /> Register New Kit
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Box size={24} /></div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Physical Kits</p>
            <p className="text-2xl font-bold text-slate-800">{inventory.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle size={24} /></div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Healthy & In-Use</p>
            <p className="text-2xl font-bold text-emerald-600">{healthyKits}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><AlertTriangle size={24} /></div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Repair / Damage Tickets</p>
            <p className="text-2xl font-bold text-amber-600">{damagedKits}</p>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search Kit ID, name, or issue notes..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue bg-white" 
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
              <span>School:</span>
              <select 
                value={schoolFilter}
                onChange={e => setSchoolFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-pixiu-blue cursor-pointer"
              >
                <option value="All">All Schools</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
              <span>Status:</span>
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-pixiu-blue cursor-pointer"
              >
                <option value="All">All Statuses</option>
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
              <tr className="bg-white text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="font-semibold p-4">Kit ID & Model</th>
                <th className="font-semibold p-4">Deployment (School & Student)</th>
                <th className="font-semibold p-4">Level</th>
                <th className="font-semibold p-4">Status & Notes</th>
                <th className="font-semibold p-4 text-right">RMA Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map(kit => {
                const assignedStudent = students.find(s => s.student_id === kit.assigned_student_id);
                const assignedSchool = schools.find(s => s.id === kit.school_id);

                return (
                  <tr key={kit.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-mono text-sm font-bold text-pixiu-blue">{kit.id}</div>
                      <div className="text-xs font-medium text-slate-700 mt-0.5">{kit.name}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                        <Building2 size={14} className="text-slate-400"/> {assignedSchool ? assignedSchool.name : 'Unassigned School'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <User size={12} className="text-slate-400"/> {assignedStudent ? `${assignedStudent.name} (${assignedStudent.student_id})` : 'Central Lab Stock'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-700">
                        {kit.level}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        kit.status === 'Healthy' 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        kit.status === 'In Repair' 
                          ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                          : 'bg-rose-100 text-rose-700 border border-rose-200'
                      }`}>
                        {kit.status === 'Healthy' ? <CheckCircle size={12}/> : <Wrench size={12}/>} {kit.status}
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
                          <Wrench size={13}/> Change Status
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm(`Remove kit ${kit.id}?`)) {
                              deleteKit(kit.id);
                            }
                          }}
                          className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete Kit"
                        >
                          <Trash2 size={16}/>
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
          <div className="p-8 text-center text-slate-500">
            No hardware kits found. Click "+ Register New Kit" to add assets!
          </div>
        )}
      </div>

      {/* Register Kit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Register Hardware Kit</h2>
                <p className="text-xs text-slate-500">Add physical robotics & IoT kits into inventory</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kit Name / Model *</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tech Level</label>
                  <select 
                    value={formData.level} 
                    onChange={e => setFormData({ ...formData, level: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    <option value="Level 1">Level 1</option>
                    <option value="Level 2">Level 2</option>
                    <option value="Level 3">Level 3</option>
                    <option value="Level 4">Level 4</option>
                    <option value="Level 5">Level 5</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Status</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({ ...formData, status: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    <option value="Healthy">Healthy</option>
                    <option value="In Repair">In Repair</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deploy to School</label>
                  <select 
                    value={formData.school_id} 
                    onChange={e => setFormData({ ...formData, school_id: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    <option value="">Central Stock</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign to Student ID</label>
                  <input 
                    type="text" 
                    placeholder="e.g. ZPS6A 01 (Optional)" 
                    value={formData.assigned_student_id} 
                    onChange={e => setFormData({ ...formData, assigned_student_id: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 font-medium text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-sm shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Register Kit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RMA / Status Modal */}
      {isRmaModalOpen && selectedKit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">RMA & Kit Status Update</h2>
                <p className="text-xs text-slate-500">Updating Kit: <strong className="font-mono text-pixiu-blue">{selectedKit.id}</strong></p>
              </div>
              <button onClick={() => setIsRmaModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleRmaSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select New Status</label>
                <select 
                  value={rmaData.status} 
                  onChange={e => setRmaData({ ...rmaData, status: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                >
                  <option value="Healthy">Healthy (Repaired & Operational)</option>
                  <option value="In Repair">In Repair (Technician dispatched)</option>
                  <option value="Damaged">Damaged (Broken part reported)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Issue / Maintenance Notes</label>
                <textarea 
                  rows={3}
                  placeholder="e.g. Ultrasonic sensor pin bent; replaced motor driver." 
                  value={rmaData.issue_notes} 
                  onChange={e => setRmaData({ ...rmaData, issue_notes: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsRmaModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 font-medium text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-sm shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
