'use client';
import { useMemo, useState } from 'react';
import { Application, ApplicationStatus } from '@/types/hr';
import { StatusChip } from './StatusChip';
import Link from 'next/link';
import { Search, Filter, Eye, MoreVertical, X } from 'lucide-react';

interface ApplicationsTableProps {
  applications: Application[];
}

const STATUS_OPTIONS: ApplicationStatus[] = ['New', 'Screening', 'Shortlisted', 'Interviewing', 'Offered', 'Hired', 'Rejected'];

export function ApplicationsTable({ applications }: ApplicationsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'All' | ApplicationStatus>('All');
  const [positionFilter, setPositionFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const positions = useMemo(() => Array.from(new Set(applications.map(a => a.jobTitle))).sort((a, b) => a.localeCompare(b)), [applications]);
  const departments = useMemo(() => Array.from(new Set(applications.map(a => a.department))).sort((a, b) => a.localeCompare(b)), [applications]);
  const locations = useMemo(() => Array.from(new Set(applications.map(a => a.location).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [applications]);

  const activeFilterCount = [
    statusFilter !== 'All',
    positionFilter !== 'All',
    departmentFilter !== 'All',
    locationFilter !== 'All',
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter('All');
    setPositionFilter('All');
    setDepartmentFilter('All');
    setLocationFilter('All');
    setDateFrom('');
    setDateTo('');
  };

  const filtered = applications.filter(app => {
    const matchesSearch =
      app.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || app.status === statusFilter;
    const matchesPosition = positionFilter === 'All' || app.jobTitle === positionFilter;
    const matchesDepartment = departmentFilter === 'All' || app.department === departmentFilter;
    const matchesLocation = locationFilter === 'All' || app.location === locationFilter;
    const appliedDate = app.appliedDate ? app.appliedDate.slice(0, 10) : '';
    const matchesDateFrom = !dateFrom || (appliedDate && appliedDate >= dateFrom);
    const matchesDateTo = !dateTo || (appliedDate && appliedDate <= dateTo);
    return matchesSearch && matchesStatus && matchesPosition && matchesDepartment && matchesLocation && matchesDateFrom && matchesDateTo;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidates, roles, or departments..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          aria-expanded={filtersOpen}
          className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-colors ${
            filtersOpen || activeFilterCount > 0
              ? 'bg-[#4C1D95]/5 border-[#4C1D95]/30 text-[#4C1D95]'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Filter size={16} /> Filters
          {activeFilterCount > 0 && (
            <span className="bg-[#4C1D95] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {filtersOpen && (
        <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="filter-app-status" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
            <select
              id="filter-app-status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'All' | ApplicationStatus)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] min-w-[140px]"
            >
              <option value="All">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-app-position" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Applied Position</label>
            <select
              id="filter-app-position"
              value={positionFilter}
              onChange={e => setPositionFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] min-w-[160px]"
            >
              <option value="All">All Positions</option>
              {positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-app-dept" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
            <select
              id="filter-app-dept"
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] min-w-[140px]"
            >
              <option value="All">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-app-location" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Location</label>
            <select
              id="filter-app-location"
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] min-w-[140px]"
            >
              <option value="All">All Locations</option>
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="filter-app-date-from" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Applied From</label>
            <input
              id="filter-app-date-from"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
            />
          </div>
          <div>
            <label htmlFor="filter-app-date-to" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Applied To</label>
            <input
              id="filter-app-date-to"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
            />
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:text-rose-600 transition-colors"
            >
              <X size={14} /> Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors ml-auto"
          >
            Close
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-4 font-semibold">Candidate</th>
              <th className="px-6 py-4 font-semibold">Applied Position</th>
              <th className="px-6 py-4 font-semibold">Experience</th>
              <th className="px-6 py-4 font-semibold">Applied Date</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filtered.map(app => (
              <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4C1D95] to-[#EC4899] flex items-center justify-center text-white font-bold text-xs">
                      {app.candidateName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{app.candidateName}</div>
                      <div className="text-slate-500 text-xs">{app.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-700">{app.jobTitle}</div>
                  <div className="text-slate-500 text-xs">{app.department}</div>
                </td>
                <td className="px-6 py-4 text-slate-600">{app.experience}</td>
                <td className="px-6 py-4 text-slate-600">{new Date(app.appliedDate).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <StatusChip status={app.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/hr/applications/${app.id}`} className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-[#4C1D95] hover:bg-[#4C1D95]/10 rounded-lg transition-colors">
                    <Eye size={18} />
                  </Link>
                  <button className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1">
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No applications found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
