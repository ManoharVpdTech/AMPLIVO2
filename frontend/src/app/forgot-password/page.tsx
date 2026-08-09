'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { authService } from '@/services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await authService.forgotPassword(email);
      setIsSubmitted(true);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Failed to send reset link. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#F8F9FA]">
      {/* Vibrant Premium Background Mesh */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] max-w-[800px] max-h-[800px] bg-gradient-to-br from-[#4C1D95]/40 to-[#7C3AED]/40 rounded-full blur-[100px]" />
        <div className="absolute top-[10%] -right-[10%] w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-gradient-to-bl from-[#06B6D4]/30 to-[#3B82F6]/30 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[20%] left-[10%] w-[60vw] h-[60vw] max-w-[900px] max-h-[900px] bg-gradient-to-tr from-[#EC4899]/30 to-[#F43F5E]/30 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[50px]" />
      </div>

      {/* Centered Card */}
      <div className="relative w-full max-w-[400px] bg-white rounded-2xl shadow-[0_8px_40px_rgb(0,0,0,0.04)] border border-slate-100 p-8 z-10">
        
        {/* Back to login */}
        <Link href="/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium mb-6">
          <ArrowLeft size={16} />
          Back to login
        </Link>

        {/* Logo & Header */}
        <div className="text-center mb-8">
          <Logo size="auth" href="/" className="inline-flex items-center justify-center mb-4" />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
            Reset your password
          </h1>
          <p className="text-slate-500 text-sm">
            {!isSubmitted 
              ? "Enter your email address and we'll send you a link to reset your password."
              : "Check your email for the reset link!"}
          </p>
        </div>

        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label htmlFor="forgot-email" className="block text-[13px] font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                id="forgot-email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="name@company.com"
                aria-describedby={error ? "forgot-email-error" : undefined}
                className={`w-full bg-white border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#4C1D95] focus:border-[#4C1D95] transition-shadow shadow-sm ${error ? 'border-red-300' : 'border-slate-200'}`}
              />
              {error && (
                <p id="forgot-email-error" role="alert" className="text-red-500 text-xs flex items-center gap-1 mt-1">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email}
              className="w-full flex items-center justify-center gap-2 bg-[#4C1D95] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#3b1574] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm active:scale-[0.98] mt-2"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Send reset link'
              )}
            </button>
          </form>
        ) : (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-1">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="text-emerald-800 font-semibold text-sm mb-1">Email Sent</h3>
              <p className="text-emerald-600 text-xs">
                We&apos;ve sent an email to <strong>{email}</strong> with instructions to reset your password.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
