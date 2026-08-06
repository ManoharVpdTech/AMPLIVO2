'use client';
import { useEffect, useState } from 'react';
import { SalesHeader } from '@/components/sales/SalesSidebar';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { userManagementService } from '@/services/crmService';
import { Avatar } from '@/components/ui/Avatar';
import { Mail, Phone, Briefcase, Globe, Save, Loader2 } from 'lucide-react';

const TIMEZONES = [
  'Asia/Kolkata', 'UTC', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'Europe/London', 'Asia/Singapore', 'Australia/Sydney',
];

export default function SalesProfilePage() {
  const { user, updateUser } = useAuthStore();
  const { showToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.name ?? '',
    phone: '',
    designation: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [detail, profile] = await Promise.all([
          userManagementService.getUser(user.id).catch(() => null),
          userManagementService.getUserProfile(user.id).catch(() => null),
        ]);
        setForm((f) => ({
          ...f,
          fullName: (detail as { full_name?: string } | null)?.full_name ?? user.name,
          phone: (detail as { phone?: string } | null)?.phone ?? '',
          designation: (profile as { designation?: string } | null)?.designation ?? '',
          timezone: (profile as { timezone?: string } | null)?.timezone || f.timezone,
        }));
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await Promise.all([
        userManagementService.updateUser(user.id, { full_name: form.fullName, phone: form.phone }),
        userManagementService.upsertUserProfile(user.id, {
          full_name: form.fullName,
          designation: form.designation || undefined,
          timezone: form.timezone,
        }),
      ]);
      updateUser({ name: form.fullName });
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <SalesHeader title="My Profile" subtitle="Manage your personal details" />
        <div className="p-6 flex items-center justify-center h-96">
          <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SalesHeader title="My Profile" subtitle="Manage your personal details" />
      <div className="p-6 max-w-2xl">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={form.fullName || 'Sales Admin'} size="lg" />
            <div>
              <div className="font-bold text-slate-900 text-lg">{form.fullName || 'Sales Admin'}</div>
              <div className="text-sm text-slate-400">{user?.role === 'admin' ? 'Sales Admin' : 'Sales'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-fullname" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
              <input
                id="profile-fullname"
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <Mail size={11} className="inline mr-1" />Email
              </label>
              <input
                type="email"
                value={user?.email ?? ''}
                disabled
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="profile-phone" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <Phone size={11} className="inline mr-1" />Phone Number
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            </div>
            <div>
              <label htmlFor="profile-designation" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <Briefcase size={11} className="inline mr-1" />Job Title
              </label>
              <input
                id="profile-designation"
                type="text"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="Sales Admin"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            </div>
            <div>
              <label htmlFor="profile-timezone" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                <Globe size={11} className="inline mr-1" />Timezone
              </label>
              <select
                id="profile-timezone"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="profile-role" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Role &amp; Permissions</label>
              <input
                id="profile-role"
                type="text"
                value={user?.role === 'admin' ? 'Sales Admin' : 'Sales'}
                disabled
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400 bg-slate-50 cursor-not-allowed capitalize"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
