'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { MapPin, Mail, Clock, ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { PageHero } from '@/components/marketing/PageHero';
import { contactHero } from '@/data/heroConfigs';
import { consultationService } from '@/services/moduleServices';
import { useToastStore } from '@/store/toastStore';

const AnimateOnScroll = dynamic(() => import('@/components/AnimateOnScroll').then(mod => mod.AnimateOnScroll), { ssr: true });
const PhoneInput = dynamic(() => import('@/components/ui/PhoneInput').then(mod => mod.PhoneInput), { ssr: false, loading: () => <div className="h-12 w-full border border-slate-200 rounded-xl bg-slate-50 animate-pulse" /> });


const offices = [
  { city: 'Hyderabad', address: 'Hi-Tech City, Hyderabad, Telangana 500081', email: 'hyderabad@amplivo.in', flag: '🇮🇳', primary: true },
  { city: 'Bengaluru', address: 'Indiranagar, Bengaluru, Karnataka 560038', email: 'bengaluru@amplivo.in', flag: '🇮🇳', primary: false },
  { city: 'Mumbai', address: 'Andheri West, Mumbai, Maharashtra 400053', email: 'mumbai@amplivo.in', flag: '🇮🇳', primary: false },
  { city: 'Dubai', address: 'Business Bay, Dubai, UAE', email: 'dubai@amplivo.in', flag: '🇦🇪', primary: false },
];

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  service_interest: string;
  budget_range: string;
  message: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  service_interest: '',
  budget_range: '',
  message: '',
};

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.email.trim()) {
      errs.email = 'Business email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Please enter a valid email address';
    }
    if (!form.phone.trim()) errs.phone = 'Phone number is required';
    if (!form.service_interest.trim()) errs.service_interest = 'Please select a service';
    if (!form.budget_range.trim()) errs.budget_range = 'Please select a budget range';
    if (!form.message.trim()) errs.message = 'Message is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof FormState]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // Prevent duplicate submissions
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      // 10s network timeout protection
      const submitPromise = consultationService.submit({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        service_interest: form.service_interest || undefined,
        budget_range: form.budget_range || undefined,
        message: form.message.trim() || undefined,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your network connection.')), 10000)
      );

      await Promise.race([submitPromise, timeoutPromise]);

      setSubmitted(true);
      setForm(EMPTY_FORM);
      useToastStore.getState().showToast('Free Growth Audit request submitted successfully!', 'success');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const errorMessage =
        axiosErr?.response?.data?.detail ||
        axiosErr?.response?.data?.message ||
        axiosErr?.message ||
        'Unable to submit request due to a network error. Please try again.';

      setError(errorMessage);
      useToastStore.getState().showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false); // Ensure loading indicator is always cleared
    }
  };

  return (
    <main id="main-content">
      <Navbar />

      <PageHero config={contactHero} />

      {/* Contact Form + Info */}
      <section className="relative py-24 bg-[#F9FAFB] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4C1D95 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Form */}
            <AnimateOnScroll animation="fade-right">
              <div className="relative z-10 bg-white/80 backdrop-blur-xl rounded-2xl p-8 border border-white/80 shadow-2xl">
                <h2 className="text-2xl font-bold text-slate-900 mb-6" style={{ fontFamily: "'Sora', sans-serif" }}>
                  Book Free Growth Audit
                </h2>

                {submitted ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                      <CheckCircle size={32} className="text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Request Submitted!</h3>
                    <p className="text-slate-500 max-w-xs">
                      Thank you! We&apos;ll review your request and get back to you within 4 business hours.
                    </p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="mt-2 px-5 py-2.5 bg-[#4C1D95] text-white text-sm font-semibold rounded-xl hover:bg-[#3b1574] transition-colors"
                    >
                      Submit Another Request
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    {error && (
                      <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                        {error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          id="contact-name"
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Rajesh Kumar"
                          pattern="[A-Za-z\s]+"
                          title="Only letters and spaces are allowed"
                          aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
                          className={`w-full bg-white/50 backdrop-blur-sm border rounded-xl px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#4C1D95]/10 focus:border-[#4C1D95] transition-all ${fieldErrors.name ? 'border-red-300' : 'border-slate-200'}`}
                        />
                        {fieldErrors.name && <p id="contact-name-error" role="alert" className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>}
                      </div>
                      <div>
                        <label htmlFor="contact-company" className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
                        <input
                          type="text"
                          id="contact-company"
                          name="company"
                          value={form.company}
                          onChange={handleChange}
                          placeholder="Company Name"
                          aria-describedby={fieldErrors.company ? "contact-company-error" : undefined}
                          className={`w-full bg-white/50 backdrop-blur-sm border rounded-xl px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#4C1D95]/10 focus:border-[#4C1D95] transition-all ${fieldErrors.company ? 'border-red-300' : 'border-slate-200'}`}
                        />
                        {fieldErrors.company && <p id="contact-company-error" role="alert" className="text-red-500 text-xs mt-1">{fieldErrors.company}</p>}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700 mb-1.5">Business Email <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        id="contact-email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="rajesh@company.in"
                        aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
                        className={`w-full bg-white/50 backdrop-blur-sm border rounded-xl px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#4C1D95]/10 focus:border-[#4C1D95] transition-all ${fieldErrors.email ? 'border-red-300' : 'border-slate-200'}`}
                      />
                      {fieldErrors.email && <p id="contact-email-error" role="alert" className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
                    </div>

                    <div>
                      <label htmlFor="contact-phone" className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                      <div aria-describedby={fieldErrors.phone ? "contact-phone-error" : undefined}>
                        <PhoneInput
                          id="contact-phone"
                          value={form.phone}
                          onChange={(val) => {
                            setForm(prev => ({ ...prev, phone: val || '' }));
                            if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                          }}
                          error={!!fieldErrors.phone}
                        />
                      </div>
                      {fieldErrors.phone && <p id="contact-phone-error" role="alert" className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>}
                    </div>

                    <div>
                      <label htmlFor="contact-service" className="block text-sm font-medium text-slate-700 mb-1.5">Service Required <span className="text-red-500">*</span></label>
                      <select
                        id="contact-service"
                        name="service_interest"
                        value={form.service_interest}
                        onChange={handleChange}
                        aria-describedby={fieldErrors.service_interest ? "contact-service-error" : undefined}
                        className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] bg-white ${fieldErrors.service_interest ? 'border-red-300' : 'border-slate-200'}`}
                      >
                        <option value="">Select a service...</option>
                        <option>Social Media Marketing</option>
                        <option>Performance Marketing</option>
                        <option>SEO</option>
                        <option>Branding & Creative</option>
                        <option>Content Marketing</option>
                        <option>Lead Generation</option>
                        <option>Website Development</option>
                        <option>Marketing Automation</option>
                        <option>Influencer Marketing</option>
                        <option>Video Marketing</option>
                        <option>Full-Service Package</option>
                      </select>
                      {fieldErrors.service_interest && <p id="contact-service-error" role="alert" className="text-red-500 text-xs mt-1">{fieldErrors.service_interest}</p>}
                    </div>

                    <div>
                      <label htmlFor="contact-budget" className="block text-sm font-medium text-slate-700 mb-1.5">Monthly Budget Range <span className="text-red-500">*</span></label>
                      <select
                        id="contact-budget"
                        name="budget_range"
                        value={form.budget_range}
                        onChange={handleChange}
                        aria-describedby={fieldErrors.budget_range ? "contact-budget-error" : undefined}
                        className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] bg-white ${fieldErrors.budget_range ? 'border-red-300' : 'border-slate-200'}`}
                      >
                        <option value="">Select budget...</option>
                        <option>₹25,000 – ₹50,000</option>
                        <option>₹50,000 – ₹1,00,000</option>
                        <option>₹1,00,000 – ₹2,50,000</option>
                        <option>₹2,50,000 – ₹5,00,000</option>
                        <option>₹5,00,000+</option>
                      </select>
                      {fieldErrors.budget_range && <p id="contact-budget-error" role="alert" className="text-red-500 text-xs mt-1">{fieldErrors.budget_range}</p>}
                    </div>

                    <div>
                      <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700 mb-1.5">Message <span className="text-red-500">*</span></label>
                      <textarea
                        id="contact-message"
                        name="message"
                        value={form.message}
                        onChange={handleChange}
                        rows={4}
                        placeholder="Tell us about your business and marketing goals..."
                        aria-describedby={fieldErrors.message ? "contact-message-error" : undefined}
                        className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] resize-none ${fieldErrors.message ? 'border-red-300' : 'border-slate-200'}`}
                      />
                      {fieldErrors.message && <p id="contact-message-error" role="alert" className="text-red-500 text-xs mt-1">{fieldErrors.message}</p>}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 bg-[#4C1D95] text-white font-semibold py-3.5 rounded-xl hover:bg-[#3b1574] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Submitting...
                        </>
                      ) : (
                        <>
                          Book Free Growth Audit <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                    <p className="text-xs text-slate-400 text-center">We respond within 4 business hours. No spam, ever.</p>
                  </form>
                )}
              </div>
            </AnimateOnScroll>

            {/* Info */}
            <AnimateOnScroll animation="fade-left">
              <div className="space-y-6">
                {/* Availability */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200">
                  <h3 className="font-semibold text-slate-900 mb-4">Reach Us Directly</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Mail size={16} className="text-[#4C1D95] flex-shrink-0" />
                      <a href="mailto:hello@amplivo.in" className="hover:text-[#4C1D95]">hello@amplivo.in</a>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Clock size={16} className="text-[#4C1D95] flex-shrink-0" />
                      <span>Mon – Sat, 9:00 AM – 7:00 PM IST</span>
                    </div>
                  </div>
                </div>

                {/* What to Expect */}
                <div className="bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] rounded-2xl p-6 text-white">
                  <h3 className="font-semibold text-lg mb-4">What to Expect from Your Free Audit</h3>
                  <div className="space-y-3">
                    {[
                      'Comprehensive review of your current digital presence',
                      'Competitor analysis and gap identification',
                      'Customised marketing strategy recommendation',
                      'Budget optimisation guidance',
                      'Clear 90-day action plan',
                      'No pressure, no obligation',
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-sm text-white/85">
                        <span className="text-[#06B6D4] font-bold flex-shrink-0">✓</span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Offices */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {offices.map((o) => (
                    <div key={o.city} className={`bg-white rounded-xl p-4 border ${o.primary ? 'border-[#4C1D95]/30' : 'border-slate-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{o.flag}</span>
                        <span className="font-semibold text-slate-900 text-sm">{o.city}</span>
                        {o.primary && <span className="text-[10px] bg-[#4C1D95]/10 text-[#4C1D95] px-1.5 py-0.5 rounded-full font-semibold">HQ</span>}
                      </div>
                      <p className="text-slate-500 text-[11px] leading-tight">{o.address}</p>
                    </div>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
