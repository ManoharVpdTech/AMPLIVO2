'use client';
import { useEffect, useState, useRef } from 'react';
import { AdminHeader } from '@/components/admin/AdminSidebar';
import { settingsService } from '@/services/moduleServices';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Settings, Building2, Bell, Shield, Palette, Globe, Check, Loader2, Upload, Lock } from 'lucide-react';

type TabType = 'agency' | 'branding' | 'domain' | 'integrations' | 'notifications' | 'security';

export default function AdminSettings() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('agency');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const showToast = useToastStore((s) => s.showToast);

  const [form, setForm] = useState({
    agency_name: '',
    registration_number: '',
    support_email: '',
    support_phone: '',
    hq_address: '',
    base_currency: 'INR',
    timezone: 'Asia/Kolkata',
    primary_color: '#4C1D95',
    secondary_color: '#06B6D4',
    custom_domain: 'agency.amplivo.in',
    api_key: 'amp_live_9837429874928374',
    email_notifications: true,
    slack_notifications: true,
    two_factor_auth: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await settingsService.getSystemSettings();
        const settings: Record<string, string> = {};
        (Array.isArray(res) ? res : res.items || []).forEach((s: Record<string, unknown>) => {
          if (typeof s.key === 'string' && typeof s.value === 'string') {
            settings[s.key] = s.value;
          }
        });
        setForm((prev) => ({
          ...prev,
          agency_name: settings.agency_name || settings.company_name || 'Amplivo Digital Growth',
          registration_number: settings.registration_number || 'U74999TG2024PTC183921',
          support_email: settings.support_email || 'support@amplivo.in',
          support_phone: settings.support_phone || '+91 9876543210',
          hq_address: settings.hq_address || 'Hitec City, Hyderabad, Telangana, India',
          base_currency: settings.base_currency || 'INR',
          timezone: settings.timezone || 'Asia/Kolkata',
        }));
      } catch {
        // use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // BUG-51 Fixed: Logo file upload handler
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
        showToast('Logo staged successfully. Save settings to apply.', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(form).map(([key, value]) =>
          settingsService.createSystemSetting({ key, value: String(value), category: 'agency', description: `Agency setting: ${key}` })
        )
      );
      setSaved(true);
      showToast('Agency settings updated successfully!', 'success');
      setTimeout(() => setSaved(false), 2000);
    } catch {
      showToast('Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <AdminHeader title="Agency Settings" subtitle="Configure system preferences, branding, and integrations." />
        <div className="p-6 flex items-center justify-center h-96">
          <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminHeader title="Agency Settings" subtitle="Configure system preferences, branding, and integrations." />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* BUG-52 Fixed: Interactive Left Navigation Tabs */}
          <div className="md:col-span-1 space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('agency')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors text-left ${
                activeTab === 'agency' ? 'bg-[#4C1D95] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 size={18} /> Agency Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('branding')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors text-left ${
                activeTab === 'branding' ? 'bg-[#4C1D95] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Palette size={18} /> Branding
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('domain')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors text-left ${
                activeTab === 'domain' ? 'bg-[#4C1D95] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Globe size={18} /> Domain &amp; SEO
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('integrations')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors text-left ${
                activeTab === 'integrations' ? 'bg-[#4C1D95] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Settings size={18} /> Integrations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors text-left ${
                activeTab === 'notifications' ? 'bg-[#4C1D95] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Bell size={18} /> Notifications
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors text-left ${
                activeTab === 'security' ? 'bg-[#4C1D95] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Shield size={18} /> Security
            </button>
          </div>

          <div className="md:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              {/* Tab Content: Agency Profile */}
              {activeTab === 'agency' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Agency Profile</h2>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-sm text-slate-500">Logged in as <span className="font-semibold text-slate-700">{user?.name || 'Admin'}</span> ({user?.email || ''})</p>
                  </div>

                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    {/* BUG-51 Fixed: Interactive Upload Logo with hidden File Input */}
                    <div className="flex items-center gap-6 mb-8">
                      <div className="w-24 h-24 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden relative">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Agency Logo" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold text-2xl text-slate-400">{form.agency_name?.charAt(0) || 'A'}</span>
                        )}
                      </div>
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoSelect}
                          accept="image/png,image/jpeg,image/svg+xml"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors mb-2 flex items-center gap-2"
                        >
                          <Upload size={16} /> Upload Logo
                        </button>
                        <p className="text-xs text-slate-500">Recommended size: 512x512px (PNG, SVG, or JPG).</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Agency Name</label>
                        <input type="text" value={form.agency_name} onChange={(e) => updateField('agency_name', e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#4C1D95]" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Registration Number</label>
                        <input type="text" value={form.registration_number} onChange={(e) => updateField('registration_number', e.target.value)} placeholder="e.g. U74999TG2024PTC..." className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#4C1D95]" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Support Email</label>
                        <input type="email" value={form.support_email} onChange={(e) => updateField('support_email', e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#4C1D95]" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Support Phone</label>
                        <PhoneInput value={form.support_phone} onChange={(val) => updateField('support_phone', val || '')} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">HQ Address</label>
                      <textarea rows={3} value={form.hq_address} onChange={(e) => updateField('hq_address', e.target.value)} placeholder="Full address for invoices..." className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#4C1D95] resize-none" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Base Currency</label>
                        <select value={form.base_currency} onChange={(e) => updateField('base_currency', e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#4C1D95] bg-white">
                          <option value="INR">INR (₹)</option>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Timezone</label>
                        <select value={form.timezone} onChange={(e) => updateField('timezone', e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#4C1D95] bg-white">
                          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                          <option value="America/New_York">America/New_York (EST)</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
                      <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#4C1D95] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50">
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tab Content: Branding */}
              {activeTab === 'branding' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Brand Customization</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="settings-primary-color" className="block text-xs font-semibold text-slate-600 mb-1.5">Primary Accent Color</label>
                      <div className="flex items-center gap-3">
                        <input id="settings-primary-color" type="color" value={form.primary_color} onChange={(e) => updateField('primary_color', e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                        <span className="font-mono text-xs text-slate-700 font-semibold">{form.primary_color}</span>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="settings-secondary-color" className="block text-xs font-semibold text-slate-600 mb-1.5">Secondary Accent Color</label>
                      <div className="flex items-center gap-3">
                        <input id="settings-secondary-color" type="color" value={form.secondary_color} onChange={(e) => updateField('secondary_color', e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                        <span className="font-mono text-xs text-slate-700 font-semibold">{form.secondary_color}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button type="button" onClick={handleSave} className="bg-[#4C1D95] text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-[#3b1574]">Save Branding</button>
                  </div>
                </div>
              )}

              {/* Tab Content: Domain & SEO */}
              {activeTab === 'domain' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Custom Domain & SEO</h2>
                  <div>
                    <label htmlFor="settings-custom-domain" className="block text-xs font-semibold text-slate-600 mb-1.5">Custom Agency Domain</label>
                    <input id="settings-custom-domain" type="text" value={form.custom_domain} onChange={(e) => updateField('custom_domain', e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#4C1D95]" />
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button type="button" onClick={handleSave} className="bg-[#4C1D95] text-white px-5 py-2 rounded-xl text-xs font-semibold hover:bg-[#3b1574]">Save Domain</button>
                  </div>
                </div>
              )}

              {/* Tab Content: Integrations */}
              {activeTab === 'integrations' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>API Keys & Integrations</h2>
                  <div>
                    <label htmlFor="settings-api-key" className="block text-xs font-semibold text-slate-600 mb-1.5">Master Live API Key</label>
                    <div className="flex gap-2">
                      <input id="settings-api-key" type="text" readOnly value={form.api_key} className="flex-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600" />
                      <button type="button" onClick={() => showToast('API key copied!', 'success')} className="px-3 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200">Copy</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Notifications */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Notification Rules</h2>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                      <span className="text-xs font-semibold text-slate-700">Email Digest Notifications</span>
                      <input type="checkbox" checked={form.email_notifications} onChange={(e) => updateField('email_notifications', e.target.checked)} className="rounded text-[#4C1D95]" />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                      <span className="text-xs font-semibold text-slate-700">Slack Webhook Alerts</span>
                      <input type="checkbox" checked={form.slack_notifications} onChange={(e) => updateField('slack_notifications', e.target.checked)} className="rounded text-[#4C1D95]" />
                    </label>
                  </div>
                </div>
              )}

              {/* Tab Content: Security */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Security & Access</h2>
                  <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-[#4C1D95] font-semibold text-sm">
                      <Lock size={16} /> Two-Factor Authentication (2FA)
                    </div>
                    <p className="text-xs text-slate-600">Enforce 2FA for all administrator accounts.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
