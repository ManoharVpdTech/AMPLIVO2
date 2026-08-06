'use client';

import React from 'react';
import { Settings, User, Bell, Lock, Shield, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function CrmSettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account and CRM preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-1">
          {[
            { id: 'profile', label: 'Profile Settings', icon: User },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'security', label: 'Security', icon: Lock },
            { id: 'team', label: 'Team Access', icon: Shield },
          ].map((item, idx) => (
            <button
              key={item.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                idx === 0 
                  ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#12141f] border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-6">Profile Settings</h2>
            
            <div className="flex items-center gap-6 mb-8 pb-8 border-b border-white/5">
              <div className="w-20 h-20 rounded-full bg-violet-600/20 border-2 border-violet-500/30 flex items-center justify-center text-2xl font-bold text-violet-400">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div>
                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors">
                  Upload Photo
                </button>
                <p className="text-xs text-slate-500 mt-2">JPG, GIF or PNG. Max size 2MB.</p>
              </div>
            </div>

            <form className="space-y-5" onSubmit={e => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="crm-fullname" className="text-xs font-medium text-slate-400">Full Name <span className="text-red-500">*</span></label>
                  <input 
                    id="crm-fullname"
                    type="text"
                    pattern="[A-Za-z\s]+"
                    title="Only letters and spaces are allowed"
                    defaultValue={user?.name || 'CRM Admin'}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="crm-role" className="text-xs font-medium text-slate-400">Role</label>
                  <input 
                    id="crm-role"
                    type="text" 
                    defaultValue={user?.role || 'Admin'}
                    disabled
                    className="w-full bg-[#0d0f17] border border-white/5 rounded-lg px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="crm-email" className="text-xs font-medium text-slate-400">Email Address <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      id="crm-email"
                      type="email" 
                      defaultValue={user?.email || 'crm@amplivo.in'}
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
