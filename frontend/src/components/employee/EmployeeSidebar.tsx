'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import {
  LayoutDashboard, FolderKanban, CheckSquare, UploadCloud, Bell, User, Settings, LogOut, Zap
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useCrmStore } from '@/store/crmStore';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/employee' },
  { icon: FolderKanban, label: 'My Projects', href: '/employee/projects' },
  { icon: CheckSquare, label: 'My Tasks', href: '/employee/tasks' },
  { icon: UploadCloud, label: 'Submit Work', href: '/employee/submit' },
  { icon: Bell, label: 'Notifications', href: '/employee/notifications' },
  { icon: User, label: 'Profile', href: '/employee/profile' },
];

export function EmployeeSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeEmployeeId, getEmployeeById } = useCrmStore();
  const employee = getEmployeeById(activeEmployeeId || '');
  const { isSidebarOpen, setSidebarOpen } = useUiStore();
  const { logout, refreshToken } = useAuthStore();

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
        <Logo size="sidebar" variant="white" href="/employee" />
      </div>

      {/* User Info */}
      <div className="px-5 py-4 border-b border-[#1F2937]">
        <div className="flex items-center gap-3">
          <Avatar name={employee ? `${employee.firstName} ${employee.lastName}` : 'Employee'} size="sm" />
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold truncate">{employee ? `${employee.firstName} ${employee.lastName}` : 'Employee'}</div>
            <div className="text-[#4B5563] text-xs truncate">{employee?.designation || 'Staff'}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/employee');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all text-sm ${
                isActive
                  ? 'bg-[#4C1D95] text-white'
                  : 'text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white'
              }`}
            >
              <item.icon size={17} className="flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-[#1F2937]">
        <div className="flex gap-2">
          <button type="button" onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-red-400 transition-all text-xs flex-1">
            <LogOut size={14} /> Sign Out
          </button>
          <Link href="/employee/settings" className={`flex items-center justify-center w-9 h-9 rounded-[10px] transition-all ${pathname === '/employee/settings' ? 'bg-[#4C1D95] text-white' : 'text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white'}`}>
            <Settings size={15} />
          </Link>
        </div>
      </div>
    </aside>
    </>
  );
}
