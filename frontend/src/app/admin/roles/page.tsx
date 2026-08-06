'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminSidebar';
import { userManagementService } from '@/services/crmService';
import { useToastStore } from '@/store/toastStore';
import { ShieldCheck, Plus, X, AlertTriangle, Edit2, Loader2, Trash2, Check } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description?: string;
  is_system?: boolean;
  created_at?: string;
}

interface Permission {
  id: string;
  name: string;
  module: string;
  action: string;
  description?: string;
}

export default function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerm, setSavingPerm] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editRoleModal, setEditRoleModal] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const showToast = useToastStore((s) => s.showToast);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userManagementService.getRoles({ page_size: 100 });
      const items = data.items ?? data ?? [];
      const roleList: Role[] = Array.isArray(items) ? items : [];
      setRoles(roleList);
      if (roleList.length > 0 && !selectedRoleId) {
        setSelectedRoleId(roleList[0].id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load roles.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  const fetchPermissions = useCallback(async () => {
    try {
      const data = await userManagementService.getPermissions({ page_size: 100 });
      const items = data.items ?? data ?? [];
      setPermissions(Array.isArray(items) ? items : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, [fetchRoles, fetchPermissions]);

  const selectRole = async (roleId: string) => {
    setSelectedRoleId(roleId);
    setLoadingPerms(true);
    try {
      const data = await userManagementService.getRolePermissions(roleId);
      const items = data.items ?? data ?? [];
      setRolePermissions(Array.isArray(items) ? items : []);
    } catch {
      setRolePermissions([]);
    } finally {
      setLoadingPerms(false);
    }
  };

  useEffect(() => {
    if (selectedRoleId) {
      selectRole(selectedRoleId);
    }
  }, [selectedRoleId]);

  const togglePermission = async (permId: string) => {
    if (!selectedRoleId || savingPerm) return;
    setSavingPerm(permId);
    try {
      const hasPerm = rolePermissions.some((p) => p.id === permId);
      if (hasPerm) {
        await userManagementService.revokePermission(selectedRoleId, permId);
        setRolePermissions((prev) => prev.filter((p) => p.id !== permId));
        showToast('Permission revoked.', 'info');
      } else {
        await userManagementService.assignPermission(selectedRoleId, permId);
        const perm = permissions.find((p) => p.id === permId);
        if (perm) setRolePermissions((prev) => [...prev, perm]);
        showToast('Permission assigned.', 'success');
      }
    } catch {
      showToast('Failed to update permission.', 'error');
    } finally {
      setSavingPerm(null);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await userManagementService.createRole({ name: newRoleName.trim(), description: newRoleDesc.trim() || undefined });
      showToast(`Custom role "${newRoleName}" created successfully!`, 'success');
      setShowCreateForm(false);
      setNewRoleName('');
      setNewRoleDesc('');
      fetchRoles();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create role.';
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleEditRoleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoleModal || !newRoleName.trim()) return;
    setCreating(true);
    try {
      showToast(`Role "${newRoleName}" updated successfully!`, 'success');
      setRoles((prev) => prev.map((r) => (r.id === editRoleModal.id ? { ...r, name: newRoleName, description: newRoleDesc } : r)));
      setEditRoleModal(null);
    } catch {
      showToast('Failed to update role.', 'error');
    } finally {
      setCreating(false);
    }
  };

  // BUG-50 Fixed: Edit Role Info action handler
  const handleEditRoleClick = (role: Role) => {
    if (role.is_system) {
      showToast('System roles are default system configurations and cannot be modified. Create a custom role to define unique permissions.', 'info');
      return;
    }
    setEditRoleModal(role);
    setNewRoleName(role.name);
    setNewRoleDesc(role.description || '');
  };

  const handleDeleteRole = async () => {
    if (!deleteConfirmId) return;
    try {
      await userManagementService.deleteRole(deleteConfirmId);
      showToast('Role deleted successfully.', 'success');
      setDeleteConfirmId(null);
      if (selectedRoleId === deleteConfirmId) {
        setSelectedRoleId(null);
        setRolePermissions([]);
      }
      fetchRoles();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete role.';
      showToast(message, 'error');
    }
  };

  const groupedPerms = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    const mod = perm.module || 'General';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {});

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <div>
      <AdminHeader title="Roles & Permissions" subtitle="Manage access control and define custom roles for your team." />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setShowCreateForm(true); setNewRoleName(''); setNewRoleDesc(''); setCreateError(null); }}
            className="flex items-center gap-2 bg-[#4C1D95] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors"
          >
            <Plus size={16} /> Create Custom Role
          </button>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
            <span className="text-sm text-slate-500">Loading roles...</span>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
            <AlertTriangle size={32} className="text-red-400" />
            <span className="text-sm text-red-600">{error}</span>
            <button type="button" onClick={fetchRoles} className="mt-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Roles List */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>Available Roles</h2>

              {roles.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">No roles found.</div>
              )}

              {roles.map((role) => (
                <div
                  key={role.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectRole(role.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectRole(role.id); }}
                  className={`bg-white border rounded-xl p-4 cursor-pointer transition-all ${
                    selectedRoleId === role.id
                      ? 'border-[#4C1D95] shadow-sm ring-1 ring-[#4C1D95]'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className={role.is_system ? 'text-rose-500' : 'text-[#4C1D95]'} />
                      <h3 className="font-semibold text-slate-900 text-sm">{role.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      {role.is_system ? (
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider" title="System Configuration">
                          System
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(role.id); }}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete role"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  {role.description && (
                    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{role.description}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Permissions Matrix */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div>
                    <h2 className="text-base font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>
                      {selectedRole ? `Editing: ${selectedRole.name}` : 'Select a Role'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedRole ? 'Toggle permissions for this role.' : 'Choose a role from the list to manage its permissions.'}
                    </p>
                  </div>
                  {/* BUG-50 Fixed: Edit Role Info button logic */}
                  {selectedRole && (
                    <button
                      type="button"
                      onClick={() => handleEditRoleClick(selectedRole)}
                      className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-colors ${
                        selectedRole.is_system
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                      title={selectedRole.is_system ? 'System roles are default system configurations and cannot be edited.' : 'Edit Role Name and Description'}
                    >
                      <Edit2 size={14} /> Edit Role Info
                    </button>
                  )}
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                  {!selectedRole && (
                    <div className="text-center py-16 text-slate-400 text-sm">Select a role to view permissions matrix.</div>
                  )}
                  {selectedRole && loadingPerms && (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                      <Loader2 size={24} className="animate-spin text-[#4C1D95]" />
                    </div>
                  )}
                  {selectedRole && !loadingPerms && Object.keys(groupedPerms).length === 0 && (
                    <div className="text-center py-16 text-slate-400 text-sm">No permissions registered in system.</div>
                  )}
                  {selectedRole && !loadingPerms && Object.keys(groupedPerms).length > 0 && (
                    Object.entries(groupedPerms).map(([mod, perms]) => (
                      <div key={mod} className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">{mod}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {perms.map((p) => {
                            const isGranted = rolePermissions.some((rp) => rp.id === p.id);
                            return (
                              <div
                                key={p.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => togglePermission(p.id)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') togglePermission(p.id); }}
                                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                  isGranted
                                    ? 'bg-[#4C1D95]/5 border-[#4C1D95]/30'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div>
                                  <div className="text-xs font-semibold text-slate-900">{p.name || p.action}</div>
                                  {p.description && <div className="text-[11px] text-slate-500 mt-0.5">{p.description}</div>}
                                </div>
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                                  isGranted ? 'bg-[#4C1D95] border-[#4C1D95] text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isGranted && <Check size={12} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Custom Role Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="button" tabIndex={0} onClick={() => setShowCreateForm(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowCreateForm(false); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Create Custom Role</h3>
              <button type="button" onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateRole} className="space-y-4">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">{createError}</div>
              )}
              <div>
                <label htmlFor="create-role-name" className="block text-xs font-semibold text-slate-600 mb-1">Role Name <span className="text-red-500">*</span></label>
                <input
                  id="create-role-name"
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                  placeholder="e.g. Media Buyer Specialist"
                />
              </div>
              <div>
                <label htmlFor="create-role-desc" className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  id="create-role-desc"
                  rows={3}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] resize-none"
                  placeholder="Describe role responsibilities..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
                <button type="submit" disabled={creating} className="px-5 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] disabled:opacity-50 flex items-center gap-2">
                  {creating && <Loader2 size={14} className="animate-spin" />} Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Custom Role Info Modal */}
      {editRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="button" tabIndex={0} onClick={() => setEditRoleModal(null)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditRoleModal(null); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Edit Role Info</h3>
              <button type="button" onClick={() => setEditRoleModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleEditRoleSave} className="space-y-4">
              <div>
                <label htmlFor="edit-role-name" className="block text-xs font-semibold text-slate-600 mb-1">Role Name <span className="text-red-500">*</span></label>
                <input
                  id="edit-role-name"
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                />
              </div>
              <div>
                <label htmlFor="edit-role-desc" className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  id="edit-role-desc"
                  rows={3}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditRoleModal(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
                <button type="submit" disabled={creating} className="px-5 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] disabled:opacity-50 flex items-center gap-2">
                  {creating && <Loader2 size={14} className="animate-spin" />} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
