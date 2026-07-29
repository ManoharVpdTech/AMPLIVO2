'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import {
  LayoutDashboard, Users, FolderKanban, UserCheck,
  FileText, CreditCard, Bell, BarChart3, Settings,
  LogOut, Menu, X, ChevronRight, Briefcase,
  Building2, CheckCircle, ClipboardCheck,
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const navItems = [
  { href: '/crm/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/crm/leads', label: 'Leads', icon: Users },
  { href: '/crm/clients', label: 'Clients', icon: Building2 },
  { href: '/crm/projects', label: 'Projects', icon: FolderKanban },
  { href: '/crm/employees', label: 'Employees', icon: UserCheck },
  { href: '/crm/submissions', label: 'Submissions', icon: ClipboardCheck },
  { href: '/crm/invoices', label: 'Invoices', icon: FileText },
  { href: '/crm/payments', label: 'Payments', icon: CreditCard },
  { href: '/crm/notifications', label: 'Notifications', icon: Bell, badge: true },
  { href: '/crm/reports', label: 'Reports', icon: BarChart3 },
  { href: '/crm/settings', label: 'Settings', icon: Settings },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const getUnreadCount = useCrmStore(s => s.getUnreadCount);
  const fetchAllData = useCrmStore(s => s.fetchAllData);
  const unread = getUnreadCount();
  const { user, logout, refreshToken } = useAuthStore();

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // ignore — still clear local state
    } finally {
      logout();
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'crm', 'finance']}>
    <div className="flex h-screen bg-[#0d0f17] overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col bg-[#12141f] border-r border-white/5 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <Logo size="sidebar" variant="white" href="/crm" />
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User */}
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name?.charAt(0) ?? 'C'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.name ?? 'CRM Admin'}</p>
              <p className="text-slate-500 text-[10px] truncate">{user?.email ?? 'crm@amplivo.in'}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || (pathname.startsWith(href + '/') && href !== '/crm/dashboard');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                  active
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className="flex-1">{label}</span>
                {badge && unread > 0 && (
                  <span className="bg-violet-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
                {active && <ChevronRight className="w-3 h-3 text-violet-500 shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-white/5 space-y-1">
          <Link
            href="/sales"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all group"
          >
            <CheckCircle className="w-4 h-4 text-emerald-500 group-hover:text-emerald-400" />
            <span>Sales Portal</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#12141f]/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
              <span className="text-slate-300">CRM</span>
              {pathname !== '/crm' && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-violet-400 capitalize">
                    {pathname.split('/').slice(2).join(' / ').replace(/-/g, ' ')}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/crm/notifications" className="relative p-2 text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-violet-500 rounded-full ring-2 ring-[#12141f]" />
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
    </ProtectedRoute>
  );
}
