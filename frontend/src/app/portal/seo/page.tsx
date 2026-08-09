'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Search, Activity, Download, Loader2, Link2, ArrowUp, ArrowDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { seoService } from '@/services/moduleServices';
import { useToastStore } from '@/store/toastStore';

interface SeoProject { id: string; name: string; target_url: string; status: string }
interface SeoKeyword { id: string; keyword: string; current_rank: number | null; target_rank: number | null; search_volume: number | null; difficulty: number | null }
interface SeoAudit { id: string; audit_date: string; health_score: number | null; errors_count: number | null; warnings_count: number | null }
interface SeoBacklink { id: string; source_url: string; domain_authority: number | null; status: string }

type SortKey = 'keyword' | 'current_rank' | 'search_volume';

export default function SEOPage() {
  const [projects, setProjects] = useState<SeoProject[]>([]);
  const [keywords, setKeywords] = useState<SeoKeyword[]>([]);
  const [audits, setAudits] = useState<SeoAudit[]>([]);
  const [backlinks, setBacklinks] = useState<SeoBacklink[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingReport, setFetchingReport] = useState(false);
  const [error, setError] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('current_rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
  const [exporting, setExporting] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  const load = () => {
    setLoading(true);
    setError(false);
    seoService
      .getProjects({ page_size: 100 })
      .then((res) => {
        const items: SeoProject[] = res?.items ?? res ?? [];
        setProjects(items);
        if (items.length > 0) setSelectedProjectId(items[0].id);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setVisibleCount(10);
    setFetchingReport(true);
    Promise.all([
      seoService.getKeywords(selectedProjectId).catch(() => []),
      seoService.getAudits(selectedProjectId).catch(() => []),
      seoService.getBacklinks(selectedProjectId).catch(() => []),
    ])
      .then(([kw, au, bl]) => {
        setKeywords(kw?.items ?? kw ?? []);
        setAudits((au?.items ?? au ?? []).sort((a: SeoAudit, b: SeoAudit) => new Date(a.audit_date).getTime() - new Date(b.audit_date).getTime()));
        setBacklinks(bl?.items ?? bl ?? []);
      })
      .finally(() => {
        setFetchingReport(false);
      });
  }, [selectedProjectId]);

  const totalKeywords = keywords.length;
  const ranked = keywords.filter((k) => k.current_rank != null);
  const avgPosition = ranked.length > 0 ? (ranked.reduce((sum, k) => sum + (k.current_rank || 0), 0) / ranked.length).toFixed(1) : '-';
  const latestHealth = audits.length > 0 ? audits[audits.length - 1].health_score : null;
  const activeBacklinks = backlinks.filter((b) => b.status === 'active').length;

  const healthTrend = audits.map((a) => ({ date: new Date(a.audit_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), score: a.health_score ?? 0 }));

  const sortedKeywords = useMemo(() => {
    const copy = [...keywords];
    copy.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === 'keyword') { av = a.keyword; bv = b.keyword; }
      else if (sortKey === 'current_rank') { av = a.current_rank ?? 9999; bv = b.current_rank ?? 9999; }
      else { av = a.search_volume ?? 0; bv = b.search_volume ?? 0; }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [keywords, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const project = projects.find((p) => p.id === selectedProjectId);
      const header = ['Keyword', 'Current Rank', 'Target Rank', 'Search Volume', 'Difficulty'];
      const rows = keywords.map((k) => [k.keyword, k.current_rank ?? '', k.target_rank ?? '', k.search_volume ?? '', k.difficulty ?? '']);
      const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seo-report-${project?.name ?? 'project'}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('SEO report exported.', 'success');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>SEO Performance</h1>
          <p className="text-slate-500 text-sm mt-1">Track keyword rankings, backlinks, and technical health.</p>
        </div>

        {projects.length > 0 && (
          <div className="flex items-center gap-3">
            {fetchingReport && <Loader2 size={16} className="animate-spin text-[#4C1D95]" />}
            <select
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus:border-[#4C1D95] disabled:opacity-50"
              value={selectedProjectId || ''}
              disabled={fetchingReport}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" onClick={handleExport} disabled={exporting || fetchingReport || keywords.length === 0} className="flex items-center gap-2 bg-[#4C1D95] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3b1574] transition-colors disabled:opacity-60">
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export Report
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6">
          Couldn&apos;t load SEO data. <button type="button" onClick={load} className="underline font-medium">Retry</button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center py-16 text-sm text-slate-400">No SEO projects found</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-500">Health Score</h3>
                <div className="w-8 h-8 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981]"><Activity size={16} /></div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-2">{latestHealth != null ? `${latestHealth}%` : '-'}</div>
              <div className="text-sm text-slate-400">{audits.length > 0 ? `Last audit ${new Date(audits[audits.length - 1].audit_date).toLocaleDateString()}` : 'No audits yet'}</div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-500">Total Keywords</h3>
                <div className="w-8 h-8 rounded-full bg-[#4C1D95]/10 flex items-center justify-center text-[#4C1D95]"><Search size={16} /></div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-2">{totalKeywords}</div>
              <div className="flex items-center gap-1 text-sm text-slate-400"><span>Tracked keywords</span></div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-500">Avg. Position</h3>
                <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B]"><ArrowUpRight size={16} /></div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-2">{avgPosition}</div>
              <div className="text-sm text-slate-400">Average across ranked keywords</div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-500">Active Backlinks</h3>
                <div className="w-8 h-8 rounded-full bg-[#06B6D4]/10 flex items-center justify-center text-[#06B6D4]"><Link2 size={16} /></div>
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-2">{activeBacklinks}</div>
              <div className="text-sm text-slate-400">{backlinks.length} total backlinks</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6" style={{ fontFamily: "'Sora', sans-serif" }}>Site Health Over Time</h3>
              <div className="h-[300px] w-full">
                {healthTrend.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">No audits recorded yet for this project</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={healthTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dx={-10} domain={[0, 100]} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="score" stroke="#4C1D95" strokeWidth={3} dot={{ r: 4, fill: '#4C1D95' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <h3 className="text-lg font-bold text-slate-900 mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>Keywords</h3>
              <div className="flex-1 overflow-auto">
                {keywords.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">No keywords tracked yet</div>
                ) : (
                  <>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-3 text-xs font-semibold text-slate-500 cursor-pointer select-none" onClick={() => toggleSort('keyword')}>
                            Keyword {sortKey === 'keyword' && (sortAsc ? <ArrowUp size={10} className="inline" /> : <ArrowDown size={10} className="inline" />)}
                          </th>
                          <th className="pb-3 text-xs font-semibold text-slate-500 text-right cursor-pointer select-none" onClick={() => toggleSort('current_rank')}>
                            Rank {sortKey === 'current_rank' && (sortAsc ? <ArrowUp size={10} className="inline" /> : <ArrowDown size={10} className="inline" />)}
                          </th>
                          <th className="pb-3 text-xs font-semibold text-slate-500 text-right cursor-pointer select-none" onClick={() => toggleSort('search_volume')}>
                            Vol {sortKey === 'search_volume' && (sortAsc ? <ArrowUp size={10} className="inline" /> : <ArrowDown size={10} className="inline" />)}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedKeywords.slice(0, visibleCount).map((kw) => (
                          <tr key={kw.id}>
                            <td className="py-3">
                              <div className="text-sm font-medium text-slate-900 truncate max-w-[150px]">{kw.keyword}</div>
                            </td>
                            <td className="py-3 text-right">
                              <span className="text-sm font-bold text-slate-900">{kw.current_rank ?? '-'}</span>
                              {kw.target_rank != null && <span className="text-[10px] text-slate-400 ml-1">/ {kw.target_rank}</span>}
                            </td>
                            <td className="py-3 text-right text-sm text-slate-600 font-medium">{kw.search_volume ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {visibleCount < sortedKeywords.length && (
                      <button onClick={() => setVisibleCount((c) => c + 10)} className="w-full text-center text-xs text-[#4C1D95] font-medium py-3 hover:underline">
                        Show more ({sortedKeywords.length - visibleCount} remaining)
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
