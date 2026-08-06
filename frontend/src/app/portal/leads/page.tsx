'use client';
import { useEffect, useState } from 'react';
import { PortalHeader } from '@/components/portal/PortalSidebar';
import { leadService, LeadRead } from '@/services/leadService';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToastStore } from '@/store/toastStore';
import { Search, Download, Filter, Loader2 } from 'lucide-react';

const STATUSES = ['', 'new', 'Hot', 'Warm', 'Cold', 'converted', 'Lost'];
const PAGE_SIZE = 20;

interface LeadSource { id: string; name: string }

export default function PortalLeads() {
  const [leads, setLeads] = useState<LeadRead[]>([]);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    leadService
      .getLeadSources()
      .then((res) => {
        const items: LeadSource[] = res?.items ?? [];
        setSources(Object.fromEntries(items.map((s) => [s.id, s.name])));
      })
      .catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    setError(false);
    leadService
      .getAll({ page, page_size: PAGE_SIZE, search: search || undefined, status: statusFilter || undefined })
      .then((res) => {
        setLeads(res?.items ?? []);
        setTotal(res?.total ?? 0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await leadService.getAll({ page: 1, page_size: 100, search: search || undefined, status: statusFilter || undefined });
      let all: LeadRead[] = res?.items ?? [];
      const totalCount = res?.total ?? all.length;
      let currentPage = 1;
      while (all.length < totalCount && currentPage < 20) {
        currentPage++;
        const nextRes = await leadService.getAll({ page: currentPage, page_size: 100, search: search || undefined, status: statusFilter || undefined });
        if (nextRes?.items?.length) {
          all = [...all, ...nextRes.items];
        } else {
          break;
        }
      }

      const header = ['Name', 'Email', 'Phone', 'Company', 'Source', 'Status', 'Priority', 'Estimated Value'];
      const rows = all.map((l) => [
        l.contact_name || l.title,
        l.email || '',
        l.phone || '',
        l.company_name || '',
        sources[l.source_id || ''] || '',
        l.status,
        l.priority,
        l.estimated_value ?? '',
      ]);
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`Exported ${all.length} leads.`, 'success');
    } catch {
      showToast('Failed to export leads.', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading && leads.length === 0) {
    return (
      <div>
        <PortalHeader title="Lead Pipeline" subtitle="Track and manage leads generated from your campaigns." />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PortalHeader title="Lead Pipeline" subtitle="Track and manage leads generated from your campaigns." />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6">
            Couldn&apos;t load leads. <button onClick={load} className="underline font-medium">Retry</button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads by name, email, or source..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu((o) => !o)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm transition-colors ${statusFilter ? 'border-[#4C1D95] text-[#4C1D95] bg-[#4C1D95]/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Filter size={16} /> {statusFilter || 'Filter'}
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl border border-slate-200 shadow-lg z-10 py-1">
                  {STATUSES.map((s) => (
                    <button
                      key={s || 'all'}
                      onClick={() => {
                        setStatusFilter(s);
                        setPage(1);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 capitalize ${statusFilter === s ? 'text-[#4C1D95] font-semibold' : 'text-slate-600'}`}
                    >
                      {s || 'All statuses'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 border border-[#4C1D95]/20 text-[#4C1D95] bg-[#4C1D95]/5 rounded-xl text-sm font-semibold hover:bg-[#4C1D95]/10 transition-colors disabled:opacity-60"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export CSV
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9FAFB] border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Lead Info</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Phone</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Source</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Company</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600">Est. Value</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-slate-400">No leads found</td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{lead.contact_name || lead.title}</div>
                        <div className="text-xs text-slate-500">{lead.email || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{lead.phone || '-'}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-md">
                          {sources[lead.source_id || ''] || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{lead.company_name || '-'}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        {lead.estimated_value != null ? `₹${lead.estimated_value.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 bg-[#F9FAFB] flex items-center justify-between text-xs text-slate-500">
            <span>Showing {leads.length} of {total} leads</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded font-medium">{page}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
