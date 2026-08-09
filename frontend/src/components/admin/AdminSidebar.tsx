'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import {
  LayoutDashboard, Users, Target, UserCheck, Megaphone, FolderKanban,
  CheckSquare, DollarSign, BarChart2, Shield, Settings, LogOut, Zap,
  Calendar, Search, Image as ImageIcon, Star, Bell, Search as SearchIcon,
  TrendingUp, Briefcase, Menu, CheckCheck
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { useUiStore } from '@/store/uiStore';
import { campaignService } from '@/services/campaignService';
import { creativeService } from '@/services';

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  badge?: string;
}

const defaultNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
  { icon: Users, label: 'CRM', href: '/admin/crm' },
  { icon: Target, label: 'Leads', href: '/admin/leads' },
  { icon: UserCheck, label: 'Clients', href: '/admin/clients' },
  { icon: Megaphone, label: 'Campaigns', href: '/admin/campaigns' },
  { icon: FolderKanban, label: 'Projects', href: '/admin/projects' },
  { icon: CheckSquare, label: 'Tasks', href: '/admin/tasks' },
  { icon: Calendar, label: 'Social Calendar', href: '/admin/social-calendar' },
  { icon: Search, label: 'SEO Projects', href: '/admin/seo-projects' },
  { icon: ImageIcon, label: 'Creative Approval', href: '/admin/creatives' },
  { icon: Star, label: 'Influencers', href: '/admin/influencers' },
  { icon: Users, label: 'Team', href: '/admin/team' },
  { icon: DollarSign, label: 'Finance', href: '/admin/finance' },
  { icon: BarChart2, label: 'Reports', href: '/admin/reports' },
  { icon: TrendingUp, label: 'Analytics', href: '/admin/analytics' },
  { icon: Shield, label: 'Roles & Perms', href: '/admin/roles' },
];

// Hook to fetch dynamic sidebar badge counts from backend
function useAdminSidebarCounts() {
  const [activeCampaigns, setActiveCampaigns] = useState<number>(0);
  const [pendingCreatives, setPendingCreatives] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    // Fetch active campaigns count
    campaignService
      .getAll({ page_size: 100 })
      .then((res) => {
        if (!cancelled) {
          const items = res?.items ?? res ?? [];
          const active = Array.isArray(items) ? items.filter((c: { status?: string }) => c.status?.toLowerCase() === 'active').length : 0;
          setActiveCampaigns(active);
        }
      })
      .catch(() => { /* leave at 0 */ });

    // Fetch pending creatives count
    creativeService
      .getProjects({ page_size: 20 })
      .then(async (projectsRes) => {
        const projects = projectsRes?.items ?? projectsRes ?? [];
        let pending = 0;
        for (const p of projects.slice(0, 5)) {
          try {
            const assets = await creativeService.getAssets(p.id);
            pending += (assets ?? []).filter((a: { status?: string }) => (a.status ?? '').toLowerCase() === 'pending').length;
          } catch { /* skip */ }
        }
        if (!cancelled) setPendingCreatives(pending);
      })
      .catch(() => { /* leave at 0 */ });

    return () => { cancelled = true; };
  }, []);

  return { activeCampaigns, pendingCreatives };
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, refreshToken } = useAuthStore();
  const { isSidebarOpen, setSidebarOpen } = useUiStore();
  const { activeCampaigns, pendingCreatives } = useAdminSidebarCounts();

  const handleLogout = async () => {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // ignore
    } finally {
      logout();
      router.push('/login');
    }
  };

  const navItems = defaultNavItems.map((item) => {
    if (item.href === '/admin/campaigns' && activeCampaigns > 0) {
      return { ...item, badge: String(activeCampaigns) };
    }
    if (item.href === '/admin/creatives' && pendingCreatives > 0) {
      return { ...item, badge: String(pendingCreatives) };
    }
    return item;
  });

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
        <Logo size="sidebar" variant="white" href="/admin" />
      </div>

      {/* User Info */}
      <div className="px-4 py-3 border-b border-[#1F2937]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {useAuthStore.getState().user?.name?.charAt(0) ?? 'A'}
          </div>
          <div>
            <div className="text-white text-sm font-medium">{useAuthStore.getState().user?.name ?? 'Admin'}</div>
            <div className="text-[#4B5563] text-xs">{useAuthStore.getState().user?.email ?? ''}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
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
              {item.badge && (
                <span className="bg-[#EC4899] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[#1F2937] space-y-0.5">
        <Link href="/sales" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white text-sm">
          <TrendingUp size={17} /> <span>Sales Portal</span>
        </Link>
        <Link href="/crm" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white text-sm">
          <Briefcase size={17} /> <span>CRM Portal</span>
        </Link>
        <Link href="/admin/settings" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white text-sm">
          <Settings size={17} /> <span>Settings</span>
        </Link>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-red-400 text-sm">
          <LogOut size={17} /> <span>Logout</span>
        </button>
      </div>
    </aside>
    </>
  );
}

// Admin Top Header
interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}
export function AdminHeader({ title, subtitle, badge, actions }: AdminHeaderProps) {
  const { user } = useAuthStore();
  const { toggleSidebar } = useUiStore();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title?: string; message: string; is_read: boolean; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

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
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (open && unreadCount === 0 && !loading && notifications.length > 0) {
      setOpen(false);
    }
  }, [unreadCount, open, loading, notifications.length]);

  const handleMarkRead = async (id: string) => {
    const { notificationService } = await import('@/services/crmService');
    try {
      await notificationService.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    const { notificationService } = await import('@/services/crmService');
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setOpen(false);
    } catch {
      // ignore
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0 sticky top-0 z-10 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button 
          type="button"
          onClick={toggleSidebar}
          className="md:hidden text-slate-500 hover:text-slate-900 focus:outline-none shrink-0"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-base md:text-lg font-bold text-slate-900 truncate" style={{ fontFamily: "'Sora', sans-serif" }}>{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>
        {badge && (
          <span className="hidden md:block text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold shrink-0">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {actions}
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="relative w-9 h-9 rounded-[10px] bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
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
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs text-[#4C1D95] hover:underline flex items-center gap-1"
                      title="Mark all as read"
                    >
                      <CheckCheck size={12} />
                      Mark all read
                    </button>
                  )}
                  <Link href="/admin/notifications" className="text-xs text-slate-400 hover:underline" onClick={() => setOpen(false)}>
                    View all
                  </Link>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <p className="text-xs text-slate-400 text-center py-6">Loading...</p>
                ) : notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No notifications</p>
                ) : (
                  notifications.slice(0, 6).map((n) => (
                    <button
                      type="button"
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
        <Link href="/admin/settings">
          <Avatar name={user?.name ?? 'Admin'} image={user?.image} size="sm" />
        </Link>
      </div>
    </header>
  );
}

