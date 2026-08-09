'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminSidebar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { projectService, clientService, userManagementService } from '@/services/crmService';
import { useToastStore } from '@/store/toastStore';
import { Search, Plus, LayoutTemplate, Clock, X, Loader2, Trash2, Pencil, AlertCircle } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  client_id: string;
  client_name?: string;
  manager_id: string;
  manager_name?: string;
  status: string;
  start_date: string;
  end_date: string;
  budget: number;
  progress: number;
  created_at: string;
}

interface Client { id: string; company_name: string; }
interface User { id: string; full_name?: string; name?: string; username?: string; }

function toArray<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.results)) return obj.results as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

const STATUS_FILTERS = ['All', 'Planning', 'In Progress', 'Review', 'Completed', 'On Hold', 'Cancelled'];
const PAGE_SIZE = 9;

export default function AdminProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<User[]>([]);

  const [form, setForm] = useState({
    name: '',
    description: '',
    client_id: '',
    manager_id: '',
    status: 'Planning',
    start_date: '',
    end_date: '',
    budget: '',
  });

  const showToast = useToastStore((s) => s.showToast);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter !== 'All') params.status = statusFilter;
      const data: any = await projectService.getAll(params);
      setProjects(toArray<Project>(data));
      setTotalCount(data?.total ?? toArray(data).length);
    } catch {
      setProjects([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  useEffect(() => {
    if (showModal) {
      Promise.all([
        clientService.getAll({ page_size: 100 }).catch(() => ({ items: [] })),
        userManagementService.getUsers({ page_size: 100 }).catch(() => ({ items: [] })),
      ]).then(([c, u]: any[]) => {
        setClients(toArray<Client>(c));
        setManagers(toArray<User>(u));
      });
    }
  }, [showModal]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const openCreateModal = () => {
    setEditingProject(null);
    setForm({ name: '', description: '', client_id: '', manager_id: '', status: 'Planning', start_date: '', end_date: '', budget: '' });
    setValidationErrors({});
    setShowModal(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setForm({
      name: project.name,
      description: project.description || '',
      client_id: project.client_id || '',
      manager_id: project.manager_id || '',
      status: project.status,
      start_date: project.start_date ? project.start_date.slice(0, 10) : '',
      end_date: project.end_date ? project.end_date.slice(0, 10) : '',
      budget: project.budget ? String(project.budget) : '',
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Project name is required.';
    if (!form.start_date) errors.start_date = 'Start date is required.';
    if (!form.end_date) errors.end_date = 'End date is required.';
    if (form.start_date && form.end_date && new Date(form.end_date) < new Date(form.start_date)) {
      errors.end_date = 'End date cannot be earlier than start date.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setFormLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        status: form.status,
        start_date: form.start_date,
        end_date: form.end_date,
      };
      if (form.client_id) payload.client_id = form.client_id;
      if (form.manager_id) payload.manager_id = form.manager_id;
      if (form.budget) payload.budget = parseFloat(form.budget);

      if (editingProject) {
        await projectService.update(editingProject.id, payload);
        showToast(`Project "${form.name}" updated successfully!`, 'success');
      } else {
        await projectService.create(payload);
        showToast(`Project "${form.name}" created successfully!`, 'success');
      }
      setShowModal(false);
      fetchProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save project.';
      showToast(msg, 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await projectService.delete(id);
      showToast('Project deleted successfully.', 'success');
      setDeleteConfirmId(null);
      fetchProjects();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project.';
      showToast(msg, 'error');
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div>
      <AdminHeader title="Project Management" subtitle="Track delivery of website and branding projects." />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
            />
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors focus:outline-none focus:border-[#4C1D95]"
            >
              {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
            </select>
            <button type="button" onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors">
              <Plus size={16} /> New Project
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
            <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="text-center py-20 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No projects found.</div>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow group flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#4C1D95]/10 flex items-center justify-center text-[#4C1D95]">
                      <LayoutTemplate size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm truncate max-w-[160px]">{project.name}</h3>
                      <p className="text-xs text-slate-500 truncate max-w-[160px]">{project.client_name || 'No client'}</p>
                    </div>
                  </div>
                  {/* BUG-32 Fixed: Clean edit/delete action icons without misaligned inline text buttons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => openEditModal(project)} className="p-1.5 text-slate-400 hover:text-[#4C1D95] hover:bg-[#4C1D95]/10 rounded-lg transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => setDeleteConfirmId(project.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mb-5 flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={project.status} />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">Progress</span>
                      <span className="font-bold text-slate-900">{project.progress ?? 0}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="bg-[#4C1D95] h-1.5 rounded-full" style={{ width: `${Math.min(project.progress ?? 0, 100)}%` }} />
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock size={12} className="text-slate-400" />
                    <span>{formatDate(project.start_date)} - {formatDate(project.end_date)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border border-slate-200 rounded-2xl flex items-center justify-between text-sm text-slate-500 bg-white shadow-sm">
            <div>Showing {projects.length} of {totalCount} projects</div>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500 font-medium">Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New / Edit Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="button" tabIndex={0} onClick={() => setShowModal(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowModal(false); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editingProject ? 'Edit Project' : 'New Project'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="project-name" className="block text-xs font-semibold text-slate-600 mb-1">Project Name <span className="text-red-500">*</span></label>
                <input
                  id="project-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                    validationErrors.name ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                  }`}
                  placeholder="e.g. Website Overhaul & Rebrand"
                />
                {validationErrors.name && <p className="text-red-500 text-[11px] mt-1">{validationErrors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="project-client" className="block text-xs font-semibold text-slate-600 mb-1">Client</label>
                  <select
                    id="project-client"
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="project-manager" className="block text-xs font-semibold text-slate-600 mb-1">Manager</label>
                  <select
                    id="project-manager"
                    value={form.manager_id}
                    onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    <option value="">Select manager...</option>
                    {managers.map((m) => {
                      const name = m.full_name || m.name || m.username || m.id;
                      return <option key={m.id} value={m.id}>{name}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="project-status" className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    id="project-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    {STATUS_FILTERS.filter((s) => s !== 'All').map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Budget (₹)</label>
                  <input
                    type="number"
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* BUG-33 Fixed: Mandatory Start Date & End Date fields with logical order validation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                      validationErrors.start_date ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                  />
                  {validationErrors.start_date && <p className="text-red-500 text-[11px] mt-1">{validationErrors.start_date}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">End Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                      validationErrors.end_date ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                  />
                  {validationErrors.end_date && <p className="text-red-500 text-[11px] mt-1">{validationErrors.end_date}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] resize-none"
                  placeholder="Project scope and details..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="px-5 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] disabled:opacity-50 flex items-center gap-2">
                  {formLoading && <Loader2 size={14} className="animate-spin" />}
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUG-32 Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="button" tabIndex={0} onClick={() => setDeleteConfirmId(null)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDeleteConfirmId(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle size={24} />
              <h3 className="font-bold text-slate-900 text-base">Delete Project</h3>
            </div>
            <p className="text-xs text-slate-600">Are you sure you want to delete this project? Any associated timelines and tasks will also be affected.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
