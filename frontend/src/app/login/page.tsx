'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import * as z from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoginError(null);
    try {
      const response = await authService.login({ identifier: data.email, password: data.password });
      login(response.user, response.access_token, response.refresh_token);
      
      // Redirect based on role
      if (response.user.role === 'admin') {
        router.push('/admin');
      } else if (response.user.role === 'sales') {
        router.push('/sales');
      } else if (response.user.role === 'hr') {
        router.push('/hr');
      } else if (response.user.role === 'employee') {
        router.push('/employee');
      } else if (response.user.role === 'crm') {
        router.push('/crm');
      } else {
        router.push('/portal');
      }
    } catch (error: unknown) {
      if (!isAxiosError<{ detail?: string; message?: string }>(error)) {
        setLoginError('Network error. Please try again.');
        return;
      }
      const apiMessage = error.response?.data?.message || error.response?.data?.detail;
      if (apiMessage) {
        setLoginError(apiMessage);
      } else if (!error.response) {
        setLoginError('Network error. Please try again.');
      } else if (error.response.status === 500) {
        setLoginError('Server error. The backend may have a database connection issue.');
      } else {
        setLoginError('Invalid email or password. Please try again.');
      }
    }
  };

  const setDemoCredentials = (role: 'client' | 'admin' | 'sales' | 'hr' | 'employee' | 'crm') => {
    setValue('email', role === 'crm' ? 'crm@amplivo.in' : `${role}@amplivo.in`);
    const passwords: Record<string, string> = {
      admin: 'Admin@123',
      client: 'Client@123',
      sales: 'Sales@123',
      hr: 'Hr@12345',
      employee: 'Employee@123',
      crm: 'Crm@1234',
    };
    setValue('password', passwords[role]);
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

      {/* Centered Login Card */}
      <div className="relative w-full max-w-[400px] bg-white rounded-2xl shadow-[0_8px_40px_rgb(0,0,0,0.04)] border border-slate-100 p-8 z-10">
        
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <Logo size="login" href="/" className="inline-flex items-center justify-center mb-4" />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
            Welcome to Amplivo
          </h1>
        </div>

        {/* Demo credentials */}
        <div className="mb-6 bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex flex-col gap-3">
          <div className="text-[10px] font-semibold text-[#4C1D95] text-left">Demo Credentials (Click to fill)</div>
          <div className="flex flex-wrap gap-1.5">
            {['client', 'admin', 'sales', 'hr', 'crm'].map((role) => (
              <button 
                key={role}
                type="button" 
                onClick={() => setDemoCredentials(role as any)} 
                className="flex-1 min-w-[60px] px-2 py-1.5 text-[10px] font-semibold text-slate-600 capitalize bg-white border border-slate-200 rounded-lg hover:border-[#4C1D95] hover:text-[#4C1D95] transition-colors"
              >
                {role} Demo
              </button>
            ))}
          </div>
          <select 
            className="w-full text-xs font-medium text-slate-700 bg-white border border-[#4C1D95] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#4C1D95]/20 transition-all appearance-none cursor-pointer"
            onChange={(e) => {
              if (!e.target.value) return;
              const slug = e.target.value.toLowerCase().replace(/[\s\/]+/g, '');
              setValue('email', `${slug}@amplivo.in`);
              setValue('password', 'Employee@123');
            }}
            defaultValue=""
          >
            <option value="" disabled>Select an Employee Role Demo...</option>
            {[
              'Digital Marketing Strategist',
              'SEO Specialist',
              'Performance Marketer',
              'Social Media Manager',
              'Content Writer',
              'Graphic Designer',
              'Video Editor',
              'UI/UX Designer',
              'Web Developer',
              'Data Analyst',
              'Campaign Manager',
              'Account Manager',
              'Influencer Manager',
              'Sales Executive',
              'Client Success Manager'
            ].map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {loginError && (
            <div className="bg-red-50 text-red-600 text-[13px] px-3 py-2 rounded-lg border border-red-100 text-center">
              {loginError}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-slate-700">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              placeholder="you@company.com"
              {...register('email')}
              className={`w-full bg-white border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#4C1D95] focus:border-[#4C1D95] transition-shadow shadow-sm ${
                errors.email ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
          </div>
          
          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className={`w-full bg-white border rounded-lg px-3 py-2.5 text-sm pr-9 focus:outline-none focus:ring-1 focus:ring-[#4C1D95] focus:border-[#4C1D95] transition-shadow shadow-sm ${
                  errors.password ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
          </div>

          <div className="flex items-center justify-between text-[13px] pt-1 pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('rememberMe')} className="rounded border-slate-300 text-[#4C1D95] focus:ring-[#4C1D95]" />
              <span className="text-slate-600">Remember me</span>
            </label>
            <Link href="/forgot-password" className="text-[#4C1D95] font-medium hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-[#4C1D95] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#3b1574] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm active:scale-[0.98]"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
