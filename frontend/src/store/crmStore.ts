import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CrmLead, CrmLeadStatus, CrmClient, ClientStatus, CrmProject, CrmEmployee,
  CrmInvoice, CrmInvoiceStatus, CrmPayment, CrmNotification,
  CrmCredentials, CrmTask, CrmSubmission, CrmSubmissionVersion, CrmActivityLog, TaskStatus, SubmissionStatus,
  ProjectStatus, ProjectPriority,
} from '@/types/crm';
import { leadService } from '@/services/leadService';
import { clientService, projectService, taskService, taskSubmissionService, notificationService, financeService } from '@/services/crmService';
import { userManagementService } from '@/services/crmService';
import { useAuthStore } from './authStore';
import { SalesLeadStatus } from '@/types';
import { MOCK_LEADS, MOCK_CLIENTS, MOCK_PROJECTS, MOCK_TASKS, MOCK_EMPLOYEES } from './mockCrmData';

// ─────────────────────────────────────────────────────────────────────────────
// AMPLIVO CRM Store
// BACKEND NOTE:
//   - All state mutations are isolated in actions.
//   - Actions call the backend API and fall back to local state on failure.
//   - Each action mirrors a REST endpoint (listed in comments).
// ─────────────────────────────────────────────────────────────────────────────

interface CrmState {
  // ─── Data ─────────────────────────────────────────────────────────────────
  leads: CrmLead[];
  clients: CrmClient[];
  projects: CrmProject[];
  employees: CrmEmployee[];
  invoices: CrmInvoice[];
  payments: CrmPayment[];
  notifications: CrmNotification[];
  tasks: CrmTask[];
  submissions: CrmSubmission[];
  activityLogs: CrmActivityLog[];

  // ─── UI State ─────────────────────────────────────────────────────────────
  isLoading: boolean;
  dataLoaded: boolean;
  selectedLeadId: string | null;
  selectedClientId: string | null;
  selectedProjectId: string | null;
  activeEmployeeId: string | null;
  theme: 'light' | 'dark' | 'system';

  // ─── API Actions ─────────────────────────────────────────────────────────
  fetchAllData: (opts?: { skipFinance?: boolean }) => Promise<void>;
  fetchLeads: () => Promise<void>;
  fetchClients: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchEmployees: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  fetchSubmissions: () => Promise<void>;
  fetchInvoices: () => Promise<void>;
  fetchPayments: () => Promise<void>;
  fetchNotifications: () => Promise<void>;

  // ─── LEAD ACTIONS ──────────────────────────────────────────────────────────
  updateLeadStatus: (id: string, status: CrmLeadStatus, notes?: string) => void;
  // BACKEND: PATCH /api/crm/leads/:id/review
  reviewLead: (id: string, status: 'Approved' | 'Rejected', notes: string, rejectionReason?: string) => void;
  // BACKEND: POST /api/crm/leads/:id/send-invoice
  sendInvoiceEmail: (leadId: string) => void;
  // BACKEND: POST /api/crm/leads/:id/generate-credentials
  generateCredentials: (leadId: string) => CrmCredentials;
  // BACKEND: POST /api/crm/leads/:id/send-welcome
  sendWelcomeEmail: (leadId: string) => void;

  // ─── CLIENT ACTIONS ────────────────────────────────────────────────────────
  // BACKEND: POST /api/crm/clients
  convertLeadToClient: (leadId: string) => CrmClient | null;
  // BACKEND: PATCH /api/crm/clients/:id
  updateClient: (id: string, updates: Partial<CrmClient>) => void;
  // BACKEND: PATCH /api/crm/clients/:id/employees
  assignEmployeesToClient: (clientId: string, employeeIds: string[]) => void;

  // ─── PROJECT ACTIONS ───────────────────────────────────────────────────────
  // BACKEND: PATCH /api/crm/projects/:id/employees
  assignEmployeesToProject: (projectId: string, employeeIds: string[]) => void;
  // BACKEND: PATCH /api/crm/projects/:id/progress
  updateProjectProgress: (projectId: string, progress: number) => void;
  // BACKEND: PATCH /api/crm/projects/:id/status
  updateProjectStatus: (projectId: string, status: CrmProject['status']) => void;
  // BACKEND: PATCH /api/crm/projects/:id/milestone
  completeMilestone: (projectId: string, milestoneId: string) => void;

  // ─── EMPLOYEE ACTIONS ──────────────────────────────────────────────────────
  setActiveEmployee: (id: string | null) => void;
  updateEmployee: (id: string, updates: Partial<CrmEmployee>) => void;
  // BACKEND: PATCH /api/crm/employees/:id (workload + projects)
  updateEmployeeWorkload: (employeeId: string, projectId: string, add: boolean) => void;

  // ─── INVOICE ACTIONS ───────────────────────────────────────────────────────
  // BACKEND: PATCH /api/crm/invoices/:id/status
  updateInvoiceStatus: (invoiceId: string, status: CrmInvoiceStatus) => void;
  // BACKEND: POST /api/crm/invoices/:id/send-reminder
  sendInvoiceReminder: (invoiceId: string) => void;

  // ─── PAYMENT ACTIONS ───────────────────────────────────────────────────────
  // BACKEND: POST /finance/payments/:id/verify-finance then /verify-crm
  verifyPayment: (paymentId: string) => Promise<void>;
  rejectPayment: (paymentId: string, reason?: string) => Promise<void>;

  // ─── NOTIFICATION ACTIONS ─────────────────────────────────────────────────
  // BACKEND: PATCH /api/crm/notifications/:id/read
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<CrmNotification, 'id'>) => void;

  // ─── SELECTORS ────────────────────────────────────────────────────────────
  getLeadById: (id: string) => CrmLead | undefined;
  getClientById: (id: string) => CrmClient | undefined;
  getProjectById: (id: string) => CrmProject | undefined;
  getEmployeeById: (id: string) => CrmEmployee | undefined;
  getInvoiceById: (id: string) => CrmInvoice | undefined;
  getUnreadCount: () => number;
  getProjectsForClient: (clientId: string) => CrmProject[];
  getEmployeesForProject: (projectId: string) => CrmEmployee[];
  getProjectsByEmployee: (employeeId: string) => CrmProject[];
  getTasksByEmployee: (employeeId: string) => CrmTask[];

  // ─── TASK ACTIONS ─────────────────────────────────────────────────────────
  startTask: (taskId: string) => void;
  updateTaskProgress: (taskId: string, progress: number, status?: TaskStatus) => void;
  markTaskBlocked: (taskId: string, reason: string) => void;
  addTaskComment: (taskId: string, text: string) => void;
  addMockFile: (taskId: string, name: string) => void;

  // ─── SUBMISSION ACTIONS ───────────────────────────────────────────────────
  saveSubmissionDraft: (submissionData: Partial<CrmSubmission>) => void;
  submitToCRM: (submissionData: Partial<CrmSubmission>) => Promise<void>;
  acknowledgeCRMFeedback: (submissionId: string) => void;
  createRevision: (submissionId: string, notes: string) => void;
  resubmitToCRM: (submissionId: string, versionData: Partial<CrmSubmissionVersion>) => Promise<void>;
  
  // CRM Review Actions
  reviewSubmission: (submissionId: string) => void;
  requestSubmissionChanges: (submissionId: string, feedback: string) => Promise<void>;
  approveSubmission: (submissionId: string) => Promise<void>;

  // ─── THEME ACTIONS ────────────────────────────────────────────────────────
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

// ─── CREDENTIAL GENERATOR ────────────────────────────────────────────────────
const generateCreds = (lead: CrmLead): CrmCredentials => {
  const fn = lead.salesLead.firstName.toLowerCase();
  const ln = lead.salesLead.lastName.toLowerCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  return {
    clientId: `AMP-CLT-${lead.id.slice(-4).toUpperCase()}`,
    username: `${fn}.${ln}@amplivo.client`,
    tempPassword: `Amp#${rand}Temp`,
    expiryDate: expiry.toISOString().split('T')[0],
    emailSent: true,
    generatedAt: new Date().toISOString(),
  };
};

// ─── PROJECT MAPPER ───────────────────────────────────────────────────────────
// The backend `Project` model only stores id/name/client_id/description/status/
// start_date/end_date/manager_id/member_ids — the CRM UI's richer CrmProject
// shape (services, milestones, budgetINR, assignedEmployeeIds, ...) is not all
// present on the wire, so it must be filled in here with real defaults instead
// of being assumed to exist on the raw API payload.
const mapBackendProject = (raw: Record<string, any>, clients: CrmClient[]): CrmProject => {
  const client = clients.find(c => c.id === raw.client_id);
  return {
    id: raw.id || '',
    name: raw.name || '',
    clientId: raw.client_id || '',
    clientName: client ? `${client.firstName} ${client.lastName}`.trim() : '',
    company: client?.company || '',
    services: client?.services || [],
    description: raw.description || '',
    priority: (raw.priority as ProjectPriority) || 'Medium',
    startDate: raw.start_date || '',
    endDate: raw.end_date || '',
    durationMonths: raw.duration_months || 0,
    status: (raw.status as ProjectStatus) || 'Waiting Assignment',
    progress: raw.progress ?? 0,
    milestones: raw.milestones || [],
    assignedEmployeeIds: raw.member_ids || raw.assignedEmployeeIds || [],
    crmExec: raw.crm_exec || client?.assignedCrmExec || '',
    budgetINR: raw.budget_inr ?? raw.budget ?? 0,
    notes: raw.notes || '',
    createdAt: raw.created_at || new Date().toISOString(),
    lastUpdated: raw.updated_at || raw.created_at || new Date().toISOString(),
  };
};

// ─── TASK MAPPER ──────────────────────────────────────────────────────────────
// Same gap as projects: the backend `Task` model only stores id/title/
// description/project_id/status/priority/progress/due_date/assigned_to —
// the CRM/Employee UI's richer CrmTask shape (projectName, service,
// assignedEmployeeId, comments, workingFiles, ...) is not on the wire and
// must be filled in here instead of assumed present on the raw payload.
const mapBackendTask = (raw: Record<string, any>, projects: CrmProject[]): CrmTask => {
  const project = projects.find(p => p.id === raw.project_id);
  return {
    id: raw.id || '',
    taskNumber: raw.task_number || raw.taskNumber || '',
    projectId: raw.project_id || '',
    projectName: project?.name || '',
    clientId: project?.clientId || '',
    service: raw.service || project?.services?.[0] || '',
    assignedEmployeeId: raw.assigned_employee_id || raw.assigned_to || raw.assignedEmployeeId || '',
    assignedRole: raw.assigned_role || '',
    title: raw.title || '',
    description: raw.description || '',
    priority: (raw.priority as ProjectPriority) || 'Medium',
    dueDate: raw.due_date || '',
    status: (String(raw.status || 'TODO').toUpperCase() as TaskStatus),
    progress: raw.progress ?? 0,
    comments: raw.comments || [],
    workingFiles: raw.working_files || [],
    createdAt: raw.created_at || new Date().toISOString(),
    lastUpdated: raw.updated_at || raw.created_at || new Date().toISOString(),
  };
};

// Backend TaskSubmission.status: pending_review (default) | approved |
// changes_requested (see Backend/app/modules/tasks/models.py /service.py) -
// there's no backend equivalent of "SENT_TO_CLIENT", so an approved
// submission maps to CRM_APPROVED.
const mapBackendSubmissionStatus = (status: string | null | undefined): SubmissionStatus => {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return 'CRM_APPROVED';
  if (s === 'changes_requested') return 'CRM_CHANGES_REQUESTED';
  return 'PENDING_CRM_REVIEW';
};

const mapBackendSubmission = (raw: Record<string, any>, task: CrmTask | undefined): CrmSubmission => {
  const status = mapBackendSubmissionStatus(raw.status);
  return {
    id: raw.id || '',
    employeeId: task?.assignedEmployeeId || raw.submitted_by || '',
    projectId: task?.projectId || '',
    taskId: raw.task_id || '',
    clientId: task?.clientId || '',
    service: task?.service || '',
    assignmentId: `${task?.projectId || ''}_${raw.task_id || ''}`,
    assignedRole: task?.assignedRole || '',
    title: raw.title || '',
    workSummary: raw.work_summary || '',
    deliverableType: raw.deliverable_type || 'link',
    currentStatus: status,
    versions: [{
      versionId: raw.id || '',
      versionNumber: raw.version_number ?? 1,
      submissionDate: raw.created_at || '',
      files: [],
      externalUrl: raw.external_url || undefined,
      completionPercentage: raw.completion_percentage ?? 100,
      employeeComment: raw.work_summary || '',
      status,
    }],
    createdAt: raw.created_at || '',
    lastUpdated: raw.updated_at || raw.created_at || '',
  };
};

// ─── LEAD STATUS MAPPER ───────────────────────────────────────────────────────
// The real backend Lead.status now uses app/core/lead_pipeline.py's values
// (NEW_LEAD, CRM_PENDING, ADVANCE_PAID, ...) - this used to be hardcoded to
// always return 'Pending Review' regardless of the real status, so the CRM
// dashboard could never distinguish a new lead from an already-closed one.
const mapBackendLeadStatusToCrmStatus = (status: string | null | undefined): CrmLeadStatus => {
  const upper = (status || '').toUpperCase();
  if (upper === 'CRM_PENDING') return 'Pending Review';
  if (upper === 'CRM_APPROVED' || upper === 'EMAIL_SENT') return 'Approved';
  if (upper === 'REJECTED' || upper === 'LOST') return 'Rejected';
  if (upper === 'ADVANCE_PAID') return 'Payment Verified';
  if (['CLIENT_ACCOUNT_CREATED', 'PROJECT_CREATED', 'PROJECT_COMPLETED'].includes(upper)) return 'Client Created';
  // NEW_LEAD / MEETING_SCHEDULED / MEETING_COMPLETED / PROPOSAL_CREATED /
  // ADVANCE_INVOICE_CREATED - still with Sales, nothing for CRM to act on yet.
  return 'Pending Review';
};

// ─── PAYMENT STATUS MAPPER ────────────────────────────────────────────────────
// Backend Payment.status: pending (placeholder, no proof yet) | submitted |
// finance_verified | crm_verified | rejected (two-step flow) -or- completed |
// failed (legacy staff-entered path) - see app/modules/finance/constants.py.
const mapBackendPaymentStatus = (status: string | null | undefined): CrmPayment['status'] => {
  const s = (status || '').toLowerCase();
  if (s === 'crm_verified' || s === 'completed') return 'Paid';
  if (s === 'submitted' || s === 'finance_verified') return 'Processing';
  if (s === 'rejected' || s === 'failed') return 'Failed';
  return 'Pending';
};

// ─── LEAD MAPPER ──────────────────────────────────────────────────────────────
// Extracted from fetchLeads so fetchAllData can build the leads list once and
// reuse it (as *already-mapped* CrmLead[]) when mapping clients/invoices,
// instead of every consumer re-deriving contact name/email/services from
// raw Lead fields independently.
const mapBackendLead = (l: Record<string, any>): CrmLead => ({
  id: l.id || '',
  salesLead: {
    id: l.id || '',
    title: l.title || '',
    firstName: (l.contact_name || '').split(' ')[0] || '',
    lastName: (l.contact_name || '').split(' ').slice(1).join(' ') || '',
    email: l.email || '',
    phone: l.phone || '',
    designation: '',
    company: l.company_name || '',
    // The real Lead table has no industry/company_size/website/city columns
    // at all (see Backend/app/modules/leads/models.py) - these were mock-only
    // concepts that were never captured anywhere upstream (intake forms,
    // Sales lead-creation UI). Left blank rather than fabricated; surfacing
    // this gap is more honest than inventing plausible-looking values.
    industry: '',
    companySize: '',
    website: '',
    city: '',
    status: 'New' as SalesLeadStatus,
    source: 'Organic' as const,
    assignedTo: l.assigned_to || '',
    priority: (l.priority as 'Low' | 'Medium' | 'High' | 'Critical') || 'Medium',
    budget: l.estimated_value || 0,
    expectedCloseDate: '',
    probability: 50,
    interestedServices: l.interested_services || [],
    notes: l.notes || '',
    meetings: [],
    timeline: [],
    invoiceGenerated: false,
    createdAt: l.created_at || new Date().toISOString(),
    lastUpdated: l.updated_at || new Date().toISOString(),
    followUpDate: '',
  },
  salesInvoice: null,
  crmStatus: mapBackendLeadStatusToCrmStatus(l.status),
  crmAssignedTo: l.assigned_to || '',
  reviewNotes: l.notes || '',
  invoiceEmailSent: false,
  welcomeEmailSent: false,
  convertedToClientId: l.converted_client_id || undefined,
  receivedAt: l.created_at || new Date().toISOString(),
});

// ─── CLIENT MAPPER ────────────────────────────────────────────────────────────
// fetchClients used to do `set({ clients: res.items || res || [] })` with NO
// mapping at all - the real backend Client (company_name, email, phone,
// industry, website, status, onboarding_date, contacts[]) shares almost no
// field names with the CrmClient shape every CRM page renders (company,
// firstName/lastName, monthlyRetainer, clientId, assignedEmployees, ...).
// That is the exact root cause of "Cannot read properties of undefined
// (reading 'charAt'/'toLocaleString')" crashes on /crm/clients and
// /crm/clients/[id] - client.company, client.firstName, client.monthlyRetainer
// etc were always undefined for any real (non-mock) client.
const CLIENT_STATUS_MAP: Record<string, ClientStatus> = {
  active: 'Active', onboarding: 'Onboarding', churned: 'Churned',
  inactive: 'Churned', on_hold: 'On Hold', renewal_due: 'Renewal Due',
};
const mapBackendClientStatus = (raw: Record<string, any>): ClientStatus => {
  const mapped = CLIENT_STATUS_MAP[String(raw.status || '').toLowerCase()];
  if (mapped) return mapped;
  return raw.is_active === false ? 'Churned' : 'Active';
};

const mapBackendClient = (raw: Record<string, any>, leads: CrmLead[], invoices: CrmInvoice[]): CrmClient => {
  // The lead this client was converted from (if any) - the real source of
  // the original contact person's name/services, since Client itself only
  // stores a company-level email/phone, not a named individual.
  const lead = leads.find(l => l.convertedToClientId === raw.id);
  const rawContacts: Array<Record<string, any>> = raw.contacts || [];
  const primaryContact = rawContacts.find(c => c.is_primary) || rawContacts[0];
  const contactFullName: string = primaryContact?.name
    || (lead ? `${lead.salesLead.firstName} ${lead.salesLead.lastName}`.trim() : '');
  const nameParts = contactFullName.trim() ? contactFullName.trim().split(' ') : [];

  const clientInvoices = invoices.filter(i => i.clientId === raw.id || (lead && i.leadId === lead.id));
  // No "monthly retainer" / "total contract value" concept is tracked on the
  // backend at all (only per-invoice totals) - derive a real total from the
  // client's actual invoices instead of showing a fabricated mock number.
  const totalContractValue = clientInvoices.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
  const hasFinalPaid = clientInvoices.some(i => i.crmStatus === 'Fully Paid');
  const hasAdvancePaid = clientInvoices.some(i => i.crmStatus === 'Advance Paid');

  return {
    id: raw.id || '',
    leadId: lead?.id || '',
    invoiceId: clientInvoices[0]?.id || '',
    // Real Client rows have no short display code - format one from the
    // real UUID (like invoice numbers do) instead of inventing a sequence.
    clientId: raw.id ? `CLT-${String(raw.id).slice(0, 8).toUpperCase()}` : '',
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
    email: raw.email || primaryContact?.email || lead?.salesLead.email || '',
    phone: raw.phone || primaryContact?.phone || lead?.salesLead.phone || '',
    designation: primaryContact?.designation || '',
    company: raw.company_name || raw.display_name || '',
    industry: raw.industry || '',
    companySize: '',
    website: raw.website || '',
    city: '',
    services: lead?.salesLead.interestedServices || [],
    monthlyRetainer: totalContractValue,
    totalContractValue,
    assignedCrmExec: '',
    // No backend concept of employees assigned directly to a Client (only to
    // Projects) - left empty; pages should derive the real team from this
    // client's projects' assignedEmployeeIds instead of this field.
    assignedEmployees: [],
    status: mapBackendClientStatus(raw),
    paymentStatus: hasFinalPaid ? 'Fully Paid' : hasAdvancePaid ? 'Advance Paid' : 'Pending',
    startDate: String(raw.onboarding_date || raw.created_at || '').slice(0, 10),
    renewalDate: '',
    createdAt: raw.created_at || new Date().toISOString(),
    lastUpdated: raw.updated_at || raw.created_at || new Date().toISOString(),
    notes: raw.notes || '',
  };
};

// ─── INVOICE MAPPER ───────────────────────────────────────────────────────────
// Same bug class as clients: fetchInvoices did `set({ invoices: res.items ||
// res || [] })` with no mapping. Real InvoiceRead has invoice_number/
// total_amount/issue_date/status - the CRM invoices page reads
// invoiceNumber/grandTotal/issueDate/crmStatus, which were always undefined,
// crashing on `invoice.grandTotal.toLocaleString()` for every real invoice.
const mapBackendInvoiceStatus = (raw: Record<string, any>): CrmInvoiceStatus => {
  const status = String(raw.status || '').toUpperCase();
  const dueDate = raw.due_date ? new Date(raw.due_date) : null;
  const isSettled = status === 'ADVANCE_PAID' || status === 'FINAL_PAID' || status === 'PAID';
  const isPastDue = dueDate ? dueDate.getTime() < Date.now() : false;
  if (isPastDue && !isSettled && status !== 'CRM_PENDING' && status !== 'CANCELLED') return 'Overdue';
  if (status === 'ADVANCE_PAID') return 'Advance Paid';
  if (status === 'FINAL_PAID' || status === 'PAID') return 'Fully Paid';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'CRM_PENDING' || status === 'DRAFT') return 'Draft';
  return 'Sent'; // CRM_APPROVED, EMAIL_SENT, SENT, or any other in-flight state
};

const mapBackendInvoice = (raw: Record<string, any>, clients: CrmClient[], leads: CrmLead[]): CrmInvoice => {
  const client = clients.find(c => c.id === raw.client_id);
  const lead = leads.find(l => l.id === raw.lead_id);
  const clientName = client
    ? (`${client.firstName} ${client.lastName}`.trim() || client.company)
    : lead ? `${lead.salesLead.firstName} ${lead.salesLead.lastName}`.trim() : '';
  const subtotal = raw.subtotal ?? 0;
  const taxTotal = raw.tax_total ?? 0;
  const crmStatus = mapBackendInvoiceStatus(raw);

  return {
    id: raw.id || '',
    invoiceNumber: raw.invoice_number || '',
    leadId: raw.lead_id || '',
    clientId: raw.client_id || undefined,
    clientName,
    clientEmail: client?.email || lead?.salesLead.email || '',
    clientPhone: client?.phone || lead?.salesLead.phone || '',
    company: client?.company || lead?.salesLead.company || '',
    issueDate: raw.issue_date || '',
    dueDate: raw.due_date || '',
    lineItems: [],
    subtotal,
    taxRate: subtotal > 0 ? Math.round((taxTotal / subtotal) * 100) : 0,
    taxAmount: taxTotal,
    grandTotal: raw.total_amount ?? 0,
    advancePercent: raw.invoice_type === 'advance' ? 25 : raw.invoice_type === 'final' ? 75 : 100,
    advanceDue: raw.total_amount ?? 0,
    status: crmStatus === 'Advance Paid' ? 'Advance Paid' : crmStatus === 'Fully Paid' ? 'Fully Paid' : crmStatus === 'Draft' ? 'Draft' : 'Sent',
    notes: raw.notes || '',
    crmStatus,
    reminderSent: false,
    reminderCount: 0,
  };
};

// ─── EMPLOYEE MAPPER ──────────────────────────────────────────────────────────
// fetchEmployees mapped `name`/`role` from fields (first_name/last_name/role)
// that don't exist on the real User payload (which only has full_name plus a
// role_id UUID) - name/role rendered blank everywhere (Employee Workload
// widget, /crm/employees, Account Team panels) even once real users loaded.
// workloadPercent/availability had no backend equivalent at all and were
// pure mock fabrications - derived here from real assigned-task counts instead.
const mapBackendEmployee = (
  u: Record<string, any>, rolesById: Map<string, string>, projects: CrmProject[], tasks: CrmTask[],
): CrmEmployee => {
  const fullName: string = u.full_name || '';
  const nameParts = fullName.trim() ? fullName.trim().split(' ') : [];
  const currentProjectIds = projects.filter(p => p.assignedEmployeeIds.includes(u.id)).map(p => p.id);
  const activeTaskCount = tasks.filter(t => t.assignedEmployeeId === u.id && t.status !== 'DONE').length;
  const workloadPercent = Math.min(100, activeTaskCount * 20);

  return {
    id: u.id || '',
    name: fullName,
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
    role: (u.role_id && rolesById.get(u.role_id)) || '',
    designation: u.designation || '',
    department: '',
    email: u.email || '',
    phone: u.phone || '',
    skills: [],
    currentProjectIds,
    availability: workloadPercent >= 80 ? 'Busy' : 'Available',
    workloadPercent,
    joinDate: String(u.created_at || '').slice(0, 10),
    avatar: '',
  };
};

// ─── NOTIFICATION MAPPER ──────────────────────────────────────────────────────
// fetchAllData/fetchNotifications used to set raw backend Notification rows
// directly into state. The real model has `is_read`/`created_at` and no
// `type`/`linkedId`/`linkedType` at all (see
// Backend/app/modules/notifications/models.py) - so `n.read` was always
// undefined (every notification showed as unread forever, badge counts were
// always wrong, "mark as read" only appeared to work until the next refetch)
// and `n.linkedId` was always undefined (the "View Details" link never
// rendered for any real notification). `type` is inferred from the title
// since the backend doesn't persist a category - a real gap: notify_role()/
// notify_users() call sites know the entity they're about but currently
// discard it, so true deep-linking needs an entity_type/entity_id column
// added to the Notification model (not done here - flagged as a follow-up).
const inferNotificationType = (title: string): CrmNotification['type'] => {
  const t = title.toLowerCase();
  if (t.includes('invoice')) return 'invoice_sent';
  if (t.includes('payment')) return 'payment_received';
  if (t.includes('credential')) return 'credentials_generated';
  if (t.includes('client')) return 'client_created';
  if (t.includes('project') || t.includes('assign')) return 'project_assigned';
  if (t.includes('lead')) return 'lead_approved';
  return 'reminder';
};

const mapBackendNotification = (raw: Record<string, any>): CrmNotification => {
  const created = raw.created_at ? new Date(raw.created_at) : new Date();
  return {
    id: raw.id || '',
    type: inferNotificationType(raw.title || ''),
    title: raw.title || '',
    message: raw.message || '',
    date: raw.created_at ? String(raw.created_at).slice(0, 10) : created.toISOString().slice(0, 10),
    time: created.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    read: raw.is_read ?? false,
  };
};

// ─── NOTIFICATION FACTORY ─────────────────────────────────────────────────────
let notifCounter = 100;
const mkNotif = (type: CrmNotification['type'], title: string, message: string, linkedId?: string, linkedType?: CrmNotification['linkedType']): CrmNotification => ({
  id: `NOTIF-${++notifCounter}`,
  type, title, message,
  date: new Date().toISOString().split('T')[0],
  time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  read: false,
  linkedId, linkedType,
});

// ─── STORE ────────────────────────────────────────────────────────────────────
export const useCrmStore = create<CrmState>()(
  persist(
    (set, get) => ({
      // ─── Initial Data (empty — populated from API) ────────────────────────
      leads: MOCK_LEADS,
      clients: MOCK_CLIENTS,
      projects: MOCK_PROJECTS,
      employees: MOCK_EMPLOYEES,
      invoices: [],
      payments: [],
      notifications: [],
      tasks: MOCK_TASKS,
      submissions: [],
      activityLogs: [],
      isLoading: false,
      dataLoaded: false,
      selectedLeadId: null,
      selectedClientId: null,
      selectedProjectId: null,
      activeEmployeeId: null,
      theme: 'system',

      // ─── API FETCH ACTIONS ────────────────────────────────────────────────
      fetchAllData: async (opts) => {
        set({ isLoading: true });
        try {
          // Leads then clients (clients needs mapped leads for contact-name/
          // services fallback) - both used to never be fetched here at all,
          // so the CRM Leads/Clients pages ran on MOCK_LEADS/MOCK_CLIENTS
          // forever, and clients was never mapped from real fields at all
          // (see mapBackendClient's doc comment for the crash this caused).
          await get().fetchLeads();
          await get().fetchClients();

          const [projectsRes, tasksRes, notifRes] = await Promise.allSettled([
            projectService.getAll({ page_size: 100 }),
            taskService.getAll({ page_size: 100 }),
            notificationService.getAll({ page_size: 100 }),
          ]);

          const projects = projectsRes.status === 'fulfilled'
            ? (projectsRes.value.items || projectsRes.value || []).map((p: Record<string, any>) => mapBackendProject(p, get().clients))
            : get().projects;
          const tasks = tasksRes.status === 'fulfilled'
            ? (tasksRes.value.items || tasksRes.value || []).map((t: Record<string, any>) => mapBackendTask(t, projects))
            : get().tasks;
          const notifications = notifRes.status === 'fulfilled'
            ? (notifRes.value.items || notifRes.value || []).map(mapBackendNotification)
            : get().notifications;

          set({ projects, tasks, notifications, isLoading: false, dataLoaded: true });

          // Needs `tasks` already set above (fans out one request per task).
          await get().fetchSubmissions();

          // Employees were never fetched from the CRM layout at all - the
          // Employee Workload widget, /crm/employees, Account Team panels,
          // and project team avatars ran on MOCK_EMPLOYEES forever.
          await get().fetchEmployees();

          // Invoices/payments are finance-role-gated on the backend (GET
          // /finance/payments requires the "finance" role) and are never
          // rendered anywhere in the Employee portal, so skip them there
          // instead of firing requests that always come back 403.
          if (!opts?.skipFinance) {
            // Invoices need mapped clients/leads for name resolution; clients
            // is re-fetched once more afterward so totalContractValue reflects
            // the now-loaded invoices instead of always reading as 0.
            await get().fetchInvoices();
            await get().fetchClients();
            await get().fetchPayments();
          }
        } catch {
          set({ isLoading: false });
        }
      },

      fetchLeads: async () => {
        try {
          const res = await leadService.getAll({ page_size: 100 });
          const backendLeads = res.items || res || [];
          set({ leads: backendLeads.map(mapBackendLead) });
        } catch { /* keep existing */ }
      },

      fetchClients: async () => {
        try {
          const res = await clientService.getAll({ page_size: 100 });
          const rawClients = res.items || res || [];
          const leads = get().leads;
          const invoices = get().invoices;
          set({ clients: rawClients.map((raw: Record<string, any>) => mapBackendClient(raw, leads, invoices)) });
        } catch { /* keep existing */ }
      },

      fetchProjects: async () => {
        try {
          const res = await projectService.getAll({ page_size: 100 });
          const raw = res.items || res || [];
          set({ projects: raw.map((p: Record<string, any>) => mapBackendProject(p, get().clients)) });
        } catch { /* keep existing */ }
      },

      fetchEmployees: async () => {
        try {
          const [usersRes, rolesRes] = await Promise.allSettled([
            userManagementService.getUsers({ page_size: 100 }),
            userManagementService.getRoles({ page_size: 100 }),
          ]);
          const users = usersRes.status === 'fulfilled' ? (usersRes.value.items || usersRes.value || []) : [];
          const roles = rolesRes.status === 'fulfilled' ? (rolesRes.value.items || rolesRes.value || []) : [];
          const rolesById = new Map<string, string>(roles.map((r: Record<string, any>) => [r.id, r.name || r.slug || '']));
          const projects = get().projects;
          const tasks = get().tasks;
          set({ employees: users.map((u: Record<string, any>) => mapBackendEmployee(u, rolesById, projects, tasks)) });
        } catch { /* keep existing */ }
      },

      fetchTasks: async () => {
        try {
          const res = await taskService.getAll({ page_size: 100 });
          const raw = res.items || res || [];
          set({ tasks: raw.map((t: Record<string, any>) => mapBackendTask(t, get().projects)) });
        } catch { /* keep existing */ }
      },

      // There is no "list all submissions" endpoint - only per-task
      // (GET /tasks/{task_id}/submissions) - so this fans out one request
      // per already-fetched task. Previously `submissions` was never
      // populated from the backend at all, so every "My Submissions" /
      // revision-history view in the Employee portal always showed empty
      // after a page reload regardless of what was really in the database.
      fetchSubmissions: async () => {
        try {
          const tasks = get().tasks;
          const results = await Promise.allSettled(tasks.map(t => taskSubmissionService.getAll(t.id)));
          const submissions: CrmSubmission[] = [];
          results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
              const raw = (r.value.items || r.value || []) as Record<string, any>[];
              raw.forEach((s) => submissions.push(mapBackendSubmission(s, tasks[i])));
            }
          });
          set({ submissions });
        } catch { /* keep existing */ }
      },

      fetchInvoices: async () => {
        try {
          const res = await financeService.getInvoices({ page_size: 100 });
          const raw = res.items || res || [];
          const clients = get().clients;
          const leads = get().leads;
          set({ invoices: raw.map((i: Record<string, any>) => mapBackendInvoice(i, clients, leads)) });
        } catch { /* keep existing */ }
      },

      fetchPayments: async () => {
        // Used to fan out one HTTP request per invoice (N+1) to build the
        // Payments Dashboard - now a single GET /finance/payments call,
        // joined client-side against the already-loaded invoices (no extra
        // round trips) for clientName/company/invoiceNumber.
        try {
          let invoices = get().invoices;
          if (invoices.length === 0) {
            await get().fetchInvoices();
            invoices = get().invoices;
          }
          const invoicesById = new Map(invoices.map(inv => [inv.id, inv]));

          const res = await financeService.getAllPayments({ page_size: 100 });
          const rawPayments = (res.items || res || []) as Record<string, any>[];

          const merged: CrmPayment[] = rawPayments.map((p) => {
            const inv = invoicesById.get(p.invoice_id);
            return {
              id: p.id,
              invoiceId: p.invoice_id,
              invoiceNumber: inv?.invoiceNumber || '',
              leadId: inv?.leadId || '',
              clientName: inv?.clientName || '',
              company: inv?.company || '',
              amount: p.amount ?? 0,
              method: (p.payment_method || 'Bank Transfer') as CrmPayment['method'],
              status: mapBackendPaymentStatus(p.status),
              transactionId: p.reference_number || '',
              date: p.payment_date || p.created_at || '',
              verifiedAt: p.crm_verified_at || undefined,
              financeVerifiedAt: p.finance_verified_at || undefined,
              crmVerifiedAt: p.crm_verified_at || undefined,
              notes: '',
            };
          });
          set({ payments: merged });
        } catch { /* keep existing */ }
      },

      fetchNotifications: async () => {
        try {
          const res = await notificationService.getAll({ page_size: 100 });
          const raw = res.items || res || [];
          set({ notifications: raw.map(mapBackendNotification) });
        } catch { /* keep existing */ }
      },

      // ─── LEAD ACTIONS ─────────────────────────────────────────────────────
      updateLeadStatus: (id, status, notes) => {
        // Optimistic local update
        set(s => ({
          leads: s.leads.map(l => l.id === id ? { ...l, crmStatus: status, reviewNotes: notes ?? l.reviewNotes } : l),
        }));
        // API call
        leadService.update(id, { status, notes }).catch(() => {});
      },

      reviewLead: (id, status, notes, rejectionReason) => {
        // Optimistic local update
        set(s => ({
          leads: s.leads.map(l => l.id === id ? {
            ...l,
            crmStatus: status,
            reviewNotes: notes,
            rejectionReason: status === 'Rejected' ? rejectionReason : undefined,
            approvedAt: status === 'Approved' ? new Date().toISOString() : l.approvedAt,
          } : l),
          notifications: [
            mkNotif(
              status === 'Approved' ? 'lead_approved' : 'lead_rejected',
              status === 'Approved' ? 'Lead Approved' : 'Lead Rejected',
              `${s.leads.find(l => l.id === id)?.salesLead.firstName} ${s.leads.find(l => l.id === id)?.salesLead.lastName} — ${status}.`,
              id, 'lead'
            ),
            ...s.notifications,
          ],
        }));
        // API call
        leadService.update(id, { status, notes }).catch(() => {});
      },

      sendInvoiceEmail: (leadId) => {
        // Optimistic local update
        set(s => ({
          leads: s.leads.map(l => l.id === leadId ? { ...l, invoiceEmailSent: true, crmStatus: 'Invoice Sent' } : l),
          invoices: s.invoices.map(inv => inv.leadId === leadId ? {
            ...inv, crmStatus: 'Sent', sentAt: new Date().toISOString(),
          } : inv),
          notifications: [
            mkNotif('invoice_sent', 'Invoice Sent', `Invoice emailed to ${s.leads.find(l => l.id === leadId)?.salesLead.email}.`, leadId, 'lead'),
            ...s.notifications,
          ],
        }));
        // API call
        financeService.updateInvoice(leadId, { status: 'Sent' }).catch(() => {});
      },

      generateCredentials: (leadId) => {
        const lead = get().leads.find(l => l.id === leadId);
        if (!lead) throw new Error('Lead not found');
        const creds = generateCreds(lead);
        // Optimistic local update
        set(s => ({
          leads: s.leads.map(l => l.id === leadId ? {
            ...l,
            credentials: creds,
            crmStatus: 'Credentials Sent',
            welcomeEmailSent: true,
          } : l),
          notifications: [
            mkNotif('credentials_generated', 'Credentials Generated', `Login credentials emailed to ${lead.salesLead.firstName} ${lead.salesLead.lastName}.`, leadId, 'lead'),
            ...s.notifications,
          ],
        }));
        // API call
        leadService.update(leadId, { status: 'Credentials Sent', notes: `Credentials: ${creds.username} / ${creds.tempPassword}` }).catch(() => {});
        return creds;
      },

      sendWelcomeEmail: (leadId) => {
        // Optimistic local update
        set(s => ({
          leads: s.leads.map(l => l.id === leadId ? { ...l, welcomeEmailSent: true } : l),
        }));
        // API call
        leadService.update(leadId, { notes: 'Welcome email sent' }).catch(() => {});
      },

      // ─── CLIENT ACTIONS ───────────────────────────────────────────────────
      convertLeadToClient: (leadId) => {
        const lead = get().leads.find(l => l.id === leadId);
        if (!lead || !lead.credentials) return null;

        const clientNum = String(get().clients.length + 1).padStart(3, '0');
        const now = new Date().toISOString().split('T')[0];
        const sl = lead.salesLead;
        const renewalDate = new Date();
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);

        const newClient: CrmClient = {
          id: `CLT-${clientNum}`,
          leadId,
          invoiceId: lead.salesInvoice?.id ?? '',
          clientId: lead.credentials.clientId,
          firstName: sl.firstName,
          lastName: sl.lastName,
          email: sl.email,
          phone: sl.phone,
          designation: sl.designation,
          company: sl.company,
          industry: sl.industry,
          companySize: sl.companySize,
          website: sl.website,
          city: sl.city,
          services: sl.interestedServices,
          monthlyRetainer: Math.round((sl.budget ?? 0) / 3),
          totalContractValue: sl.budget ?? 0,
          assignedCrmExec: lead.crmAssignedTo,
          assignedEmployees: [],
          status: 'Onboarding',
          paymentStatus: 'Advance Paid',
          startDate: now,
          renewalDate: renewalDate.toISOString().split('T')[0],
          createdAt: now,
          lastUpdated: now,
          credentials: lead.credentials,
          notes: lead.reviewNotes,
        };

        // Optimistic local update
        set(s => ({
          clients: [newClient, ...s.clients],
          leads: s.leads.map(l => l.id === leadId ? {
            ...l,
            crmStatus: 'Client Created',
            convertedToClientId: newClient.id,
            clientCreatedAt: now,
          } : l),
          notifications: [
            mkNotif('client_created', 'New Client Created', `${sl.firstName} ${sl.lastName} onboarded as ${newClient.clientId}.`, newClient.id, 'client'),
            ...s.notifications,
          ],
        }));

        // API call — create client on the backend
        clientService.create({
          company_name: newClient.company || `${newClient.firstName} ${newClient.lastName}`,
          display_name: `${newClient.firstName} ${newClient.lastName}`,
          email: newClient.email,
          phone: newClient.phone,
          industry: newClient.industry,
          website: newClient.website,
          notes: newClient.notes || undefined,
          is_active: true,
        }).catch(() => {});

        return newClient;
      },

      updateClient: (id, updates) => {
        // Optimistic local update
        set(s => ({
          clients: s.clients.map(c => c.id === id ? { ...c, ...updates, lastUpdated: new Date().toISOString().split('T')[0] } : c),
        }));
        // API call
        clientService.update(id, updates).catch(() => {});
      },

      assignEmployeesToClient: (clientId, employeeIds) => {
        const prev = get().clients.find(c => c.id === clientId)?.assignedEmployees ?? [];
        const added = employeeIds.filter(e => !prev.includes(e));
        const removed = prev.filter(e => !employeeIds.includes(e));

        // Optimistic local update
        set(s => ({
          clients: s.clients.map(c => c.id === clientId ? { ...c, assignedEmployees: employeeIds } : c),
          employees: s.employees.map(emp => {
            if (added.includes(emp.id)) {
              return { ...emp, workloadPercent: Math.min(100, emp.workloadPercent + 10) };
            }
            if (removed.includes(emp.id)) {
              return { ...emp, workloadPercent: Math.max(0, emp.workloadPercent - 10) };
            }
            return emp;
          }),
        }));
        // API call
        clientService.update(clientId, { assignedEmployees: employeeIds }).catch(() => {});
      },

      // ─── PROJECT ACTIONS ──────────────────────────────────────────────────
      assignEmployeesToProject: (projectId, employeeIds) => {
        const project = get().projects.find(p => p.id === projectId);
        if (!project) return;
        const prev = project.assignedEmployeeIds;
        const added = employeeIds.filter(e => !prev.includes(e));
        const removed = prev.filter(e => !employeeIds.includes(e));

        // Optimistic local update
        set(s => ({
          projects: s.projects.map(p => p.id === projectId ? {
            ...p,
            assignedEmployeeIds: employeeIds,
            status: employeeIds.length > 0 ? (p.status === 'Waiting Assignment' ? 'Assigned' : p.status) : 'Waiting Assignment',
          } : p),
          employees: s.employees.map(emp => {
            if (added.includes(emp.id)) {
              return {
                ...emp,
                currentProjectIds: [...emp.currentProjectIds, projectId],
                workloadPercent: Math.min(100, emp.workloadPercent + 15),
                availability: emp.workloadPercent + 15 >= 80 ? 'Busy' : emp.availability,
              };
            }
            if (removed.includes(emp.id)) {
              return {
                ...emp,
                currentProjectIds: emp.currentProjectIds.filter(id => id !== projectId),
                workloadPercent: Math.max(0, emp.workloadPercent - 15),
                availability: emp.workloadPercent - 15 < 80 ? 'Available' : emp.availability,
              };
            }
            return emp;
          }),
          notifications: [
            mkNotif('project_assigned', 'Employees Assigned', `${employeeIds.length} employee(s) assigned to ${project.name}.`, projectId, 'project'),
            ...s.notifications,
          ],
        }));
        // API call — membership is a separate join resource on the backend,
        // not a field on the project itself.
        added.forEach(id => projectService.addMember(projectId, id).catch(() => {}));
        removed.forEach(id => projectService.removeMember(projectId, id).catch(() => {}));
      },

      updateProjectProgress: (projectId, progress) => {
        // Optimistic local update
        set(s => ({
          projects: s.projects.map(p => p.id === projectId ? { ...p, progress, lastUpdated: new Date().toISOString().split('T')[0] } : p),
        }));
        // API call
        projectService.update(projectId, { progress }).catch(() => {});
      },

      updateProjectStatus: (projectId, status) => {
        // Optimistic local update
        set(s => ({
          projects: s.projects.map(p => p.id === projectId ? { ...p, status, lastUpdated: new Date().toISOString().split('T')[0] } : p),
        }));
        // API call
        projectService.update(projectId, { status }).catch(() => {});
      },

      completeMilestone: (projectId, milestoneId) => {
        // Optimistic local update
        set(s => ({
          projects: s.projects.map(p => p.id === projectId ? {
            ...p,
            milestones: p.milestones.map(m => m.id === milestoneId ? {
              ...m, completed: true, completedAt: new Date().toISOString().split('T')[0],
            } : m),
          } : p),
        }));
        // API call
        projectService.update(projectId, { milestoneId, milestoneCompleted: true }).catch(() => {});
      },

      // ─── EMPLOYEE ACTIONS ─────────────────────────────────────────────────
      setActiveEmployee: (id) => set({ activeEmployeeId: id }),
      updateEmployee: (id, updates) => set(s => ({
        employees: s.employees.map(emp => emp.id === id ? { ...emp, ...updates } : emp),
      })),
      updateEmployeeWorkload: (employeeId, projectId, add) => {
        // Optimistic local update
        set(s => ({
          employees: s.employees.map(emp => {
            if (emp.id !== employeeId) return emp;
            const newProjects = add
              ? [...new Set([...emp.currentProjectIds, projectId])]
              : emp.currentProjectIds.filter(id => id !== projectId);
            const newWorkload = add
              ? Math.min(100, emp.workloadPercent + 15)
              : Math.max(0, emp.workloadPercent - 15);
            return {
              ...emp,
              currentProjectIds: newProjects,
              workloadPercent: newWorkload,
              availability: newWorkload >= 90 ? 'Busy' : newWorkload < 40 ? 'Available' : emp.availability,
            };
          }),
        }));
        // API call
        const emp = get().employees.find(e => e.id === employeeId);
        if (emp) {
          userManagementService.updateUser(employeeId, {
            current_project_ids: emp.currentProjectIds,
            workload_percent: emp.workloadPercent,
            availability: emp.availability,
          }).catch(() => {});
        }
      },

      // ─── INVOICE ACTIONS ──────────────────────────────────────────────────
      updateInvoiceStatus: (invoiceId, status) => {
        // Optimistic local update
        set(s => ({
          invoices: s.invoices.map(inv => inv.id === invoiceId ? {
            ...inv,
            crmStatus: status,
            paidAt: ['Advance Paid', 'Fully Paid'].includes(status) ? new Date().toISOString() : inv.paidAt,
          } : inv),
        }));
        // API call
        financeService.updateInvoice(invoiceId, { status }).catch(() => {});
      },

      sendInvoiceReminder: (invoiceId) => {
        // Optimistic local update
        set(s => ({
          invoices: s.invoices.map(inv => inv.id === invoiceId ? {
            ...inv, reminderSent: true, reminderCount: inv.reminderCount + 1,
          } : inv),
          notifications: [
            mkNotif('reminder', 'Invoice Reminder Sent', `Reminder sent for invoice ${s.invoices.find(i => i.id === invoiceId)?.invoiceNumber}.`, invoiceId, 'invoice'),
            ...s.notifications,
          ],
        }));
        // API call
        financeService.updateInvoice(invoiceId, { reminderSent: true }).catch(() => {});
      },

      // ─── PAYMENT ACTIONS ──────────────────────────────────────────────────
      verifyPayment: async (paymentId) => {
        const payment = get().payments.find(p => p.id === paymentId);
        if (!payment) return;

        // Real two-step verification (Finance, then CRM), each gated server-
        // side to its own role (require_roles("finance") / require_roles
        // ("crm")) - only admin/super_admin can do both. Previously this
        // always attempted both calls regardless of the caller's actual
        // role, silently swallowing the first failure - which meant a real
        // "finance" or "crm" user (not admin) could never successfully
        // complete verification through this button at all (the second call
        // always 403'd). Now it only attempts the step(s) the current
        // user's role is actually allowed to perform.
        const role = useAuthStore.getState().user?.role;
        const canFinance = role === 'finance' || role === 'admin';
        const canCrm = role === 'crm' || role === 'admin';

        if (!payment.financeVerifiedAt) {
          if (!canFinance) {
            throw new Error('This payment needs Finance verification first - ask a Finance team member to verify it.');
          }
          await financeService.verifyPaymentFinance(paymentId);
        }
        if (canCrm) {
          await financeService.verifyPaymentCrm(paymentId);
        } else if (!canFinance) {
          throw new Error('You do not have permission to verify this payment.');
        }
        // else: a finance-only user just completed their step; CRM sign-off
        // is a separate person's job, not a failure.

        await get().fetchInvoices();
        await Promise.allSettled([get().fetchPayments(), get().fetchLeads()]);

        set(s => ({
          notifications: [
            mkNotif('payment_received', 'Payment Verified', `₹${payment.amount.toLocaleString('en-IN')} payment verified for ${payment.clientName}.`, paymentId, 'payment'),
            ...s.notifications,
          ],
        }));
      },

      rejectPayment: async (paymentId, reason) => {
        await financeService.rejectPayment(paymentId, reason);
        await Promise.allSettled([get().fetchPayments(), get().fetchInvoices()]);
      },

      // ─── NOTIFICATION ACTIONS ─────────────────────────────────────────────
      markNotificationRead: (id) => {
        // Optimistic local update
        set(s => ({
          notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
        }));
        // API call
        notificationService.markRead(id).catch(() => {});
      },

      markAllNotificationsRead: () => {
        // Optimistic local update
        set(s => ({
          notifications: s.notifications.map(n => ({ ...n, read: true })),
        }));
        // API call
        notificationService.markAllRead().catch(() => {});
      },

      addNotification: (n) => set(s => ({
        notifications: [{ ...n, id: `NOTIF-${++notifCounter}` }, ...s.notifications],
      })),

      // ─── THEME ACTIONS ────────────────────────────────────────────────────
      setTheme: (theme) => set({ theme }),

      // ─── SELECTORS ────────────────────────────────────────────────────────
      getLeadById: (id) => get().leads.find(l => l.id === id),
      getClientById: (id) => get().clients.find(c => c.id === id),
      getProjectById: (id) => get().projects.find(p => p.id === id),
      getEmployeeById: (id) => get().employees.find(e => e.id === id),
      getInvoiceById: (id) => get().invoices.find(i => i.id === id),
      getUnreadCount: () => get().notifications.filter(n => !n.read).length,
      getProjectsForClient: (clientId) => get().projects.filter(p => p.clientId === clientId),
      getEmployeesForProject: (projectId) => {
        const project = get().projects.find(p => p.id === projectId);
        if (!project) return [];
        return get().employees.filter(e => project.assignedEmployeeIds.includes(e.id));
      },
      getProjectsByEmployee: (employeeId) => get().projects.filter(p => p.assignedEmployeeIds.includes(employeeId)),
      getTasksByEmployee: (employeeId) => get().tasks.filter(t => t.assignedEmployeeId === employeeId),

      // ─── TASK ACTIONS ───────────────────────────────────────────────────────
      startTask: (taskId) => {
        // Optimistic local update
        set(s => ({
          tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'IN_PROGRESS', lastUpdated: new Date().toISOString() } : t)
        }));
        // API call
        taskService.update(taskId, { status: 'IN_PROGRESS' }).catch(() => {});
      },
      updateTaskProgress: (taskId, progress, status) => {
        // Optimistic local update
        set(s => ({
          tasks: s.tasks.map(t => t.id === taskId ? { ...t, progress, status: status || t.status, lastUpdated: new Date().toISOString() } : t)
        }));
        // API call
        taskService.update(taskId, { progress, status: status || undefined }).catch(() => {});
      },
      markTaskBlocked: (taskId, reason) => {
        // Optimistic local update
        set(s => ({
          tasks: s.tasks.map(t => t.id === taskId ? {
            ...t, status: 'BLOCKED', lastUpdated: new Date().toISOString(),
            comments: [...t.comments, { id: `COM-${Date.now()}`, authorId: t.assignedEmployeeId, text: `BLOCKED: ${reason}`, date: new Date().toISOString() }]
          } : t)
        }));
        // API call
        taskService.update(taskId, { status: 'BLOCKED' }).catch(() => {});
        taskService.addComment(taskId, `BLOCKED: ${reason}`).catch(() => {});
      },
      addTaskComment: (taskId, text) => {
        // Optimistic local update
        set(s => ({
          tasks: s.tasks.map(t => t.id === taskId ? {
            ...t, comments: [...t.comments, { id: `COM-${Date.now()}`, authorId: s.activeEmployeeId || t.assignedEmployeeId, text, date: new Date().toISOString() }]
          } : t)
        }));
        // API call
        taskService.addComment(taskId, text).catch(() => {});
      },
      addMockFile: (taskId, name) => set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? {
          ...t, workingFiles: [...t.workingFiles, { id: `FILE-${Date.now()}`, name, url: '#', uploadedAt: new Date().toISOString() }]
        } : t)
      })),

      // ─── SUBMISSION ACTIONS ─────────────────────────────────────────────────
      saveSubmissionDraft: (data) => set(s => {
        return {}; 
      }),
      submitToCRM: async (data) => {
        if (!data.taskId) throw new Error('No task selected.');

        // API call first — the submission only exists locally once the
        // backend has actually accepted and persisted it. A validation
        // failure here (missing title, out-of-range completion %, task not
        // assigned to this employee, ...) throws and must reach the caller
        // instead of being masked by an optimistic local update.
        const created = await taskSubmissionService.create(data.taskId, {
          title: data.title!,
          work_summary: data.workSummary,
          deliverable_type: data.deliverableType,
          external_url: data.versions?.[0]?.externalUrl || undefined,
          completion_percentage: data.versions?.[0]?.completionPercentage ?? 100,
        });

        set(s => {
          const newSubId: string = created.id;
          const newSub: CrmSubmission = {
            id: newSubId,
            employeeId: data.employeeId!,
            projectId: data.projectId!,
            taskId: data.taskId!,
            clientId: data.clientId!,
            service: data.service!,
            assignmentId: `${data.projectId}_${data.taskId}`,
            assignedRole: data.assignedRole!,
            title: data.title!,
            workSummary: data.workSummary!,
            deliverableType: data.deliverableType!,
            currentStatus: 'PENDING_CRM_REVIEW',
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            versions: [
              {
                versionId: `VER-${Date.now()}`,
                versionNumber: 1,
                submissionDate: new Date().toISOString(),
                files: data.versions?.[0]?.files || [],
                externalUrl: data.versions?.[0]?.externalUrl,
                completionPercentage: data.versions?.[0]?.completionPercentage || 100,
                employeeComment: data.versions?.[0]?.employeeComment || '',
                status: 'PENDING_CRM_REVIEW'
              }
            ]
          };

          return {
            submissions: [newSub, ...s.submissions],
            tasks: s.tasks.map(t => t.id === data.taskId ? { ...t, status: 'SUBMITTED' } : t),
            projects: s.projects.map(p => p.id === data.projectId ? { ...p, status: 'SUBMITTED_BY_EMPLOYEE' } : p),
            activityLogs: [{ id: `ACT-${Date.now()}`, type: 'submission_created', description: `Submitted work for task ${data.taskId}`, timestamp: new Date().toISOString(), employeeId: data.employeeId, projectId: data.projectId, taskId: data.taskId }, ...s.activityLogs],
            notifications: [
              mkNotif('submission_created', 'New Submission Received', `Work submitted by ${data.employeeId} for project ${data.projectId}`, newSubId, 'submission'),
              ...s.notifications
            ]
          };
        });
      },
      acknowledgeCRMFeedback: (submissionId) => set(s => ({
        activityLogs: [{ id: `ACT-${Date.now()}`, type: 'feedback_acknowledged', description: `Acknowledged CRM feedback for submission ${submissionId}`, timestamp: new Date().toISOString() }, ...s.activityLogs]
      })),
      createRevision: (submissionId, notes) => set(s => ({
        activityLogs: [{ id: `ACT-${Date.now()}`, type: 'revision_started', description: `Started revision for submission ${submissionId}: ${notes}`, timestamp: new Date().toISOString() }, ...s.activityLogs]
      })),
      resubmitToCRM: async (submissionId, versionData) => {
        // API call first, for the same reason as submitToCRM — a rejected
        // resubmission must not be recorded locally as if it succeeded.
        await taskSubmissionService.resubmit(submissionId, {
          work_summary: versionData.employeeComment,
          external_url: versionData.externalUrl || undefined,
          completion_percentage: versionData.completionPercentage ?? 100,
        });

        set(s => {
          const sub = s.submissions.find(sub => sub.id === submissionId);
          if (!sub) return {};
          const newVersionNum = sub.versions.length + 1;
          const newVersion: CrmSubmissionVersion = {
            versionId: `VER-${Date.now()}`,
            versionNumber: newVersionNum,
            submissionDate: new Date().toISOString(),
            files: versionData.files || [],
            externalUrl: versionData.externalUrl,
            completionPercentage: versionData.completionPercentage || 100,
            employeeComment: versionData.employeeComment || '',
            status: 'PENDING_CRM_REVIEW',
            revisionNotes: versionData.revisionNotes
          };

          return {
            submissions: s.submissions.map(sItem => sItem.id === submissionId ? {
              ...sItem,
              currentStatus: 'PENDING_CRM_REVIEW',
              lastUpdated: new Date().toISOString(),
              versions: [newVersion, ...sItem.versions]
            } : sItem),
            notifications: [
              mkNotif('submission_created', 'Revision Submitted', `Revision ${newVersionNum} submitted for ${sub.title}`, submissionId, 'submission'),
              ...s.notifications
            ]
          };
        });
      },
      reviewSubmission: (submissionId) => set(s => {
        return {};
      }),
      requestSubmissionChanges: async (submissionId, feedback) => {
        // API call first — these two actions used to be local-only `set()`
        // calls with no backend request at all, so "requesting changes" from
        // the CRM side never touched task_submissions.status in the
        // database: the employee's own view (which reads real backend data)
        // never saw the feedback, and reloading the CRM page reverted the
        // submission back to pending as if nothing had happened.
        await taskSubmissionService.review(submissionId, { approve: false, reviewer_feedback: feedback });

        set(s => {
          const sub = s.submissions.find(sItem => sItem.id === submissionId);
          return {
            submissions: s.submissions.map(sItem => sItem.id === submissionId ? {
              ...sItem,
              currentStatus: 'CRM_CHANGES_REQUESTED',
              lastUpdated: new Date().toISOString(),
              versions: sItem.versions.map((v, i) => i === 0 ? { ...v, status: 'CRM_CHANGES_REQUESTED', crmFeedback: feedback } : v)
            } : sItem),
            projects: s.projects.map(p => p.id === sub?.projectId ? { ...p, status: 'In Progress' } : p),
            tasks: s.tasks.map(t => t.id === sub?.taskId ? { ...t, status: 'IN_PROGRESS' } : t),
            notifications: [
              mkNotif('crm_changes_requested', 'Changes Requested', `CRM requested changes on ${sub?.title}`, submissionId, 'submission'),
              ...s.notifications
            ]
          };
        });
      },
      approveSubmission: async (submissionId) => {
        // Same fix as requestSubmissionChanges above — must actually persist.
        await taskSubmissionService.review(submissionId, { approve: true });

        set(s => {
          const sub = s.submissions.find(sItem => sItem.id === submissionId);
          return {
            submissions: s.submissions.map(sItem => sItem.id === submissionId ? {
              ...sItem,
              currentStatus: 'CRM_APPROVED',
              lastUpdated: new Date().toISOString(),
              versions: sItem.versions.map((v, i) => i === 0 ? { ...v, status: 'CRM_APPROVED' } : v)
            } : sItem),
            tasks: s.tasks.map(t => t.id === sub?.taskId ? { ...t, status: 'DONE', progress: 100 } : t),
            notifications: [
              mkNotif('crm_approved', 'Submission Approved', `CRM approved your submission for ${sub?.title}`, submissionId, 'submission'),
              ...s.notifications
            ]
          };
        });
      },
    }),
    {
      name: 'amplivo-crm-store',
      partialize: (state) => ({
        selectedLeadId: state.selectedLeadId,
        selectedClientId: state.selectedClientId,
        selectedProjectId: state.selectedProjectId,
        activeEmployeeId: state.activeEmployeeId,
      }),
    }
  )
);
