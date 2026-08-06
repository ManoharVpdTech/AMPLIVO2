'use client';
import { useEffect, useState } from 'react';
import { PortalHeader } from '@/components/portal/PortalSidebar';
import { creativeService } from '@/services/moduleServices';
import { useToastStore } from '@/store/toastStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Search, Image as ImageIcon, MessageSquare, Check, Download, History, Loader2, X, Send, AlertTriangle } from 'lucide-react';

interface CreativeProject { id: string; name: string; description?: string | null }
interface CreativeAsset {
  id: string;
  project_id: string;
  name: string;
  asset_type: string;
  file_url: string | null;
  version: string;
  status: string;
  created_at: string;
}
interface FeedbackItem { id: string; content: string; is_resolved: boolean; created_at: string }

interface AssetWithProject extends CreativeAsset {
  projectName: string;
}

export default function PortalCreatives() {
  const [assets, setAssets] = useState<AssetWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [previewAsset, setPreviewAsset] = useState<AssetWithProject | null>(null);
  const [commentAsset, setCommentAsset] = useState<AssetWithProject | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  const load = () => {
    setLoading(true);
    setError(false);
    creativeService
      .getProjects({ page_size: 100 })
      .then(async (res) => {
        const projects: CreativeProject[] = res?.items ?? res ?? [];
        const perProject = await Promise.all(
          projects.map(async (p) => {
            try {
              const projectAssets: CreativeAsset[] = await creativeService.getAssets(p.id);
              return projectAssets.map((a) => ({ ...a, projectName: p.name }));
            } catch {
              return [];
            }
          })
        );
        setAssets(perProject.flat());
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const normalizedStatus = (s: string) => s.toLowerCase();
  const filtered = assets.filter((a) => {
    const matchesFilter = filter === 'all' || normalizedStatus(a.status) === filter;
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.projectName.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const [showRejectModal, setShowRejectModal] = useState<AssetWithProject | null>(null);
  // BUG-07: Separate state for "Request Changes" confirmation modal
  const [showRequestChangesModal, setShowRequestChangesModal] = useState<AssetWithProject | null>(null);

  const handleApprove = async (asset: AssetWithProject) => {
    setUpdatingId(asset.id);
    try {
      await creativeService.updateAsset(asset.id, { status: 'approved' });
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, status: 'approved' } : a)));
      showToast(`"${asset.name}" approved.`, 'success');
    } catch {
      showToast('Failed to approve creative.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (asset: AssetWithProject, reason?: string) => {
    setUpdatingId(asset.id);
    try {
      await creativeService.updateAsset(asset.id, { status: 'rejected' });
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, status: 'rejected' } : a)));
      if (reason) {
        await creativeService.createFeedback(asset.id, { content: `Rejection reason: ${reason}` });
      }
      showToast(`"${asset.name}" rejected.`, 'info');
    } catch {
      showToast('Failed to reject creative.', 'error');
    } finally {
      setUpdatingId(null);
      setShowRejectModal(null);
    }
  };

  // BUG-07: Handle request changes - submit feedback and mark as changes_requested
  const handleRequestChanges = async (asset: AssetWithProject, changeDetails: string) => {
    setUpdatingId(asset.id);
    try {
      await creativeService.createFeedback(asset.id, { content: `Change request: ${changeDetails}` });
      // Optionally update status to pending/changes_requested if API supports it
      try {
        await creativeService.updateAsset(asset.id, { status: 'changes_requested' });
        setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, status: 'changes_requested' } : a)));
      } catch {
        // If status update isn't supported, just post the feedback
      }
      showToast('Change request submitted successfully.', 'success');
    } catch {
      showToast('Failed to submit change request.', 'error');
    } finally {
      setUpdatingId(null);
      setShowRequestChangesModal(null);
    }
  };

  if (loading) {
    return (
      <div>
        <PortalHeader title="Creative Approvals" subtitle="Review, download, and approve creatives for your campaigns." />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PortalHeader title="Creative Approvals" subtitle="Review, download, and approve creatives for your campaigns." />

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6">
            Couldn&apos;t load creatives. <button onClick={load} className="underline font-medium">Retry</button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search creatives..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
            />
          </div>
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
              All ({assets.length})
            </button>
            <button onClick={() => setFilter('pending')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === 'pending' ? 'bg-white text-[#4C1D95] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
              Pending ({assets.filter((a) => normalizedStatus(a.status) === 'pending').length})
            </button>
            <button onClick={() => setFilter('approved')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === 'approved' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
              Approved ({assets.filter((a) => normalizedStatus(a.status) === 'approved').length})
            </button>
            <button onClick={() => setFilter('rejected')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === 'rejected' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
              Rejected ({assets.filter((a) => normalizedStatus(a.status) === 'rejected').length})
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">No creatives found</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((asset) => (
              <div key={asset.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-md transition-shadow flex flex-col group">
                <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                  {asset.file_url ? (
                    <img src={asset.file_url} alt={asset.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={32} className="text-slate-300" />
                  )}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button onClick={() => setPreviewAsset(asset)} className="bg-white text-slate-900 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                      Preview
                    </button>
                    {asset.file_url && (
                      <a href={asset.file_url} target="_blank" rel="noopener noreferrer" download className="bg-[#4C1D95] text-white p-2 rounded-lg hover:bg-[#3b1574] transition-colors" title="Download Source File">
                        <Download size={16} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 mb-1 truncate">{asset.name}</h3>
                      <div className="text-xs text-slate-500 truncate max-w-[180px]">{asset.projectName} · v{asset.version}</div>
                    </div>
                    <StatusBadge status={asset.status} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 mb-5">
                    <span>Type: <span className="text-slate-700 capitalize">{asset.asset_type}</span></span>
                    <span className="flex items-center gap-1"><History size={12} /> {new Date(asset.created_at).toLocaleDateString()}</span>
                  </div>

                  {normalizedStatus(asset.status) === 'pending' ? (
                    <div className="grid grid-cols-3 gap-2 mt-auto">
                      <button
                        onClick={() => handleApprove(asset)}
                        disabled={updatingId === asset.id}
                        className="flex items-center justify-center gap-1 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        {updatingId === asset.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
                      </button>
                      {/* BUG-07: "Changes" now opens RequestChangesModal, not comment thread */}
                      <button
                        type="button"
                        onClick={() => setShowRequestChangesModal(asset)}
                        className="flex items-center justify-center gap-1 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors"
                      >
                        <AlertTriangle size={14} /> Changes
                      </button>
                      <button
                        onClick={() => setShowRejectModal(asset)}
                        disabled={updatingId === asset.id}
                        className="flex items-center justify-center gap-1 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 mt-auto">
                      {normalizedStatus(asset.status) === 'rejected' ? (
                        <button
                          onClick={() => handleApprove(asset)}
                          disabled={updatingId === asset.id}
                          className="col-span-1 flex items-center justify-center gap-1 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                        >
                          {updatingId === asset.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Re-approve
                        </button>
                      ) : (
                        /* BUG-07: "Request Changes" now opens proper confirmation modal */
                        <button
                          type="button"
                          onClick={() => setShowRequestChangesModal(asset)}
                          className="flex items-center justify-center gap-1 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors"
                        >
                          <AlertTriangle size={14} /> Request Changes
                        </button>
                      )}
                      <button onClick={() => setCommentAsset(asset)} className="flex items-center justify-center gap-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                        <MessageSquare size={14} /> Thread
                      </button>
                      {asset.file_url ? (
                        <a href={asset.file_url} target="_blank" rel="noopener noreferrer" download className="flex items-center justify-center gap-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                          <Download size={14} /> Asset
                        </a>
                      ) : (
                        <button disabled className="flex items-center justify-center gap-1 py-2 rounded-xl border border-slate-100 text-slate-300 text-sm font-semibold cursor-not-allowed">
                          <Download size={14} /> Asset
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewAsset && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6" onClick={() => setPreviewAsset(null)}>
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">{previewAsset.name}</h3>
              <button onClick={() => setPreviewAsset(null)} className="text-white/70 hover:text-white"><X size={20} /></button>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden flex items-center justify-center min-h-[300px]">
              {previewAsset.file_url ? (
                <img src={previewAsset.file_url} alt={previewAsset.name} className="w-full h-auto max-h-[70vh] object-contain" />
              ) : (
                <div className="py-24 text-slate-400 flex flex-col items-center gap-2">
                  <ImageIcon size={40} />
                  <p className="text-sm">No preview available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <RejectModal
          asset={showRejectModal}
          onConfirm={(reason) => handleReject(showRejectModal, reason)}
          onCancel={() => setShowRejectModal(null)}
          loading={updatingId === showRejectModal.id}
        />
      )}

      {/* BUG-07: New Request Changes confirmation modal */}
      {showRequestChangesModal && (
        <RequestChangesModal
          asset={showRequestChangesModal}
          onConfirm={(details) => handleRequestChanges(showRequestChangesModal, details)}
          onCancel={() => setShowRequestChangesModal(null)}
          loading={updatingId === showRequestChangesModal.id}
        />
      )}

      {commentAsset && (
        <CommentThreadModal asset={commentAsset} onClose={() => setCommentAsset(null)} />
      )}
    </div>
  );
}

function RejectModal({ asset, onConfirm, onCancel, loading }: { asset: AssetWithProject; onConfirm: (reason: string) => void; onCancel: () => void; loading: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Reject Creative</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-600 mb-4">Provide a reason for rejecting <strong>{asset.name}</strong>:</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe what needs to be changed..."
          rows={4}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
        />
        <div className="flex gap-3 pt-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// BUG-07: Dedicated Request Changes modal — separate from comment thread
function RequestChangesModal({ asset, onConfirm, onCancel, loading }: Readonly<{ asset: AssetWithProject; onConfirm: (details: string) => void; onCancel: () => void; loading: boolean }>) {
  const [details, setDetails] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="button" tabIndex={0} onClick={onCancel} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCancel(); }}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6" role="button" tabIndex={0} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Request Changes
          </h3>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          You are requesting changes to <strong className="text-slate-700">{asset.name}</strong>. Please describe what you&apos;d like adjusted.
        </p>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Describe the changes you'd like to see (e.g. adjust color scheme, resize logo, update copy)..."
          rows={4}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
        />
        {!details.trim() && (
          <p className="text-xs text-slate-400 mt-1.5">Please describe the requested changes before submitting.</p>
        )}
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
          <button
            type="button"
            onClick={() => onConfirm(details)}
            disabled={loading || !details.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />} Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentThreadModal({ asset, onClose }: { asset: AssetWithProject; onClose: () => void }) {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    creativeService.getFeedback(asset.id).then(setFeedback).catch(() => setFeedback([])).finally(() => setLoading(false));
  }, [asset.id]);

  const handleSend = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      const created = await creativeService.createFeedback(asset.id, { content: comment.trim() });
      setFeedback((prev) => [...prev, created]);
      setComment('');
    } catch {
      showToast('Failed to post comment.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">{asset.name} — Feedback Thread</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <Loader2 size={20} className="animate-spin text-[#4C1D95] mx-auto" />
          ) : feedback.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No feedback yet</p>
          ) : (
            feedback.map((f) => (
              <div key={f.id} className="bg-slate-50 rounded-xl p-3">
                <p className="text-sm text-slate-700">{f.content}</p>
                <p className="text-[10px] text-slate-400 mt-1">{new Date(f.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2 pt-3 border-t border-slate-100 mt-3">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Leave feedback..."
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/30"
          />
          <button onClick={handleSend} disabled={sending || !comment.trim()} className="bg-[#4C1D95] text-white rounded-lg px-4 disabled:opacity-40">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
