'use client';
import { useHrStore } from '@/store/hrStore';
import { useToastStore } from '@/store/toastStore';
import { StatusChip } from '@/components/hr/StatusChip';
import { ConfirmDialog } from '@/components/hr/ConfirmDialog';
import { JobViewModal } from '@/components/hr/JobViewModal';
import { Job, JobStatus } from '@/types/hr';
import { careersService } from '@/services/moduleServices';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, Edit, Copy, XCircle, Trash2, Eye, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const STATUS_OPTIONS: JobStatus[] = ['Published', 'Draft', 'Closed'];
const STATUS_TO_BACKEND: Record<string, string> = { Published: 'open', Draft: 'draft', Closed: 'closed' };

export default function JobsPage() {
  const router = useRouter();
  const jobs = useHrStore(state => state.jobs);
  const departmentsRaw = useHrStore(state => state.departments);
  const fetchJobs = useHrStore(state => state.fetchJobs);
  const fetchDepartments = useHrStore(state => state.fetchDepartments);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    fetchDepartments().then(() => fetchJobs());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'All' | JobStatus>('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');

  const [viewJob, setViewJob] = useState<Job | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'close' | 'delete'; job: Job } | null>(null);

  const departments = useMemo(() => Array.from(new Set(jobs.map(j => j.department))).sort((a, b) => a.localeCompare(b)), [jobs]);
  const locations = useMemo(() => Array.from(new Set(jobs.map(j => j.location).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [jobs]);

  const activeFilterCount = (statusFilter !== 'All' ? 1 : 0) + (departmentFilter !== 'All' ? 1 : 0) + (locationFilter !== 'All' ? 1 : 0);

  const filteredJobs = jobs.filter(job =>
    (job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.department.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (statusFilter === 'All' || job.status === statusFilter) &&
    (departmentFilter === 'All' || job.department === departmentFilter) &&
    (locationFilter === 'All' || job.location === locationFilter)
  );

  const clearFilters = () => {
    setStatusFilter('All');
    setDepartmentFilter('All');
    setLocationFilter('All');
  };

  const handleDuplicate = async (job: Job) => {
    const departmentId = departmentsRaw.find(d => d.name === job.department)?.id;
    try {
      await careersService.createJob({
        title: `${job.title} (Copy)`,
        department_id: departmentId,
        location: job.location || undefined,
        vacancies: job.vacancies,
        skills_required: job.skillsRequired?.length ? job.skillsRequired : undefined,
        description: job.description || undefined,
        salary_range: job.salaryRange || undefined,
        status: 'draft',
      });
      await fetchJobs();
      showToast(`"${job.title}" duplicated as a draft.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to duplicate job.', 'error');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "'Sora', sans-serif" }}>Job Openings</h1>
          <p className="text-slate-500">Manage all job postings and drafts.</p>
        </div>
        <Link href="/hr/jobs/create" className="flex items-center gap-2 bg-[#4C1D95] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3B1574] transition-colors shadow-sm">
          <Plus size={18} /> Create Job
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by job title or department..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-colors ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-[#4C1D95]/5 border-[#4C1D95]/30 text-[#4C1D95]'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter size={16} /> Filters
            {activeFilterCount > 0 && (
              <span className="bg-[#4C1D95] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {filtersOpen && (
          <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="filter-job-status" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <select
                id="filter-job-status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as 'All' | JobStatus)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] min-w-[140px]"
              >
                <option value="All">All Statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filter-job-dept" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
              <select
                id="filter-job-dept"
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] min-w-[140px]"
              >
                <option value="All">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="filter-job-location" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Location</label>
              <select
                id="filter-job-location"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] min-w-[140px]"
              >
                <option value="All">All Locations</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:text-rose-600 transition-colors"
              >
                <X size={14} /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">Job Title</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Location</th>
                <th className="px-6 py-4 font-semibold text-center">Vacancies</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredJobs.map(job => (
                <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{job.title}</td>
                  <td className="px-6 py-4 text-slate-600">{job.department}</td>
                  <td className="px-6 py-4 text-slate-600">
                    <div>{job.location}</div>
                    <div className="text-xs text-slate-400">{job.workMode}</div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">{job.vacancies}</td>
                  <td className="px-6 py-4">
                    <StatusChip status={job.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setViewJob(job)}
                        className="p-2 text-slate-400 hover:text-[#4C1D95] rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/hr/jobs/${job.id}/edit`)}
                        className="p-2 text-slate-400 hover:text-blue-500 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(job)}
                        className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                        title="Duplicate"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDialog({ type: 'close', job })}
                        disabled={job.status === 'Closed'}
                        className="p-2 text-slate-400 hover:text-amber-500 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
                        title="Close Job"
                      >
                        <XCircle size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDialog({ type: 'delete', job })}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No jobs found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewJob && <JobViewModal job={viewJob} onClose={() => setViewJob(null)} />}

      {confirmDialog?.type === 'close' && confirmDialog.job && (
        <ConfirmDialog
          title="Close this job posting?"
          message={`"${confirmDialog.job.title}" will be marked as Closed and hidden from active listings. You can still find it under the Closed status filter.`}
          confirmLabel="Close Job"
          onConfirm={async () => {
            if (!confirmDialog?.job) return;
            try {
              await careersService.updateJob(confirmDialog.job.id, { status: STATUS_TO_BACKEND.Closed });
              await fetchJobs();
              showToast(`"${confirmDialog.job.title}" closed.`, 'success');
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Failed to close job.', 'error');
            }
          }}
          onClose={() => setConfirmDialog(null)}
        />
      )}

      {confirmDialog?.type === 'delete' && confirmDialog.job && (
        <ConfirmDialog
          title="Delete this job posting?"
          message={`Are you sure you want to delete "${confirmDialog.job.title}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={async () => {
            if (!confirmDialog?.job) return;
            try {
              await careersService.deleteJob(confirmDialog.job.id);
              await fetchJobs();
              showToast(`"${confirmDialog.job.title}" deleted.`, 'success');
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Failed to delete job.', 'error');
            }
          }}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
