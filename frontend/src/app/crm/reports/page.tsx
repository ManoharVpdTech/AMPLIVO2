'use client';

import React from 'react';
import {
  BarChart3, TrendingUp, Users, Building2, IndianRupee,
  Calendar, PieChart, Activity
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart as RePieChart, Pie, Cell
} from 'recharts';

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#12141f] border border-white/10 p-3 rounded-lg shadow-xl">
        <p className="text-white font-medium mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm" style={{ color: p.color }}>
            {p.name}: {p.value.toLocaleString('en-IN')}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function CrmReportsPage() {
  const { leads, clients, payments, projects } = useCrmStore();

  // Real last-6-months revenue, aggregated from actually-verified payments
  // (status === 'Paid') by month - this used to be 5 hardcoded fake numbers
  // with only the current month backed by real data.
  const verifiedPayments = payments.filter(p => p.status === 'Paid');
  const revenueData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const actual = verifiedPayments
      .filter(p => {
        const pd = new Date(p.date);
        return `${pd.getFullYear()}-${pd.getMonth()}` === monthKey;
      })
      .reduce((s, p) => s + p.amount, 0);
    return { name: d.toLocaleDateString('en-IN', { month: 'short' }), actual, projected: actual };
  });
  const lastMonthRevenue = revenueData[5].actual;
  const prevMonthRevenue = revenueData[4].actual;
  let revenueDeltaPct = 0;
  if (prevMonthRevenue > 0) {
    revenueDeltaPct = Math.round(((lastMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
  } else if (lastMonthRevenue > 0) {
    revenueDeltaPct = 100;
  }

  // Lead Conversion Funnel
  const funnelData = [
    { stage: 'Total Leads Received', value: leads.length },
    { stage: 'Pending Review', value: leads.filter(l => l.crmStatus === 'Pending Review').length },
    { stage: 'Approved', value: leads.filter(l => l.crmStatus !== 'Pending Review' && l.crmStatus !== 'Rejected').length },
    { stage: 'Converted to Client', value: clients.length },
  ];

  // Services Distribution
  const servicesMap: Record<string, number> = {};
  clients.forEach(c => c.services.forEach(s => {
    servicesMap[s] = (servicesMap[s] || 0) + 1;
  }));
  const servicesData = Object.entries(servicesMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Key performance indicators and business metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#12141f] p-5 rounded-xl border border-white/5">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-500 text-sm">Total Revenue ({revenueData[5].name})</p>
            <IndianRupee className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-white">₹{(lastMonthRevenue / 100000).toFixed(2)}L</p>
          <p className={`text-xs mt-1 flex items-center gap-1 ${revenueDeltaPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <TrendingUp className="w-3 h-3" /> {revenueDeltaPct >= 0 ? '+' : ''}{revenueDeltaPct}% vs {revenueData[4].name}
          </p>
        </div>

        <div className="bg-[#12141f] p-5 rounded-xl border border-white/5">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-500 text-sm">Active Clients</p>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-white">{clients.length}</p>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {clients.filter(c => c.status === 'Active').length} active, {clients.filter(c => c.status === 'Onboarding').length} onboarding
          </p>
        </div>

        <div className="bg-[#12141f] p-5 rounded-xl border border-white/5">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-500 text-sm">Active Projects</p>
            <Activity className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-2xl font-bold text-white">{projects.filter(p => p.status === 'In Progress').length}</p>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Across {clients.length} clients
          </p>
        </div>

        <div className="bg-[#12141f] p-5 rounded-xl border border-white/5">
          <div className="flex justify-between items-start mb-2">
            <p className="text-slate-500 text-sm">Lead Conversion</p>
            <Users className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-white">{leads.length > 0 ? Math.round((clients.length / leads.length) * 100) : 0}%</p>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Users className="w-3 h-3" /> {clients.length} of {leads.length} leads converted
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-[#12141f] p-5 rounded-xl border border-white/5">
          <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            Revenue Growth
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `₹${v/100000}L`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff05' }} />
                <Bar dataKey="actual" name="Actual Revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="projected" name="Projected" fill="#3b82f6" fillOpacity={0.3} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel Chart */}
        <div className="bg-[#12141f] p-5 rounded-xl border border-white/5">
          <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Sales to CRM Funnel
          </h2>
          <div className="space-y-4">
            {funnelData.map((item, idx) => {
              const max = funnelData[0].value;
              const pct = max > 0 ? Math.round((item.value / max) * 100) : 0;
              return (
                <div key={item.stage} className="relative">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">{item.stage}</span>
                    <span className="text-slate-400">{item.value} ({pct}%)</span>
                  </div>
                  <div className="h-8 bg-white/5 rounded-lg overflow-hidden relative border border-white/5">
                    <div 
                      className={`absolute inset-y-0 left-0 transition-all ${
                        idx === 0 ? 'bg-slate-700' :
                        idx === 1 ? 'bg-violet-600/70' :
                        idx === 2 ? 'bg-violet-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Services Distribution */}
        <div className="bg-[#12141f] p-5 rounded-xl border border-white/5">
          <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-400" />
            Services Distribution
          </h2>
          <div className="h-64 flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={servicesData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {servicesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-3">
              {servicesData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{entry.name}</p>
                    <p className="text-xs text-slate-500">{entry.value} active clients</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
