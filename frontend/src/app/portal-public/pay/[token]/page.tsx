'use client';

import { use, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { paymentService } from '@/services/paymentService';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface PublicInvoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  currency: string;
  total_amount: number;
  balance_due: number;
  due_date: string;
}

function extractErrorMessage(err: unknown): string {
  if (isAxiosError<{ message?: string; detail?: string }>(err)) {
    return err.response?.data?.message || err.response?.data?.detail || 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

export default function PublicPayInvoicePage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = use(params);

  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    paymentService.getPublicInvoice(token)
      .then((data) => {
        if (cancelled) return;
        setInvoice(data);
        setAmount(String(data.balance_due));
      })
      .catch((err) => { if (!cancelled) setLoadError(extractErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setSubmitError('Please enter a valid amount.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await paymentService.submitPublicPayment(token, {
        amount: numericAmount, payment_method: paymentMethod, reference_number: referenceNumber || undefined,
      });
      setSubmitted(true);
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

  if (loadError || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="font-bold text-slate-900 mb-1">Link unavailable</h1>
          <p className="text-sm text-slate-500">{loadError || 'This invoice could not be found.'}</p>
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
          <h1 className="text-xl font-bold text-slate-900">Invoice {invoice.invoice_number}</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">{invoice.invoice_type} payment</p>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Total amount</span><span className="font-semibold text-slate-800">{invoice.currency} {invoice.total_amount.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Balance due</span><span className="font-bold text-[#4C1D95]">{invoice.currency} {invoice.balance_due.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Due date</span><span className="text-slate-700">{invoice.due_date}</span></div>
        </div>

        {submitted && (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">Payment proof submitted.</p>
            <p className="text-sm text-slate-500 mt-1">Our finance team will verify it shortly.</p>
          </div>
        )}
        {!submitted && invoice.balance_due <= 0 && (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">This invoice is fully paid.</p>
          </div>
        )}
        {!submitted && invoice.balance_due > 0 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="pay-amount" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Amount paid</label>
              <input
                id="pay-amount"
                type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            </div>
            <div>
              <label htmlFor="pay-method" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Payment method</label>
              <select
                id="pay-method"
                value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="credit_card">Credit Card</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="pay-ref" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Reference / transaction number</label>
              <input
                id="pay-ref"
                type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. UTR / UPI ref"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            </div>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <button
              type="submit" disabled={submitting}
              className="w-full py-3 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Payment Proof'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
