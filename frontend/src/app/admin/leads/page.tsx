'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminHeader } from '@/components/admin/AdminSidebar';
import { leadService, LeadRead, LeadCreatePayload } from '@/services/leadService';
import { userManagementService } from '@/services/crmService';
import { useToastStore } from '@/store/toastStore';
import { PhoneInput } from '@/components/ui/PhoneInput';
import {
  Search, Plus, Filter, MoreHorizontal, Mail, Phone, X, Trash2, Pencil,
  ChevronLeft, ChevronRight, Loader2, AlertCircle, Clock, UserCheck, Download
} from 'lucide-react';

interface UserRead {
  id: string;
  full_name?: string;
  name?: string;
  email?: string;
}

const ALL_STATUSES = ['All', 'New', 'Meeting Scheduled', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Converted', 'Lost'];
const PRIORITY_OPTIONS = ['All', 'Low', 'Medium', 'High', 'Urgent'];
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date Created' },
  { value: 'estimated_value', label: 'Value' },
  { value: 'title', label: 'Title' },
];

function statusColor(status: string) {
  const normalized = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : '';
  switch (normalized) {
    case 'New': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Meeting Scheduled': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Contacted': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'Qualified': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'Proposal': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Negotiation': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Converted': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Lost': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

function priorityColor(priority: string) {
  switch (priority) {
    case 'Low': return 'text-slate-500';
    case 'Medium': return 'text-amber-600';
    case 'High': return 'text-orange-600';
    case 'Urgent': return 'text-rose-600';
    default: return 'text-slate-500';
  }
}

function formatCurrency(val?: number | null) {
  if (val == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
}

// AMP-017: CSV export helper
function exportLeadsToCSV(leads: LeadRead[]) {
  const headers = ['Title', 'Company', 'Contact Name', 'Email', 'Phone', 'Status', 'Priority', 'Estimated Value', 'Assigned To', 'Created At'];
  const rows = leads.map((l) => [
    l.title,
    l.company_name ?? '',
    l.contact_name ?? '',
    l.email ?? '',
    l.phone ?? '',
    l.status,
    l.priority,
    l.estimated_value != null ? l.estimated_value : '',
    l.assigned_to ?? '',
    l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN') : '',
  ]);
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM: LeadCreatePayload = {
  title: '',
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  status: 'New',
  priority: 'Medium',
  estimated_value: undefined,
  assigned_to: '',
  notes: '',
};

export default function AdminLeads() {
  const [leads, setLeads] = useState<LeadRead[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadRead | null>(null);
  const [form, setForm] = useState<LeadCreatePayload>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<LeadCreatePayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = useToastStore((s) => s.showToast);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'All') params.status = statusFilter;
      if (priorityFilter !== 'All') params.priority = priorityFilter;
      const res = await leadService.getAll(params as any);
      setLeads(res.items ?? []);
      setTotalCount(res.total ?? (res.items ?? []).length);
    } catch (err) {
      console.error('Failed to fetch leads', err);
      setLeads([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, priorityFilter, sortBy, sortOrder]);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const data = await userManagementService.getUsers({ page_size: 100 });
      const items = data.items ?? data ?? [];
      setTeamMembers(Array.isArray(items) ? items : []);
    } catch {
      setTeamMembers([]);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuId && !(e.target as HTMLElement).closest('.action-menu-wrapper')) {
        setActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actionMenuId]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm]);

  const openCreateModal = () => {
    setEditingLead(null);
    setForm(EMPTY_FORM);
    setInitialForm(EMPTY_FORM);
    setValidationErrors({});
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (lead: LeadRead) => {
    setEditingLead(lead);
    const loadedForm: LeadCreatePayload = {
      title: lead.title,
      company_name: lead.company_name ?? '',
      contact_name: lead.contact_name ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      status: lead.status,
      priority: lead.priority,
      estimated_value: lead.estimated_value ?? undefined,
      assigned_to: lead.assigned_to ?? '',
      notes: lead.notes ?? '',
    };
    setForm(loadedForm);
    setInitialForm(loadedForm);
    setValidationErrors({});
    setShowModal(true);
    setActionMenuId(null);
  };

  const attemptCloseModal = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      setShowModal(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) {
      errors.title = 'Title is required.';
    } else if (form.title.trim().length < 2) {
      errors.title = 'Title must be at least 2 characters.';
    }
    if (!form.contact_name?.trim()) errors.contact_name = 'Contact name is required.';
    if (!form.email?.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Invalid email address format.';
    }
    if (!form.phone?.trim()) {
      errors.phone = 'Phone number is required.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildLeadPayload = (): LeadCreatePayload => {
    // Optional string fields must be omitted (not sent as "") - the backend
    // rejects an explicit empty string as "too short" for these fields.
    const payload: LeadCreatePayload = { ...form, title: form.title.trim() };
    if (!payload.company_name?.trim()) delete payload.company_name;
    else payload.company_name = payload.company_name.trim();
    if (!payload.contact_name?.trim()) delete payload.contact_name;
    else payload.contact_name = payload.contact_name.trim();
    if (!payload.email?.trim()) delete payload.email;
    if (!payload.phone?.trim()) delete payload.phone;
    if (!payload.notes?.trim()) delete payload.notes;
    if (!payload.assigned_to) delete payload.assigned_to;
    return payload;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = buildLeadPayload();
      if (editingLead) {
        await leadService.update(editingLead.id, payload);
        showToast(`Lead "${form.title}" updated successfully!`, 'success');
      } else {
        await leadService.create(payload);
        showToast(`Lead "${form.title}" created successfully!`, 'success');
      }
      setShowModal(false);
      fetchLeads();
    } catch (err: any) {
      // AMP-015: 422 error handling
      if (err?.response?.status === 422) {
        const detail = err.response?.data?.detail;
        if (Array.isArray(detail)) {
          const fieldErrors: Record<string, string> = {};
          detail.forEach((d: { loc?: string[]; msg?: string }) => {
            const field = d.loc?.[d.loc.length - 1];
            if (field) fieldErrors[field] = d.msg ?? 'Invalid value.';
          });
          setValidationErrors((prev) => ({ ...prev, ...fieldErrors }));
          setFormError('Please fix the highlighted fields and try again.');
        } else {
          setFormError(typeof detail === 'string' ? detail : 'Validation error. Please check the form fields.');
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to save lead.';
        setFormError(msg);
        showToast(msg, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, leadTitle: string) => {
    setActionMenuId(null);
    if (!confirm(`Are you sure you want to delete lead "${leadTitle}"?`)) return;
    try {
      await leadService.delete(id);
      showToast(`Lead "${leadTitle}" deleted successfully.`, 'success');
      fetchLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete lead.';
      showToast(msg, 'error');
    }
  };

  // AMP-017: Export all leads as CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string | number> = { page: 1, page_size: 1000, sort_by: sortBy, sort_order: sortOrder };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'All') params.status = statusFilter;
      if (priorityFilter !== 'All') params.priority = priorityFilter;
      const res = await leadService.getAll(params as any);
      const allLeads: LeadRead[] = res.items ?? [];
      if (allLeads.length === 0) {
        showToast('No leads to export.', 'error');
        return;
      }
      exportLeadsToCSV(allLeads);
      showToast(`Exported ${allLeads.length} lead(s) to CSV.`, 'success');
    } catch {
      showToast('Failed to export leads.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div>
      <AdminHeader title="Lead Management" subtitle="Track and convert inbound leads across all client campaigns." />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, email..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
            />
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {/* Status Dropdown (FEATURE-02) */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#4C1D95]"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#4C1D95]"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p === 'All' ? 'All Priorities' : p}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#4C1D95]"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button
              onClick={toggleSortOrder}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
            {/* AMP-017: Export CSV button */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
              title="Export leads to CSV"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors"
            >
              <Plus size={16} /> Add Lead
            </button>
          </div>
        </div>

        {/* Status Pills Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ALL_STATUSES.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-[#4C1D95] text-white border-[#4C1D95]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lead Info</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status & Priority</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimated Value</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex items-center justify-center gap-2 text-slate-400">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-sm">Loading leads...</span>
                      </div>
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                      No leads found.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-900 text-sm mb-0.5">{lead.title}</div>
                        <div className="text-xs text-slate-500">{lead.company_name || 'N/A'}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          {lead.contact_name && (
                            <span className="text-xs text-slate-700 font-medium">{lead.contact_name}</span>
                          )}
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="text-xs text-slate-600 flex items-center gap-1.5 hover:text-[#4C1D95] transition-colors">
                              <Mail size={12} className="text-slate-400" /> {lead.email}
                            </a>
                          )}
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="text-xs text-slate-600 flex items-center gap-1.5 hover:text-[#4C1D95] transition-colors">
                              <Phone size={12} className="text-slate-400" /> {lead.phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border w-fit ${statusColor(lead.status)}`}>
                            {lead.status}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${priorityColor(lead.priority)}`}>
                            {lead.priority}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-900 text-sm">
                        {formatCurrency(lead.estimated_value)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {lead.assigned_to ? (
                            <>
                              <div className="w-6 h-6 rounded-full bg-[#4C1D95]/10 flex items-center justify-center text-[10px] font-bold text-[#4C1D95] border border-[#4C1D95]/20">
                                {lead.assigned_to.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-medium text-slate-700">{lead.assigned_to}</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">Unassigned</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="relative action-menu-wrapper inline-block">
                          <button
                            onClick={() => setActionMenuId(actionMenuId === lead.id ? null : lead.id)}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {actionMenuId === lead.id && (
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                              <button
                                onClick={() => openEditModal(lead)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                <Pencil size={13} className="text-slate-400" /> Edit
                              </button>
                              <button
                                onClick={() => handleDelete(lead.id, lead.title)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500 bg-slate-50">
            <div>Showing {leads.length} of {totalCount} leads</div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="text-xs text-slate-500 font-medium">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editingLead ? 'Edit Lead' : 'Add Lead'}</h2>
              <button onClick={attemptCloseModal} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                    validationErrors.title ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                  }`}
                  placeholder="e.g. Website Redesign Inquiry"
                />
                {validationErrors.title && <p className="text-red-500 text-[11px] mt-1">{validationErrors.title}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Contact Name <span className="text-red-500">*</span></label>
                  <input
                    value={form.contact_name ?? ''}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                      validationErrors.contact_name ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                    placeholder="John Doe"
                  />
                  {validationErrors.contact_name && <p className="text-red-500 text-[11px] mt-1">{validationErrors.contact_name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Company</label>
                  <input
                    value={form.company_name ?? ''}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                    placeholder="Acme Corp"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                      validationErrors.email ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                    placeholder="john@example.com"
                  />
                  {validationErrors.email && <p className="text-red-500 text-[11px] mt-1">{validationErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone <span className="text-red-500">*</span></label>
                  <PhoneInput
                    value={form.phone ?? ''}
                    onChange={(val) => setForm({ ...form, phone: val || '' })}
                    placeholder="+91 9876543210"
                  />
                  {validationErrors.phone && <p className="text-red-500 text-[11px] mt-1">{validationErrors.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={form.status ?? 'New'}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                  >
                    {ALL_STATUSES.filter((s) => s !== 'All').map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                  <select
                    value={form.priority ?? 'Medium'}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                  >
                    {PRIORITY_OPTIONS.filter((p) => p !== 'All').map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Estimated Value (₹)</label>
                  <input
                    type="number"
                    value={form.estimated_value ?? ''}
                    onChange={(e) => setForm({ ...form, estimated_value: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned To</label>
                  <select
                    value={form.assigned_to ?? ''}
                    onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                  >
                    <option value="">Select Team Member...</option>
                    {teamMembers.map((m) => {
                      const name = m.full_name || m.name || m.email || m.id;
                      return <option key={m.id} value={m.id}>{name}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Activity Log & Notes</label>
                <textarea
                  value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] resize-none"
                  placeholder="Enter formatted lead activity logs or follow-up notes..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-200">
              <button
                onClick={attemptCloseModal}
                className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (editingLead ? !isDirty : false)}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#4C1D95] rounded-xl hover:bg-[#3b1574] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {/* AMP-015: Only disable save when editing+pristine; new leads can always submit */}
                {editingLead ? 'Save Changes' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Changes Guard Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle size={24} />
              <h3 className="font-bold text-slate-900 text-base">Unsaved Changes</h3>
            </div>
            <p className="text-xs text-slate-600">You have unsaved changes on this lead. Are you sure you want to leave without saving?</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Keep Editing
              </button>
              <button
                onClick={() => { setShowDiscardConfirm(false); setShowModal(false); }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
