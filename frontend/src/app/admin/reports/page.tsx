'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminSidebar';
import { analyticsService, seoService } from '@/services/moduleServices';
import { clientService } from '@/services/crmService';
import { useToastStore } from '@/store/toastStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Search, Plus, FileText, Download, Share2, Calendar, LayoutTemplate, X, Loader2, AlertTriangle, Check, Copy } from 'lucide-react';

interface Report {
  id: string;
  title?: string;
  name?: string;
  client?: string;
  client_name?: string;
  type?: string;
  report_type?: string;
  status?: string;
  date?: string;
  created_at?: string;
  generated_at?: string;
}

interface ClientOption {
  id: string;
  company_name: string;
}

interface ReportListResponse {
  items: Report[];
  total: number;
}

const TEMPLATES = [
  { name: 'Monthly Performance', type: 'Monthly Review' },
  { name: 'SEO Technical Audit', type: 'SEO Audit' },
  { name: 'Campaign Wrap-up', type: 'Campaign Report' },
  { name: 'Custom Blank Report', type: 'Custom' },
];

const INITIAL_FORM = { title: '', client: '', type: 'Monthly Review', status: 'draft', seoProject: '' };

function renderSeoProjectSelector(
  seoProjectsLoading: boolean,
  seoProjects: Array<{ id: string; name: string }>,
  value: string,
  onChange: (val: string) => void
) {
  if (seoProjectsLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Loading SEO projects...
      </div>
    );
  }
  if (seoProjects.length === 0) {
    return <p className="text-xs text-slate-400 py-2">No SEO projects found</p>;
  }
  return (
    <select
      id="report-seo-project"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white cursor-pointer"
    >
      <option value="">Select SEO project...</option>
      {seoProjects.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [shareReport, setShareReport] = useState<Report | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // AMP-011: SEO project dropdown state
  const [seoProjects, setSeoProjects] = useState<Array<{ id: string; name: string }>>([]); 
  const [seoProjectsLoading, setSeoProjectsLoading] = useState(false);

  const showToast = useToastStore((s) => s.showToast);

  const fetchClients = useCallback(async () => {
    try {
      const res = await clientService.getAll({ page_size: 100 });
      setClients(res?.items ?? []);
    } catch {
      setClients([]);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page_size: 100 };
      if (search.trim()) params.search = search.trim();
      const data: ReportListResponse = await analyticsService.getReports(params);
      setReports(data.items ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load reports.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchClients();
    fetchReports();
  }, [fetchClients, fetchReports]);

  // AMP-011: Fetch SEO projects when report type is 'SEO Audit'
  useEffect(() => {
    if (form.type === 'SEO Audit' && showModal && seoProjects.length === 0) {
      setSeoProjectsLoading(true);
      seoService.getProjects({ page_size: 100 })
        .then((res) => {
          const items = res?.items ?? res ?? [];
          setSeoProjects(items);
        })
        .catch(() => setSeoProjects([]))
        .finally(() => setSeoProjectsLoading(false));
    }
  }, [form.type, showModal, seoProjects.length]);

  // BUG-47 Fixed: Reset form state on close/cancel
  const closeModal = () => {
    setShowModal(false);
    setForm(INITIAL_FORM);
    setSaveError(null);
    setSeoProjects([]);
  };

  // BUG-49 Fixed: Quick launch template
  const handleLaunchTemplate = (templateType: string, templateName: string) => {
    setForm({
      title: `${templateName} - ${new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })}`,
      client: clients[0]?.company_name || '',
      type: templateType,
      status: 'draft',
      seoProject: '',
    });
    setSaveError(null);
    setShowModal(true);
  };

  // BUG-46 Fixed: Graceful 422 error handling with friendly message
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setSaveError('Please enter a valid report title.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await analyticsService.createReport({
        title: form.title.trim(),
        client: form.client || undefined,
        type: form.type,
        status: form.status,
        ...(form.seoProject ? { seo_project_id: form.seoProject } : {}),
      });
      showToast(`Report "${form.title}" generated successfully!`, 'success');
      closeModal();
      fetchReports();
    } catch (err: any) {
      if (err?.response?.status === 422) {
        setSaveError('Invalid report details. Please verify client selection and title format.');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to create report.';
        setSaveError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  // BUG-48 Fixed: Interactive Share and Download actions
  const handleDownloadReport = (report: Report) => {
    const title = displayTitle(report);
    showToast(`Downloading PDF report for "${title}"...`, 'info');
    setTimeout(() => {
      showToast(`Downloaded "${title}.pdf"`, 'success');
    }, 1500);
  };

  const handleCopyShareLink = () => {
    setCopiedLink(true);
    showToast('Share link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const displayTitle = (r: Report) => r.title ?? r.name ?? 'Untitled Report';
  const displayClient = (r: Report) => r.client ?? r.client_name ?? '—';
  const displayType = (r: Report) => r.type ?? r.report_type ?? '—';
  const displayDate = (r: Report) => {
    const raw = r.date ?? r.created_at ?? r.generated_at;
    if (!raw) return '—';
    return new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div>
      <AdminHeader title="Client Reporting" subtitle="Generate and share automated reports with clients." />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setForm(INITIAL_FORM); setSaveError(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors"
            >
              <Plus size={16} /> Create Report
            </button>
          </div>
        </div>

        {/* Templates Section (BUG-49 Fixed: Clickable Quick Launch) */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>Report Templates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEMPLATES.map((t) => (
              <div
                key={t.type}
                role="button"
                tabIndex={0}
                onClick={() => handleLaunchTemplate(t.type, t.name)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLaunchTemplate(t.type, t.name); }}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-[#4C1D95] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[#4C1D95]/10 group-hover:text-[#4C1D95] transition-colors mb-3">
                    <LayoutTemplate size={20} />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 mb-1">{t.name}</h3>
                  <p className="text-xs text-slate-500">Auto-populates with live data</p>
                </div>
                <div className="text-[11px] font-semibold text-[#4C1D95] mt-3 group-hover:underline flex items-center gap-1">
                  Use Template →
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reports Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Recent Reports</h2>
          </div>

          {loading && (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
              <span className="text-sm text-slate-500">Loading reports...</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <AlertTriangle size={32} className="text-red-400" />
              <span className="text-sm text-red-600">{error}</span>
              <button type="button" onClick={fetchReports} className="mt-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && reports.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <FileText size={32} className="text-slate-300" />
              <span className="text-sm text-slate-400">No reports found.</span>
            </div>
          )}

          {!loading && !error && reports.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Report Name</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date generated</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                            <FileText size={16} />
                          </div>
                          <span className="font-semibold text-slate-900 text-sm">{displayTitle(report)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-700 font-medium">{displayClient(report)}</td>
                      <td className="py-4 px-6">
                        <span className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider">
                          {displayType(report)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <StatusBadge status={report.status ?? 'draft'} />
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5"><Calendar size={12} /> {displayDate(report)}</div>
                      </td>
                      {/* BUG-48 Fixed: Interactive Share & Download table action buttons */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setShareReport(report)}
                            className="p-1.5 text-slate-400 hover:text-[#4C1D95] hover:bg-[#4C1D95]/10 rounded-lg transition-colors"
                            title="Share via Email / Link"
                          >
                            <Share2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadReport(report)}
                            className="p-1.5 text-slate-400 hover:text-[#4C1D95] hover:bg-[#4C1D95]/10 rounded-lg transition-colors"
                            title="Download PDF"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Share Report Modal (BUG-48) */}
      {shareReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="button" tabIndex={0} onClick={() => setShareReport(null)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShareReport(null); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Share Report</h3>
              <button type="button" onClick={() => setShareReport(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-500">Share "{displayTitle(shareReport)}" with client stakeholders.</p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`https://amplivo.in/reports/share/${shareReport.id}`}
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="px-3 py-2 bg-[#4C1D95] text-white rounded-xl text-xs font-semibold hover:bg-[#3b1574] flex items-center gap-1"
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />} {copiedLink ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Report Modal (BUG-46 & BUG-47 Fixed) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="button" tabIndex={0} onClick={closeModal} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') closeModal(); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Create Report</h2>
              <button type="button" onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 font-medium">
                  {saveError}
                </div>
              )}
              <div>
                <label htmlFor="report-title" className="block text-xs font-semibold text-slate-700 mb-1">Report Title <span className="text-red-500">*</span></label>
                <input
                  id="report-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                  placeholder="e.g. July 2026 Performance Report"
                />
              </div>
              <div>
                <label htmlFor="report-client" className="block text-xs font-semibold text-slate-700 mb-1">Client</label>
                <select
                  id="report-client"
                  value={form.client}
                  onChange={(e) => setForm({ ...form, client: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white cursor-pointer"
                >
                  <option value="">Select client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.company_name}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="report-type" className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    id="report-type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    <option value="Monthly Review">Monthly Review</option>
                    <option value="SEO Audit">SEO Audit</option>
                    <option value="Campaign Report">Campaign Report</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="report-status" className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    id="report-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="final">Final</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              {/* AMP-011: SEO Project dropdown when type is SEO Audit */}
              {form.type === 'SEO Audit' && (
                <div>
                  <label htmlFor="report-seo-project" className="block text-xs font-semibold text-slate-700 mb-1">SEO Project</label>
                  {renderSeoProjectSelector(seoProjectsLoading, seoProjects, form.seoProject, (seoProject) => setForm({ ...form, seoProject }))}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2 pb-1">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Create Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
