'use client';
import { Job } from '@/types/hr';
import { StatusChip } from '@/components/hr/StatusChip';
import { X, MapPin, Briefcase, Users, Calendar } from 'lucide-react';

interface JobViewModalProps {
  job: Job;
  onClose: () => void;
}

export function JobViewModal({ job, onClose }: Readonly<JobViewModalProps>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        role="button"
        tabIndex={0}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-lg" style={{ fontFamily: "'Sora', sans-serif" }}>{job.title}</h2>
            <div className="mt-2"><StatusChip status={job.status} /></div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Briefcase size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-slate-400">Department</div>
                <div className="text-slate-700 font-medium">{job.department}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-slate-400">Location</div>
                <div className="text-slate-700 font-medium">{job.location} · {job.workMode}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-slate-400">Vacancies</div>
                <div className="text-slate-700 font-medium">{job.vacancies} · {job.employmentType}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-slate-400">Posted</div>
                <div className="text-slate-700 font-medium">{job.postedDate || '—'}</div>
              </div>
            </div>
          </div>

          {job.description && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description</div>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {job.skillsRequired && job.skillsRequired.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Skills Required</div>
              <div className="flex flex-wrap gap-1.5">
                {job.skillsRequired.map((skill) => (
                  <span key={skill} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">{skill}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
