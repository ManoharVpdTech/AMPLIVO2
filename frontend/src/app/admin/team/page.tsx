'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminSidebar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { userManagementService } from '@/services/crmService';
import { Search, Plus, Mail, MoreHorizontal, X, Loader2, Pencil, Eye, Ban, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';

interface UserListItem {
  id: string;
  email: string;
  username: string;
  full_name: string;
  is_active: boolean;
  role_name: string;
  department: string;
  created_at: string;
}

interface Role { id: string; name: string; }
interface Department { id: string; name: string; }

// API list endpoints paginate as { items: [...] }. Normalizes defensively
// against any shape (array already, { items }, { results }, { data }, or
// null/undefined) so a mismatch never leaves a non-array in state - which
// crashes every .map() call on that state ("x.map is not a function").
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

interface PaginatedResponse {
  items: UserListItem[];
  total: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 10;

export default function AdminTeam() {
  const [members, setMembers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<UserListItem | null>(null);
  const [viewingMember, setViewingMember] = useState<UserListItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [form, setForm] = useState({
    username: '',
    email: '',
    full_name: '',
    role_id: '',
    department_id: '',
  });

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (departmentFilter) params.department = departmentFilter;
      const data: PaginatedResponse = await userManagementService.getUsers(params);
      setMembers(toArray<UserListItem>(data));
      setTotalCount(data?.total ?? 0);
    } catch {
      setMembers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, departmentFilter]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useEffect(() => { setPage(1); }, [search, departmentFilter]);

  useEffect(() => {
    if (showModal) {
      Promise.all([
        userManagementService.getRoles().catch(() => ({ results: [] })),
        userManagementService.getDepartments().catch(() => ({ results: [] })),
      ]).then(([r, d]: any[]) => {
        setRoles(toArray<Role>(r));
        setDepartments(toArray<Department>(d));
      });
    }
  }, [showModal]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const openCreateModal = () => {
    setEditingMember(null);
    setForm({ username: '', email: '', full_name: '', role_id: '', department_id: '' });
    setShowModal(true);
  };

  const openEditModal = (member: UserListItem) => {
    setEditingMember(member);
    setForm({
      username: member.username,
      email: member.email,
      full_name: member.full_name,
      role_id: '',
      department_id: '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username,
        email: form.email,
        full_name: form.full_name,
      };
      if (form.role_id) payload.role_id = form.role_id;
      if (form.department_id) payload.department_id = form.department_id;

      if (editingMember) {
        await userManagementService.updateUser(editingMember.id, payload);
      } else {
        await userManagementService.getUsers({ page_size: 1 });
      }
      setShowModal(false);
      fetchMembers();
    } catch {
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await userManagementService.deactivateUser(id);
      fetchMembers();
    } catch {
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await userManagementService.activateUser(id);
      fetchMembers();
    } catch {
    }
  };

  return (
    <div>
      <AdminHeader title="Team Directory" subtitle="Manage agency team members, roles, and permissions." />

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
            />
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors focus:outline-none focus:border-[#4C1D95]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors">
              <Plus size={16} /> Add Member
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-sm">No team members found.</div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name || member.username)}&background=random`} alt={member.full_name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm mb-0.5">{member.full_name || member.username}</div>
                            <div className="text-xs text-slate-500">@{member.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <a href={`mailto:${member.email}`} className="text-xs text-slate-600 flex items-center gap-1.5 hover:text-[#4C1D95] transition-colors">
                          <Mail size={12} className="text-slate-400" /> {member.email}
                        </a>
                      </td>
                      <td className="py-4 px-6">
                        {member.role_name ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4C1D95] bg-[#4C1D95]/10 px-2.5 py-1 rounded-full">
                            <ShieldCheck size={12} /> {member.role_name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No role</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <StatusBadge status={member.is_active ? 'Active' : 'Inactive'} />
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setViewingMember(member)} className="p-1.5 text-slate-400 hover:text-[#4C1D95] hover:bg-[#4C1D95]/10 rounded-lg transition-colors" title="View">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => openEditModal(member)} className="p-1.5 text-slate-400 hover:text-[#4C1D95] hover:bg-[#4C1D95]/10 rounded-lg transition-colors" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => member.is_active ? handleDeactivate(member.id) : handleActivate(member.id)}
                            className={`p-1.5 rounded-lg transition-colors ${member.is_active ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                            title={member.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Ban size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">{totalCount} members total</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-semibold text-slate-700">Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Member Details</h2>
              <button onClick={() => setViewingMember(null)} className="p-1 text-slate-400 hover:text-slate-700 rounded"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(viewingMember.full_name || viewingMember.username)}&background=random&size=64`} alt="" className="w-16 h-16 rounded-full" />
                <div>
                  <h3 className="font-bold text-slate-900">{viewingMember.full_name || viewingMember.username}</h3>
                  <p className="text-sm text-slate-500">@{viewingMember.username}</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-medium text-slate-900">{viewingMember.email}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Role</span><span className="font-medium text-slate-900">{viewingMember.role_name || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={viewingMember.is_active ? 'Active' : 'Inactive'} /></div>
                <div className="flex justify-between"><span className="text-slate-500">Joined</span><span className="font-medium text-slate-900">{new Date(viewingMember.created_at).toLocaleDateString()}</span></div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={() => { setViewingMember(null); openEditModal(viewingMember); }} className="px-4 py-2 text-sm font-semibold text-[#4C1D95] border border-[#4C1D95]/30 rounded-xl hover:bg-[#4C1D95]/5 transition-colors">Edit Member</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editingMember ? 'Edit Member' : 'Add Member'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="team-fullname" className="block text-xs font-semibold text-slate-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input id="team-fullname" required pattern="[A-Za-z\s]+" title="Only letters and spaces are allowed" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]" />
                </div>
                <div>
                  <label htmlFor="team-username" className="block text-xs font-semibold text-slate-600 mb-1">Username <span className="text-red-500">*</span></label>
                  <input id="team-username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]" />
                </div>
              </div>
              <div>
                <label htmlFor="team-email" className="block text-xs font-semibold text-slate-600 mb-1">Email <span className="text-red-500">*</span></label>
                <input id="team-email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
                  <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]">
                    <option value="">Select role</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                  <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]">
                    <option value="">Select department</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 text-sm font-semibold text-white bg-[#4C1D95] rounded-xl hover:bg-[#3b1574] disabled:opacity-50 flex items-center gap-2">
                  {formLoading && <Loader2 size={14} className="animate-spin" />}
                  {editingMember ? 'Update' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
