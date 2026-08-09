'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import {
  LayoutDashboard, Users, CalendarDays, BarChart2,
  Settings, LogOut, Zap, Bell, Receipt, Briefcase, Menu, UserCircle, ChevronDown
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { Avatar } from '@/components/ui/Avatar';
import { useUiStore } from '@/store/uiStore';
import { useSalesStore } from '@/store/salesStore';
import { isMeetingUpcoming } from '@/lib/utils';

// Bug 1 fixed: removed hardcoded badge values; badges are now computed dynamically in SalesSidebar
const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/sales' },
  { icon: Users, label: 'Leads', href: '/sales/leads' },
  { icon: CalendarDays, label: 'Meetings', href: '/sales/meetings' },
  { icon: CalendarDays, label: 'Calendar', href: '/sales/calendar' },
  { icon: Receipt, label: 'Invoices', href: '/sales/invoices' },
  { icon: BarChart2, label: 'Reports', href: '/sales/reports' },
];

interface SalesHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export function SalesHeader({ title, subtitle, badge, actions }: SalesHeaderProps) {
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUiStore();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title?: string; message: string; is_read: boolean; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    import('@/services/crmService').then(({ notificationService }) => {
      notificationService
        .getAll({ page_size: 10 })
        .then((res) => {
          if (!cancelled) setNotifications(res?.items ?? []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = async (id: string) => {
    const { notificationService } = await import('@/services/crmService');
    try {
      await notificationService.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // ignore
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0 sticky top-0 z-10 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button 
          onClick={toggleSidebar}
          className="md:hidden text-slate-500 hover:text-slate-900 focus:outline-none shrink-0"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-bold text-slate-900 truncate" style={{ fontFamily: "'Sora', sans-serif" }}>{title}</h1>
            {badge && (
              <span className="hidden sm:inline-block text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-0.5 rounded-full font-semibold shrink-0">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {actions}
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="relative w-9 h-9 rounded-[10px] bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EC4899] text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">Notifications</span>
                {/* Stay inside the Sales portal - the CRM notifications page is a
                    different context (different layout, different data scope). */}
                <Link href="/sales/notifications" className="text-xs text-[#4C1D95] hover:underline" onClick={() => setOpen(false)}>
                  View all
                </Link>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <p className="text-xs text-slate-400 text-center py-6">Loading...</p>
                ) : notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No notifications</p>
                ) : (
                  notifications.slice(0, 6).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleMarkRead(n.id)}
                      className="w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 flex gap-2"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.is_read ? 'bg-slate-300' : 'bg-amber-500'}`} />
                      <div className="min-w-0">
                         <p className="text-xs text-slate-700 line-clamp-2">{n.title ? `${n.title}: ` : ''}{n.message}</p>
                         <p className="text-[10px] text-slate-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-1.5"
            title={user?.name ?? 'Sales Admin'}
          >
            <Avatar name={user?.name ?? 'Sales Admin'} image={user?.image} size="sm" />
            <ChevronDown size={14} className="hidden sm:block text-slate-400" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-20">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900 truncate">{user?.name ?? 'Sales Admin'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email ?? ''}</p>
              </div>
              <Link
                href="/sales/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <UserCircle size={15} /> My Profile
              </Link>
              <Link
                href="/sales/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Settings size={15} /> Account Settings
              </Link>
              <button
                onClick={() => { logout(); window.location.href = '/login'; }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-slate-100"
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function SalesSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarOpen, setSidebarOpen } = useUiStore();
  const { leads, meetings, fetchLeads } = useSalesStore();
  // Bug 2 fixed: use logout from authStore instead of plain /login link
  const { user, logout, refreshToken } = useAuthStore();

  const userName = user?.name ?? 'Shreya Agarwal';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SA';

  useEffect(() => {
    if (leads.length === 0) {
      fetchLeads();
    }
  }, [leads.length, fetchLeads]);

  // Calculate this month's stats dynamically
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const thisMonthLeads = leads.filter((l) => {
    if (!l.createdAt) return false;
    const d = new Date(l.createdAt);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const leadsCount = thisMonthLeads.length;
  const wonCount = thisMonthLeads.filter((l) => l.status === 'Won' || l.status === 'Ready for CRM').length;
  const pipelineVal = thisMonthLeads
    .filter((l) => !['Lost', 'Ready for CRM'].includes(l.status))
    .reduce((sum, l) => sum + l.budget, 0);

  const formatPipeline = (val: number) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)}L`;
    }
    return `₹${(val / 1000).toFixed(0)}K`;
  };

  // Bug 1 fixed: compute dynamic badge counts
  const scheduledMeetingsCount = meetings.filter(isMeetingUpcoming).length;

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
        <Logo size="sidebar" variant="white" href="/sales" />
      </div>

      {/* User Info */}
      <Link
        href="/sales/profile"
        className="block px-4 py-3 border-b border-[#1F2937] hover:bg-[#1F2937]/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userInitials}
          </div>
          <div>
            <div className="text-white text-sm font-medium">{userName}</div>
            <div className="text-[#4B5563] text-xs">Sales Admin</div>
          </div>
        </div>
      </Link>

      {/* Pipeline Status Strip */}
      <div className="mx-3 mt-3 mb-1 bg-[#1F2937] rounded-xl p-3">
        <div className="text-[#9CA3AF] text-[10px] font-semibold uppercase tracking-wider mb-2">This Month</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-white text-sm font-bold">{leadsCount}</div>
            <div className="text-[#6B7280] text-[9px]">Leads</div>
          </div>
          <div>
            <div className="text-emerald-400 text-sm font-bold">{wonCount}</div>
            <div className="text-[#6B7280] text-[9px]">Won</div>
          </div>
          <div>
            <div className="text-violet-400 text-sm font-bold">{formatPipeline(pipelineVal)}</div>
            <div className="text-[#6B7280] text-[9px]">Pipeline</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <div className="text-[#4B5563] text-[10px] font-semibold uppercase tracking-wider px-3 py-2">Navigation</div>
        {navItems.map((item) => {
          const isActive = item.href === '/sales' ? pathname === '/sales' : pathname.startsWith(item.href);
          // Nav badges are reserved for counts that need action (e.g. upcoming
          // meetings) - the Leads item intentionally has none, since the total
          // lead count isn't an actionable number and duplicates what the
          // Leads page itself already shows.
          let dynamicBadge: string | null = null;
          if (item.href === '/sales/meetings' && scheduledMeetingsCount > 0) {
            dynamicBadge = String(scheduledMeetingsCount);
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all text-sm ${
                isActive
                  ? 'bg-[#4C1D95] text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white'
              }`}
            >
              <item.icon size={17} className="flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {dynamicBadge && (
                <span className="bg-[#EC4899] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {dynamicBadge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Switch to Admin + Bottom */}
      <div className="px-3 py-4 border-t border-[#1F2937] space-y-0.5">
        {user?.role === 'admin' && (
          <>
            <div className="px-3 pb-1 text-[#4B5563] text-[10px] font-semibold uppercase tracking-wider">System Admin</div>
            <Link href="/admin" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white text-sm transition-all">
              <Zap size={17} /> <span>Admin ERP</span>
            </Link>
          </>
        )}
        <Link href="/crm" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white text-sm transition-all">
          <Briefcase size={17} /> <span>CRM Portal</span>
        </Link>
        <Link href="/sales/settings" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white text-sm transition-all">
          <Settings size={17} /> <span>Settings</span>
        </Link>
        {/* Bug 2 fixed: call logout() then redirect, instead of bare /login link */}
        <button
          type="button"
          onClick={async () => { try { if (refreshToken) await authService.logout(refreshToken); } catch {} finally { logout(); router.push('/login'); } }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-red-400 text-sm transition-all"
        >
          <LogOut size={17} /> <span>Logout</span>
        </button>
      </div>
    </aside>
    </>
  );
}
