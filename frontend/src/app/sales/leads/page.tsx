'use client';
import { useState, useEffect } from 'react';
import { SalesHeader } from '@/components/sales/SalesSidebar';
import { LeadStatusBadge } from '@/components/sales/LeadStatusBadge';
import { useSalesStore } from '@/store/salesStore';
import { SalesLeadStatus, SalesLead } from '@/types';
import { AddLeadModal } from '@/components/sales/AddLeadModal';
import { userManagementService } from '@/services/crmService';
import {
  Search, Plus, Filter, Download, ArrowUpDown, Mail, Phone, ExternalLink,
  TrendingUp, Star, AlertCircle, Edit, Trash2,
} from 'lucide-react';
import Link from 'next/link';

interface AssignableMember {
  id: string;
  name: string;
}

const STATUS_TABS: (SalesLeadStatus | 'All')[] = [
  'All', 'New', 'Contacted', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Ready for CRM',
];

const PRIORITY_COLOR: Record<string, string> = {
  Critical: 'text-red-500',
  High: 'text-orange-500',
  Medium: 'text-amber-500',
  Low: 'text-slate-400',
};

export default function SalesLeadsPage() {
  const { leads, fetchLeads, deleteLead, editLead } = useSalesStore();
  const [search, setSearch] = useState('');
  const [assignMenuFor, setAssignMenuFor] = useState<string | null>(null);
  const [assignableMembers, setAssignableMembers] = useState<AssignableMember[]>([]);
  const [activeTab, setActiveTab] = useState<SalesLeadStatus | 'All'>('All');
  const [sortBy, setSortBy] = useState<'budget' | 'date' | 'name'>('date');
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<SalesLead | undefined>(undefined);

  // Granular filters
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterSource, setFilterSource] = useState<string>('All');

  // Client-side pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    userManagementService.getUsers({ page_size: 100 })
      .then((res) => {
        const users = Array.isArray(res) ? res : res?.items || [];
        setAssignableMembers(
          users.map((u: Record<string, unknown>) => ({
            id: typeof u.id === 'string' ? u.id : String(u.id ?? ''),
            name: typeof u.full_name === 'string' ? u.full_name : typeof u.name === 'string' ? u.name : typeof u.email === 'string' ? u.email : 'Unnamed',
          }))
        );
      })
      .catch(() => setAssignableMembers([]));
  }, []);

  const handleAssign = async (leadId: string, memberId: string) => {
    setAssignMenuFor(null);
    try {
      await editLead(leadId, { assigned_to: memberId || undefined });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update assignment.');
    }
  };

  // Reset page when filters/sorting change - adjusted directly during render
  // (rather than in an effect) since it only depends on this render's props.
  const filterKey = `${search}|${activeTab}|${sortBy}|${filterPriority}|${filterSource}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // 1. Deduplicate leads: by email when present, otherwise by name+company+phone
  // so blank-email duplicates (e.g. two identical "unnamed" imports) aren't both shown.
  const uniqueLeads = leads.filter((lead, index, self) => {
    if (lead.email) {
      return self.findIndex(l => l.email && l.email.toLowerCase() === lead.email.toLowerCase()) === index;
    }
    const fallbackKey = `${lead.firstName}|${lead.lastName}|${lead.company}|${lead.phone}`.toLowerCase();
    return self.findIndex(l => {
      if (l.email) return false;
      return `${l.firstName}|${l.lastName}|${l.company}|${l.phone}`.toLowerCase() === fallbackKey;
    }) === index;
  });

  // 2. Filter & Sort leads
  const filtered = uniqueLeads
    .filter((l) => activeTab === 'All' || l.status === activeTab)
    .filter((l) => filterPriority === 'All' || l.priority === filterPriority)
    .filter((l) => filterSource === 'All' || l.source.toUpperCase() === filterSource.toUpperCase())
    .filter((l) => {
      const q = search.toLowerCase();
      return (
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.industry.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'budget') return b.budget - a.budget;
      if (sortBy === 'name') return a.firstName.localeCompare(b.firstName);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedLeads = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleDeleteLead = async (leadId: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete lead "${name}"?`)) {
      try {
        await deleteLead(leadId);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete lead.');
      }
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Title', 'Contact Name', 'Company', 'Email', 'Phone', 'Status', 'Priority', 'Budget', 'Source', 'Assigned To'];
    const rows = filtered.map(l => [
      l.id,
      l.title || '',
      `${l.firstName} ${l.lastName}`.trim(),
      l.company || '',
      l.email || '',
      l.phone || '',
      l.status,
      l.priority,
      l.budget,
      l.source,
      l.assignedTo
    ]);
    // Bug 9 fixed: use Blob + URL.createObjectURL so special chars/commas/quotes are handled correctly
    const csvContent = [headers, ...rows]
      .map(row => row.map(val => `"${String(val).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const counts = STATUS_TABS.reduce<Record<string, number>>((acc, tab) => {
    acc[tab] = tab === 'All' ? uniqueLeads.length : uniqueLeads.filter((l) => l.status === tab).length;
    return acc;
  }, {});

  return (
    <div>
      <SalesHeader
        title="Leads"
        badge={`${leads.length} Total`}
        subtitle="Manage your sales pipeline"
        actions={
          <button
            type="button"
            onClick={() => setShowAddLeadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors"
          >
            <Plus size={15} /> Add Lead
          </button>
        }
      />

      <div className="p-6 space-y-5">
        {/* Status Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              type="button"
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                activeTab === tab
                  ? 'bg-[#4C1D95] text-white border-[#4C1D95]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#4C1D95]/30 hover:text-[#4C1D95]'
              }`}
            >
              {tab}
              {counts[tab] > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, email..."
              className="w-full pl-9 pr-4 py-2.5 bg-white text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95]"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'budget' | 'date' | 'name')}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20"
            >
              <option value="date">Sort: Latest</option>
              <option value="budget">Sort: Budget</option>
              <option value="name">Sort: Name</option>
            </select>
            <button
              type="button"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`flex items-center gap-2 px-3 py-2 border text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors ${
                showFilterPanel || filterPriority !== 'All' || filterSource !== 'All'
                  ? 'border-[#4C1D95] text-[#4C1D95] bg-[#4C1D95]/5'
                  : 'bg-white border-slate-200'
              }`}
            >
              <Filter size={14} /> Filter
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Download size={14} /> Export
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilterPanel && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 items-center animate-fade-in-up">
            <div>
              <label htmlFor="filter-priority" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
              <select
                id="filter-priority"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none"
              >
                <option value="All">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label htmlFor="filter-source" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Source</label>
              <select
                id="filter-source"
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none"
              >
                <option value="All">All Sources</option>
                <option value="Contact Form">Contact Form</option>
                <option value="Referral">Referral</option>
                <option value="Organic">Organic</option>
                <option value="Paid Ads">Paid Ads</option>
                <option value="Social Media">Social Media</option>
                <option value="Cold Outreach">Cold Outreach</option>
                <option value="Event">Event</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilterPriority('All');
                setFilterSource('All');
              }}
              className="mt-5 text-xs text-slate-400 hover:text-slate-600 font-semibold"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Leads Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">Lead <ArrowUpDown size={10} /></div>
                  </th>
                  <th className="py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                  <th className="py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                  <th className="py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Budget</th>
                  <th className="py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned</th>
                  <th className="py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</th>
                  <th className="py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400 text-sm">
                      No leads found matching your criteria
                    </td>
                  </tr>
                ) : (
                  paginatedLeads.map((lead) => {
                    const displayName = `${lead.firstName} ${lead.lastName}`.trim();
                    const initials = displayName
                      ? `${lead.firstName[0] || ''}${lead.lastName[0] || ''}`.toUpperCase()
                      : (lead.company ? lead.company.substring(0, 2) : 'UL').toUpperCase();

                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {initials}
                            </div>
                            <div>
                              <Link
                                href={`/sales/leads/${lead.id}`}
                                className="font-semibold text-slate-900 text-sm hover:text-[#4C1D95] transition-colors"
                              >
                                {displayName || <span className="text-slate-400 italic">Unnamed Lead</span>}
                              </Link>
                              <div className="text-xs text-slate-400">
                                {lead.company || <span className="text-slate-400 italic">No Company Provided</span>}
                              </div>
                              {lead.industry && <div className="text-[10px] text-slate-300 mt-0.5">{lead.industry}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="space-y-1">
                            {lead.email ? (
                              <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#4C1D95] transition-colors">
                                <Mail size={11} className="text-slate-300" />{lead.email}
                              </a>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs text-slate-400 italic">
                                <Mail size={11} className="text-slate-300" />No Email Provided
                              </span>
                            )}
                            {lead.phone ? (
                              <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#4C1D95] transition-colors">
                                <Phone size={11} className="text-slate-300" />{lead.phone}
                              </a>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs text-slate-400 italic">
                                <Phone size={11} className="text-slate-300" />No Phone Provided
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <LeadStatusBadge status={lead.status} />
                          {lead.invoiceGenerated && (
                            <div className="text-[10px] text-purple-600 font-semibold mt-1">Invoice Generated</div>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <div className={`flex items-center gap-1 text-xs font-semibold ${PRIORITY_COLOR[lead.priority]}`}>
                            {lead.priority === 'Critical' && <AlertCircle size={12} />}
                            {lead.priority === 'High' && <TrendingUp size={12} />}
                            {lead.priority !== 'Critical' && lead.priority !== 'High' && <Star size={12} />}
                            {lead.priority}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-900 text-sm">₹{(lead.budget / 1000).toFixed(0)}K</div>
                          <div className="text-[10px] text-slate-400">/ month</div>
                        </td>
                        <td className="py-4 px-5 relative">
                          <button
                            type="button"
                            onClick={() => setAssignMenuFor(assignMenuFor === lead.id ? null : lead.id)}
                            title={lead.assignedTo ? `Assigned to ${lead.assignedTo}` : 'Unassigned — click to assign'}
                            aria-label={lead.assignedTo ? `Assigned to ${lead.assignedTo}` : 'Unassigned, click to assign a team member'}
                            aria-haspopup="listbox"
                            aria-expanded={assignMenuFor === lead.id}
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                          >
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-[9px] font-bold">
                              {lead.assignedTo ? lead.assignedTo.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'UA'}
                            </div>
                            <span className="text-xs text-slate-600 font-medium">{lead.assignedTo || <span className="text-slate-400 italic">Unassigned</span>}</span>
                          </button>
                          {assignMenuFor === lead.id && (
                            <>
                              <div
                                role="button"
                                tabIndex={0}
                                className="fixed inset-0 z-10"
                                onClick={() => setAssignMenuFor(null)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setAssignMenuFor(null); }}
                              />
                              <div
                                className="absolute z-20 left-5 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 max-h-56 overflow-y-auto"
                              >
                                <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Assign to</div>
                                {assignableMembers.length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-slate-400 italic">No team members found</div>
                                ) : (
                                  assignableMembers.map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => handleAssign(lead.id, m.id)}
                                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                      {m.name}
                                    </button>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-semibold uppercase tracking-wide">
                            {lead.source}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              href={`/sales/leads/${lead.id}`}
                              className="p-1 text-slate-400 hover:text-[#4C1D95] transition-colors"
                              title="View Details"
                            >
                              <ExternalLink size={14} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setLeadToEdit(lead);
                                setShowAddLeadModal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Edit Lead"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLead(lead.id, displayName)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                              title="Delete Lead"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500 bg-slate-50/50">
            <span>Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(filtered.length, page * pageSize)} of {filtered.length} leads</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || totalPages === 0}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAddLeadModal && (
        <AddLeadModal
          leadToEdit={leadToEdit}
          onClose={() => {
            setShowAddLeadModal(false);
            setLeadToEdit(undefined);
          }}
        />
      )}
    </div>
  );
}
