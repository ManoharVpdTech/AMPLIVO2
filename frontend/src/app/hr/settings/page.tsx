'use client';
import { useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Camera, Mail, Phone, Hash, Briefcase, PenLine, Save, Check } from 'lucide-react';

export default function HRSettingsPage() {
  const { user, updateUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: user?.name ?? 'HR Manager',
    phone: user?.phone ?? '',
    extension: user?.extension ?? '',
    designation: user?.designation ?? 'Talent Team',
    signature: user?.signature ?? '',
  });
  const [saved, setSaved] = useState(false);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      updateUser({ image: imageUrl });
    }
  };

  const handleSaveProfile = () => {
    updateUser({
      name: form.name,
      phone: form.phone,
      extension: form.extension,
      designation: form.designation,
      signature: form.signature,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "'Sora', sans-serif" }}>Settings</h1>
        <p className="text-slate-500">Manage HR Portal preferences and configurations.</p>
      </div>

      {/* Profile / My Account */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-1">My Account</h3>
        <p className="text-slate-500 text-sm mb-6">Your profile details and contact metadata used on candidate notifications.</p>

        <div className="flex items-start gap-6 flex-wrap">
          <div className="relative group flex-shrink-0">
            <Avatar name={form.name || 'HR Manager'} image={user?.image} size="lg" className="w-20 h-20 text-2xl" />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-slate-900/60 rounded-full text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium gap-1"
              title="Upload Photo"
            >
              <Camera size={16} />
              <span>Change</span>
            </button>
          </div>

          <div className="flex-1 min-w-[280px] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="hr-settings-name" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Display Name</label>
              <input
                id="hr-settings-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            </div>
            <div>
              <label htmlFor="hr-settings-email" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Mail size={11} className="inline mr-1" />Email
              </label>
              <input
                id="hr-settings-email"
                type="email"
                value={user?.email ?? ''}
                disabled
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="hr-settings-phone" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Phone size={11} className="inline mr-1" />Phone Number
              </label>
              <input
                id="hr-settings-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            </div>
            <div>
              <label htmlFor="hr-settings-ext" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Hash size={11} className="inline mr-1" />Extension
              </label>
              <input
                id="hr-settings-ext"
                type="text"
                value={form.extension}
                onChange={(e) => setForm({ ...form, extension: e.target.value })}
                placeholder="e.g. 204"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="hr-settings-title" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <Briefcase size={11} className="inline mr-1" />Job Title
              </label>
              <input
                id="hr-settings-title"
                type="text"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="Talent Team"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="hr-settings-signature" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                <PenLine size={11} className="inline mr-1" />Email Signature
              </label>
              <textarea
                id="hr-settings-signature"
                value={form.signature}
                onChange={(e) => setForm({ ...form, signature: e.target.value })}
                rows={3}
                placeholder={'Best regards,\nHR Team, Amplivo'}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] resize-none"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">Appended automatically to offer letters, rejections, and interview invitations sent to candidates.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSaveProfile}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${
              saved ? 'bg-emerald-600' : 'bg-[#4C1D95] hover:bg-[#3B1574]'
            }`}
          >
            {saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
