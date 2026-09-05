import { useState } from 'react';
import { 
  Building2, Search, Plus, Phone, Calendar, IndianRupee, Trash2, X, 
  Users, BookOpen, CheckCircle, Edit, Megaphone, Bell, Sparkles, 
  Receipt, ShieldCheck, Check, Send, AlertCircle
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';

export default function Schools() {
  const { 
    schools, 
    classes, 
    students, 
    trainers, 
    billing, 
    addSchool, 
    updateSchool, 
    deleteSchool, 
    pushSchoolNotification,
    updateInvoiceStatus 
  } = useData();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [notificationSchool, setNotificationSchool] = useState(null); // When open, holds the target school or 'ALL'

  // Add Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    principal_name: '',
    principal_phone: '',
    lab_room: 'Block B - STEM Lab 101',
    trainer_id: 'TR-01',
    status: 'Active',
    contract_type: 'Full STEM Lab Suite',
    contract_start: new Date().toISOString().split('T')[0],
    renewal_date: '2027-03-31',
    expected_revenue: 100000
  });

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    name: '',
    code: '',
    principal_name: '',
    principal_phone: '',
    lab_room: '',
    trainer_id: 'TR-01',
    status: 'Active',
    contract_type: 'Full STEM Lab Suite',
    contract_start: '',
    renewal_date: '',
    expected_revenue: 100000
  });

  // Notification Push State
  const [notifData, setNotifData] = useState({
    title: '',
    message: '',
    type: 'announcement',
    priority: 'normal',
    target_school_id: 'ALL'
  });

  const filteredSchools = schools.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle Add School
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const code = formData.code.toUpperCase().trim();
    const trainer = trainers.find(t => t.id === formData.trainer_id);
    
    await addSchool({
      id: code,
      name: formData.name,
      code: code,
      principal_name: formData.principal_name,
      principal_phone: formData.principal_phone,
      lab_room: formData.lab_room,
      trainer_id: formData.trainer_id,
      lead_trainer: trainer ? trainer.name : 'Vikas Pandey',
      status: formData.status,
      contract_type: formData.contract_type,
      contract_start: formData.contract_start,
      renewal_date: formData.renewal_date,
      expected_revenue: Number(formData.expected_revenue) || 100000,
      created_at: new Date().toISOString().split('T')[0]
    });

    toast.success(`${formData.name} successfully onboarded!`, 'Partner School Added');
    setIsAddModalOpen(false);
    setFormData({
      name: '',
      code: '',
      principal_name: '',
      principal_phone: '',
      lab_room: 'Block B - STEM Lab 101',
      trainer_id: 'TR-01',
      status: 'Active',
      contract_type: 'Full STEM Lab Suite',
      contract_start: new Date().toISOString().split('T')[0],
      renewal_date: '2027-03-31',
      expected_revenue: 100000
    });
  };

  // Open Edit Modal
  const handleOpenEdit = (e, school) => {
    e.stopPropagation();
    setEditingSchool(school);
    setEditFormData({
      name: school.name || '',
      code: school.code || school.id || '',
      principal_name: school.principal_name || school.principal || '',
      principal_phone: school.principal_phone || school.contact || '',
      lab_room: school.lab_room || 'Block B - Innovation Lab 102',
      trainer_id: school.trainer_id || 'TR-01',
      status: school.status || 'Active',
      contract_type: school.contract_type || 'Full STEM Lab Suite',
      contract_start: school.contract_start || '2026-08-01',
      renewal_date: school.renewal_date || '2027-03-31',
      expected_revenue: school.expected_revenue || 100000
    });
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingSchool) return;

    const trainer = trainers.find(t => t.id === editFormData.trainer_id);

    await updateSchool(editingSchool.id, {
      name: editFormData.name,
      principal_name: editFormData.principal_name,
      principal_phone: editFormData.principal_phone,
      lab_room: editFormData.lab_room,
      trainer_id: editFormData.trainer_id,
      lead_trainer: trainer ? trainer.name : editingSchool.lead_trainer,
      status: editFormData.status,
      contract_type: editFormData.contract_type,
      contract_start: editFormData.contract_start,
      renewal_date: editFormData.renewal_date,
      expected_revenue: Number(editFormData.expected_revenue) || 0
    });

    toast.success(`School "${editFormData.name}" information updated successfully!`, 'School Updated');
    setEditingSchool(null);
  };

  // Open Notification Push Modal
  const handleOpenNotification = (school = null) => {
    setNotificationSchool(school);
    setNotifData({
      title: '',
      message: '',
      type: 'announcement',
      priority: 'normal',
      target_school_id: school ? school.id : 'ALL'
    });
  };

  // Handle Notification Send
  const handleSendNotification = async (e) => {
    e.preventDefault();
    await pushSchoolNotification(notifData);
    toast.success(`Announcement pushed to ${notifData.target_school_id === 'ALL' ? 'All Partner Schools' : notifData.target_school_id}!`, 'Notification Dispatched');
    setNotificationSchool(null);
  };

  const getStudentCountForSchool = (schoolId) => {
    return students.filter(s => s.school_id === schoolId || s.school_id === schoolId.replace('CLS-', '')).length;
  };

  const getClassCountForSchool = (schoolId) => {
    return classes.filter(c => c.school_id === schoolId).length;
  };

  const getBillingStatsForSchool = (schoolId) => {
    const schoolInvoices = billing.filter(b => b.school_id === schoolId);
    const totalAmount = schoolInvoices.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const paidInvoices = schoolInvoices.filter(b => b.status === 'Paid').length;
    return {
      totalAmount,
      totalCount: schoolInvoices.length,
      paidCount: paidInvoices,
      hasPending: schoolInvoices.some(b => b.status !== 'Paid')
    };
  };

  return (
    <div className="pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Partner Schools (Client Directory)</h1>
          <p className="text-slate-500">Full administrative control over school contracts, assigned trainers, live billing, and announcements.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => handleOpenNotification(null)}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm cursor-pointer text-xs sm:text-sm"
          >
            <Megaphone size={16} /> Broadcast Announcement
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-pixiu-blue text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer text-xs sm:text-sm"
          >
            <Plus size={18} /> Onboard School
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Partners</p>
            <p className="text-2xl font-bold text-slate-800">{schools.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Active Contracts</p>
            <p className="text-2xl font-bold text-slate-800">{schools.filter(s => s.status === 'Active').length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Enrolled Students</p>
            <p className="text-2xl font-bold text-slate-800">{students.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Invoiced Value</p>
            <p className="text-2xl font-bold text-slate-800">
              ₹{(billing.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search and Filters */}
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
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-pixiu-blue cursor-pointer text-xs font-bold"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Trial">Trial</option>
              <option value="Paused">Paused</option>
            </select>
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <th className="p-4">School Details</th>
                <th className="p-4">Principal & Lab</th>
                <th className="p-4">Assigned Faculty</th>
                <th className="p-4">Enrolled / Classes</th>
                <th className="p-4">Billing & Payments</th>
                <th className="p-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchools.map(school => {
                const billingStats = getBillingStatsForSchool(school.id);
                const trainer = trainers.find(t => t.id === school.trainer_id || t.assigned_schools === school.id);
                return (
                  <tr key={school.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        {school.name}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          school.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {school.status}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-pixiu-blue font-bold mt-1">ID / Code: {school.code || school.id}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{school.city || 'Gorakhpur'} • {school.tier || 'Partner'}</div>
                    </td>

                    <td className="p-4">
                      <div className="text-sm font-semibold text-slate-800">{school.principal_name || school.principal || 'Dr. Principal'}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                        <Phone size={12} className="text-pixiu-blue"/> {school.principal_phone || school.contact || 'No phone'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <Building2 size={11} /> {school.lab_room || 'Innovation Lab'}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-xs">{trainer ? trainer.name : school.lead_trainer || 'Vikas Pandey'}</div>
                      <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">{trainer ? trainer.role : 'Lead STEM Trainer'}</div>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-700">
                          <Users size={12}/> {getStudentCountForSchool(school.id)} Students Enrolled
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-700">
                          <BookOpen size={12}/> {getClassCountForSchool(school.id)} Academic Classes
                        </span>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-sm">
                        ₹{(billingStats.totalAmount || school.expected_revenue || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] mt-0.5">
                        <span className={`font-bold ${billingStats.hasPending ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {billingStats.paidCount} Paid / {billingStats.totalCount} Invoices
                        </span>
                      </div>
                      <Link 
                        to="/billing" 
                        className="text-[11px] text-pixiu-blue font-bold hover:underline inline-flex items-center gap-0.5 mt-1"
                      >
                        Manage Invoices →
                      </Link>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Send Notification Button */}
                        <button
                          onClick={() => handleOpenNotification(school)}
                          className="p-1.5 text-slate-500 hover:text-pixiu-blue hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Push Announcement to this School"
                        >
                          <Megaphone size={16} />
                        </button>

                        {/* Edit School Button */}
                        <button
                          onClick={(e) => handleOpenEdit(e, school)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit School Information"
                        >
                          <Edit size={16} />
                        </button>

                        {/* Delete School Button */}
                        <button 
                          onClick={async () => {
                            if (confirm(`Are you sure you want to remove ${school.name} from the portal?`)) {
                              await deleteSchool(school.id);
                              toast.info(`School "${school.name}" removed from registry`, 'School Deleted');
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete School"
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

        {filteredSchools.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No partner schools found matching your search.
          </div>
        )}
      </div>

      {/* MODAL 1: EDIT SCHOOL INFORMATION */}
      {editingSchool && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-800">Edit School Information</h2>
                <p className="text-xs text-slate-500">Update institutional details, principal contact, lab room, and assigned faculty</p>
              </div>
              <button onClick={() => setEditingSchool(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-500 uppercase mb-1">School Full Name *</label>
                  <input 
                    type="text" 
                    value={editFormData.name} 
                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">School Code (ID)</label>
                  <input 
                    type="text" 
                    value={editFormData.code} 
                    disabled
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-100 font-mono font-bold text-slate-500 rounded-lg cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Principal / Authority Name *</label>
                  <input 
                    type="text" 
                    value={editFormData.principal_name} 
                    onChange={e => setEditFormData({ ...editFormData, principal_name: e.target.value })} 
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Principal Direct Phone *</label>
                  <input 
                    type="text" 
                    value={editFormData.principal_phone} 
                    onChange={e => setEditFormData({ ...editFormData, principal_phone: e.target.value })} 
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Designated Lab Room</label>
                  <input 
                    type="text" 
                    value={editFormData.lab_room} 
                    onChange={e => setEditFormData({ ...editFormData, lab_room: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Assigned Lead Trainer</label>
                  <select
                    value={editFormData.trainer_id}
                    onChange={e => setEditFormData({ ...editFormData, trainer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue bg-white font-bold text-slate-800"
                  >
                    {(trainers || []).map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Contract Status</label>
                  <select 
                    value={editFormData.status} 
                    onChange={e => setEditFormData({ ...editFormData, status: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue bg-white font-bold"
                  >
                    <option value="Active">Active Partner</option>
                    <option value="Trial">Pilot Trial Lab</option>
                    <option value="Paused">Temporarily Paused</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Expected Annual Revenue (₹)</label>
                  <input 
                    type="number" 
                    value={editFormData.expected_revenue} 
                    onChange={e => setEditFormData({ ...editFormData, expected_revenue: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue font-bold font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEditingSchool(null)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14}/> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PUSH BROADCAST NOTIFICATION */}
      {notificationSchool !== undefined && notificationSchool !== false && notificationSchool !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Megaphone size={18} className="text-pixiu-blue" />
                <div>
                  <h2 className="text-base font-bold">Push School Announcement</h2>
                  <p className="text-xs text-slate-300">
                    Target: <b>{notificationSchool?.name || 'All Partner Schools (Network-wide)'}</b>
                  </p>
                </div>
              </div>
              <button onClick={() => setNotificationSchool(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleSendNotification} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Announcement Title *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Term 1 Robotics Exhibition Schedule or Hardware Update"
                  value={notifData.title}
                  onChange={e => setNotifData({ ...notifData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Message Content *</label>
                <textarea 
                  rows={4}
                  placeholder="Type the message details for the school administration..."
                  value={notifData.message}
                  onChange={e => setNotifData({ ...notifData, message: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Category Type</label>
                  <select
                    value={notifData.type}
                    onChange={e => setNotifData({ ...notifData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue bg-white font-semibold"
                  >
                    <option value="announcement">General Announcement</option>
                    <option value="billing_due">Fee & Invoice Notice</option>
                    <option value="curriculum">Curriculum & Term Update</option>
                    <option value="event">Robotics Competition / Exhibition</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Priority</label>
                  <select
                    value={notifData.priority}
                    onChange={e => setNotifData({ ...notifData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue bg-white font-semibold"
                  >
                    <option value="normal">Normal Announcement</option>
                    <option value="high">High Priority / Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setNotificationSchool(null)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Send size={14}/> Dispatch Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ONBOARD NEW SCHOOL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-800">Onboard Partner School</h2>
                <p className="text-xs text-slate-500">Add a new school client into the Pixiu ecosystem</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18}/>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-500 uppercase mb-1">School Full Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. St. Xavier International" 
                    value={formData.name} 
                    onChange={e => {
                      const name = e.target.value;
                      const code = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
                      setFormData({ ...formData, name, code: formData.code || code });
                    }} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-pixiu-blue uppercase mb-1">Code *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. SXI" 
                    value={formData.code} 
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} 
                    required 
                    maxLength={5}
                    className="w-full px-3 py-2 border border-blue-300 bg-blue-50/50 font-mono font-bold text-pixiu-blue rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Principal Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Dr. A.K. Singh" 
                    value={formData.principal_name} 
                    onChange={e => setFormData({ ...formData, principal_name: e.target.value })} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Principal Phone *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. +91 94151 99887" 
                    value={formData.principal_phone} 
                    onChange={e => setFormData({ ...formData, principal_phone: e.target.value })} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Designated Lab Room</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Block C - Lab 201" 
                    value={formData.lab_room} 
                    onChange={e => setFormData({ ...formData, lab_room: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Assign Lead Trainer</label>
                  <select
                    value={formData.trainer_id}
                    onChange={e => setFormData({ ...formData, trainer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue bg-white font-bold"
                  >
                    {(trainers || []).map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Expected Revenue (₹)</label>
                  <input 
                    type="number" 
                    value={formData.expected_revenue} 
                    onChange={e => setFormData({ ...formData, expected_revenue: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({ ...formData, status: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue bg-white font-bold"
                  >
                    <option value="Active">Active</option>
                    <option value="Trial">Pilot Trial</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={16}/> Complete Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
