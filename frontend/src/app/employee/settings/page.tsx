'use client';

import { useState, useEffect } from 'react';
import { useCrmStore } from '@/store/crmStore';
import { EmployeeHeader } from '@/components/employee/EmployeeHeader';
import { User, Bell, Mail, Save, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function EmployeeSettings() {
  const { activeEmployeeId, employees, updateEmployee } = useCrmStore();
  const activeEmployee = employees.find(e => e.id === activeEmployeeId);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    skills: '',
  });
  
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (activeEmployee) {
      setFormData({
        firstName: activeEmployee.firstName ?? '',
        lastName: activeEmployee.lastName ?? '',
        email: activeEmployee.email ?? '',
        skills: activeEmployee.skills ? activeEmployee.skills.join(', ') : '',
      });
    }
  }, [activeEmployee]);

  // BUG-06 Fix: Determine if form state is dirty (modified from original values)
  const initialFirstName = activeEmployee?.firstName ?? '';
  const initialLastName = activeEmployee?.lastName ?? '';
  const initialEmail = activeEmployee?.email ?? '';
  const initialSkills = activeEmployee?.skills ? activeEmployee.skills.join(', ') : '';

  const isDirty = 
    formData.firstName !== initialFirstName ||
    formData.lastName !== initialLastName ||
    formData.email !== initialEmail ||
    formData.skills !== initialSkills;

  const handleSaveProfile = () => {
    if (activeEmployeeId && isDirty) {
      updateEmployee(activeEmployeeId, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <EmployeeHeader title="Settings" subtitle="Manage your portal preferences" />
      
      <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
        
        {/* Edit Profile Form */}
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-indigo-100 bg-indigo-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="text-indigo-600" size={20} />
              <h3 className="font-bold text-indigo-900">Edit Profile</h3>
            </div>
            {/* BUG-05 Fix: Clear IA navigation link directly to My Profile page */}
            <Link 
              href="/employee/profile" 
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 hover:underline"
            >
              Go to My Profile <ExternalLink size={12} />
            </Link>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <input 
                  type="text" 
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                <input 
                  type="text" 
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Skills (comma separated)</label>
                <input 
                  type="text" 
                  value={formData.skills}
                  onChange={(e) => setFormData({...formData, skills: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                  placeholder="React, Node.js, Design"
                />
              </div>
            </div>
            <div className="flex justify-end">
              {/* BUG-06 Fix: Save Changes button disabled when pristine */}
              <button 
                type="button"
                onClick={handleSaveProfile}
                disabled={!isDirty || isSaved}
                title={!isDirty ? "No changes to save" : undefined}
                className={`px-4 py-2 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <Save size={16} /> {isSaved ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Preferences</h3>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="text-slate-400" size={20} />
                <div>
                  <div className="font-medium text-slate-900 text-sm">Push Notifications</div>
                  <div className="text-xs text-slate-500">Receive alerts for new tasks and feedback.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="text-slate-400" size={20} />
                <div>
                  <div className="font-medium text-slate-900 text-sm">Email Digest</div>
                  <div className="text-xs text-slate-500">Receive daily summary of tasks and deadlines.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* BUG-07 Fix: Danger Zone data reset removed for standard employee role */}

      </div>
    </div>
  );
}
