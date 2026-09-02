import { useState } from 'react';
import { 
  GraduationCap, Plus, Phone, Building2, Star, CheckCircle, 
  Trash2, IndianRupee, Bell, Send
} from 'lucide-react';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';

export default function TrainerRosterManagement({
  trainers = [],
  schools = [],
  onOpenAddModal,
  onOpenScheduleModal,
  onRequestDeleteTrainer,
  onToggleTrainerStatus,
  isAdmin = true
}) {
  const toast = useToast();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Certified Robotics Instructors</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage deployed STEM trainers, weekly curriculum schedules, and monthly salary reconciliation.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenScheduleModal}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <Bell size={14} className="text-indigo-600" />
              <span>Schedule Session</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-4 py-2 bg-pixiu-blue hover:bg-blue-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <Plus size={15} />
              <span>Onboard Trainer</span>
            </button>
          </div>
        )}
      </div>

      {/* Trainers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trainers.map(trainer => {
          const assignedCodes = trainer.assigned_schools
            ? trainer.assigned_schools.split(',').map(s => s.trim())
            : [trainer.id === 'TR-02' ? 'XYZ' : 'ZPS'];

          const primarySchoolCode = assignedCodes[0] || (trainer.id === 'TR-02' ? 'XYZ' : 'ZPS');
          const targetSchool = schools.find(s => s.id === primarySchoolCode || s.code === primarySchoolCode) || {
            name: primarySchoolCode === 'XYZ' ? 'XYZ Academy (Pilot Lab)' : 'Zenith Public School',
            code: primarySchoolCode
          };

          const dailyRate = Number(trainer.daily_rate) || 600;
          const weeklyDays = Number(trainer.weekly_days) || 2;
          const weeklyPayout = dailyRate * weeklyDays;

          return (
            <div
              key={trainer.id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {trainer.name.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{trainer.name}</h3>
                      <p className="text-xs text-pixiu-blue font-semibold">{trainer.role}</p>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => onToggleTrainerStatus(trainer.id, trainer.status === 'Active' ? 'On Leave' : 'Active')}
                      className={`text-xs font-bold px-3 py-1 rounded-full cursor-pointer transition-colors ${
                        trainer.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {trainer.status}
                    </button>
                  )}
                </div>

                <div className="space-y-2.5 py-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5"><Phone size={13} /> Phone:</span>
                    <span className="font-mono font-bold text-slate-800">{trainer.phone || 'N/A'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Star size={13} className="text-amber-500 fill-amber-500" /> Rating:
                    </span>
                    <span className="font-bold text-slate-800">{trainer.rating || 5.0} / 5.0</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <IndianRupee size={13} className="text-emerald-600" /> Payout / Day:
                    </span>
                    <span className="font-bold text-slate-800 font-mono">₹{dailyRate} ({weeklyDays} days/wk)</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-500 font-bold uppercase tracking-wider block mb-1 text-[10px]">
                      Assigned Institution:
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-50 text-slate-800 border border-slate-200">
                      <Building2 size={12} className="text-pixiu-blue" />
                      {targetSchool.name} ({targetSchool.code})
                    </span>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-4">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">
                    Est. Monthly: ₹{(weeklyPayout * 4).toLocaleString('en-IN')}
                  </span>

                  <button
                    type="button"
                    onClick={() => onRequestDeleteTrainer(trainer)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Remove Trainer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
