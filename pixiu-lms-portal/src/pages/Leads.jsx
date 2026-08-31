import { useState } from 'react';
import { Plus, MoreHorizontal, Phone, Calendar, IndianRupee, MapPin, ArrowRight, CheckCircle2, Trash2, X, Sparkles } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function Leads() {
  const { leads, addLead, updateLeadStage, deleteLead, convertLeadToSchool } = useData();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    city: 'New Delhi',
    stage: 'Contacted',
    expected_value: 150000,
    notes: ''
  });

  const stages = ['Contacted', 'Demo Scheduled', 'Negotiation', 'Closed (Won)'];

  const getLeadsByStage = (stage) => leads.filter(l => l.stage === stage);

  const calculateTotalValue = (stageLeads) => {
    return stageLeads.reduce((acc, curr) => acc + (Number(curr.expected_value) || 0), 0).toLocaleString('en-IN');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addLead({
      name: formData.name,
      contact_person: formData.contact_person,
      phone: formData.phone,
      city: formData.city,
      stage: formData.stage,
      expected_value: Number(formData.expected_value) || 0,
      notes: formData.notes,
      last_contact: new Date().toISOString().split('T')[0]
    });
    toast.success(`Prospect "${formData.name}" added to sales pipeline!`, 'New Lead Captured');
    setIsModalOpen(false);
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      city: 'New Delhi',
      stage: 'Contacted',
      expected_value: 150000,
      notes: ''
    });
  };

  const getNextStage = (currentStage) => {
    const idx = stages.indexOf(currentStage);
    if (idx !== -1 && idx < stages.length - 1) return stages[idx + 1];
    return null;
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 shrink-0 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Pipeline & CRM</h1>
          <p className="text-slate-500">Track prospective schools from first pitch to signed contract & 1-click onboarding.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-pixiu-blue text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={18} /> Add New Lead
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-6 h-full min-w-max pb-4">
          
          {stages.map(stage => {
            const stageLeads = getLeadsByStage(stage);
            
            let headerColor = "border-t-slate-400";
            if (stage === 'Demo Scheduled') headerColor = "border-t-blue-500";
            if (stage === 'Negotiation') headerColor = "border-t-amber-500";
            if (stage === 'Closed (Won)') headerColor = "border-t-emerald-500";

            return (
              <div key={stage} className="w-80 flex flex-col bg-slate-100/70 rounded-xl border border-slate-200 shrink-0 shadow-xs">
                <div className={`p-4 border-t-4 ${headerColor} rounded-t-xl bg-slate-100 flex justify-between items-center border-b border-slate-200`}>
                  <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                      {stage} <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">{stageLeads.length}</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">₹{calculateTotalValue(stageLeads)} pipeline</p>
                  </div>
                </div>
                
                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                  {stageLeads.map(lead => {
                    const nextStage = getNextStage(lead.stage);

                    return (
                      <div key={lead.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold uppercase text-slate-400 font-mono tracking-wider">{lead.id}</span>
                          <span className="text-xs font-bold text-emerald-600 flex items-center bg-emerald-50 px-2 py-0.5 rounded">
                            <IndianRupee size={12}/> {(lead.expected_value || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1 leading-snug">{lead.name}</h4>
                        
                        <div className="space-y-1 my-3 text-xs text-slate-500 font-medium">
                          {lead.contact_person && (
                            <p className="text-slate-700 font-medium">POC: {lead.contact_person}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="text-slate-400" /> {lead.phone || 'No phone'}
                          </div>
                          {lead.city && (
                            <div className="flex items-center gap-2">
                              <MapPin size={13} className="text-slate-400" /> {lead.city}
                            </div>
                          )}
                          {lead.notes && (
                            <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 mt-2 italic">
                              "{lead.notes}"
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button 
                            onClick={() => deleteLead(lead.id)}
                            className="text-slate-300 hover:text-red-600 p-1.5 rounded transition-colors cursor-pointer"
                            title="Delete Lead"
                          >
                            <Trash2 size={14} />
                          </button>

                          {lead.stage !== 'Closed (Won)' ? (
                            <div className="flex items-center gap-1">
                              {nextStage && (
                                <button 
                                  onClick={async () => {
                                    await updateLeadStage(lead.id, nextStage);
                                    toast.info(`Lead moved to ${nextStage}`, 'Pipeline Progress');
                                  }}
                                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                                  title={`Advance to ${nextStage}`}
                                >
                                  Next <ArrowRight size={12} />
                                </button>
                              )}
                              <button 
                                onClick={async () => {
                                  await convertLeadToSchool(lead);
                                  toast.success(`🎉 ${lead.name} successfully converted to an active Partner School!`, 'Deal Closed & Won!');
                                }}
                                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                title="1-Click Convert to Partner School"
                              >
                                <Sparkles size={12}/> Win Deal
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle2 size={12} /> Onboarded
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {stageLeads.length === 0 && (
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 font-medium">
                      No leads in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      </div>

      {/* Add Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Add Sales Lead</h2>
                <p className="text-xs text-slate-500">Track a prospective school in the sales pipeline</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">School / Institution Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Cambridge Court High School" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Person / Decision Maker</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Principal Mrs. Verma" 
                    value={formData.contact_person} 
                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 919876543210" 
                    value={formData.phone} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City / Region</label>
                  <input 
                    type="text" 
                    placeholder="e.g. New Delhi" 
                    value={formData.city} 
                    onChange={e => setFormData({ ...formData, city: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Stage</label>
                  <select 
                    value={formData.stage} 
                    onChange={e => setFormData({ ...formData, stage: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
                  >
                    {stages.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Expected Annual Deal Value (₹)</label>
                <input 
                  type="number" 
                  value={formData.expected_value} 
                  onChange={e => setFormData({ ...formData, expected_value: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Call Notes / Context</label>
                <textarea 
                  rows={2}
                  placeholder="e.g. Met at EdTech summit. Requested demo next Wednesday." 
                  value={formData.notes} 
                  onChange={e => setFormData({ ...formData, notes: e.target.value })} 
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
                  Add Lead to Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
