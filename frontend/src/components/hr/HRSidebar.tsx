'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import {
  LayoutDashboard, Briefcase, Users, Calendar, Award,
  BarChart2, Settings, LogOut, Zap, TrendingUp, Search, Menu
} from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useHrStore, useHrStats } from '@/store/hrStore';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/hr' },
  { icon: Briefcase, label: 'Job Openings', href: '/hr/jobs', badgeKey: 'activeJobs' },
  { icon: Users, label: 'Applications', href: '/hr/applications', badgeKey: 'newApplications' },
  { icon: Calendar, label: 'Interviews', href: '/hr/interviews', badgeKey: 'pendingInterviews' },
  { icon: Award, label: 'Offers', href: '/hr/offers', badgeKey: 'offerLettersSent' },
  { icon: BarChart2, label: 'Reports', href: '/hr/reports' },
  { icon: Settings, label: 'Settings', href: '/hr/settings' },
];

export function HRSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const stats = useHrStats();
  const { isSidebarOpen, setSidebarOpen } = useUiStore();
  const { user, logout, refreshToken } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const handleLogout = async () => {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // ignore - still clear local state
    } finally {
      logout();
      router.push('/login');
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`
        fixed md:sticky top-0 left-0 z-50 h-screen w-64 flex-shrink-0 bg-[#111827] flex flex-col overflow-hidden
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-[#1F2937]">
        <Logo size="sidebar" variant="white" href="/hr" />
      </div>

      {/* User Info */}
      <div className="px-4 py-3 border-b border-[#1F2937]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#EC4899] to-[#F43F5E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            HR
          </div>
          <div>
            <div className="text-white text-sm font-medium">{user?.name || 'HR Manager'}</div>
            <div className="text-[#4B5563] text-xs">{user?.designation || 'Talent Team'}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/hr' && pathname.startsWith(item.href));
          const badgeValue = item.badgeKey ? stats[item.badgeKey as keyof typeof stats] : 0;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all text-sm ${
                isActive
                  ? 'bg-[#EC4899] text-white'
                  : 'text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white'
              }`}
            >
              <item.icon size={17} className="flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {!!badgeValue && (
                <span className="bg-[#4C1D95] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {badgeValue}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[#1F2937] space-y-0.5">
        {isAdmin && (
          <>
            <Link href="/admin" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white text-sm">
              <Zap size={17} /> <span>Admin Portal</span>
            </Link>
            <Link href="/sales" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white text-sm">
              <TrendingUp size={17} /> <span>Sales Portal</span>
            </Link>
          </>
        )}
        <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-red-400 text-sm">
          <LogOut size={17} /> <span>Logout</span>
        </button>
      </div>
    </aside>
    </>
  );
}
