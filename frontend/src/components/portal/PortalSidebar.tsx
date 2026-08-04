'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';import { Logo } from '@/components/ui/Logo';
import { LayoutDashboard, Megaphone, TrendingUp, BarChart2, Image as ImageIcon,
  Files, Calendar, MessageSquare, FileText, LifeBuoy, Settings, LogOut, Zap, Bell,
  FolderKanban, Receipt, Folder, Menu, CheckCheck
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { campaignService } from '@/services/campaignService';
import { creativeService, companyService, messagingService } from '@/services';
import { userManagementService } from '@/services/crmService';
import { useUiStore } from '@/store/uiStore';

interface AccountManager {
  name: string;
  email: string;
}

function useSidebarData() {
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [pendingCreatives, setPendingCreatives] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [accountManager, setAccountManager] = useState<AccountManager | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const campaignsRes = await campaignService.getAll({ page_size: 100 });
        const items = campaignsRes?.items ?? [];
        if (!cancelled) setActiveCampaigns(items.filter((c: { status?: string }) => c.status === 'Active').length);
      } catch {
        // leave at 0
      }

      try {
        const projectsRes = await creativeService.getProjects({ page_size: 20 });
        const projects = projectsRes?.items ?? projectsRes ?? [];
        let pending = 0;
        for (const p of projects.slice(0, 5)) {
          try {
            const assets = await creativeService.getAssets(p.id);
            pending += (assets ?? []).filter((a: { status?: string }) => (a.status ?? '').toLowerCase() === 'pending').length;
          } catch {
            // skip project on error
          }
        }
        if (!cancelled) setPendingCreatives(pending);
      } catch {
        // leave at 0
      }

      try {
        const convRes = await messagingService.getConversations({ page_size: 5 });
        const conversations = convRes?.items ?? [];
        let unread = 0;
        for (const c of conversations) {
          try {
            const messages = await messagingService.getMessages(c.id);
            unread += messages.filter((m) => !m.is_read && m.sender_id !== user?.id).length;
          } catch {
            // skip conversation on error
          }
        }
        if (!cancelled) setUnreadMessages(unread);
      } catch {
        // leave at 0
      }

      try {
        const company = await companyService.getMine();
        if (company.assigned_to) {
          const manager = await userManagementService.getUser(company.assigned_to);
          let name = manager.full_name ?? manager.name ?? 'Account Manager';
          let email = manager.email ?? '';
          if (name === 'Admin User' || email === 'admin@amplivo.in') {
            name = 'Account Manager';
            email = 'support@amplivo.in';
          }
          if (!cancelled) setAccountManager({ name, email });
        }
      } catch {
        // no account manager assigned / not a client-portal user
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { activeCampaigns, pendingCreatives, unreadMessages, accountManager };
}

export function PortalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, refreshToken } = useAuthStore();
  const { activeCampaigns, pendingCreatives, unreadMessages, accountManager } = useSidebarData();
  const { isSidebarOpen, setSidebarOpen } = useUiStore();
  const [lastSeenCampaigns, setLastSeenCampaigns] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('lastSeenCampaigns');
      if (stored) setLastSeenCampaigns(parseInt(stored, 10));
    }
  }, []);

  useEffect(() => {
    if (pathname === '/portal/campaigns' && activeCampaigns > 0) {
      setLastSeenCampaigns(activeCampaigns);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastSeenCampaigns', activeCampaigns.toString());
      }
    }
  }, [pathname, activeCampaigns]);

  const newCampaigns = Math.max(0, activeCampaigns - lastSeenCampaigns);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/portal' },
    { icon: Megaphone, label: 'Campaigns', href: '/portal/campaigns', badge: newCampaigns > 0 ? String(newCampaigns) : undefined },
    { icon: ImageIcon, label: 'Creative Approval', href: '/portal/creatives', badge: pendingCreatives > 0 ? String(pendingCreatives) : undefined },
    { icon: TrendingUp, label: 'Leads', href: '/portal/leads' },
    { icon: FolderKanban, label: 'Projects & Tasks', href: '/portal/projects' },
    { icon: Calendar, label: 'Content Calendar', href: '/portal/calendar' },
    { icon: BarChart2, label: 'SEO Reports', href: '/portal/seo' },
    { icon: Files, label: 'Analytics', href: '/portal/analytics' },
    { icon: FileText, label: 'Invoices', href: '/portal/invoices' },
    { icon: Receipt, label: 'Payments', href: '/portal/payments' },
    { icon: Folder, label: 'Documents', href: '/portal/documents' },
    { icon: MessageSquare, label: 'Messages', href: '/portal/messages', badge: unreadMessages > 0 ? String(unreadMessages) : undefined },
    { icon: LifeBuoy, label: 'Support Tickets', href: '/portal/support' },
  ];

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
        <Logo size="sidebar" variant="white" href="/portal" />
      </div>

      {/* User Info — BUG-018: use user?.image so sidebar updates when avatar changes */}
      <div className="px-5 py-4 border-b border-[#1F2937]">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name ?? 'Client'} image={user?.image} size="sm" />
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold truncate">{user?.name ?? 'Client'}</div>
            <div className="text-[#4B5563] text-xs truncate">{user?.company ?? user?.email ?? ''}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
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
                <span className="bg-[#7C3AED] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Sign Out */}
      <div className="px-4 py-4 border-t border-[#1F2937]">
        <div className="flex gap-2">
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-red-400 transition-all text-xs flex-1">
            <LogOut size={14} /> Sign Out
          </button>
          <Link href="/portal/settings" className="flex items-center justify-center w-9 h-9 rounded-[10px] text-[#9CA3AF] hover:bg-[#1F2937] hover:text-white transition-all">
            <Settings size={15} />
          </Link>
        </div>
      </div>
    </aside>
    </>
  );
}

// Portal Top Header — shared across all portal pages, shows real user + real notifications
interface PortalHeaderProps {
  title: string;
  subtitle?: string;
}
export function PortalHeader({ title, subtitle }: PortalHeaderProps) {
  // BUG-018: read user from auth store so avatar reflects latest upload
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

  // BUG-06: Auto-close popup when all notifications become read
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

  // BUG-06: Mark all as read from within the popup and close it
  const handleMarkAllRead = async () => {
    const { notificationService } = await import('@/services/crmService');
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setOpen(false); // close popup after marking all as read
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
          <h1 className="text-base md:text-lg font-bold text-slate-900 truncate" style={{ fontFamily: "'Sora', sans-serif" }}>{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="relative" ref={ref}>
          <button
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
                  {/* BUG-06: Mark all read button inside popup */}
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-[#4C1D95] hover:underline flex items-center gap-1"
                      title="Mark all as read"
                    >
                      <CheckCheck size={12} />
                      Mark all read
                    </button>
                  )}
                  <Link href="/portal/notifications" className="text-xs text-slate-400 hover:underline" onClick={() => setOpen(false)}>
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
        {/* BUG-018: Avatar reads from user?.image which is updated by login() on avatar upload */}
        <Avatar name={user?.name ?? 'Client'} image={user?.image} size="sm" />
      </div>
    </header>
  );
}
