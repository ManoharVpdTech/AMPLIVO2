'use client';

import { use, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { proposalService, ProposalRead } from '@/services/proposalService';
import { CheckCircle, XCircle, MessageSquareWarning, Loader2, AlertCircle } from 'lucide-react';

function extractErrorMessage(err: unknown): string {
  if (isAxiosError<{ message?: string; detail?: string }>(err)) {
    return err.response?.data?.message || err.response?.data?.detail || 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

export default function PublicProposalPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = use(params);

  const [proposal, setProposal] = useState<ProposalRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decision, setDecision] = useState<'accept' | 'reject' | 'revise' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    proposalService.getPublic(token)
      .then((data) => { if (!cancelled) setProposal(data); })
      .catch((err) => { if (!cancelled) setLoadError(extractErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await proposalService.decidePublic(token, decision, notes || undefined);
      setProposal(updated);
      setDone(true);
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="w-8 h-8 animate-spin text-[#4C1D95]" />
      </div>
    );
  }

  if (loadError || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="font-bold text-slate-900 mb-1">Link unavailable</h1>
          <p className="text-sm text-slate-500">{loadError || 'This proposal could not be found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{proposal.title}</h1>
          {proposal.amount != null && (
            <p className="text-2xl font-bold text-[#4C1D95] mt-2">₹{proposal.amount.toLocaleString('en-IN')}</p>
          )}
        </div>

        {proposal.description && (
          <p className="text-sm text-slate-600 whitespace-pre-wrap mb-6">{proposal.description}</p>
        )}

        {done || !['draft', 'sent'].includes(proposal.status) ? (
          <div className="text-center py-6">
            {proposal.status === 'accepted' && <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />}
            {proposal.status === 'rejected' && <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />}
            {proposal.status === 'revision_requested' && <MessageSquareWarning className="w-10 h-10 text-amber-500 mx-auto mb-3" />}
            <p className="font-semibold text-slate-800">
              {proposal.status === 'accepted' && 'You accepted this proposal. Check your email for the payment link.'}
              {proposal.status === 'rejected' && 'You declined this proposal.'}
              {proposal.status === 'revision_requested' && 'Your revision request has been sent to our team.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDecision('accept')}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-semibold transition-colors ${decision === 'accept' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-emerald-300'}`}
              >
                <CheckCircle size={18} /> Accept
              </button>
              <button
                type="button"
                onClick={() => setDecision('revise')}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-semibold transition-colors ${decision === 'revise' ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-slate-200 text-slate-600 hover:border-amber-300'}`}
              >
                <MessageSquareWarning size={18} /> Revise
              </button>
              <button
                type="button"
                onClick={() => setDecision('reject')}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-semibold transition-colors ${decision === 'reject' ? 'bg-red-50 border-red-400 text-red-700' : 'border-slate-200 text-slate-600 hover:border-red-300'}`}
              >
                <XCircle size={18} /> Reject
              </button>
            </div>

            {decision && (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={decision === 'revise' ? 'What would you like changed?' : 'Add a note (optional)'}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            )}

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!decision || submitting}
              className="w-full py-3 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
