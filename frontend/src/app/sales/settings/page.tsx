'use client';
import { useEffect, useMemo, useState } from 'react';
import { SalesHeader } from '@/components/sales/SalesSidebar';
import { TeamMemberModal, TeamMemberEditTarget, TeamMemberRole } from '@/components/sales/TeamMemberModal';
import { userManagementService } from '@/services/crmService';
import { settingsService } from '@/services/moduleServices';
import { authService } from '@/services/authService';
import { useToastStore } from '@/store/toastStore';
import {
  Bell, IndianRupee, Users, Package, Shield, ChevronRight, Save, Loader2,
  Plus, Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound,
} from 'lucide-react';

const tabs = [
  { id: 'team', label: 'Sales Team', icon: Users },
  { id: 'services', label: 'Service Catalog', icon: Package },
  { id: 'tax', label: 'Tax & Billing', icon: IndianRupee },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
];

const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const withResponse = err as { response?: { data?: { message?: string; detail?: string } } };
  return withResponse?.response?.data?.message || withResponse?.response?.data?.detail || fallback;
}

function passwordChecks(pwd: string) {
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    digit: /\d/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
}

export default function SalesSettingsPage() {
  const [activeTab, setActiveTab] = useState('team');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToastStore();

  // ── Team ──────────────────────────────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<TeamMemberRole[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<TeamMemberEditTarget | undefined>(undefined);

  // ── Services ──────────────────────────────────────────────────────────
  const [services, setServices] = useState<Array<{ id: string; name: string; category: string; monthlyPrice: number; setupFee: number }>>([]);

  // ── Tax & Billing ─────────────────────────────────────────────────────
  const [taxRate, setTaxRate] = useState(18);
  const [advancePercent, setAdvancePercent] = useState(25);
  const [gstin, setGstin] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('7');
  const [originalTax, setOriginalTax] = useState({ taxRate: 18, advancePercent: 25, gstin: '', paymentTerms: '7' });
  const [savingTax, setSavingTax] = useState(false);

  // ── Notifications ─────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([
    { label: 'New Lead Submitted', desc: 'Get notified when a visitor submits the contact form', enabled: true },
    { label: 'Meeting Reminders', desc: '30-minute reminder before scheduled meetings', enabled: true },
    { label: 'Lead Status Changed', desc: 'Notify when a lead status is updated', enabled: true },
    { label: 'Invoice Generated', desc: 'Notify team when a 25% invoice is created', enabled: true },
    { label: 'Weekly Pipeline Report', desc: 'Monday morning summary of pipeline health', enabled: false },
    { label: 'Lead Overdue Follow-up', desc: 'Alert when follow-up date is past due', enabled: true },
  ]);
  const [originalNotifications, setOriginalNotifications] = useState(notifications);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // ── Security ──────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [savingTwoFactor, setSavingTwoFactor] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [usersRes, rolesRes, prefsRes] = await Promise.all([
          userManagementService.getUsers({ page_size: 100 }),
          userManagementService.getRoles(),
          settingsService.getMyPreferences().catch(() => null),
        ]);

        const users = Array.isArray(usersRes) ? usersRes : usersRes?.items || [];
        const rolesList = Array.isArray(rolesRes) ? rolesRes : rolesRes?.items || [];
        const mappedRoles: TeamMemberRole[] = rolesList.map((r: Record<string, unknown>) => ({
          id: typeof r.id === 'string' ? r.id : String(r.id ?? ''),
          name: typeof r.name === 'string' ? r.name : String(r.name ?? ''),
        }));
        setRoles(mappedRoles);

        const roleNameById = new Map(mappedRoles.map((r) => [r.id, r.name]));
        setTeamMembers(
          users.map((u: Record<string, unknown>) => {
            const uId = typeof u.id === 'string' ? u.id : String(u.id ?? '');
            const uName = typeof u.full_name === 'string' ? u.full_name : typeof u.name === 'string' ? u.name : '';
            const uEmail = typeof u.email === 'string' ? u.email : '';
            const uPhone = typeof u.phone === 'string' ? u.phone : '';
            const uRoleId = typeof u.role_id === 'string' ? u.role_id : String(u.role_id ?? '');
            return {
              id: uId,
              name: uName,
              email: uEmail,
              phone: uPhone,
              roleId: uRoleId,
              roleName: roleNameById.get(uRoleId) || '—',
              isActive: u.is_active !== false,
            };
          })
        );

        if (prefsRes) {
          const p = prefsRes as Record<string, unknown>;
          const loadedTax = {
            taxRate: typeof p.tax_rate === 'number' ? p.tax_rate : 18,
            advancePercent: typeof p.advance_percent === 'number' ? p.advance_percent : 25,
            gstin: typeof p.gstin === 'string' ? p.gstin : '',
            paymentTerms: typeof p.payment_terms === 'string' ? p.payment_terms : '7',
          };
          setTaxRate(loadedTax.taxRate);
          setAdvancePercent(loadedTax.advancePercent);
          setGstin(loadedTax.gstin);
          setPaymentTerms(loadedTax.paymentTerms);
          setOriginalTax(loadedTax);

          if (typeof p.two_factor_enabled === 'boolean') setTwoFactorEnabled(p.two_factor_enabled);

          if (Array.isArray(p.notification_preferences)) {
            setNotifications((prev) => {
              const next = prev.map((n, i) => {
                const saved = (p.notification_preferences as Record<string, unknown>[])[i];
                return saved ? { ...n, enabled: Boolean(saved.enabled) } : n;
              });
              setOriginalNotifications(next);
              return next;
            });
          } else {
            setOriginalNotifications(notifications);
          }
        } else {
          setOriginalNotifications(notifications);
        }

        const svcRes = await settingsService.getSystemSettings({ category: 'services' }).catch(() => null);
        if (svcRes) {
          const items = Array.isArray(svcRes) ? svcRes : svcRes?.items || [];
          setServices(
            items.map((s: Record<string, unknown>) => ({
              id: String(s.id || s.key || ''),
              name: String(s.name || s.key || ''),
              category: String(s.category || s.value || ''),
              monthlyPrice: Number(s.monthly_price || s.monthlyPrice || 0),
              setupFee: Number(s.setup_fee || s.setupFee || 0),
            }))
          );
        }
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadTeam = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        userManagementService.getUsers({ page_size: 100 }),
        userManagementService.getRoles(),
      ]);
      const users = Array.isArray(usersRes) ? usersRes : usersRes?.items || [];
      const rolesList = Array.isArray(rolesRes) ? rolesRes : rolesRes?.items || [];
      const mappedRoles: TeamMemberRole[] = rolesList.map((r: Record<string, unknown>) => ({
        id: typeof r.id === 'string' ? r.id : String(r.id ?? ''),
        name: typeof r.name === 'string' ? r.name : String(r.name ?? ''),
      }));
      setRoles(mappedRoles);
      const roleNameById = new Map(mappedRoles.map((r) => [r.id, r.name]));
      setTeamMembers(
        users.map((u: Record<string, unknown>) => {
          const uId = typeof u.id === 'string' ? u.id : String(u.id ?? '');
          const uName = typeof u.full_name === 'string' ? u.full_name : typeof u.name === 'string' ? u.name : '';
          const uEmail = typeof u.email === 'string' ? u.email : '';
          const uPhone = typeof u.phone === 'string' ? u.phone : '';
          const uRoleId = typeof u.role_id === 'string' ? u.role_id : String(u.role_id ?? '');
          return {
            id: uId,
            name: uName,
            email: uEmail,
            phone: uPhone,
            roleId: uRoleId,
            roleName: roleNameById.get(uRoleId) || '—',
            isActive: u.is_active !== false,
          };
        })
      );
    } catch {
      // keep existing list on failure
    }
  };

  // ── Tax & Billing validation + dirty state ──────────────────────────────
  const taxErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      errors.taxRate = 'Tax rate must be a valid percentage between 0% and 100%.';
    }
    if (Number.isNaN(advancePercent) || advancePercent < 0 || advancePercent > 100) {
      errors.advancePercent = 'Advance payment percentage must be between 0% and 100%.';
    }
    const terms = Number(paymentTerms);
    if (paymentTerms.trim() === '' || Number.isNaN(terms) || terms < 0) {
      errors.paymentTerms = 'Payment terms must be a positive number of days.';
    }
    if (gstin && !GSTIN_REGEX.test(gstin)) {
      errors.gstin = 'Enter a valid 15-character GSTIN (e.g. 22AAAAA0000A1Z5).';
    }
    return errors;
  }, [taxRate, advancePercent, paymentTerms, gstin]);

  const taxDirty =
    taxRate !== originalTax.taxRate ||
    advancePercent !== originalTax.advancePercent ||
    gstin !== originalTax.gstin ||
    paymentTerms !== originalTax.paymentTerms;

  const handleSaveTax = async () => {
    if (Object.keys(taxErrors).length > 0) return;
    setSavingTax(true);
    try {
      await settingsService.updateMyPreferences({
        tax_rate: taxRate,
        advance_percent: advancePercent,
        gstin,
        payment_terms: paymentTerms,
      });
      setOriginalTax({ taxRate, advancePercent, gstin, paymentTerms });
      showToast('Tax & Billing settings saved successfully', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save Tax & Billing settings.'), 'error');
    } finally {
      setSavingTax(false);
    }
  };

  // ── Notifications dirty state ───────────────────────────────────────────
  const notificationsDirty = notifications.some((n, i) => n.enabled !== originalNotifications[i]?.enabled);

  const toggleNotification = (index: number) => {
    setNotifications((prev) => prev.map((n, i) => (i === index ? { ...n, enabled: !n.enabled } : n)));
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await settingsService.updateMyPreferences({
        notification_preferences: notifications.map((n) => ({ label: n.label, enabled: n.enabled })),
      });
      setOriginalNotifications(notifications);
      showToast('Notification preferences saved successfully', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save notification preferences.'), 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  // ── Security: password change ───────────────────────────────────────────
  const checks = passwordChecks(newPassword);
  const strengthScore = Object.values(checks).filter(Boolean).length;
  const strengthLabel = strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Medium' : 'Strong';
  let strengthColor = 'bg-emerald-500';
  if (strengthScore <= 2) {
    strengthColor = 'bg-red-500';
  } else if (strengthScore <= 4) {
    strengthColor = 'bg-amber-500';
  }

  const passwordFormValid =
    currentPassword.length > 0 &&
    Object.values(checks).every(Boolean) &&
    newPassword === confirmPassword;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFormError(null);
    setCurrentPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordFormError('New password and confirmation do not match.');
      return;
    }
    if (!Object.values(checks).every(Boolean)) {
      setPasswordFormError('New password does not meet the complexity requirements below.');
      return;
    }

    setChangingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully', 'success');
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message = extractErrorMessage(err, 'Failed to update password.');
      if (status === 401) {
        setCurrentPasswordError('The current password you entered is incorrect.');
        setCurrentPassword('');
      } else {
        setPasswordFormError(message);
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const generateBackupCodes = () => {
    const codes = Array.from({ length: 8 }, () => {
      const bytes = new Uint8Array(5);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8).toUpperCase().replace(/(.{4})(.{4})/, '$1-$2');
    });
    setBackupCodes(codes);
    setShowBackupCodes(true);
  };

  const handleToggleTwoFactor = async () => {
    const next = !twoFactorEnabled;
    setSavingTwoFactor(true);
    try {
      await settingsService.updateMyPreferences({ two_factor_enabled: next });
      setTwoFactorEnabled(next);
      showToast(next ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update two-factor authentication.'), 'error');
    } finally {
      setSavingTwoFactor(false);
    }
  };

  if (loading) {
    return (
      <div>
        <SalesHeader title="Settings" subtitle="Sales portal configuration" />
        <div className="p-6 flex items-center justify-center h-96">
          <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SalesHeader title="Settings" subtitle="Sales portal configuration" />

      <div className="p-6">
        <div className="flex gap-6">
          <div className="w-56 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {tabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium transition-all border-b border-slate-100 last:border-0 ${
                    activeTab === tab.id
                      ? 'bg-violet-50 text-[#4C1D95] font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <tab.icon size={16} />
                    {tab.label}
                  </div>
                  <ChevronRight size={14} className={activeTab === tab.id ? 'text-[#4C1D95]' : 'text-slate-300'} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            {activeTab === 'team' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Sales Team Members</h2>
                  <button
                    type="button"
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4C1D95] text-white rounded-xl text-xs font-semibold hover:bg-[#3b1574] transition-colors"
                  >
                    <Plus size={14} /> Add Team Member
                  </button>
                </div>
                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/20 transition-all">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#4C1D95] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {member.name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '??'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-slate-800 truncate">{member.name || 'Unnamed User'}</div>
                            {!member.isActive && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200">INACTIVE</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate">{member.email}</div>
                          {member.roleName !== '—' && (
                            <div className="text-[10px] text-violet-600 font-semibold mt-0.5">{member.roleName}</div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMemberToEdit({ id: member.id, name: member.name, email: member.email, phone: member.phone, roleId: member.roleId, isActive: member.isActive })}
                        className="px-3 py-1.5 bg-violet-50 text-[#4C1D95] rounded-lg text-xs font-semibold hover:bg-violet-100 transition-colors flex-shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                  {teamMembers.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-8">No team members found</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'services' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="font-bold text-slate-900 mb-5" style={{ fontFamily: "'Sora', sans-serif" }}>Service Catalog</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {['Service', 'Category', 'Monthly Price', 'Setup Fee'].map((h) => (
                          <th key={h} className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {services.map((svc) => (
                        <tr key={svc.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">{svc.name}</td>
                          <td className="py-3 px-4">
                            <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded font-semibold">
                              {svc.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm font-semibold text-slate-700">
                            {svc.monthlyPrice > 0 ? `₹${svc.monthlyPrice.toLocaleString('en-IN')}/mo` : '—'}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-500">
                            {svc.setupFee > 0 ? `₹${svc.setupFee.toLocaleString('en-IN')}` : '—'}
                          </td>
                        </tr>
                      ))}
                      {services.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-slate-400">No services configured</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'tax' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                <h2 className="font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Tax & Billing Settings</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="settings-tax-rate" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Default Tax Rate (%) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="settings-tax-rate"
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className={`w-full px-4 py-3 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                        taxErrors.taxRate ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]'
                      }`}
                    />
                    {taxErrors.taxRate ? (
                      <p className="text-xs text-red-500 mt-1">{taxErrors.taxRate}</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">Standard Indian GST rate</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="settings-advance-percent" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Advance Payment (%) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="settings-advance-percent"
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={advancePercent}
                      onChange={(e) => setAdvancePercent(Number(e.target.value))}
                      className={`w-full px-4 py-3 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                        taxErrors.advancePercent ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]'
                      }`}
                    />
                    {taxErrors.advancePercent ? (
                      <p className="text-xs text-red-500 mt-1">{taxErrors.advancePercent}</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">% of grand total due upfront</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Company GSTIN</label>
                    <input
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 36AABCA1234B1ZX"
                      maxLength={15}
                      className={`w-full px-4 py-3 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 uppercase ${
                        taxErrors.gstin ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]'
                      }`}
                    />
                    {taxErrors.gstin && <p className="text-xs text-red-500 mt-1">{taxErrors.gstin}</p>}
                  </div>
                  <div>
                    <label htmlFor="settings-payment-terms" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Payment Terms (days) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="settings-payment-terms"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      type="number"
                      min={0}
                      required
                      className={`w-full px-4 py-3 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                        taxErrors.paymentTerms ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]'
                      }`}
                    />
                    {taxErrors.paymentTerms && <p className="text-xs text-red-500 mt-1">{taxErrors.paymentTerms}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveTax}
                  disabled={savingTax || !taxDirty || Object.keys(taxErrors).length > 0}
                  title={!taxDirty ? 'No changes to save' : undefined}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all bg-[#4C1D95] text-white hover:bg-[#3b1574] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingTax ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {savingTax ? 'Saving...' : 'Save Tax & Billing'}
                </button>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <h2 className="font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Notification Preferences</h2>
                {notifications.map((item, idx) => (
                  <div key={item.label} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-violet-100 hover:bg-violet-50/20 transition-all">
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{item.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={item.enabled} onChange={() => toggleNotification(idx)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4C1D95]" />
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={savingPrefs || !notificationsDirty}
                  title={!notificationsDirty ? 'No changes to save' : undefined}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all bg-[#4C1D95] text-white hover:bg-[#3b1574] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPrefs ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {savingPrefs ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="font-bold text-slate-900 mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>Security Settings</h2>
                  <form onSubmit={handleChangePassword} className="p-4 rounded-xl border border-slate-100 space-y-3">
                    <div className="font-semibold text-slate-800 text-sm mb-1">Change Password</div>

                    {passwordFormError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs">
                        <AlertCircle size={14} className="flex-shrink-0" /> {passwordFormError}
                      </div>
                    )}

                    <div>
                      <label htmlFor="settings-current-pwd" className="block text-xs text-slate-500 mb-1">Current Password</label>
                      <div className="relative">
                        <input
                          id="settings-current-pwd"
                          type={showCurrent ? 'text' : 'password'}
                          required
                          value={currentPassword}
                          onChange={(e) => { setCurrentPassword(e.target.value); setCurrentPasswordError(null); }}
                          placeholder="••••••••"
                          className={`w-full px-4 py-2.5 pr-10 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                            currentPasswordError ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]'
                          }`}
                        />
                        <button type="button" onClick={() => setShowCurrent((v) => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {currentPasswordError && <p className="text-xs text-red-500 mt-1">{currentPasswordError}</p>}
                    </div>

                    <div>
                      <label htmlFor="settings-new-pwd" className="block text-xs text-slate-500 mb-1">New Password</label>
                      <div className="relative">
                        <input
                          id="settings-new-pwd"
                          type={showNew ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
                        />
                        <button type="button" onClick={() => setShowNew((v) => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {newPassword.length > 0 && (
                        <div className="mt-2">
                          <div className="flex gap-1">
                            {[0, 1, 2, 3].map((i) => (
                              <div key={i} className={`h-1 flex-1 rounded-full ${i < strengthScore - 1 ? strengthColor : 'bg-slate-100'}`} />
                            ))}
                          </div>
                          <p className={`text-[11px] font-semibold mt-1 ${
                            strengthScore <= 2 ? 'text-red-500' : strengthScore <= 4 ? 'text-amber-500' : 'text-emerald-600'
                          }`}>
                            {strengthLabel}
                          </p>
                          <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
                            {[
                              { key: 'length', label: 'At least 8 characters' },
                              { key: 'upper', label: '1 uppercase letter' },
                              { key: 'lower', label: '1 lowercase letter' },
                              { key: 'digit', label: '1 number' },
                              { key: 'special', label: '1 special character' },
                            ].map((c) => (
                              <li key={c.key} className={`text-[11px] flex items-center gap-1 ${checks[c.key as keyof typeof checks] ? 'text-emerald-600' : 'text-slate-400'}`}>
                                <CheckCircle2 size={11} /> {c.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="settings-confirm-pwd" className="block text-xs text-slate-500 mb-1">Confirm New Password</label>
                      <div className="relative">
                        <input
                          id="settings-confirm-pwd"
                          type={showConfirm ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
                        />
                        <button type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={changingPassword || !passwordFormValid}
                      className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {changingPassword ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                      {changingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>

                  <div className="mt-4 p-4 rounded-xl border border-emerald-100 bg-emerald-50">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Shield size={16} className="text-emerald-600" />
                          <div className="font-semibold text-emerald-700 text-sm">Two-Factor Authentication</div>
                        </div>
                        <p className="text-xs text-emerald-600">
                          {twoFactorEnabled ? '2FA is enabled for your account.' : '2FA is currently disabled for your account.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleTwoFactor}
                        disabled={savingTwoFactor}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0 ${
                          twoFactorEnabled ? 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {savingTwoFactor ? <Loader2 size={13} className="animate-spin" /> : twoFactorEnabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                    {twoFactorEnabled && (
                      <div className="mt-3 pt-3 border-t border-emerald-100 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={generateBackupCodes}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          Regenerate Backup Codes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {showBackupCodes && backupCodes && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" role="button" tabIndex={0} onClick={() => setShowBackupCodes(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowBackupCodes(false); }} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 p-6">
                <h2 className="font-bold text-slate-900 text-lg mb-1">Backup Recovery Codes</h2>
                <p className="text-xs text-slate-500 mb-4">
                  Save these codes somewhere safe. Each code can be used once to sign in if you lose access to your authenticator app.
                </p>
                <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm text-slate-700 mb-4">
                  {backupCodes.map((code) => (
                    <div key={code}>{code}</div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(backupCodes.join('\n'));
                      showToast('Backup codes copied to clipboard', 'success');
                    }}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Copy Codes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBackupCodes(false)}
                    className="flex-1 px-4 py-2.5 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddMember && (
        <TeamMemberModal
          roles={roles}
          onClose={() => setShowAddMember(false)}
          onSaved={reloadTeam}
        />
      )}
      {memberToEdit && (
        <TeamMemberModal
          roles={roles}
          memberToEdit={memberToEdit}
          onClose={() => setMemberToEdit(undefined)}
          onSaved={reloadTeam}
        />
      )}
    </div>
  );
}
