import { useState } from 'react';
import { Building2, Search, Plus, Phone, Calendar, IndianRupee, Trash2, X, Users, BookOpen, CheckCircle } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function Schools() {
  const { schools, classes, students, addSchool, deleteSchool } = useData();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    principal: '',
    contact: '',
    status: 'Active',
    contract_start: new Date().toISOString().split('T')[0],
    renewal_date: '2027-03-31',
    expected_revenue: 150000
  });

  const filteredSchools = schools.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = formData.code.toUpperCase().trim();
    await addSchool({
      id: code,
      name: formData.name,
      code: code,
      principal: formData.principal,
      contact: formData.contact,
      status: formData.status,
      contract_start: formData.contract_start,
      renewal_date: formData.renewal_date,
      expected_revenue: Number(formData.expected_revenue) || 0
    });
    toast.success(`${formData.name} successfully onboarded!`, 'Partner School Added');
    setIsModalOpen(false);
    setFormData({
      name: '',
      code: '',
      principal: '',
      contact: '',
      status: 'Active',
      contract_start: new Date().toISOString().split('T')[0],
      renewal_date: '2027-03-31',
      expected_revenue: 150000
    });
  };

  const getStudentCountForSchool = (schoolId) => {
    return students.filter(s => s.school_id === schoolId).length;
  };

  const getClassCountForSchool = (schoolId) => {
    return classes.filter(c => c.school_id === schoolId).length;
  };

  return (
    <div className="pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Partner Schools (Client Directory)</h1>
          <p className="text-slate-500">Manage onboarded schools, contracts, and view nested classes and students.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-pixiu-blue text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={18} /> Onboard School
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Building2 size={24} /></div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Partners</p>
            <p className="text-2xl font-bold text-slate-800">{schools.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle size={24} /></div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Active Contracts</p>
            <p className="text-2xl font-bold text-slate-800">{schools.filter(s => s.status === 'Active').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600"><Users size={24} /></div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Enrolled Students</p>
            <p className="text-2xl font-bold text-slate-800">{students.length}</p>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by school name or code..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue bg-white" 
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
            <span>Status:</span>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-pixiu-blue cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Trial">Trial</option>
              <option value="Paused">Paused</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="font-semibold p-4">School Details</th>
                <th className="font-semibold p-4">Principal / POC</th>
                <th className="font-semibold p-4">Enrolled / Classes</th>
                <th className="font-semibold p-4">Contract Period</th>
                <th className="font-semibold p-4">Revenue</th>
                <th className="font-semibold p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchools.map(school => (
                <tr key={school.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      {school.name}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        school.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {school.status}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-pixiu-blue font-bold mt-1">Code: {school.code}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-medium text-slate-700">{school.principal || 'N/A'}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={12}/> {school.contact || 'No phone'}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-700">
                        <Users size={12}/> {getStudentCountForSchool(school.id)} Students
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-700">
                        <BookOpen size={12}/> {getClassCountForSchool(school.id)} Classes
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-slate-600 flex items-center gap-1">
                      <Calendar size={13} className="text-slate-400" /> {school.contract_start || 'N/A'} to {school.renewal_date || 'N/A'}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-slate-800 text-sm flex items-center">
                      <IndianRupee size={14} className="text-slate-500"/> {(school.expected_revenue || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={async () => {
                        if (confirm(`Are you sure you want to remove ${school.name}?`)) {
                          await deleteSchool(school.id);
                          toast.info(`School ${school.name} removed from registry`, 'School Deleted');
                        }
                      }}
                      className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete School"
                    >
                      <Trash2 size={18}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSchools.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No partner schools found. Click "+ Onboard School" to add one!
          </div>
        )}
      </div>

      {/* Onboard School Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Onboard Partner School</h2>
                <p className="text-xs text-slate-500">Add a new school client into the Pixiu ecosystem</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">School Full Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Zenith Public School" 
                    value={formData.name} 
                    onChange={e => {
                      const name = e.target.value;
                      const code = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
                      setFormData({ ...formData, name, code: formData.code || code });
                    }} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-pixiu-blue uppercase mb-1">Code *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. ZPS" 
                    value={formData.code} 
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} 
                    required 
                    maxLength={5}
                    className="w-full px-3 py-2 border border-blue-300 bg-blue-50/50 font-mono font-bold text-pixiu-blue rounded-lg text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Principal / Coordinator</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Dr. R.K. Sharma" 
                    value={formData.principal} 
                    onChange={e => setFormData({ ...formData, principal: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Phone</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 9876543210" 
                    value={formData.contact} 
                    onChange={e => setFormData({ ...formData, contact: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contract Start</label>
                  <input 
                    type="date" 
                    value={formData.contract_start} 
                    onChange={e => setFormData({ ...formData, contract_start: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Renewal Date</label>
                  <input 
                    type="date" 
                    value={formData.renewal_date} 
                    onChange={e => setFormData({ ...formData, renewal_date: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Annual Revenue (₹)</label>
                  <input 
                    type="number" 
                    value={formData.expected_revenue} 
                    onChange={e => setFormData({ ...formData, expected_revenue: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Status</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({ ...formData, status: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Trial">Trial</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>
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
                  Save & Onboard School
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
