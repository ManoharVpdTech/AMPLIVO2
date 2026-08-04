'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useCrmStore } from '@/store/crmStore';
import { useAuthStore } from '@/store/authStore';
import { EmployeeHeader } from '@/components/employee/EmployeeHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Mail, Phone, MapPin, Briefcase, Calendar, Edit3, Camera, X, Check, Save } from 'lucide-react';

export default function EmployeeProfile() {
  const user = useAuthStore((state) => state.user);
  const { activeEmployeeId, getEmployeeById, getProjectsByEmployee, getTasksByEmployee, updateEmployee } = useCrmStore();
  const currentId = activeEmployeeId || user?.id || '';
  const storeEmployee = getEmployeeById(currentId);

  const employee = useMemo(() => {
    return storeEmployee || {
      id: user?.id || 'EMP-001',
      firstName: user?.name ? user.name.split(' ')[0] : 'Alex',
      lastName: user?.name ? user.name.split(' ').slice(1).join(' ') : 'Strategist',
      email: user?.email || 'digital.marketing.strategist@amplivo.employee',
      phone: '',
      avatar: '',
      role: user?.role || 'Staff',
      designation: 'Digital Strategist',
      department: 'Marketing',
      skills: ['Strategy', 'Analytics', 'Growth'],
      joinDate: '2023-01-15',
      workloadPercent: 70,
      availability: 'Available',
    };
  }, [storeEmployee, user?.id, user?.name, user?.email, user?.role]);

  const projects = getProjectsByEmployee(currentId);
  const tasks = getTasksByEmployee(currentId);

  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    skills: '',
  });
  const [isSaved, setIsSaved] = useState(false);

  const skillsStr = employee.skills ? employee.skills.join(', ') : '';

  useEffect(() => {
    setFormData({
      firstName: employee.firstName ?? '',
      lastName: employee.lastName ?? '',
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      skills: skillsStr,
    });
  }, [employee.id, employee.firstName, employee.lastName, employee.email, employee.phone, skillsStr]);

  const fullName = `${employee.firstName} ${employee.lastName}`.trim() || 'Employee';

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && employee) {
      const imageUrl = URL.createObjectURL(file);
      updateEmployee(employee.id, { avatar: imageUrl });
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (employee) {
      updateEmployee(employee.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
      });
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        setIsEditing(false);
      }, 1200);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <EmployeeHeader title="My Profile" subtitle="Manage your personal details" />
      
      <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
        
        {/* Profile Card Header with Edit Trigger */}
        <div className="flex justify-end">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {isEditing ? <X size={16} /> : <Edit3 size={16} />}
            {isEditing ? 'Cancel Editing' : 'Edit Profile'}
          </button>
        </div>

        {/* Modal / Section for Editing Profile directly on Profile Page */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-6 shadow-sm space-y-4 animate-in fade-in duration-200">
            <h3 className="font-bold text-indigo-900 text-lg mb-2">Edit Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Skills (comma separated)</label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="React, Node.js, Growth"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-5 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  isSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSaved ? <Check size={16} /> : <Save size={16} />}
                {isSaved ? 'Saved!' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Profile Info Card */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center relative">
              
              {/* BUG-01 Fix: Interactive Profile Avatar Container with Fallback Initials & Photo Upload */}
              <div className="relative group mb-4">
                <Avatar
                  name={fullName}
                  image={employee.avatar}
                  size="lg"
                  className="w-24 h-24 text-3xl shadow-sm border-2 border-indigo-100"
                />
                
                {/* Upload Photo Button Overlay */}
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
                  className="absolute inset-0 bg-slate-900/60 rounded-full text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium gap-1"
                  title="Upload Photo"
                >
                  <Camera size={18} />
                  <span>Change</span>
                </button>
              </div>

              <h2 className="text-xl font-bold text-slate-900">{fullName}</h2>
              <p className="text-sm text-indigo-600 font-medium mb-1">{employee.designation || employee.role || 'Staff'}</p>
              <p className="text-xs text-slate-500 mb-6">{employee.department || 'Department'}</p>
              
              <div className="w-full pt-6 border-t border-slate-100 space-y-4 text-sm text-left">
                {/* BUG-02 Fix: Responsive Email Wrapping */}
                <div className="flex items-start gap-3 text-slate-600 min-w-0">
                  <Mail size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  <span className="break-all text-xs font-medium text-slate-700 min-w-0 flex-1" title={employee.email}>
                    {employee.email || 'No email provided'}
                  </span>
                </div>
                
                {/* BUG-03 Fix: Phone Number Display with "Not provided" Fallback */}
                <div className="flex items-center gap-3 text-slate-600 min-w-0">
                  <Phone size={16} className="text-slate-400 shrink-0" />
                  {employee.phone ? (
                    <span className="text-xs font-medium text-slate-700">{employee.phone}</span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Not provided</span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 text-slate-600">
                  <Calendar size={16} className="text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-600">Joined {employee.joinDate || 'recently'}</span>
                </div>
              </div>
            </div>
            
            {/* Workload & Status */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Briefcase size={16} className="text-slate-400" /> Workload & Status
              </h3>
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Current Workload</span>
                  <span className="font-medium text-slate-900">{employee.workloadPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${
                    employee.workloadPercent > 80 ? 'bg-red-500' :
                    employee.workloadPercent > 50 ? 'bg-amber-500' : 'bg-green-500'
                  }`} style={{ width: `${employee.workloadPercent}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-500 text-xs">Status</span>
                <span className="font-medium px-2.5 py-1 bg-green-50 text-green-700 rounded-md text-xs border border-green-200">
                  {employee.availability || 'Available'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-900">Skills & Expertise</h3>
              </div>
              <div className="p-6">
                {employee.skills && employee.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {employee.skills.map((skill, i) => (
                      <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No skills listed yet.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Current Responsibilities</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="text-3xl font-bold text-slate-900 mb-1">{projects.length}</div>
                    <div className="text-xs text-slate-500 font-medium">Active Projects</div>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="text-3xl font-bold text-slate-900 mb-1">{tasks.filter(t => t.status !== 'DONE').length}</div>
                    <div className="text-xs text-slate-500 font-medium">Active Tasks</div>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="text-3xl font-bold text-slate-900 mb-1">{tasks.filter(t => t.status === 'DONE').length}</div>
                    <div className="text-xs text-slate-500 font-medium">Completed Tasks</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
