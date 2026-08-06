import { create } from 'zustand';
import { SalesLead, SalesLeadStatus, Meeting, SalesInvoice } from '@/types';
import { SalesService } from '@/types';
import { leadService } from '@/services/leadService';
import type { LeadRead, LeadCreatePayload, LeadUpdatePayload } from '@/services/leadService';
import { meetingService } from '@/services/meetingService';
import { proposalService } from '@/services/proposalService';
import { financeService } from '@/services/crmService';
import { useToastStore } from '@/store/toastStore';

function extractErrorMessage(err: unknown, fallback: string): string {
  const withResponse = err as { response?: { data?: { message?: string; detail?: string } } };
  return withResponse?.response?.data?.message || withResponse?.response?.data?.detail || fallback;
}

interface SalesState {
  leads: SalesLead[];
  meetings: Meeting[];
  invoices: SalesInvoice[];
  services: SalesService[];
  isLoading: boolean;

  // API Actions
  fetchLeads: () => Promise<void>;
  createLead: (payload: Omit<LeadCreatePayload, 'status'>) => Promise<void>;
  editLead: (leadId: string, payload: LeadUpdatePayload) => Promise<void>;
  deleteLead: (leadId: string) => Promise<void>;

  // Actions - every one of these now calls the real backend first, then
  // reflects the confirmed result into local state (previously these only
  // ever mutated local Zustand state and were lost on refresh).
  updateLeadStatus: (leadId: string, status: SalesLeadStatus) => Promise<void>;
  updateLeadNotes: (leadId: string, notes: string) => Promise<void>;
  updateLeadBudget: (leadId: string, budget: number) => Promise<void>;
  updateLeadServices: (leadId: string, services: string[]) => Promise<void>;
  scheduleMeeting: (meeting: Omit<Meeting, 'id'>) => Promise<void>;
  addMeetingNotes: (meetingId: string, notes: string) => Promise<void>;
  completeMeeting: (meetingId: string, notes: string) => Promise<void>;
  generateInvoice: (leadId: string) => Promise<SalesInvoice | null>;
}

function mapLeadStatus(status: string): SalesLeadStatus {
  const normalized = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const known: SalesLeadStatus[] = ['New', 'Contacted', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Ready for CRM'];
  if (known.includes(normalized as SalesLeadStatus)) return normalized as SalesLeadStatus;
  // Backend pipeline statuses (NEW_LEAD, MEETING_SCHEDULED, CRM_PENDING, ...)
  // that don't have a direct 1:1 Sales-dashboard label yet - anything past
  // "proposal created" reads as "Ready for CRM" from Sales's perspective.
  const upper = status.toUpperCase();
  if (upper === 'NEW_LEAD') return 'New';
  if (upper === 'MEETING_SCHEDULED') return 'Meeting Scheduled';
  if (upper === 'MEETING_COMPLETED') return 'Contacted';
  if (upper === 'LOST' || upper === 'REJECTED') return 'Lost';
  if (['PROPOSAL_CREATED', 'ADVANCE_INVOICE_CREATED', 'CRM_PENDING', 'CRM_APPROVED', 'EMAIL_SENT', 'ADVANCE_PAID', 'CLIENT_ACCOUNT_CREATED', 'PROJECT_CREATED', 'PROJECT_COMPLETED'].includes(upper)) {
    return 'Ready for CRM';
  }
  return 'New';
}

function parseBudgetFromNotes(notes: string | null | undefined): number {
  if (!notes) return 0;
  const regex = /Budget:\s*(?:₹|INR)?\s*([\d,]+)/i;
  const match = regex.exec(notes);
  if (match) {
    const val = Number.parseInt(match[1].replaceAll(',', ''), 10);
    if (!Number.isNaN(val)) {
      return val;
    }
  }
  return 0;
}

function getTimeZoneOffset(timeZone: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    if (!tzPart) return 'Z';
    const val = tzPart.value;
    if (val === 'GMT') return '+00:00';
    const match = /GMT([+-])(\d+):?(\d+)?/.exec(val);
    if (match) {
      const sign = match[1];
      const hours = match[2].padStart(2, '0');
      const minutes = (match[3] || '00').padStart(2, '0');
      return `${sign}${hours}:${minutes}`;
    }
    return 'Z';
  } catch {
    return 'Z';
  }
}

// Bug 5 fixed: map source_id to a proper SalesLead source label instead of always 'Organic'
const SOURCE_MAP: Record<string, SalesLead['source']> = {
  organic: 'Organic',
  referral: 'Referral',
  paid_ads: 'Paid Ads',
  social_media: 'Social Media',
  cold_outreach: 'Cold Outreach',
  event: 'Event',
  contact_form: 'Contact Form',
};

function mapSource(sourceId: string | null | undefined): SalesLead['source'] {
  if (!sourceId) return 'Organic';
  const key = sourceId.toLowerCase().replace(/[^a-z_]/g, '_');
  return SOURCE_MAP[key] ?? 'Organic';
}

function mapMeetingRead(m: Record<string, unknown>): Meeting {
  const scheduledAt = typeof m.scheduled_at === 'string' ? m.scheduled_at : String(m.scheduled_at ?? '');
  const datePart = scheduledAt.split('T')[0] || '';
  const timePart = scheduledAt.split('T')[1]?.slice(0, 5) || '';
  const typeRaw = typeof m.meeting_type === 'string' ? m.meeting_type : String(m.meeting_type ?? 'Video Call');
  const typeMap: Record<string, Meeting['type']> = {
    video_call: 'Video Call', video: 'Video Call',
    phone_call: 'Phone Call', phone: 'Phone Call',
    in_person: 'In-Person', in_person_meeting: 'In-Person',
    demo: 'Demo',
  };
  const meetingType: Meeting['type'] = typeMap[typeRaw.toLowerCase().replaceAll(' ', '_')] ?? 'Video Call';
  const statusRaw = (typeof m.status === 'string' ? m.status : String(m.status ?? 'scheduled')).toLowerCase();
  const statusMap: Record<string, Meeting['status']> = {
    scheduled: 'Scheduled', completed: 'Completed',
    cancelled: 'Cancelled', no_show: 'No-Show',
  };
  return {
    id: typeof m.id === 'string' ? m.id : String(m.id ?? ''),
    leadId: typeof m.lead_id === 'string' ? m.lead_id : String(m.lead_id ?? ''),
    leadName: typeof m.lead_name === 'string' ? m.lead_name : typeof m.title === 'string' ? m.title : String(m.title ?? ''),
    company: typeof m.company === 'string' ? m.company : String(m.company ?? ''),
    date: datePart,
    time: timePart,
    duration: Number(m.duration_minutes || 60),
    type: meetingType,
    status: statusMap[statusRaw] ?? 'Scheduled',
    notes: typeof m.notes === 'string' ? m.notes : String(m.notes ?? ''),
    agenda: m.agenda ? String(m.agenda) : undefined,
    followUpRequired: Boolean(m.follow_up_required),
    timezone: m.timezone ? String(m.timezone) : undefined,
  };
}

function mapLeadRead(l: LeadRead): SalesLead {
  const parsedBudget = parseBudgetFromNotes(l.notes);
  return {
    id: l.id,
    title: l.title || '',
    firstName: (l.contact_name || '').split(' ')[0] || '',
    lastName: (l.contact_name || '').split(' ').slice(1).join(' ') || '',
    email: l.email || '',
    phone: l.phone || '',
    designation: '',
    company: l.company_name || '',
    industry: '',
    companySize: '',
    website: '',
    city: '',
    status: mapLeadStatus(l.status || 'new'),
    // Bug 5 fixed: use actual source from backend
    source: mapSource(l.source_id),
    assignedTo: l.assigned_to || '',
    priority: (l.priority as 'Low' | 'Medium' | 'High' | 'Critical') || 'Medium',
    budget: l.estimated_value || parsedBudget || 0,
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
  };
}

function mapInvoiceStatus(status: string): SalesInvoice['status'] {
  const s = status.toLowerCase();
  if (s.includes('final_paid') || s === 'paid' || s.includes('fully')) return 'Fully Paid';
  if (s.includes('advance_paid')) return 'Advance Paid';
  if (s.includes('sent') || s.includes('overdue')) return 'Sent';
  return 'Draft';
}

function mapInvoiceRead(inv: Record<string, unknown>, leadsById: Map<string, SalesLead>): SalesInvoice {
  const leadId = typeof inv.lead_id === 'string' ? inv.lead_id : String(inv.lead_id ?? '');
  const lead = leadsById.get(leadId);
  const subtotal = Number(inv.subtotal || 0);
  const taxTotal = Number(inv.tax_total || 0);
  const total = Number(inv.total_amount || 0);
  const invoiceType = typeof inv.invoice_type === 'string' ? inv.invoice_type : String(inv.invoice_type ?? 'standard');
  const invNotes = typeof inv.notes === 'string' ? inv.notes : String(inv.notes ?? '');
  return {
    id: typeof inv.id === 'string' ? inv.id : String(inv.id ?? ''),
    invoiceNumber: typeof inv.invoice_number === 'string' ? inv.invoice_number : String(inv.invoice_number ?? ''),
    leadId,
    clientName: lead ? `${lead.firstName} ${lead.lastName}`.trim() : '',
    clientEmail: lead?.email || '',
    clientPhone: lead?.phone || '',
    company: lead?.company || '',
    issueDate: typeof inv.issue_date === 'string' ? inv.issue_date : String(inv.issue_date ?? ''),
    dueDate: typeof inv.due_date === 'string' ? inv.due_date : String(inv.due_date ?? ''),
    lineItems: [{
      serviceId: invoiceType,
      serviceName: invoiceType.charAt(0).toUpperCase() + invoiceType.slice(1) + ' Invoice',
      description: invNotes,
      quantity: 1,
      unitPrice: subtotal,
      total: subtotal,
    }],
    subtotal,
    taxRate: subtotal > 0 ? Math.round((taxTotal / subtotal) * 100) : 0,
    taxAmount: taxTotal,
    grandTotal: total,
    advancePercent: invoiceType === 'advance' ? 25 : 0,
    advanceDue: total,
    status: mapInvoiceStatus(typeof inv.status === 'string' ? inv.status : String(inv.status ?? 'draft')),
    notes: invNotes,
  };
}

function pushTimelineEvent(lead: SalesLead, type: SalesLead['timeline'][number]['type'], description: string): SalesLead {
  return {
    ...lead,
    lastUpdated: new Date().toISOString().split('T')[0],
    timeline: [
      ...lead.timeline,
      {
        id: `t-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        type,
        description,
        actor: 'Sales Admin',
      },
    ],
  };
}

export const useSalesStore = create<SalesState>((set, get) => ({
  leads: [],
  meetings: [],
  invoices: [],
  services: [],
  isLoading: false,

  // ─── API FETCH ACTIONS ────────────────────────────────────────────────────
  fetchLeads: async () => {
    set({ isLoading: true });
    try {
      // Bug 4 fixed: also fetch meetings from backend so the meetings array is populated
      // Invoices were never fetched at all (the store's `invoices` array only ever
      // grew from generateInvoice() during the current session) - the Invoices page
      // always showed 0 even though persisted invoices existed. Fetch them too.
      const [leadsRes, meetingsRes, invoicesRes] = await Promise.all([
        leadService.getAll({ page_size: 200 }),
        meetingService.getAll({ page_size: 200 }).catch(() => ({ items: [] })),
        financeService.getInvoices({ page_size: 200 }).catch(() => ({ items: [] })),
      ]);
      const backendLeads = leadsRes.items || leadsRes || [];
      const backendMeetings = (meetingsRes as { items?: unknown[] }).items || meetingsRes || [];
      const backendInvoices = (invoicesRes as { items?: unknown[] }).items || invoicesRes || [];
      const mappedLeads = backendLeads.map(mapLeadRead);
      const mappedMeetings: Meeting[] = (backendMeetings as Parameters<typeof mapMeetingRead>[0][]).map(mapMeetingRead);
      const leadsById = new Map(mappedLeads.map((l) => [l.id, l]));
      const mappedInvoices: SalesInvoice[] = (backendInvoices as Record<string, unknown>[]).map((inv) => mapInvoiceRead(inv, leadsById));
      set({ leads: mappedLeads, meetings: mappedMeetings, invoices: mappedInvoices, isLoading: false });
    } catch (err) {
      // A silently-swallowed failure here previously rendered as an empty,
      // error-free leads table indistinguishable from "there's just no data" -
      // surface it instead so a 4xx/5xx/network failure is never mistaken for empty state.
      console.error('Failed to load leads/meetings:', err);
      useToastStore.getState().showToast(extractErrorMessage(err, 'Failed to load leads.'), 'error');
      set({ isLoading: false });
    }
  },

  createLead: async (payload) => {
    set({ isLoading: true });
    try {
      const created = await leadService.create({
        ...payload,
        status: 'NEW_LEAD',
      });
      const newLead = mapLeadRead(created);
      set((state) => ({
        leads: [newLead, ...state.leads],
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  editLead: async (leadId, payload) => {
    set({ isLoading: true });
    try {
      const updated = await leadService.update(leadId, payload);
      const mapped = mapLeadRead(updated);
      set((state) => ({
        leads: state.leads.map((l) => (l.id === leadId ? mapped : l)),
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  deleteLead: async (leadId) => {
    set({ isLoading: true });
    try {
      await leadService.delete(leadId);
      set((state) => ({
        leads: state.leads.filter((l) => l.id !== leadId),
        isLoading: false,
      }));
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  updateLeadStatus: async (leadId, status) => {
    // Bug 20 fixed: optimistic update first, roll back on error
    const prev = get().leads;
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId ? pushTimelineEvent({ ...lead, status }, 'status_changed', `Status changed to ${status}`) : lead,
      ),
    }));
    try {
      if (status === 'Lost') {
        await leadService.markLost(leadId);
      } else {
        await leadService.update(leadId, { status });
      }
    } catch (err) {
      set({ leads: prev });
      throw err;
    }
  },

  updateLeadNotes: async (leadId, notes) => {
    await leadService.update(leadId, { notes });
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId ? pushTimelineEvent({ ...lead, notes }, 'note_added', 'Notes updated') : lead,
      ),
    }));
  },

  updateLeadBudget: async (leadId, budget) => {
    await leadService.update(leadId, { estimated_value: budget });
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId ? pushTimelineEvent({ ...lead, budget }, 'budget_updated', `Budget updated to ₹${budget.toLocaleString('en-IN')}`) : lead,
      ),
    }));
  },

  updateLeadServices: async (leadId, services) => {
    await leadService.update(leadId, { interested_services: services });
    set((state) => ({
      leads: state.leads.map((lead) =>
        lead.id === leadId
          ? pushTimelineEvent({ ...lead, interestedServices: services }, 'services_updated', `Services updated: ${services.join(', ')}`)
          : lead,
      ),
    }));
  },

  scheduleMeeting: async (meeting) => {
    let scheduledAt = new Date(`${meeting.date}T${meeting.time}:00`).toISOString();
    if (meeting.timezone) {
      const offset = getTimeZoneOffset(meeting.timezone, new Date(`${meeting.date}T${meeting.time}:00`));
      scheduledAt = `${meeting.date}T${meeting.time}:00${offset}`;
    }
    const created = await meetingService.create({
      lead_id: meeting.leadId,
      title: `${meeting.type} with ${meeting.leadName}`,
      meeting_type: meeting.type,
      scheduled_at: scheduledAt,
      duration_minutes: meeting.duration,
      agenda: meeting.agenda,
    });
    const newMeeting: Meeting = { ...meeting, id: created.id };
    set((state) => ({
      meetings: [...state.meetings, newMeeting],
      leads: state.leads.map((lead) =>
        lead.id === meeting.leadId
          ? pushTimelineEvent(
              { ...lead, status: 'Meeting Scheduled' as SalesLeadStatus, meetings: [...lead.meetings, newMeeting] },
              'meeting_scheduled',
              `Meeting scheduled for ${meeting.date} at ${meeting.time} — ${meeting.type}`,
            )
          : lead,
      ),
    }));
  },

  addMeetingNotes: async (meetingId, notes) => {
    await meetingService.update(meetingId, { notes });
    set((state) => ({
      meetings: state.meetings.map((m) => (m.id === meetingId ? { ...m, notes } : m)),
    }));
  },

  completeMeeting: async (meetingId, notes) => {
    await meetingService.complete(meetingId, notes);
    set((state) => ({
      meetings: state.meetings.map((m) =>
        m.id === meetingId ? { ...m, status: 'Completed', notes } : m,
      ),
      leads: state.leads.map((lead) => ({
        ...lead,
        meetings: lead.meetings.map((m) =>
          m.id === meetingId ? { ...m, status: 'Completed', notes } : m
        )
      })),
    }));
  },

  generateInvoice: async (leadId) => {
    const lead = get().leads.find((l) => l.id === leadId);
    if (!lead || lead.invoiceGenerated) return null;

    // total_deal_amount is validated server-side as gt=0 (see
    // AdvanceInvoiceCreateRequest) - failing fast here with a clear message
    // is the fix for the 422, instead of ever sending a 0/negative amount.
    if (lead.budget <= 0) {
      throw new Error('Set a budget greater than ₹0 for this lead before generating an invoice.');
    }

    // Backend requires a Proposal to exist before the advance invoice can
    // reference it (see migration 0020) - the deal amount comes from the
    // lead's own budget field, matching what this page already shows.
    const proposalTitleName = `${lead.firstName} ${lead.lastName}`.trim();
    const proposal = await proposalService.createForLead(leadId, {
      title: `Proposal for ${lead.company || proposalTitleName}`,
      description: lead.interestedServices.join(', ') || undefined,
      amount: lead.budget,
    });

    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const backendInvoice = await financeService.createAdvanceInvoice({
      lead_id: leadId,
      proposal_id: proposal.id,
      total_deal_amount: lead.budget,
      tax_rate: 18,
      due_date: dueDate,
      currency: 'INR',
      notes: `Invoice generated for ${lead.company}. 25% advance payment due within 7 days.`,
    });

    const invoice: SalesInvoice = {
      id: backendInvoice.id,
      invoiceNumber: backendInvoice.invoice_number,
      leadId,
      clientName: `${lead.firstName} ${lead.lastName}`,
      clientEmail: lead.email,
      clientPhone: lead.phone,
      company: lead.company,
      issueDate: backendInvoice.issue_date,
      dueDate: backendInvoice.due_date,
      lineItems: [{
        serviceId: 'advance',
        serviceName: 'Advance Payment (25%)',
        description: `Advance payment for engagement (of ₹${lead.budget.toLocaleString('en-IN')} total)`,
        quantity: 1,
        unitPrice: backendInvoice.subtotal,
        total: backendInvoice.subtotal,
      }],
      subtotal: backendInvoice.subtotal,
      taxRate: 18,
      taxAmount: backendInvoice.tax_total,
      grandTotal: backendInvoice.total_amount,
      advancePercent: 25,
      advanceDue: backendInvoice.total_amount,
      status: 'Draft',
      notes: backendInvoice.notes || '',
    };

    set((state) => ({
      invoices: [...state.invoices, invoice],
      leads: state.leads.map((l) =>
        l.id === leadId
          ? pushTimelineEvent(
              pushTimelineEvent(
                { ...l, invoiceGenerated: true, invoiceId: invoice.id, status: 'Ready for CRM' as SalesLeadStatus },
                'invoice_generated',
                `Invoice ${invoice.invoiceNumber} generated. 25% advance: ₹${invoice.advanceDue.toLocaleString('en-IN')}`,
              ),
              'status_changed',
              'Status changed to Ready for CRM',
            )
          : l,
      ),
    }));

    return invoice;
  },
}));
