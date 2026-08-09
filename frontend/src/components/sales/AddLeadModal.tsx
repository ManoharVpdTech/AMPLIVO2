'use client';
import { useState } from 'react';
import { X, User, Building2, Mail, Phone, AlertCircle, FileText } from 'lucide-react';
import { useSalesStore } from '@/store/salesStore';
import { ServiceSelector } from './ServiceSelector';

import { SalesLead } from '@/types';

interface AddLeadModalProps {
  onClose: () => void;
  leadToEdit?: SalesLead;
}

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Accepts an optional leading +, then 7-15 digits, allowing spaces/hyphens as
// separators - loose enough for Indian and international formats alike.
const PHONE_REGEX = /^\+?[\d\s-]{7,17}$/;

interface FieldErrors {
  title?: string;
  firstName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  budget?: string;
}

export function AddLeadModal({ onClose, leadToEdit }: Readonly<AddLeadModalProps>) {
  const { createLead, editLead } = useSalesStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [form, setForm] = useState({
    title: leadToEdit?.title || '',
    firstName: leadToEdit?.firstName || '',
    lastName: leadToEdit?.lastName || '',
    companyName: leadToEdit?.company || '',
    email: leadToEdit?.email || '',
    phone: leadToEdit?.phone || '',
    budget: leadToEdit?.budget || 0,
    priority: (leadToEdit?.priority || 'Medium') as 'Low' | 'Medium' | 'High' | 'Critical',
    notes: leadToEdit?.notes || '',
  });

  const [interestedServices, setInterestedServices] = useState<string[]>(leadToEdit?.interestedServices || []);

  // Mirrors what a visitor must fill in on the public "Book Free Growth Audit"
  // form (frontend/src/app/contact/page.tsx): Name, Company, and Email are
  // mandatory there too; Phone/Service/Budget/Message are optional on both.
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!form.title.trim()) errors.title = 'Lead Title is required.';
    if (!form.firstName.trim()) errors.firstName = 'Name is required.';
    if (!form.companyName.trim()) errors.companyName = 'Company name is required.';
    if (!form.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (form.phone.trim() && !PHONE_REGEX.test(form.phone.trim())) errors.phone = 'Enter a valid phone number (7-15 digits).';
    if (form.budget < 0) errors.budget = 'Budget cannot be negative.';
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const contactName = `${form.firstName} ${form.lastName}`.trim();

    try {
      const payload = {
        title: form.title,
        company_name: form.companyName || undefined,
        contact_name: contactName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        priority: form.priority,
        estimated_value: form.budget || undefined,
        notes: form.notes || undefined,
        interested_services: interestedServices.length > 0 ? interestedServices : undefined,
      };

      if (leadToEdit) {
        await editLead(leadToEdit.id, payload);
      } else {
        await createLead(payload);
      }
      onClose();
    } catch (err) {
      const actionText = leadToEdit ? 'save' : 'create';
      setError(err instanceof Error ? err.message : `Failed to ${actionText} lead. Please check the details and try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }} />
      
      {/* Modal Container (Scrollable) */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 animate-fade-in-up flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 text-lg" style={{ fontFamily: "'Sora', sans-serif" }}>
              {leadToEdit ? 'Edit Lead' : 'Add New Lead'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {leadToEdit ? 'Update the details for this pipeline lead' : 'Initialize a new opportunity in the pipeline'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle size={18} className="flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Lead Title */}
          <div>
            <label htmlFor="modal-lead-title" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Lead Title <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="modal-lead-title"
                type="text"
                required
                aria-required="true"
                placeholder="e.g. Website Overhaul Campaign, Custom Software retention"
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, title: undefined }));
                }}
                className={`w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 ${
                  fieldErrors.title ? 'border-red-400' : 'border-slate-200 focus:border-[#4C1D95]'
                }`}
              />
            </div>
            {fieldErrors.title && <p className="mt-1.5 text-xs text-red-500 font-medium">{fieldErrors.title}</p>}
          </div>

          {/* Name Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-first-name" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="modal-first-name"
                  type="text"
                  required
                  aria-required="true"
                  placeholder="John"
                  value={form.firstName}
                  onChange={(e) => {
                    setForm({ ...form, firstName: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                  }}
                  className={`w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 ${
                    fieldErrors.firstName ? 'border-red-400' : 'border-slate-200 focus:border-[#4C1D95]'
                  }`}
                />
              </div>
              {fieldErrors.firstName && <p className="mt-1.5 text-xs text-red-500 font-medium">{fieldErrors.firstName}</p>}
            </div>
            <div>
              <label htmlFor="modal-last-name" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Last Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="modal-last-name"
                  type="text"
                  placeholder="Doe"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
                />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-email" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="modal-email"
                  type="email"
                  required
                  aria-required="true"
                  placeholder="john.doe@company.com"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={`w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 ${
                    fieldErrors.email ? 'border-red-400' : 'border-slate-200 focus:border-[#4C1D95]'
                  }`}
                />
              </div>
              {fieldErrors.email && <p className="mt-1.5 text-xs text-red-500 font-medium">{fieldErrors.email}</p>}
            </div>
            <div>
              <label htmlFor="modal-phone" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Phone Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="modal-phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => {
                    setForm({ ...form, phone: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  className={`w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 ${
                    fieldErrors.phone ? 'border-red-400' : 'border-slate-200 focus:border-[#4C1D95]'
                  }`}
                />
              </div>
              {fieldErrors.phone && <p className="mt-1.5 text-xs text-red-500 font-medium">{fieldErrors.phone}</p>}
            </div>
          </div>

          {/* Company details & budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-company" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="modal-company"
                  type="text"
                  required
                  aria-required="true"
                  placeholder="Acme Corp"
                  value={form.companyName}
                  onChange={(e) => {
                    setForm({ ...form, companyName: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, companyName: undefined }));
                  }}
                  className={`w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 ${
                    fieldErrors.companyName ? 'border-red-400' : 'border-slate-200 focus:border-[#4C1D95]'
                  }`}
                />
              </div>
              {fieldErrors.companyName && <p className="mt-1.5 text-xs text-red-500 font-medium">{fieldErrors.companyName}</p>}
            </div>
            <div>
              <label htmlFor="modal-budget" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Monthly Budget (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                <input
                  id="modal-budget"
                  type="number"
                  min={0}
                  placeholder="50000"
                  value={form.budget || ''}
                  onChange={(e) => {
                    setForm({ ...form, budget: Number(e.target.value) });
                    setFieldErrors((prev) => ({ ...prev, budget: undefined }));
                  }}
                  className={`w-full pl-7 pr-3 py-2.5 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 ${
                    fieldErrors.budget ? 'border-red-400' : 'border-slate-200 focus:border-[#4C1D95]'
                  }`}
                />
              </div>
              {fieldErrors.budget && <p className="mt-1.5 text-xs text-red-500 font-medium">{fieldErrors.budget}</p>}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Priority Level</label>
            <div className="flex gap-2">
              {(['Low', 'Medium', 'High', 'Critical'] as const).map((lvl) => {
                const isActive = form.priority === lvl;
                let activeStyle = 'bg-slate-100 border-slate-200 text-slate-700 shadow-sm font-bold';
                if (lvl === 'Critical') {
                  activeStyle = 'bg-red-50 border-red-200 text-red-600 shadow-sm font-bold';
                } else if (lvl === 'High') {
                  activeStyle = 'bg-orange-50 border-orange-200 text-orange-600 shadow-sm font-bold';
                } else if (lvl === 'Medium') {
                  activeStyle = 'bg-amber-50 border-amber-200 text-amber-600 shadow-sm font-bold';
                }
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setForm({ ...form, priority: lvl })}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      isActive ? activeStyle : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interested Services */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Interested Services</label>
            <ServiceSelector
              selected={interestedServices}
              onChange={setInterestedServices}
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="modal-notes" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Initial Notes</label>
            <textarea
              id="modal-notes"
              placeholder="Provide background information, requirements or meeting notes..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] resize-none"
            />
          </div>

          {/* Footer Actions */}
          </div>
          {/* Bug 18 fixed: footer is outside the scrollable area so it stays visible */}
          <div className="flex gap-3 p-6 pt-4 border-t border-slate-100 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {leadToEdit ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                leadToEdit ? 'Save Changes' : 'Create Lead'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
