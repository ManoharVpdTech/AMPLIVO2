'use client';
import { useEffect, useState, useMemo } from 'react';
import { SalesHeader } from '@/components/sales/SalesSidebar';
import { notificationService } from '@/services/crmService';
import { Bell, Check, UserPlus, CalendarDays, FileText, Users } from 'lucide-react';

interface SalesNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

type FilterTab = 'All' | 'New Enquiries' | 'Unread';

function isEnquiry(n: SalesNotification): boolean {
  const haystack = `${n.title} ${n.message}`.toLowerCase();
  return haystack.includes('enquiry') || haystack.includes('contact form');
}

function iconFor(n: SalesNotification) {
  const t = n.title.toLowerCase();
  if (isEnquiry(n)) return { Icon: UserPlus, cls: 'bg-violet-50 text-violet-600' };
  if (t.includes('meeting')) return { Icon: CalendarDays, cls: 'bg-blue-50 text-blue-600' };
  if (t.includes('proposal')) return { Icon: FileText, cls: 'bg-amber-50 text-amber-600' };
  if (t.includes('lead')) return { Icon: Users, cls: 'bg-emerald-50 text-emerald-600' };
  return { Icon: Bell, cls: 'bg-slate-100 text-slate-500' };
}

export default function SalesNotificationsPage() {
  const [notifications, setNotifications] = useState<SalesNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('New Enquiries');

  const load = () => {
    setLoading(true);
    notificationService
      .getAll({ page_size: 100 })
      .then((res) => setNotifications(res?.items ?? []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => ({
    All: notifications.length,
    'New Enquiries': notifications.filter(isEnquiry).length,
    Unread: notifications.filter((n) => !n.is_read).length,
  }), [notifications]);

  const filtered = useMemo(() => {
    return notifications
      .filter((n) => {
        if (tab === 'New Enquiries') return isEnquiry(n);
        if (tab === 'Unread') return !n.is_read;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [notifications, tab]);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await notificationService.markRead(id);
    } catch {
      load();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await notificationService.markAllRead();
    } catch {
      load();
    }
  };

  return (
    <div>
      <SalesHeader
        title="Notifications"
        subtitle="New enquiries, meetings, and lead activity for your pipeline"
        badge={counts.Unread > 0 ? `${counts.Unread} unread` : undefined}
        actions={
          counts.Unread > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Check size={14} /> Mark all as read
            </button>
          ) : undefined
        }
      />

      <div className="p-6 space-y-5">
        <div className="flex gap-1.5">
          {(['New Enquiries', 'All', 'Unread'] as FilterTab[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                tab === t
                  ? 'bg-[#4C1D95] text-white border-[#4C1D95]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#4C1D95]/30 hover:text-[#4C1D95]'
              }`}
            >
              {t}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === t ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading && (
            <div className="py-16 text-center text-slate-400 text-sm">Loading...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-16 text-center">
              <Bell size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                {tab === 'New Enquiries' ? 'No new contact-form enquiries yet.' : 'No notifications here.'}
              </p>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="divide-y divide-slate-100">
              {filtered.map((n) => {
                const { Icon, cls } = iconFor(n);
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 p-4 transition-colors ${n.is_read ? '' : 'bg-violet-50/40'}`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm ${n.is_read ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>
                          {n.title}
                        </p>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          className="mt-2 text-xs font-semibold text-[#4C1D95] hover:underline"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-[#EC4899] flex-shrink-0 mt-1.5" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
