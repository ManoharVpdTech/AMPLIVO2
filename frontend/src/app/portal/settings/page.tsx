'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useRef, useState } from 'react';
import { User as UserIcon, Building2, Bell, Shield, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { useRouter } from 'next/navigation';
import { settingsService } from '@/services/moduleServices';
import { userManagementService } from '@/services/crmService';
import { fileManagerService } from '@/services/moduleServices';
import { companyService, ClientRead } from '@/services/portalServices';
import { authService } from '@/services/authService';
import { PhoneInput } from '@/components/ui/PhoneInput';

type Tab = 'profile' | 'company' | 'notifications' | 'security';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '');
const resolveUrl = (url: string) => (url.startsWith('http') ? url : `${API_ORIGIN}${url}`);

export default function SettingsPage() {
  const { user, logout, token, refreshToken, login } = useAuthStore();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);

  // Profile state
  const [fullName, setFullName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.image ?? null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // BUG-017: Track original profile values to detect dirty state
  const [originalFullName, setOriginalFullName] = useState(user?.name ?? '');
  const [originalPhone, setOriginalPhone] = useState('');
  const isProfileDirty = fullName !== originalFullName || phone !== originalPhone;

  // Company state
  const [company, setCompany] = useState<ClientRead | null>(null);
  const [companyForm, setCompanyForm] = useState({ display_name: '', website: '', phone: '' });
  const [originalCompanyForm, setOriginalCompanyForm] = useState({ display_name: '', website: '', phone: '' });
  const [savingCompany, setSavingCompany] = useState(false);
  const isCompanyDirty = JSON.stringify(companyForm) !== JSON.stringify(originalCompanyForm);

  // Notifications preferences
  const [preferences, setPreferences] = useState<{ theme: string; email_notifications: boolean; in_app_notifications: boolean } | null>(null);
  const [originalPreferences, setOriginalPreferences] = useState<{ theme: string; email_notifications: boolean; in_app_notifications: boolean } | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  // BUG-017: Only enable save prefs if preferences have changed
  const isPreferencesDirty = preferences && originalPreferences
    ? JSON.stringify(preferences) !== JSON.stringify(originalPreferences)
    : false;

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  // BUG-015: Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      userManagementService.getUser(user.id).catch(() => null),
      userManagementService.getUserProfile(user.id).catch(() => null),
      settingsService.getMyPreferences().catch(() => null),
      companyService.getMine().catch(() => null),
    ]).then(([detail, profile, prefs, myCompany]) => {
      const loadedName = detail?.full_name ?? user?.name ?? '';
      const loadedPhone = detail?.phone ?? '';
      if (detail?.phone) setPhone(loadedPhone);
      if (detail?.full_name) setFullName(loadedName);
      // BUG-017: set original values for dirty detection
      setOriginalFullName(loadedName);
      setOriginalPhone(loadedPhone);

      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);

      const defaultPrefs = { theme: 'light', email_notifications: true, in_app_notifications: true };
      const resolvedPrefs = prefs ?? defaultPrefs;
      setPreferences(resolvedPrefs);
      setOriginalPreferences(resolvedPrefs);

      if (myCompany) {
        setCompany(myCompany);
        const compForm = { display_name: myCompany.display_name ?? '', website: myCompany.website ?? '', phone: myCompany.phone ?? '' };
        setCompanyForm(compForm);
        setOriginalCompanyForm(compForm);
      }
      setLoading(false);
    });
  }, [user?.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await userManagementService.updateUser(user.id, { full_name: fullName.trim(), phone: phone.trim() });
      login({ ...user, name: fullName.trim() }, token ?? '', refreshToken ?? undefined);
      setOriginalFullName(fullName.trim());
      setOriginalPhone(phone.trim());
      showToast('Profile updated successfully.', 'success');
    } catch {
      showToast('Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !user) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await fileManagerService.uploadBinary(fileList[0]);
      const url = resolveUrl(uploaded.url);
      await userManagementService.upsertUserProfile(user.id, { full_name: fullName.trim() || user.name, avatar_url: url });
      setAvatarUrl(url);
      // BUG-018: Update auth store so sidebar/header Avatar re-renders with new image
      login({ ...user, image: url }, token ?? '', refreshToken ?? undefined);
      showToast('Avatar updated.', 'success');
    } catch {
      showToast('Failed to upload avatar.', 'error');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setSavingCompany(true);
    try {
      const updated = await companyService.update(company.id, companyForm);
      setCompany(updated);
      setOriginalCompanyForm({ ...companyForm });
      showToast('Company details updated.', 'success');
    } catch {
      showToast('Failed to update company details.', 'error');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;
    setSavingPrefs(true);
    try {
      await settingsService.updateMyPreferences(preferences);
      setOriginalPreferences({ ...preferences });
      showToast('Notification preferences saved.', 'success');
    } catch {
      showToast('Failed to save preferences.', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    setChangingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully.', 'success');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to change password.';
      setPasswordError(message);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
        </div>
      </div>
    );
  }

  // BUG-016: Removed 'Sign out' from the tab navigation — it already exists in the sidebar
  const navButtons: { key: Tab; label: string; icon: typeof UserIcon }[] = [
    { key: 'profile', label: 'Profile', icon: UserIcon },
    { key: 'company', label: 'Company details', icon: Building2 },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'security', label: 'Password & Security', icon: Shield },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Account Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your profile, company details, and preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* BUG-016: No Sign Out button here — only navigation tabs */}
        <div className="md:col-span-1 space-y-1">
          {navButtons.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors ${
                tab === key ? 'bg-[#4C1D95]/10 text-[#4C1D95] font-semibold' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>

        <div className="md:col-span-3 space-y-6">
          {tab === 'profile' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-6" style={{ fontFamily: "'Sora', sans-serif" }}>Profile Information</h2>

              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                  {avatarUrl ? <img src={avatarUrl} alt={user?.name} className="w-full h-full object-cover" /> : <UserIcon size={28} className="text-slate-400" />}
                </div>
                <div>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarChange(e.target.files)} />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors mb-2 disabled:opacity-60 flex items-center gap-2"
                  >
                    {uploadingAvatar && <Loader2 size={14} className="animate-spin" />}
                    {uploadingAvatar ? 'Uploading...' : 'Change avatar'}
                  </button>
                  <p className="text-xs text-slate-500">JPG, GIF or PNG. 20MB max.</p>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSaveProfile}>
                <div>
                  <label htmlFor="portal-fullname" className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                  <input id="portal-fullname" type="text" required pattern="[A-Za-z\s]+" title="Only letters and spaces are allowed" minLength={2} value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                  <input type="email" value={user?.email || ''} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500" />
                  <p className="text-xs text-slate-500 mt-1.5">Contact your account manager to change your email address.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                  <PhoneInput value={phone} onChange={(val) => setPhone(val || '')} />
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  {/* BUG-017: Disabled when form is pristine */}
                  <button
                    type="submit"
                    disabled={savingProfile || !isProfileDirty}
                    title={!isProfileDirty ? 'No changes to save' : undefined}
                    className="flex items-center gap-2 bg-[#4C1D95] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {tab === 'company' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-6" style={{ fontFamily: "'Sora', sans-serif" }}>Company Details</h2>
              {!company ? (
                <p className="text-sm text-slate-400">No company information linked to this account.</p>
              ) : (
                <form className="space-y-4" onSubmit={handleSaveCompany}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name</label>
                      <input type="text" value={company.company_name} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Industry</label>
                      <input type="text" value={company.industry ?? '-'} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Display Name</label>
                    <input type="text" value={companyForm.display_name} onChange={(e) => setCompanyForm((p) => ({ ...p, display_name: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label>
                      <input type="url" value={companyForm.website} onChange={(e) => setCompanyForm((p) => ({ ...p, website: e.target.value }))} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                      <PhoneInput value={companyForm.phone} onChange={(val) => setCompanyForm((p) => ({ ...p, phone: val || '' }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">GST Number</label>
                      <input type="text" value={company.gst_number ?? '-'} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">PAN Number</label>
                      <input type="text" value={company.pan_number ?? '-'} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Tax/registration details can only be updated by your account manager.</p>
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    {/* BUG-017: Disabled when company form is pristine */}
                    <button
                      type="submit"
                      disabled={savingCompany || !isCompanyDirty}
                      title={!isCompanyDirty ? 'No changes to save' : undefined}
                      className="flex items-center gap-2 bg-[#4C1D95] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingCompany ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      {savingCompany ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {tab === 'notifications' && preferences && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-6" style={{ fontFamily: "'Sora', sans-serif" }}>Notification Preferences</h2>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Email notifications</p>
                    <p className="text-xs text-slate-500">Receive updates about campaigns, invoices, and messages by email.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.email_notifications}
                    onChange={(e) => setPreferences((p) => (p ? { ...p, email_notifications: e.target.checked } : p))}
                    className="w-5 h-5 accent-[#4C1D95]"
                  />
                </label>
                <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-sm font-medium text-slate-900">In-app notifications</p>
                    <p className="text-xs text-slate-500">Show notifications in the bell icon while you&apos;re using the portal.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.in_app_notifications}
                    onChange={(e) => setPreferences((p) => (p ? { ...p, in_app_notifications: e.target.checked } : p))}
                    className="w-5 h-5 accent-[#4C1D95]"
                  />
                </label>
              </div>
              <div className="pt-6 mt-2 border-t border-slate-100 flex justify-end">
                {/* BUG-017: Disabled when preferences are pristine */}
                <button
                  onClick={handleSavePreferences}
                  disabled={savingPrefs || !isPreferencesDirty}
                  title={!isPreferencesDirty ? 'No changes to save' : undefined}
                  className="flex items-center gap-2 bg-[#4C1D95] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPrefs ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {savingPrefs ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-6" style={{ fontFamily: "'Sora', sans-serif" }}>Password & Security</h2>
              <form className="space-y-4 max-w-md" onSubmit={handleChangePassword}>
                {passwordError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{passwordError}</p>}

                {/* BUG-015: Current Password with eye toggle */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* BUG-015: New Password with eye toggle */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">At least 8 characters, with an uppercase letter, lowercase letter, number, and symbol.</p>
                </div>

                {/* BUG-015: Confirm Password with eye toggle */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="flex items-center gap-2 bg-[#4C1D95] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50"
                  >
                    {changingPassword ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {changingPassword ? 'Updating...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
