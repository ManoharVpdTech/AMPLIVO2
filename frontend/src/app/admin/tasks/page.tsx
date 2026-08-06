'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminHeader } from '@/components/admin/AdminSidebar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { taskService, projectService, userManagementService } from '@/services/crmService';
import { useToastStore } from '@/store/toastStore';
import { Search, Plus, X, Loader2, Clock, Trash2, Pencil, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  project_id: string;
  assigned_to: string;
  created_by: string;
  due_date: string;
  created_at: string;
  updated_at: string;
}

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

const STATUS_TABS = ['All', 'Todo', 'In Progress', 'Review', 'Done'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
const PAGE_SIZE = 10;

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'Todo',
  priority: 'Medium',
  project_id: '',
  assigned_to: '',
  due_date: '',
};

export default function AdminTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name?: string; name?: string; username?: string }[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const showToast = useToastStore((s) => s.showToast);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const data: any = await taskService.getAll(params);
      setTasks(toArray<Task>(data));
      setTotalCount(data?.total ?? toArray(data).length);
    } catch {
      setTasks([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    if (showModal) {
      Promise.all([
        projectService.getAll({ page_size: 100 }).catch(() => ({ items: [] })),
        userManagementService.getUsers({ page_size: 100 }).catch(() => ({ items: [] })),
      ]).then(([p, u]: any[]) => {
        setProjects(toArray(p));
        setUsers(toArray(u));
      });
    }
  }, [showModal]);

  useEffect(() => { setPage(1); }, [search, statusFilter, priorityFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const openCreateModal = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
    setValidationErrors({});
    setShowModal(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    const loaded = {
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      project_id: task.project_id || '',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
    };
    setForm(loaded);
    setInitialForm(loaded);
    setValidationErrors({});
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'Task title is required.';

    // BUG-35 Fixed: Due Date validation preventing past dates
    if (form.due_date && form.due_date < today) {
      errors.due_date = 'Due date cannot be in the past.';
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
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
      };
      if (form.project_id) payload.project_id = form.project_id;
      if (form.assigned_to) payload.assigned_to = form.assigned_to;
      if (form.due_date) payload.due_date = form.due_date;

      if (editingTask) {
        await taskService.update(editingTask.id, payload);
        showToast(`Task "${form.title}" updated successfully!`, 'success');
      } else {
        await taskService.create(payload);
        showToast(`Task "${form.title}" created successfully!`, 'success');
      }
      setShowModal(false);
      fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save task.';
      showToast(msg, 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await taskService.delete(id);
      showToast('Task deleted successfully.', 'success');
      setDeleteConfirmId(null);
      fetchTasks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete task.';
      showToast(msg, 'error');
    }
  };

  const getPriorityStyle = (p: string) => {
    switch (p) {
      case 'Urgent': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'High': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div>
      <AdminHeader title="Task Management" subtitle="Manage internal team tasks and project deliverables." />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
            />
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors focus:outline-none focus:border-[#4C1D95]"
            >
              <option value="">All Priorities</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button type="button" onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors">
              <Plus size={16} /> New Task
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-4 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`text-sm px-2 py-1 transition-colors whitespace-nowrap ${
                  statusFilter === tab ? 'font-bold text-[#4C1D95] border-b-2 border-[#4C1D95]' : 'font-medium text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
            </div>
          )}
          {!loading && tasks.length === 0 && (
            <div className="text-center py-20 text-slate-400 text-sm">No tasks found.</div>
          )}
          {!loading && tasks.length > 0 && (
            <div className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center gap-4 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-semibold text-sm truncate ${task.status === 'Done' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {task.title}
                      </h3>
                      <StatusBadge status={task.status} />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${getPriorityStyle(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {task.description && <span className="truncate max-w-xs">{task.description}</span>}
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" /> Due {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => openEditModal(task)} className="p-1.5 text-slate-400 hover:text-[#4C1D95] hover:bg-[#4C1D95]/10 rounded-lg transition-colors" title="Edit Task">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => setDeleteConfirmId(task.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Task">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500 bg-slate-50">
              <div>Showing {tasks.length} of {totalCount} tasks</div>
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
      </div>

      {/* New / Edit Task Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="button" tabIndex={0} onClick={() => setShowModal(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowModal(false); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editingTask ? 'Edit Task' : 'New Task'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="admin-task-title" className="block text-xs font-semibold text-slate-600 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  id="admin-task-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                    validationErrors.title ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                  }`}
                  placeholder="e.g. Complete wireframes for client onboarding"
                />
                {validationErrors.title && <p className="text-red-500 text-[11px] mt-1">{validationErrors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    {STATUS_TABS.filter((s) => s !== 'All').map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Project</label>
                  <select
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    <option value="">Select project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Assign To</label>
                  <select
                    value={form.assigned_to}
                    onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    <option value="">Select team member...</option>
                    {users.map((u) => {
                      const name = u.full_name || u.name || u.username || u.id;
                      return <option key={u.id} value={u.id}>{name}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* BUG-35 Fixed: Due Date picker min={today} and validation */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Due Date</label>
                <input
                  type="date"
                  min={today}
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                    validationErrors.due_date ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                  }`}
                />
                {validationErrors.due_date && <p className="text-red-500 text-[11px] mt-1">{validationErrors.due_date}</p>}
              </div>

              <div>
                <label htmlFor="task-description" className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  id="task-description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] resize-none"
                  placeholder="Task instructions and guidelines..."
                />
              </div>

              {/* BUG-34 Fixed: Disabled button when form is pristine */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading || !isDirty}
                  className="px-5 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {formLoading && <Loader2 size={14} className="animate-spin" />}
                  {editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="button" tabIndex={0} onClick={() => setDeleteConfirmId(null)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDeleteConfirmId(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle size={24} />
              <h3 className="font-bold text-slate-900 text-base">Delete Task</h3>
            </div>
            <p className="text-xs text-slate-600">Are you sure you want to delete this task? This action cannot be undone.</p>
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
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
