'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle, Mail, Briefcase,
  FileText, Clock, AlertCircle, RefreshCw, UserCheck, Phone,
  Globe, MapPin, Tag, Download
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { leadService } from '@/services/leadService';
import { financeService } from '@/services/crmService';

interface InvoiceRead {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  total_amount: number;
  currency: string;
  due_date: string;
}

interface PaymentRead {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  reference_number: string | null;
}

export default function CrmLeadDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { getLeadById, fetchLeads } = useCrmStore();

  const lead = getLeadById(params.id as string);
  const [reviewNotes, setReviewNotes] = useState(lead?.reviewNotes || '');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const [invoice, setInvoice] = useState<InvoiceRead | null>(null);
  const [payments, setPayments] = useState<PaymentRead[]>([]);
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [emailLive, setEmailLive] = useState(true);
  const [pdfLoading, setPdfLoading] = useState<'view' | 'download' | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    financeService.getEmailDeliveryStatus().then((r) => setEmailLive(r.live)).catch(() => setEmailLive(true));
  }, []);

  const loadInvoiceAndPayments = async (leadId: string) => {
    setLoadingInvoice(true);
    try {
      const inv = await financeService.getAdvanceInvoiceForLead(leadId);
      setInvoice(inv);
      if (inv) {
        const pays = await financeService.getPayments(inv.id);
        setPayments(pays || []);
      } else {
        setPayments([]);
      }
    } catch {
      setInvoice(null);
      setPayments([]);
    } finally {
      setLoadingInvoice(false);
    }
  };

  useEffect(() => {
    if (lead?.id) loadInvoiceAndPayments(lead.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  if (!lead) {
    return (
      <div className="p-6 text-center text-slate-400">
        <p>Lead not found.</p>
        <button type="button" onClick={() => router.push('/crm/leads')} className="mt-4 text-violet-400 hover:underline">
          Back to Leads
        </button>
      </div>
    );
  }

  const sl = lead.salesLead;

  // Real backend actions: CRM approving/rejecting the lead's advance
  // invoice/proposal - replacing the old local-only mock reviewLead/
  // sendInvoiceEmail/generateCredentials/convertLeadToClient actions, which
  // never reached the database and were disconnected from the real
  // Sales -> CRM -> Payments -> Client-account pipeline built on the backend.
  const handleApprove = async () => {
    if (!invoice) {
      setActionError('No advance invoice found for this lead yet - ask Sales to generate one first.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      if (reviewNotes.trim()) {
        await leadService.update(lead.id, { notes: reviewNotes }).catch(() => {});
      }
      await financeService.crmApproveInvoice(invoice.id);
      await Promise.all([fetchLeads(), loadInvoiceAndPayments(lead.id)]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewPdf = async () => {
    if (!invoice) return;
    setPdfLoading('view');
    try {
      const blob = await financeService.fetchInvoicePdfBlob(invoice.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to open the invoice PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setPdfLoading('download');
    try {
      const blob = await financeService.fetchInvoicePdfBlob(invoice.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to download the invoice PDF.');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleResendEmail = async () => {
    if (!invoice) return;
    setResending(true);
    setResendMessage(null);
    try {
      await financeService.resendInvoiceEmail(invoice.id);
      await loadInvoiceAndPayments(lead.id);
      setResendMessage('Payment-link email resent.');
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : 'Failed to resend the email.');
    } finally {
      setResending(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      await leadService.markLost(lead.id, rejectReason || undefined, 'REJECTED');
      await fetchLeads();
      setShowReject(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const awaitingPayment = lead.crmStatus === 'Approved';
  const isClientCreated = lead.crmStatus === 'Client Created';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/leads" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{sl.firstName} {sl.lastName}</h1>
              <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium bg-white/5 border-white/10 text-white`}>
                {lead.crmStatus}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{sl.company} · Received from Sales on {lead.receivedAt}</p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Handover Notes */}
          <div className="bg-[#12141f] border border-white/5 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4 text-violet-400" />
              Sales Handover Details
            </h2>
            <div className="bg-violet-500/5 border border-violet-500/10 rounded-lg p-4 mb-5">
              <p className="text-sm text-slate-300 italic">&quot;{lead.salesLead.notes}&quot;</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white">
                  {lead.salesLead.assignedTo.charAt(0)}
                </span>
                <span>{lead.salesLead.assignedTo} (Sales Executive)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Company Size</p>
                <p className="text-sm font-medium text-white">{sl.companySize || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Industry</p>
                <p className="text-sm font-medium text-white">{sl.industry || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Approved Budget</p>
                <p className={`text-sm font-medium ${(sl.budget ?? 0) > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  ₹{(sl.budget ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>

          {/* Requested Services */}
          <div className="bg-[#12141f] border border-white/5 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Tag className="w-4 h-4 text-violet-400" />
              Required Services
            </h2>
            <div className="flex flex-wrap gap-2">
              {sl.interestedServices.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No services recorded on this lead.</p>
              ) : sl.interestedServices.map(s => (
                <span key={s} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-[#12141f] border border-white/5 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <Mail className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm text-white">{sl.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <Phone className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-sm text-white">{sl.phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <Globe className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Website</p>
                  <p className="text-sm text-white">{sl.website || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                <MapPin className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="text-sm text-white">{sl.city || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: CRM Actions & Workflow */}
        <div className="space-y-6">
          {/* CRM Workflow Engine */}
          <div className="bg-[#12141f] border border-white/5 rounded-xl p-5 shadow-xl shadow-black/20 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-violet-400" />
              Onboarding Workflow
            </h2>

            <div className="space-y-6">
              {/* STEP 1: Review */}
              <div className="relative pl-6 border-l border-white/10 pb-2">
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-[#12141f] ${lead.crmStatus === 'Pending Review' ? 'bg-violet-500' : 'bg-emerald-500'}`} />
                <h3 className="text-sm font-semibold text-white">1. Lead Review</h3>
                <p className="text-xs text-slate-500 mt-1">Review handover and verify scope, then approve to send the invoice + payment link.</p>

                {lead.crmStatus === 'Pending Review' && !showReject && (
                  <div className="mt-4 space-y-3">
                    {loadingInvoice && (
                      <p className="text-xs text-slate-500">Loading invoice…</p>
                    )}
                    {!loadingInvoice && !invoice && (
                      <p className="text-xs text-amber-400">No advance invoice found yet for this lead - Sales needs to generate one first.</p>
                    )}
                    <textarea
                      placeholder="Add CRM review notes..."
                      value={reviewNotes}
                      onChange={e => setReviewNotes(e.target.value)}
                      className="w-full h-20 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-violet-500/50 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={actionLoading || !invoice}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> {actionLoading ? 'Approving…' : 'Approve'}
                      </button>
                      <button type="button" onClick={() => setShowReject(true)} disabled={actionLoading} className="px-4 bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50 text-sm font-medium py-2 rounded-lg transition-colors">
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {showReject && (
                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      placeholder="Reason for rejection..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="w-full bg-white/5 border border-red-500/30 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={handleReject} disabled={actionLoading} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                        {actionLoading ? 'Rejecting…' : 'Confirm Reject'}
                      </button>
                      <button type="button" onClick={() => setShowReject(false)} disabled={actionLoading} className="px-4 bg-white/5 text-slate-400 hover:bg-white/10 disabled:opacity-50 text-sm font-medium py-2 rounded-lg transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {lead.crmStatus === 'Rejected' && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300">
                    This lead was rejected/marked lost.
                  </div>
                )}
              </div>

              {/* STEP 2: Invoice + payment-link email (automatic on approval) */}
              <div className="relative pl-6 border-l border-white/10 pb-2">
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-[#12141f] ${
                  lead.crmStatus === 'Pending Review' ? 'bg-slate-700' : 'bg-emerald-500'
                }`} />
                <h3 className="text-sm font-semibold text-white">2. Invoice &amp; Payment Link</h3>
                <p className="text-xs text-slate-500 mt-1">Sent to the client automatically the moment CRM approves.</p>

                {invoice && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300">{invoice.invoice_number}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{invoice.currency} {invoice.total_amount.toLocaleString('en-IN')}</span>
                    </div>

                    {invoice.status === 'EMAIL_SENT' && !emailLive && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>Email delivery is not configured (BREVO_API_KEY missing) — the client did not actually receive this email.</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-slate-300 font-medium">
                        {invoice.status}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleResendEmail}
                          disabled={resending}
                          className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> {resending ? 'Resending…' : 'Resend Email'}
                        </button>
                        <button
                          type="button"
                          onClick={handleViewPdf}
                          disabled={pdfLoading !== null}
                          className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50 flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" /> {pdfLoading === 'view' ? 'Opening…' : 'View PDF'}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          disabled={pdfLoading !== null}
                          className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> {pdfLoading === 'download' ? 'Downloading…' : 'Download'}
                        </button>
                      </div>
                    </div>
                    {resendMessage && <p className="text-[11px] text-slate-400 px-1">{resendMessage}</p>}
                  </div>
                )}
              </div>

              {/* STEP 3: Payment Tracking */}
              <div className="relative pl-6 border-l border-white/10 pb-2">
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-[#12141f] ${
                  awaitingPayment ? 'bg-violet-500' : (isClientCreated ? 'bg-emerald-500' : 'bg-slate-700')
                }`} />
                <h3 className="text-sm font-semibold text-white">3. Payment Verification</h3>
                <p className="text-xs text-slate-500 mt-1">Wait for client payment, then verify from the Payments tab.</p>

                {payments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg border border-white/10 text-xs">
                        <span className="text-slate-300">{p.payment_method}{p.reference_number ? ` · ${p.reference_number}` : ''}</span>
                        <span className="text-white font-semibold">₹{p.amount.toLocaleString('en-IN')}</span>
                        <span className="text-slate-400">{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {awaitingPayment && (
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">
                      Awaiting payment. Check <Link href="/crm/payments" className="underline font-semibold">Payments tab</Link> to verify when received.
                    </p>
                  </div>
                )}
              </div>

              {/* STEP 4: Credentials (automatic once payment is CRM-verified) */}
              <div className="relative pl-6 border-l border-white/10 pb-2">
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-[#12141f] ${isClientCreated ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <h3 className="text-sm font-semibold text-white">4. Client Credentials</h3>
                <p className="text-xs text-slate-500 mt-1">Portal login is generated and emailed automatically once payment is verified.</p>

                {isClientCreated && (
                  <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Credentials emailed to client
                    </p>
                  </div>
                )}
              </div>

              {/* STEP 5: Convert */}
              <div className="relative pl-6">
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-[#12141f] ${isClientCreated ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                <h3 className="text-sm font-semibold text-white">5. Convert to Client</h3>
                <p className="text-xs text-slate-500 mt-1">Client account + onboarding project are created automatically once payment is verified.</p>

                {isClientCreated && (
                  <div className="mt-4 text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <UserCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-emerald-400">Successfully Onboarded</p>
                    {lead.convertedToClientId && (
                      <Link href={`/crm/clients/${lead.convertedToClientId}`} className="text-xs text-white hover:underline mt-1 block">
                        View Client Profile →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
