'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Logo } from '@/components/ui/Logo';
import { Zap, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

const registerSchema = z.object({
  full_name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  username: z.string().min(3, { message: 'Username must be at least 3 characters' }).regex(/^[a-zA-Z0-9_.]+$/, { message: 'Username can only contain letters, numbers, underscores, and dots' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }).regex(/[a-zA-Z]/, { message: 'Password must contain at least one letter' }).regex(/[0-9]/, { message: 'Password must contain at least one digit' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [showPassword, setShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setRegisterError(null);
    try {
      const user = await authService.register({
        email: data.email,
        username: data.username,
        full_name: data.full_name,
        password: data.password,
      });

      // Auto-login after registration
      const response = await authService.login({
        identifier: data.email,
        password: data.password,
      });
      login(response.user, response.access_token, response.refresh_token);

      if (response.user.role === 'admin') {
        router.push('/admin');
      } else if (response.user.role === 'sales') {
        router.push('/sales');
      } else if (response.user.role === 'hr') {
        router.push('/hr');
      } else if (response.user.role === 'employee') {
        router.push('/employee');
      } else {
        router.push('/portal');
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { detail?: string; message?: string } }; message?: string };
      const apiMessage = axiosError?.response?.data?.message || axiosError?.response?.data?.detail;
      if (apiMessage) {
        setRegisterError(apiMessage);
      } else if (!axiosError?.response) {
        setRegisterError('Network error. Please check your connection and try again.');
      } else if (axiosError?.response?.status === 500) {
        setRegisterError('Server error. Please try again in a moment.');
      } else {
        setRegisterError('Registration failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — Form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-white">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Logo size="auth" href="/" className="flex items-center mb-8" />

          {/* Mobile-only Brand Banner */}
          <div className="lg:hidden bg-gradient-to-br from-[#4C1D95] to-[#06B6D4] rounded-2xl p-6 text-white mb-8 relative overflow-hidden shadow-md">
            <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="relative">
              <h2 className="text-xl font-bold mb-2 tracking-tight">Start Your Growth Journey</h2>
              <p className="text-white/80 text-sm leading-relaxed">Access powerful CRM tools, manage projects, and collaborate from a single platform.</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
            Create an account
          </h1>
          <p className="text-slate-500 mb-8">Join Amplivo to get started</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {registerError && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200">
                {registerError}
              </div>
            )}

            <div>
              <label htmlFor="register-fullname" className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="register-fullname"
                aria-describedby={errors.full_name ? "register-fullname-error" : undefined}
                {...register('full_name')}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] ${
                  errors.full_name ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="John Doe"
                pattern="[A-Za-z\s]+"
                title="Only letters and spaces are allowed"
              />
              {errors.full_name && <p id="register-fullname-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.full_name.message}</p>}
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
              <input
                type="email"
                id="register-email"
                aria-describedby={errors.email ? "register-email-error" : undefined}
                {...register('email')}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] ${
                  errors.email ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="john@example.com"
              />
              {errors.email && <p id="register-email-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="register-username" className="block text-sm font-medium text-slate-700 mb-1.5">Username <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="register-username"
                aria-describedby={errors.username ? "register-username-error" : undefined}
                {...register('username')}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] ${
                  errors.username ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="john_doe"
              />
              {errors.username && <p id="register-username-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.username.message}</p>}
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-slate-700 mb-1.5">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="register-password"
                  aria-describedby={errors.password ? "register-password-error" : undefined}
                  {...register('password')}
                  className={`w-full border rounded-xl px-4 py-3 text-sm pr-11 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] ${
                    errors.password ? 'border-red-300' : 'border-slate-200'
                  }`}
                  placeholder="Min 8 chars, 1 letter, 1 number"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p id="register-password-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="register-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
              <input
                type="password"
                id="register-confirm"
                aria-describedby={errors.confirmPassword ? "register-confirm-error" : undefined}
                {...register('confirmPassword')}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] ${
                  errors.confirmPassword ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="Confirm your password"
              />
              {errors.confirmPassword && <p id="register-confirm-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.confirmPassword.message}</p>}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-[#4C1D95] text-white font-semibold py-3.5 rounded-xl hover:bg-[#3b1574] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Creating Account...
                  </>
                ) : (
                  <>
                    Create Account <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-[#4C1D95] font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>

      {/* Right — Brand Visual */}
      <div
        className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 60%, #06B6D4 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative">
          <div className="text-white text-xs font-semibold uppercase tracking-widest opacity-70 mb-8">Welcome to Amplivo</div>
          <h2 className="text-4xl font-bold text-white leading-tight max-w-xs mb-6" style={{ fontFamily: "'Sora', sans-serif" }}>
            Start Your Growth Journey
          </h2>
          <p className="text-white/70 max-w-xs leading-relaxed">
            Access powerful CRM tools, manage projects, track campaigns, and collaborate with your team — all from a single platform.
          </p>
        </div>

        <div className="relative space-y-3">
          {[
            { label: 'CRM Management', value: 'Lead to client' },
            { label: 'Project Tracking', value: 'Real-time' },
            { label: 'Team Collaboration', value: 'Built-in' },
          ].map((item) => (
            <div key={item.label} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-white/70 text-sm">{item.label}</span>
              <span className="text-white font-semibold text-sm">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
