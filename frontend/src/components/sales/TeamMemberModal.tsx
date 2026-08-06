'use client';
import { useState } from 'react';
import { X, User, Mail, AtSign, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { authService } from '@/services/authService';
import { userManagementService } from '@/services/crmService';

export interface TeamMemberRole {
  id: string;
  name: string;
}

export interface TeamMemberEditTarget {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  isActive: boolean;
}

interface TeamMemberModalProps {
  roles: TeamMemberRole[];
  memberToEdit?: TeamMemberEditTarget;
  onClose: () => void;
  onSaved: () => void;
}

function generateUsername(email: string): string {
  return email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30) || '';
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const array = new Uint32Array(12);
  window.crypto.getRandomValues(array);
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += chars[array[i] % chars.length];
  }
  return pwd;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const withResponse = err as { response?: { data?: { message?: string; detail?: string } } };
  return withResponse?.response?.data?.message || withResponse?.response?.data?.detail || fallback;
}

export function TeamMemberModal({ roles, memberToEdit, onClose, onSaved }: Readonly<TeamMemberModalProps>) {
  const isEdit = Boolean(memberToEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(memberToEdit?.name ?? '');
  const [email, setEmail] = useState(memberToEdit?.email ?? '');
  const [phone, setPhone] = useState(memberToEdit?.phone ?? '');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState(isEdit ? '' : generatePassword());
  const [roleId, setRoleId] = useState(memberToEdit?.roleId ?? '');
  const [isActive, setIsActive] = useState(memberToEdit?.isActive ?? true);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (!isEdit && !usernameTouched) setUsername(generateUsername(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }

    setLoading(true);
    try {
      if (isEdit && memberToEdit) {
        await userManagementService.updateUser(memberToEdit.id, {
          full_name: fullName,
          phone: phone || undefined,
          role_id: roleId || undefined,
        });
        if (isActive !== memberToEdit.isActive) {
          if (isActive) await userManagementService.activateUser(memberToEdit.id);
          else await userManagementService.deactivateUser(memberToEdit.id);
        }
      } else {
        if (!username.trim()) { setError('Username is required.'); setLoading(false); return; }
        if (password.length < 8) { setError('Temporary password must be at least 8 characters.'); setLoading(false); return; }
        const created = await authService.register({
          email,
          username,
          full_name: fullName,
          password,
        });
        if (roleId) {
          await userManagementService.updateUser(created.id, { role_id: roleId });
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, `Failed to ${isEdit ? 'update' : 'add'} team member.`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" role="button" tabIndex={0} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg" style={{ fontFamily: "'Sora', sans-serif" }}>
            {isEdit ? 'Edit Team Member' : 'Add Team Member'}
          </h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle size={15} className="flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="tm-fullname" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="tm-fullname"
                required
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tm-email" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="tm-email"
                required
                type="email"
                disabled={isEdit}
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          {!isEdit && (
            <div>
              <label htmlFor="tm-username" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <AtSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="tm-username"
                  required
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setUsernameTouched(true); }}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="tm-phone" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Phone Number</label>
            <input
              id="tm-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
            />
          </div>

          <div>
            <label htmlFor="tm-role" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Role</label>
            <select
              id="tm-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
            >
              <option value="">-- Unassigned --</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Status</label>
              <div className="flex gap-2">
                {[{ v: true, label: 'Active' }, { v: false, label: 'Inactive' }].map((opt) => {
                  let statusStyle = 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50';
                  if (isActive === opt.v) {
                    statusStyle = opt.v ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-600';
                  }
                  return (
                    <button
                      key={String(opt.v)}
                      type="button"
                      onClick={() => setIsActive(opt.v)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${statusStyle}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isEdit && (
            <div>
              <label htmlFor="tm-password" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Temporary Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="tm-password"
                  required
                  type="text"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
                />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  title="Generate new password"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#4C1D95] transition-colors"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Share this with the new team member — they can change it after logging in.</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50"
            >
              {loading ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Team Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
