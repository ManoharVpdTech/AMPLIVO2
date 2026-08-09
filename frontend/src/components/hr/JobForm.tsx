'use client';
import { useEffect, useState } from 'react';
import { Job } from '@/types/hr';
import { useRouter } from 'next/navigation';
import { useHrStore } from '@/store/hrStore';

interface JobFormProps {
  initialData?: Job;
  initialDepartmentId?: string;
  onSubmit: (data: Partial<Job> & { departmentId?: string }) => void;
}

export function JobForm({ initialData, initialDepartmentId, onSubmit }: Readonly<JobFormProps>) {
  const router = useRouter();
  const departments = useHrStore(state => state.departments);
  const fetchDepartments = useHrStore(state => state.fetchDepartments);
  const [formData, setFormData] = useState<Partial<Job>>(
    initialData || {
      title: '',
      department: '',
      serviceCategory: 'Website Development',
      employmentType: 'Full-time',
      experienceLevel: '1-3 Years',
      location: '',
      workMode: 'Remote',
      salaryRange: '',
      vacancies: 1,
      skillsRequired: [],
      responsibilities: [],
      requirements: [],
      benefits: [],
      description: '',
      applicationDeadline: '',
      status: 'Draft',
    }
  );
  const [departmentId, setDepartmentId] = useState(initialDepartmentId || '');

  useEffect(() => {
    if (departments.length === 0) fetchDepartments();
  }, [departments.length, fetchDepartments]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setDepartmentId(id);
    const name = departments.find(d => d.id === id)?.name || '';
    setFormData(prev => ({ ...prev, department: name }));
  };

  const handleArrayChange = (e: React.ChangeEvent<HTMLTextAreaElement>, field: keyof Job) => {
    const arr = e.target.value.split('\n').filter(s => s.trim() !== '');
    setFormData(prev => ({ ...prev, [field]: arr }));
  };

  const handleSubmit = (e: React.FormEvent, status: 'Published' | 'Draft') => {
    e.preventDefault();
    onSubmit({ ...formData, status, departmentId });
  };

  return (
    <form className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Job Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
            required
          />
        </div>
        <div>
          <label htmlFor="job-form-dept" className="block text-sm font-medium text-slate-700 mb-2">Department <span className="text-red-500">*</span></label>
          <select
            id="job-form-dept"
            name="departmentId"
            value={departmentId}
            onChange={handleDepartmentChange}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
            required
          >
            <option value="">Select department...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        
        <div>
          <label htmlFor="job-form-workmode" className="block text-sm font-medium text-slate-700 mb-2">Work Mode <span className="text-red-500">*</span></label>
          <select
            id="job-form-workmode"
            name="workMode"
            value={formData.workMode}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
          >
            <option>Remote</option>
            <option>Hybrid</option>
            <option>On-site</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Location <span className="text-red-500">*</span></label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
            placeholder="e.g. Hyderabad, Remote"
            required
          />
        </div>

        <div>
          <label htmlFor="job-form-emptype" className="block text-sm font-medium text-slate-700 mb-2">Employment Type <span className="text-red-500">*</span></label>
          <select
            id="job-form-emptype"
            name="employmentType"
            value={formData.employmentType}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
          >
            <option>Full-time</option>
            <option>Part-time</option>
            <option>Contract</option>
            <option>Internship</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Vacancies <span className="text-red-500">*</span></label>
          <input
            type="number"
            name="vacancies"
            value={formData.vacancies}
            onChange={handleChange}
            min={1}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
            required
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Job Description <span className="text-red-500">*</span></label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={4}
          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Skills Required (One per line)</label>
        <textarea
          value={(formData.skillsRequired || []).join('\n')}
          onChange={e => handleArrayChange(e, 'skillsRequired')}
          rows={3}
          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
        />
      </div>

      <div className="flex gap-4 pt-6 border-t border-slate-100 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e, 'Draft')}
          className="px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e, 'Published')}
          className="px-6 py-2.5 bg-[#4C1D95] text-white font-medium rounded-xl hover:bg-[#3B1574] transition-colors shadow-sm"
        >
          Publish Job
        </button>
      </div>
    </form>
  );
}
