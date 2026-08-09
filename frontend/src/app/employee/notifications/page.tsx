'use client';

import { useCrmStore } from '@/store/crmStore';
import { EmployeeHeader } from '@/components/employee/EmployeeHeader';
import { Bell, Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function EmployeeNotifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useCrmStore();
  const myNotifications = notifications; // In a real app we'd filter by activeEmployeeId if notifs were targeted. For demo we share all CRM notifs for visibility.

  // BUG-08 Fix: Check if there are any unread notifications
  const hasUnread = myNotifications.some(n => !n.read);

  return (
    <div className="flex flex-col min-h-full">
      <EmployeeHeader title="Notifications" subtitle="Updates on your tasks and projects" />
      
      <div className="p-6 max-w-4xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-900">Recent Notifications</h2>
          
          {/* BUG-08 Fix: Disable "Mark all as read" button when empty or no unread notifications */}
          <button 
            type="button"
            onClick={() => markAllNotificationsRead()}
            disabled={!hasUnread}
            title={!hasUnread ? "No unread notifications" : undefined}
            className="flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-indigo-600"
          >
            <Check size={16} /> Mark all as read
          </button>
        </div>

        {myNotifications.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
            <Bell className="mx-auto text-slate-300 mb-4" size={48} />
            <h3 className="text-lg font-bold text-slate-900 mb-1">No Notifications</h3>
            <p className="text-slate-500 text-sm">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            {myNotifications.map(n => (
              <div key={n.id} className={`p-4 flex gap-4 transition-colors ${!n.read ? 'bg-indigo-50/30 hover:bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                <div className="mt-1 flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!n.read ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Bell size={18} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm ${!n.read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{n.title}</h4>
                    <span className="text-xs text-slate-400 whitespace-nowrap ml-4">{n.date} {n.time}</span>
                  </div>
                  <p className={`text-sm mb-3 ${!n.read ? 'text-slate-700' : 'text-slate-500'}`}>{n.message}</p>
                  
                  <div className="flex items-center gap-4">
                    {!n.read && (
                      <button 
                        type="button"
                        onClick={() => markNotificationRead(n.id)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Mark as read
                      </button>
                    )}
                    {n.linkedType === 'project' && n.linkedId && (
                      <Link href={`/employee/projects/${n.linkedId}`} className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1">
                        View Project <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
