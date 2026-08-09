'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Mail, Phone, Globe, MapPin, 
  Briefcase, IndianRupee, Calendar, CheckCircle, 
  FolderKanban, FileText, UserPlus
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';

export default function CrmClientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { getClientById, getProjectsForClient, employees, assignEmployeesToClient } = useCrmStore();
  
  const client = getClientById(params.id as string);
  const clientProjects = getProjectsForClient(params.id as string);
  
  const [showAssign, setShowAssign] = useState(false);
  const [selectedEmps, setSelectedEmps] = useState<string[]>(client?.assignedEmployees || []);

  if (!client) {
    return (
      <div className="p-6 text-center text-slate-400">
        <p>Client not found.</p>
        <button onClick={() => router.push('/crm/clients')} className="mt-4 text-violet-400 hover:underline">
          Back to Clients
        </button>
      </div>
    );
  }

  const handleSaveAssign = () => {
    assignEmployeesToClient(client.id, selectedEmps);
    setShowAssign(false);
  };

  // There's no backend concept of employees assigned directly to a Client
  // (only to Projects) - the real "account team" is the union of everyone
  // assigned across this client's actual projects.
  const assignedEmployeeIdSet = new Set(clientProjects.flatMap(p => p.assignedEmployeeIds));
  const assignedEmpsFull = employees.filter(e => assignedEmployeeIdSet.has(e.id));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/crm/clients" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{client.company}</h1>
            <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${
              client.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              client.status === 'Onboarding' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {client.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{client.clientId} · Since {client.startDate}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Details & Team */}
        <div className="space-y-6">
          {/* Contact Profile */}
          <div className="bg-[#12141f] border border-white/5 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Point of Contact</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center text-lg font-bold text-violet-400 shrink-0">
                  {client.firstName.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-medium">{client.firstName} {client.lastName}</p>
                  <p className="text-xs text-slate-500">{client.designation}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-300">{client.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-300">{client.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-300">{client.website || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-300">{client.city || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Team */}
          <div className="bg-[#12141f] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Account Team</h2>
              <button onClick={() => setShowAssign(!showAssign)} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> Assign
              </button>
            </div>
            
            {showAssign ? (
              <div className="space-y-3 mb-4">
                <div className="h-40 overflow-y-auto pr-2 space-y-1">
                  {employees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEmps.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedEmps([...selectedEmps, emp.id]);
                          else setSelectedEmps(selectedEmps.filter(id => id !== emp.id));
                        }}
                        className="rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/20"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{emp.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{emp.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveAssign} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium py-1.5 rounded transition-colors">
                    Save
                  </button>
                  <button onClick={() => setShowAssign(false)} className="px-3 bg-white/5 text-slate-400 hover:bg-white/10 text-xs font-medium py-1.5 rounded transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2 bg-violet-500/5 rounded-lg border border-violet-500/10">
                  <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center text-xs font-bold text-violet-400">
                    A
                  </div>
                  <div>
                    <p className="text-sm text-white">You (Admin)</p>
                    <p className="text-[10px] text-slate-500">Account Executive</p>
                  </div>
                </div>
                {assignedEmpsFull.map(emp => (
                  <div key={emp.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white">
                      {emp.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm text-white">{emp.name}</p>
                      <p className="text-[10px] text-slate-500">{emp.role}</p>
                    </div>
                  </div>
                ))}
                {assignedEmpsFull.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-2">No other team members assigned.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Projects & Financials */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#12141f] border border-white/5 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2 text-slate-400">
                <IndianRupee className="w-4 h-4" />
                <h3 className="text-sm font-medium">Monthly Retainer</h3>
              </div>
              <p className="text-2xl font-bold text-emerald-400">₹{client.monthlyRetainer.toLocaleString('en-IN')}</p>
              <p className="text-xs text-slate-500 mt-1">TCV: ₹{client.totalContractValue.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-[#12141f] border border-white/5 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2 text-slate-400">
                <Calendar className="w-4 h-4" />
                <h3 className="text-sm font-medium">Renewal Date</h3>
              </div>
              <p className="text-2xl font-bold text-white">{client.renewalDate || 'Not set'}</p>
              <p className="text-xs text-slate-500 mt-1">{client.status} Subscription</p>
            </div>
          </div>

          {/* Active Projects */}
          <div className="bg-[#12141f] border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-violet-400" />
                Client Projects
              </h2>
              <Link href="/crm/projects" className="text-xs text-violet-400 hover:text-violet-300">
                View all
              </Link>
            </div>
            
            <div className="space-y-3">
              {clientProjects.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500 bg-white/5 rounded-lg border border-white/5">
                  No projects created yet.
                </div>
              ) : (
                clientProjects.map(p => (
                  <Link key={p.id} href={`/crm/projects/${p.id}`} className="block">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{p.name}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                            {p.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{p.services.join(', ')}</p>
                      </div>
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="flex-1 sm:w-32">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Progress</span>
                            <span className="text-violet-400 font-medium">{p.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${p.progress}%` }} />
                          </div>
                        </div>
                        <div className="hidden sm:flex -space-x-2">
                          {p.assignedEmployeeIds.slice(0, 3).map((id, i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-slate-700 border border-[#12141f] flex items-center justify-center text-[10px] font-bold text-white">
                              {employees.find(e => e.id === id)?.name?.charAt(0) || 'U'}
                            </div>
                          ))}
                          {p.assignedEmployeeIds.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-white/10 border border-[#12141f] flex items-center justify-center text-[10px] font-bold text-slate-300">
                              +{p.assignedEmployeeIds.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
