'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminSidebar';
import { influencersService } from '@/services/moduleServices';
import { useToastStore } from '@/store/toastStore';
import { Search, Filter, Plus, Mail, ExternalLink, Video, X, Loader2, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { FaInstagram, FaYoutube, FaTiktok, FaTwitter, FaLinkedin } from 'react-icons/fa';

interface Influencer {
  id: string;
  name?: string;
  handle?: string;
  username?: string;
  category?: string;
  followers?: number | string;
  follower_count?: number | string;
  followers_count?: number | string;
  platform?: string;
  engagement_rate?: number | string;
  engagement?: string;
  cost_per_post?: number | string;
  cost?: string;
  status?: string;
  email?: string;
}

interface InfluencerListResponse {
  items: Influencer[];
  total: number;
}

function formatFollowers(val?: number | string): string {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseInt(val, 10) : val;
  if (isNaN(num)) return String(val);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(num);
}

export default function AdminInfluencers() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingInfluencer, setEditingInfluencer] = useState<Influencer | null>(null);
  const [form, setForm] = useState({ name: '', handle: '', category: '', platform: 'Instagram', followers: '', engagement_rate: '', cost_per_post: '', status: 'Active', email: '' });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const showToast = useToastStore((s) => s.showToast);

  const fetchInfluencers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page_size: 100 };
      if (search.trim()) params.search = search.trim();
      const data: InfluencerListResponse = await influencersService.getAll(params);
      setInfluencers(data.items ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load influencers.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchInfluencers(); }, [fetchInfluencers]);

  const openCreateModal = () => {
    setEditingInfluencer(null);
    setForm({ name: '', handle: '', category: '', platform: 'Instagram', followers: '', engagement_rate: '', cost_per_post: '', status: 'Active', email: '' });
    setValidationErrors({});
    setShowModal(true);
  };

  const openEditModal = (inf: Influencer) => {
    setEditingInfluencer(inf);
    setForm({
      name: inf.name ?? '',
      handle: inf.handle ?? inf.username ?? '',
      category: inf.category ?? '',
      platform: inf.platform ?? 'Instagram',
      followers: String(inf.followers ?? inf.follower_count ?? inf.followers_count ?? ''),
      engagement_rate: String(inf.engagement_rate ?? ''),
      cost_per_post: String(inf.cost_per_post ?? ''),
      status: inf.status ?? 'Active',
      email: inf.email ?? '',
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Influencer name is required.';

    // BUG-42 Fixed: Block negative values for numeric fields
    if (form.followers && Number(form.followers) < 0) {
      errors.followers = 'Followers count cannot be negative.';
    }
    if (form.engagement_rate && Number(form.engagement_rate) < 0) {
      errors.engagement_rate = 'Engagement rate cannot be negative.';
    }
    if (form.cost_per_post && Number(form.cost_per_post) < 0) {
      errors.cost_per_post = 'Cost per post cannot be negative.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        handle: form.handle || undefined,
        category: form.category || undefined,
        platform: form.platform,
        followers: form.followers ? Number(form.followers) : undefined,
        engagement_rate: form.engagement_rate ? Number(form.engagement_rate) : undefined,
        cost_per_post: form.cost_per_post ? Number(form.cost_per_post) : undefined,
        status: form.status,
        email: form.email || undefined,
      };

      if (editingInfluencer) {
        await influencersService.update(editingInfluencer.id, payload);
        showToast(`Influencer "${form.name}" updated successfully!`, 'success');
      } else {
        await influencersService.create(payload);
        showToast(`Influencer "${form.name}" added successfully!`, 'success');
      }
      setShowModal(false);
      fetchInfluencers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save influencer.';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete influencer "${name}"?`)) return;
    try {
      await influencersService.delete(id);
      showToast(`Influencer "${name}" deleted successfully.`, 'success');
      fetchInfluencers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete influencer.';
      showToast(msg, 'error');
    }
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'In Negotiation': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Shortlisted': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div>
      <AdminHeader title="Influencer Database" subtitle="Manage influencer partnerships and campaign outreach." />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, handle, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors"
            >
              <Plus size={16} /> Add Influencer
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
            <span className="text-sm text-slate-500">Loading influencers...</span>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
            <AlertTriangle size={32} className="text-red-400" />
            <span className="text-sm text-red-600">{error}</span>
            <button onClick={fetchInfluencers} className="mt-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && influencers.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
            <span className="text-sm text-slate-400">No influencers found.</span>
          </div>
        )}

        {!loading && !error && influencers.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Influencer</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Followers</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Engagement</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Avg Cost/Post</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {influencers.map((inf) => {
                    {/* BUG-43 Fixed: Defensive Followers mapping */}
                    const followerVal = inf.followers ?? inf.follower_count ?? inf.followers_count;

                    return (
                      <tr key={inf.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(inf.name ?? 'U')}&background=random`} alt={inf.name ?? 'Influencer'} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm mb-0.5">{inf.name ?? 'Unknown'}</div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                {inf.platform === 'Instagram' ? <FaInstagram size={12} className="text-[#E1306C]" /> : <Video size={12} className="text-[#FF0000]" />}
                                <span className="hover:text-[#4C1D95] flex items-center gap-1">{inf.handle ?? inf.username ?? '—'} <ExternalLink size={10} /></span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                            {inf.category ?? 'General'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-slate-900">{formatFollowers(followerVal)}</td>
                        <td className="py-4 px-6 text-right font-medium text-[#10B981]">{inf.engagement_rate != null ? `${inf.engagement_rate}%` : (inf.engagement ?? '—')}</td>
                        <td className="py-4 px-6 text-right font-medium text-slate-700">{inf.cost_per_post != null ? `₹${Number(inf.cost_per_post).toLocaleString()}` : (inf.cost ?? '—')}</td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusClass(inf.status)}`}>
                            {inf.status ?? 'Active'}
                          </span>
                        </td>
                        {/* BUG-41 Fixed: Added Edit, Delete, and Contact action buttons */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditModal(inf)} className="p-1.5 text-slate-400 hover:text-[#4C1D95] hover:bg-[#4C1D95]/10 rounded-lg transition-colors" title="Edit Influencer">
                              <Pencil size={15} />
                            </button>
                            {inf.email && (
                              <a href={`mailto:${inf.email}`} className="p-1.5 text-slate-400 hover:text-[#4C1D95] hover:bg-[#4C1D95]/10 rounded-lg transition-colors" title="Contact Email">
                                <Mail size={15} />
                              </a>
                            )}
                            <button onClick={() => handleDelete(inf.id, inf.name || 'Influencer')} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Influencer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editingInfluencer ? 'Edit Influencer' : 'Add Influencer'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateOrUpdate} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                      validationErrors.name ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                    placeholder="Priya Sharma"
                  />
                  {validationErrors.name && <p className="text-red-500 text-[11px] mt-1">{validationErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Handle</label>
                  <input
                    type="text"
                    value={form.handle}
                    onChange={(e) => setForm({ ...form, handle: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                    placeholder="@priyastyle"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                    placeholder="Fashion & Lifestyle"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Platform</label>
                  <select
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="YouTube">YouTube</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Twitter">Twitter</option>
                    <option value="LinkedIn">LinkedIn</option>
                  </select>
                </div>
              </div>

              {/* BUG-42 Fixed: min=0 restriction preventing negative numbers */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Followers</label>
                  <input
                    type="number"
                    min="0"
                    value={form.followers}
                    onChange={(e) => setForm({ ...form, followers: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                      validationErrors.followers ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                    placeholder="125000"
                  />
                  {validationErrors.followers && <p className="text-red-500 text-[11px] mt-1">{validationErrors.followers}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Engagement %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.engagement_rate}
                    onChange={(e) => setForm({ ...form, engagement_rate: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                      validationErrors.engagement_rate ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                    placeholder="4.2"
                  />
                  {validationErrors.engagement_rate && <p className="text-red-500 text-[11px] mt-1">{validationErrors.engagement_rate}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cost/Post (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.cost_per_post}
                    onChange={(e) => setForm({ ...form, cost_per_post: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:border-[#4C1D95] ${
                      validationErrors.cost_per_post ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                    placeholder="15000"
                  />
                  {validationErrors.cost_per_post && <p className="text-red-500 text-[11px] mt-1">{validationErrors.cost_per_post}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="In Negotiation">In Negotiation</option>
                    <option value="Shortlisted">Shortlisted</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                    placeholder="contact@example.com"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 pb-1">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingInfluencer ? 'Save Changes' : 'Add Influencer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
