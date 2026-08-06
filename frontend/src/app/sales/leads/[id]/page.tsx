'use client';
import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { SalesHeader } from '@/components/sales/SalesSidebar';
import { LeadStatusBadge } from '@/components/sales/LeadStatusBadge';
import { ActivityFeed } from '@/components/sales/ActivityFeed';
import { ScheduleMeetingModal } from '@/components/sales/ScheduleMeetingModal';
import { ServiceSelector } from '@/components/sales/ServiceSelector';
import { useSalesStore } from '@/store/salesStore';
import { useToastStore } from '@/store/toastStore';
import { SalesLeadStatus } from '@/types';
import {
  ArrowLeft, CalendarDays, Clock, FileText, Edit2, Save, X,
  Mail, Phone, Globe, Building2, MapPin, Users, TrendingUp,
  Video, CheckCircle2, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_OPTIONS: SalesLeadStatus[] = [
  'New', 'Contacted', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Ready for CRM',
];

const formatDate = (isoString: string | null | undefined) => {
  if (!isoString) return 'Not Scheduled';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
};

export default function LeadDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { leads, updateLeadStatus, updateLeadNotes, updateLeadBudget, updateLeadServices, scheduleMeeting, generateInvoice } = useSalesStore();
  const { showToast } = useToastStore();
  const lead = leads.find((l) => l.id === id);

  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [editingServices, setEditingServices] = useState(false);
  // Bugs 11, 12, 13: local edit state is seeded from the lead record at the
  // moment each editor opens (see the "Edit"/"Edit Services" handlers below),
  // rather than kept in sync via an effect - these values are only ever read
  // while their corresponding editingX flag is true.
  const [notesValue, setNotesValue] = useState(lead?.notes ?? '');
  const [budgetValue, setBudgetValue] = useState(lead?.budget ?? 0);
  const [servicesValue, setServicesValue] = useState(lead?.interestedServices ?? []);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [invoiceSuccess, setInvoiceSuccess] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-4">
        <AlertCircle className="text-red-400" size={40} />
        <p className="text-slate-500">Lead not found</p>
        <Link href="/sales/leads" className="text-[#4C1D95] font-semibold text-sm hover:underline">← Back to Leads</Link>
      </div>
    );
  }

  const handleGenerateInvoice = async () => {
    setGeneratingInvoice(true);
    setInvoiceError(null);
    try {
      const invoice = await generateInvoice(lead.id);
      if (invoice) {
        setInvoiceSuccess(true);
        setTimeout(() => router.push(`/sales/invoices/${invoice.id}`), 1200);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate invoice. Please check the lead details and try again.';
      setInvoiceError(message);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const canGenerateInvoice =
    !lead.invoiceGenerated &&
    ['Negotiation', 'Won', 'Proposal Sent'].includes(lead.status) &&
    lead.interestedServices.length > 0 &&
    lead.budget > 0;

  // The backend rejects total_deal_amount <= 0 (HTTP 422) - leads created
  // automatically from the public contact/consultation forms never have a
  // budget set, so Sales must set one before an invoice can be generated.
  const blockedByMissingBudget =
    !lead.invoiceGenerated &&
    ['Negotiation', 'Won', 'Proposal Sent'].includes(lead.status) &&
    lead.interestedServices.length > 0 &&
    !(lead.budget > 0);

  return (
    <div>
      <SalesHeader
        title={`${lead.firstName} ${lead.lastName}`}
        subtitle={`${lead.company || 'No Company Provided'} · ${lead.city || 'Unassigned City'}`}
      />

      {/* Invoice Error Toast */}
      {invoiceError && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
          <div>
            <div className="font-semibold text-red-700">Couldn&apos;t generate invoice</div>
            <div className="text-sm text-red-600">{invoiceError}</div>
          </div>
        </div>
      )}

      {/* Invoice Success Toast */}
      {invoiceSuccess && (
        <div className="mx-6 mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="text-emerald-600 flex-shrink-0" size={20} />
          <div>
            <div className="font-semibold text-emerald-700">Invoice Generated Successfully!</div>
            <div className="text-sm text-emerald-600">Lead status updated to &quot;Ready for CRM&quot;. Redirecting to invoice...</div>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Page Actions Bar (BUG-014 Layout Hierarchy & BUG-023 Back Button Referrer) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/sales/leads');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Lead Profile</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMeetingModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-[#4C1D95] rounded-xl text-xs font-bold hover:bg-violet-50 hover:border-violet-200 transition-colors shadow-sm"
            >
              <CalendarDays size={14} /> Schedule Meeting
            </button>

            {canGenerateInvoice && (
              <button
                type="button"
                onClick={handleGenerateInvoice}
                disabled={generatingInvoice}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-violet-500/25 transition-all disabled:opacity-70 shadow-sm"
              >
                {generatingInvoice ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText size={14} /> Generate 25% Invoice
                  </>
                )}
              </button>
            )}

            {lead.invoiceGenerated && lead.invoiceId && (
              <Link
                href={`/sales/invoices/${lead.invoiceId}`}
                className="flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-xs font-semibold hover:bg-purple-100 transition-colors shadow-sm"
              >
                <CheckCircle2 size={14} /> View Invoice
              </Link>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="space-y-5">
            {/* Client Info Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {(lead.firstName?.[0] || '') + (lead.lastName?.[0] || '') || 'UL'}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base" style={{ fontFamily: "'Sora', sans-serif" }}>
                      {lead.firstName || lead.lastName ? `${lead.firstName} ${lead.lastName}`.trim() : 'Unnamed Lead'}
                    </h2>
                    <p className="text-sm text-slate-500">{lead.designation || <span className="text-slate-400 italic">No Designation Provided</span>}</p>
                  </div>
                </div>
                <LeadStatusBadge status={lead.status} size="sm" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={15} className="text-slate-300 flex-shrink-0" />
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="text-slate-700 hover:text-[#4C1D95] transition-colors truncate">{lead.email}</a>
                  ) : (
                    <span className="text-slate-400 italic">No Email Provided</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={15} className="text-slate-300 flex-shrink-0" />
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="text-slate-700 hover:text-[#4C1D95] transition-colors">{lead.phone}</a>
                  ) : (
                    <span className="text-slate-400 italic">No Phone Provided</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Globe size={15} className="text-slate-300 flex-shrink-0" />
                  {lead.website ? (
                    <a href={`https://${lead.website}`} target="_blank" rel="noreferrer" className="text-[#4C1D95] hover:underline truncate">{lead.website}</a>
                  ) : (
                    <span className="text-slate-400 italic">No Website Provided</span>
                  )}
                </div>
              </div>

              {/* Update Status */}
              <div className="mt-5 pt-5 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Update Status</label>
                <select
                  value={lead.status}
                  onChange={(e) => updateLeadStatus(lead.id, e.target.value as SalesLeadStatus)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Company Info */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                <Building2 size={15} className="text-[#4C1D95]" /> Company Details
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Company</div>
                  <div className="text-sm text-slate-700 font-semibold mt-0.5">{lead.company || <span className="text-slate-400 italic">No Company Provided</span>}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Industry</div>
                  <div className="text-sm text-slate-700 mt-0.5">{lead.industry || <span className="text-slate-400 italic">Not Provided</span>}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Team Size</div>
                    <div className="flex items-center gap-1 text-sm text-slate-700 mt-0.5">
                      <Users size={12} className="text-slate-300" />{lead.companySize || <span className="text-slate-400 italic">Not Provided</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">City</div>
                    <div className="flex items-center gap-1 text-sm text-slate-700 mt-0.5">
                      <MapPin size={12} className="text-slate-300" />{lead.city || <span className="text-slate-400 italic">Not Provided</span>}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Source</div>
                  <span className="mt-0.5 inline-block text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                    {lead.source}
                  </span>
                </div>
              </div>
            </div>

            {/* Deal Info */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                <TrendingUp size={15} className="text-[#4C1D95]" /> Deal Overview
              </h3>
              <div className="space-y-4">
                {/* Budget */}
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Monthly Budget</div>
                  {editingBudget ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₹</span>
                        <input
                          type="number"
                          value={budgetValue}
                          onChange={(e) => setBudgetValue(Number(e.target.value))}
                          className="w-full pl-7 pr-3 py-2 border border-[#4C1D95] rounded-lg text-sm focus:outline-none"
                        />
                      </div>
                      <button type="button" onClick={() => { updateLeadBudget(lead.id, budgetValue); setEditingBudget(false); }}
                        className="px-3 py-2 bg-[#4C1D95] text-white rounded-lg text-sm hover:bg-[#3b1574]">
                        <Save size={14} />
                      </button>
                      <button type="button" onClick={() => { setBudgetValue(lead.budget); setEditingBudget(false); }}
                        className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-[#4C1D95]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        ₹{lead.budget.toLocaleString('en-IN')}
                      </div>
                      <button type="button" onClick={() => { setBudgetValue(lead.budget); setEditingBudget(true); }} className="p-1.5 text-slate-400 hover:text-[#4C1D95] rounded-lg hover:bg-violet-50 transition-colors">
                        <Edit2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Probability</div>
                    <div className="text-lg font-bold text-slate-800 mt-0.5">{lead.probability}%</div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                      <div className="bg-[#4C1D95] h-1.5 rounded-full" style={{ width: `${lead.probability}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Close Date</div>
                    <div className="text-sm font-semibold text-slate-700 mt-0.5">{lead.expectedCloseDate}</div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Assigned To</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-[10px] font-bold">
                      {lead.assignedTo ? lead.assignedTo.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'UA'}
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {lead.assignedTo || <span className="text-slate-400 italic">Unassigned</span>}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER COLUMN */}
          <div className="space-y-5">
            {/* Services */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-sm">Interested Services</h3>
                <button
                  type="button"
                  onClick={() => {
                    if (!editingServices) {
                      setServicesValue(lead.interestedServices);
                      setEditingServices(true);
                    } else {
                      // "Done" must persist the selection, not silently discard it.
                      updateLeadServices(lead.id, servicesValue);
                      setEditingServices(false);
                      showToast('Interested services saved successfully', 'success');
                    }
                  }}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    editingServices ? 'bg-[#4C1D95] text-white' : 'bg-violet-50 text-[#4C1D95] hover:bg-violet-100'
                  }`}
                >
                  {editingServices ? 'Done' : 'Edit Services'}
                </button>
              </div>

              {editingServices ? (
                <div>
                  <ServiceSelector
                    selected={servicesValue}
                    onChange={setServicesValue}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateLeadServices(lead.id, servicesValue);
                      setEditingServices(false);
                      showToast('Interested services saved successfully', 'success');
                    }}
                    className="mt-4 w-full py-2.5 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors"
                  >
                    Save Services
                  </button>
                </div>
              ) : (
                <div>
                  {lead.interestedServices.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No services selected yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {lead.interestedServices.map((svc) => (
                        <div key={svc} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-100">
                          <CheckCircle2 size={14} className="text-[#4C1D95] flex-shrink-0" />
                          <span className="text-sm text-slate-700 font-medium">{svc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-sm">Notes</h3>
                {!editingNotes && (
                  <button
                    type="button"
                    onClick={() => { setNotesValue(lead.notes); setEditingNotes(true); }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#4C1D95] bg-violet-50 px-3 py-1.5 rounded-lg hover:bg-violet-100 transition-colors"
                  >
                    <Edit2 size={11} /> Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div>
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-3 border border-[#4C1D95]/30 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 resize-none"
                    placeholder="Add notes about this lead..."
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        updateLeadNotes(lead.id, notesValue);
                        setEditingNotes(false);
                        showToast('Notes saved successfully', 'success');
                      }}
                      className="flex-1 py-2.5 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors"
                    >
                      Save Notes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingNotes(false)}
                      className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">
                  {lead.notes || <span className="italic text-slate-400">No notes added yet.</span>}
                </p>
              )}
            </div>

            {/* Meeting History */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-sm">Meeting History</h3>
                <button
                  type="button"
                  onClick={() => setShowMeetingModal(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#4C1D95] bg-violet-50 px-3 py-1.5 rounded-lg hover:bg-violet-100 transition-colors"
                >
                  <CalendarDays size={11} /> Schedule
                </button>
              </div>
              {lead.meetings.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No meetings scheduled yet.</p>
              ) : (
                <div className="space-y-3">
                  {lead.meetings.map((meeting) => (
                    <div key={meeting.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 hover:border-violet-200 hover:bg-violet-50/30 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Video size={14} className="text-[#4C1D95]" />
                          <span className="text-xs font-semibold text-slate-700">{meeting.type}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            meeting.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                            meeting.status === 'Scheduled' ? 'bg-violet-50 text-violet-600 border border-violet-200' :
                            meeting.status === 'No-Show' ? 'bg-red-50 text-red-500 border border-red-200' :
                            'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}>
                            {meeting.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <CalendarDays size={11} />{meeting.date}
                          <Clock size={11} />{meeting.time}
                        </div>
                      </div>
                      {meeting.notes && (
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{meeting.notes}</p>
                      )}
                      {meeting.agenda && !meeting.notes && (
                        <p className="text-xs text-slate-400 italic line-clamp-2">{meeting.agenda}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">
            {/* Budget missing warning - the reason Generate Invoice is hidden */}
            {blockedByMissingBudget && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
                <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <div className="font-bold text-amber-800 text-sm">Set a budget before invoicing</div>
                  <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                    This lead has no budget set, so a 25% advance invoice can&apos;t be generated (amount would be ₹0).
                    Edit the <strong>Monthly Budget</strong> field in Deal Overview first.
                  </p>
                </div>
              </div>
            )}

            {/* Generate Invoice CTA (if eligible) */}
            {canGenerateInvoice && (
              <div className="bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] rounded-2xl p-6 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 90% 10%, white 0%, transparent 50%)' }} />
                <div className="relative">
                  <FileText size={24} className="mb-3 text-white/80" />
                  <h3 className="font-bold text-lg mb-1" style={{ fontFamily: "'Sora', sans-serif" }}>Ready to Invoice?</h3>
                  <p className="text-white/70 text-sm mb-4">Generate a 25% advance invoice based on the selected services.</p>
                  <div className="bg-white/10 rounded-xl p-3 mb-4">
                    <div className="text-white/70 text-xs mb-1">Estimated 25% Advance</div>
                    <div className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      ₹{Math.round(lead.budget * 3 * 0.25 * 1.18 / 1000).toFixed(0)}K
                    </div>
                    <div className="text-white/50 text-[10px] mt-0.5">(3 months × budget × 25% + 18% GST)</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateInvoice}
                    disabled={generatingInvoice}
                    className="w-full py-3 bg-white text-[#4C1D95] rounded-xl text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-70"
                  >
                    {generatingInvoice ? 'Generating...' : '⚡ Generate 25% Invoice'}
                  </button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4">Activity Timeline</h3>
              <ActivityFeed events={lead.timeline} />
            </div>

            {/* Follow-up Date */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Follow-up Schedule</h3>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <CalendarDays size={18} className="text-amber-600 flex-shrink-0" />
                <div>
                  <div className="text-xs text-amber-700 font-semibold">Next Follow-up</div>
                  <div className="text-sm font-bold text-amber-800">
                    {lead.followUpDate ? formatDate(lead.followUpDate) : 'Not Scheduled'}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-slate-400">
                <span className="font-medium text-slate-500">Created:</span> {formatDate(lead.createdAt)}
                {' · '}
                <span className="font-medium text-slate-500">Last Updated:</span> {formatDate(lead.lastUpdated)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Meeting Modal */}
      {showMeetingModal && (
        <ScheduleMeetingModal
          leadId={lead.id}
          leadName={`${lead.firstName} ${lead.lastName}`}
          company={lead.company}
          onClose={() => setShowMeetingModal(false)}
          onSchedule={scheduleMeeting}
        />
      )}
    </div>
  );
}
