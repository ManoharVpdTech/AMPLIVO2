import { api } from './api';

// ── Clients ──────────────────────────────────────────────────────────────────

export const clientService = {
  getAll: async (params?: {
    page?: number; page_size?: number; search?: string;
    status?: string; client_type?: string; assigned_to?: string;
    branch_id?: string; is_active?: boolean;
  }) => {
    const { data } = await api.get('/clients', { params });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/clients/${id}`);
    return data;
  },

  create: async (payload: {
    company_name: string; display_name?: string; industry?: string;
    website?: string; email?: string; phone?: string; gst_number?: string;
    pan_number?: string; client_type?: string; status?: string;
    assigned_to?: string; branch_id?: string; onboarding_date?: string;
    notes?: string; is_active?: boolean;
  }) => {
    const { data } = await api.post('/clients', payload);
    return data;
  },

  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/clients/${id}`, payload);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/clients/${id}`);
  },

  getContacts: async (clientId: string) => {
    const { data } = await api.get(`/clients/${clientId}/contacts`);
    return data;
  },

  addContact: async (clientId: string, payload: {
    name: string; email?: string; phone?: string;
    designation?: string; is_primary?: boolean;
  }) => {
    const { data } = await api.post(`/clients/${clientId}/contacts`, payload);
    return data;
  },

  updateContact: async (contactId: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/clients/contacts/${contactId}`, payload);
    return data;
  },

  deleteContact: async (contactId: string) => {
    await api.delete(`/clients/contacts/${contactId}`);
  },

  getAddresses: async (clientId: string) => {
    const { data } = await api.get(`/clients/${clientId}/addresses`);
    return data;
  },

  addAddress: async (clientId: string, payload: {
    address_type?: string; address_line_1: string; address_line_2?: string;
    city: string; state?: string; country?: string; postal_code?: string; is_primary?: boolean;
  }) => {
    const { data } = await api.post(`/clients/${clientId}/addresses`, payload);
    return data;
  },

  getDocuments: async (clientId: string) => {
    const { data } = await api.get(`/clients/${clientId}/documents`);
    return data;
  },

  addDocument: async (clientId: string, payload: {
    title: string; document_type?: string; file_url?: string; file_size?: number;
  }) => {
    const { data } = await api.post(`/clients/${clientId}/documents`, payload);
    return data;
  },

  getNotes: async (clientId: string) => {
    const { data } = await api.get(`/clients/${clientId}/notes`);
    return data;
  },

  addNote: async (clientId: string, content: string) => {
    const { data } = await api.post(`/clients/${clientId}/notes`, { content });
    return data;
  },
};

// ── Projects ─────────────────────────────────────────────────────────────────

export const projectService = {
  getAll: async (params?: {
    page?: number; page_size?: number; search?: string;
    status?: string; client_id?: string; manager_id?: string;
  }) => {
    const { data } = await api.get('/projects', { params });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/projects/${id}`);
    return data;
  },

  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/projects', payload);
    return data;
  },

  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/projects/${id}`, payload);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/projects/${id}`);
  },

  getMembers: async (projectId: string) => {
    const { data } = await api.get(`/projects/${projectId}/members`);
    return data;
  },

  addMember: async (projectId: string, userId: string) => {
    const { data } = await api.post(`/projects/${projectId}/members`, { user_id: userId });
    return data;
  },

  removeMember: async (projectId: string, userId: string) => {
    await api.delete(`/projects/${projectId}/members/${userId}`);
  },
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const taskService = {
  getAll: async (params?: {
    page?: number; page_size?: number; search?: string;
    status?: string; priority?: string; project_id?: string; assigned_to?: string;
  }) => {
    const { data } = await api.get('/tasks', { params });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/tasks/${id}`);
    return data;
  },

  create: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/tasks', payload);
    return data;
  },

  update: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/tasks/${id}`, payload);
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/tasks/${id}`);
  },

  getComments: async (taskId: string) => {
    const { data } = await api.get(`/tasks/${taskId}/comments`);
    return data;
  },

  addComment: async (taskId: string, content: string) => {
    const { data } = await api.post(`/tasks/${taskId}/comments`, { content });
    return data;
  },

  getAttachments: async (taskId: string) => {
    const { data } = await api.get(`/tasks/${taskId}/attachments`);
    return data;
  },

  addAttachment: async (taskId: string, payload: {
    file_name: string; file_url: string; file_size?: number; file_type?: string;
  }) => {
    const { data } = await api.post(`/tasks/${taskId}/attachments`, payload);
    return data;
  },
};

// ── Task Submissions ───────────────────────────────────────────────────────────

export const taskSubmissionService = {
  getAll: async (taskId: string) => {
    const { data } = await api.get(`/tasks/${taskId}/submissions`);
    return data;
  },

  create: async (taskId: string, payload: {
    title: string; work_summary?: string; deliverable_type?: string;
    external_url?: string; completion_percentage?: number;
  }) => {
    const { data } = await api.post(`/tasks/${taskId}/submissions`, payload);
    return data;
  },

  resubmit: async (submissionId: string, payload: {
    title?: string; work_summary?: string; deliverable_type?: string;
    external_url?: string; completion_percentage?: number;
  }) => {
    const { data } = await api.put(`/submissions/${submissionId}`, payload);
    return data;
  },

  review: async (submissionId: string, payload: { approve: boolean; reviewer_feedback?: string }) => {
    const { data } = await api.post(`/submissions/${submissionId}/review`, payload);
    return data;
  },

  // CRM review queue: every submission across every task, not just one
  // already-known task's history.
  getQueue: async (params?: { page?: number; page_size?: number; status?: string }) => {
    const { data } = await api.get('/submissions', { params });
    return data;
  },
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationService = {
  getAll: async (params?: {
    page?: number; page_size?: number; is_read?: boolean; channel?: string;
  }) => {
    const { data } = await api.get('/notifications', { params });
    return data;
  },

  markRead: async (id: string) => {
    const { data } = await api.put(`/notifications/${id}/read`);
    return data;
  },

  markAllRead: async () => {
    const { data } = await api.put('/notifications/read-all');
    return data;
  },

  delete: async (id: string) => {
    await api.delete(`/notifications/${id}`);
  },
};

// ── Finance ───────────────────────────────────────────────────────────────────

export const financeService = {
  getInvoices: async (params?: {
    page?: number; page_size?: number; search?: string;
    status?: string; client_id?: string;
  }) => {
    const { data } = await api.get('/finance/invoices', { params });
    return data;
  },

  getInvoice: async (id: string) => {
    const { data } = await api.get(`/finance/invoices/${id}`);
    return data;
  },

  getAdvanceInvoiceForLead: async (leadId: string) => {
    const { data } = await api.get(`/finance/invoices/by-lead/${leadId}/advance`);
    return data;
  },

  createInvoice: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/finance/invoices', payload);
    return data;
  },

  updateInvoice: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/finance/invoices/${id}`, payload);
    return data;
  },

  deleteInvoice: async (id: string) => {
    await api.delete(`/finance/invoices/${id}`);
  },

  getInvoiceItems: async (invoiceId: string) => {
    const { data } = await api.get(`/finance/invoices/${invoiceId}/items`);
    return data;
  },

  addInvoiceItem: async (invoiceId: string, payload: Record<string, unknown>) => {
    const { data } = await api.post(`/finance/invoices/${invoiceId}/items`, payload);
    return data;
  },

  getPayments: async (invoiceId: string) => {
    const { data } = await api.get(`/finance/invoices/${invoiceId}/payments`);
    return data;
  },

  getAllPayments: async (params?: { page?: number; page_size?: number; status?: string }) => {
    const { data } = await api.get('/finance/payments', { params });
    return data;
  },

  addPayment: async (invoiceId: string, payload: Record<string, unknown>) => {
    const { data } = await api.post(`/finance/invoices/${invoiceId}/payments`, payload);
    return data;
  },

  // For a logged-in client submitting proof of their own payment - staff-only
  // (addPayment above requires the "finance" role and always 403s for a
  // client-role caller). Starts the same two-step Finance-then-CRM
  // verification as the public magic-link flow; never auto-confirmed.
  submitClientPayment: async (invoiceId: string, payload: { amount: number; payment_method: string; reference_number?: string }) => {
    const { data } = await api.post(`/finance/invoices/${invoiceId}/client-payment`, payload);
    return data;
  },

  createAdvanceInvoice: async (payload: {
    lead_id: string; proposal_id?: string; total_deal_amount: number;
    tax_rate?: number; due_date: string; currency?: string; notes?: string;
  }) => {
    const { data } = await api.post('/finance/invoices/advance', payload);
    return data;
  },

  createFinalInvoice: async (payload: {
    project_id: string; task_submission_id?: string; total_deal_amount: number;
    tax_rate?: number; due_date: string; currency?: string; notes?: string;
  }) => {
    const { data } = await api.post('/finance/invoices/final', payload);
    return data;
  },

  crmApproveInvoice: async (invoiceId: string) => {
    const { data } = await api.post(`/finance/invoices/${invoiceId}/crm-approve`);
    return data;
  },

  resendInvoiceEmail: async (invoiceId: string) => {
    const { data } = await api.post(`/finance/invoices/${invoiceId}/resend-email`);
    return data;
  },

  getEmailDeliveryStatus: async (): Promise<{ live: boolean }> => {
    const { data } = await api.get('/finance/email-delivery-status');
    return data;
  },

  getInvoicePdfUrl: (invoiceId: string) => `${api.defaults.baseURL}/finance/invoices/${invoiceId}/pdf`,

  // The PDF endpoint requires the same Authorization bearer token as every
  // other API call - a plain <a href> can't attach that header, so it 401s.
  // Fetch it as an authenticated blob instead and hand back an object URL.
  fetchInvoicePdfBlob: async (invoiceId: string): Promise<Blob> => {
    const { data } = await api.get(`/finance/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
    return data;
  },

  verifyPaymentFinance: async (paymentId: string) => {
    const { data } = await api.post(`/finance/payments/${paymentId}/verify-finance`);
    return data;
  },

  verifyPaymentCrm: async (paymentId: string) => {
    const { data } = await api.post(`/finance/payments/${paymentId}/verify-crm`);
    return data;
  },

  rejectPayment: async (paymentId: string, reason?: string) => {
    const { data } = await api.post(`/finance/payments/${paymentId}/reject`, { reason });
    return data;
  },

  getExpenses: async (params?: {
    page?: number; page_size?: number; search?: string; category?: string;
  }) => {
    const { data } = await api.get('/finance/expenses', { params });
    return data;
  },

  createExpense: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/finance/expenses', payload);
    return data;
  },

  updateExpense: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/finance/expenses/${id}`, payload);
    return data;
  },

  deleteExpense: async (id: string) => {
    await api.delete(`/finance/expenses/${id}`);
  },
};

// ── Users / Roles / Permissions / Org ─────────────────────────────────────────

export const userManagementService = {
  getUsers: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/users', { params });
    return data;
  },

  getUser: async (id: string) => {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },

  updateUser: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/users/${id}`, payload);
    return data;
  },

  activateUser: async (id: string) => {
    const { data } = await api.post(`/users/${id}/activate`);
    return data;
  },

  deactivateUser: async (id: string) => {
    const { data } = await api.post(`/users/${id}/deactivate`);
    return data;
  },

  getUserProfile: async (userId: string) => {
    const { data } = await api.get(`/users/${userId}/profile`);
    return data;
  },

  upsertUserProfile: async (userId: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/users/${userId}/profile`, payload);
    return data;
  },

  getRoles: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/roles', { params });
    return data;
  },

  createRole: async (payload: { name: string; description?: string }) => {
    const { data } = await api.post('/roles', payload);
    return data;
  },

  updateRole: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/roles/${id}`, payload);
    return data;
  },

  deleteRole: async (id: string) => {
    await api.delete(`/roles/${id}`);
  },

  getRolePermissions: async (roleId: string) => {
    const { data } = await api.get(`/roles/${roleId}/permissions`);
    return data;
  },

  assignPermission: async (roleId: string, permissionId: string) => {
    const { data } = await api.post(`/roles/${roleId}/permissions/${permissionId}`);
    return data;
  },

  revokePermission: async (roleId: string, permissionId: string) => {
    await api.delete(`/roles/${roleId}/permissions/${permissionId}`);
  },

  getPermissions: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/permissions', { params });
    return data;
  },

  createPermission: async (payload: { name: string; module: string; action: string; description?: string }) => {
    const { data } = await api.post('/permissions', payload);
    return data;
  },

  getBranches: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/branches', { params });
    return data;
  },

  createBranch: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/branches', payload);
    return data;
  },

  updateBranch: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/branches/${id}`, payload);
    return data;
  },

  deleteBranch: async (id: string) => {
    await api.delete(`/branches/${id}`);
  },

  getDepartments: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/departments', { params });
    return data;
  },

  createDepartment: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/departments', payload);
    return data;
  },

  updateDepartment: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/departments/${id}`, payload);
    return data;
  },

  deleteDepartment: async (id: string) => {
    await api.delete(`/departments/${id}`);
  },

  getTeams: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/teams', { params });
    return data;
  },

  createTeam: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/teams', payload);
    return data;
  },

  updateTeam: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/teams/${id}`, payload);
    return data;
  },

  deleteTeam: async (id: string) => {
    await api.delete(`/teams/${id}`);
  },

  getDesignations: async (params?: Record<string, unknown>) => {
    const { data } = await api.get('/designations', { params });
    return data;
  },

  createDesignation: async (payload: Record<string, unknown>) => {
    const { data } = await api.post('/designations', payload);
    return data;
  },

  updateDesignation: async (id: string, payload: Record<string, unknown>) => {
    const { data } = await api.put(`/designations/${id}`, payload);
    return data;
  },

  deleteDesignation: async (id: string) => {
    await api.delete(`/designations/${id}`);
  },
};
