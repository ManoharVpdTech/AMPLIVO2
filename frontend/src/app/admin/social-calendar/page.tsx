'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminSidebar';
import { socialService } from '@/services/moduleServices';
import { useToastStore } from '@/store/toastStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ChevronLeft, ChevronRight, Plus, Users, Check, Clock, X, Loader2, AlertTriangle, ChevronDown } from 'lucide-react';
import { FaInstagram, FaLinkedin, FaFacebook, FaTwitter } from 'react-icons/fa';

interface SocialProfile {
  id: string;
  name?: string;
  platform?: string;
  handle?: string;
}

interface SocialPost {
  id: string;
  title?: string;
  content?: string;
  platform?: string;
  client?: string;
  status?: string;
  scheduled_date?: string;
  date?: string;
  type?: string;
}

interface ProfileListResponse {
  items: SocialProfile[];
  total: number;
}

const platformIcon = (platform?: string) => {
  switch (platform?.toLowerCase()) {
    case 'instagram': return <FaInstagram size={14} className="text-[#E1306C]" />;
    case 'linkedin': return <FaLinkedin size={14} className="text-[#0A66C2]" />;
    case 'facebook': return <FaFacebook size={14} className="text-[#1877F2]" />;
    case 'twitter': return <FaTwitter size={14} className="text-[#1DA1F2]" />;
    default: return <FaInstagram size={14} className="text-slate-400" />;
  }
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AdminSocialCalendar() {
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('all');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', profile_id: '', platform: 'Instagram', status: 'draft', scheduled_date: '', content: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const showToast = useToastStore((s) => s.showToast);

  const fetchProfiles = useCallback(async () => {
    try {
      const data: ProfileListResponse = await socialService.getProfiles({ page_size: 100 });
      const items = data.items ?? [];
      setProfiles(items);
    } catch (err: unknown) {
      console.error('Failed to load profiles', err);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedProfileId === 'all') {
        const allPostsArrays = await Promise.all(
          profiles.map((p) => socialService.getPosts(p.id).catch(() => []))
        );
        const merged: SocialPost[] = [];
        allPostsArrays.forEach((res: any) => {
          const items = Array.isArray(res) ? res : (res.items ?? []);
          merged.push(...items);
        });
        setPosts(merged);
      } else {
        const data = await socialService.getPosts(selectedProfileId);
        setPosts(Array.isArray(data) ? data : (data.items ?? []));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load posts.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedProfileId, profiles]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);
  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProfileId = form.profile_id || (selectedProfileId !== 'all' ? selectedProfileId : profiles[0]?.id);
    if (!form.title.trim() || !targetProfileId) {
      setSaveError('Title and Target Profile selection are required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await socialService.createPost(targetProfileId, {
        title: form.title.trim(),
        platform: form.platform,
        status: form.status,
        scheduled_date: form.scheduled_date || undefined,
        content: form.content || undefined,
      });
      showToast(`Social post "${form.title}" created successfully!`, 'success');
      setShowModal(false);
      setForm({ title: '', profile_id: '', platform: 'Instagram', status: 'draft', scheduled_date: '', content: '' });
      fetchPosts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create post.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const approvedCount = posts.filter((p) => p.status?.toLowerCase() === 'approved').length;
  const pendingCount = posts.filter((p) => p.status?.toLowerCase() === 'pending_review' || p.status?.toLowerCase() === 'pending').length;

  const navigateMonth = (dir: number) => {
    setCurrentDate(new Date(year, month + dir, 1));
  };

  return (
    <div>
      <AdminHeader title="Master Social Calendar" subtitle="Manage content schedules across all clients." />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Controls Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* BUG-36 Fixed: Fully interactive Profile Selector Dropdown */}
          <div className="relative inline-flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Users size={16} className="text-[#4C1D95]" />
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="bg-transparent border-none text-slate-900 text-sm font-semibold focus:outline-none cursor-pointer pr-6 appearance-none"
            >
              <option value="all">All Social Profiles ({profiles.length})</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.handle ?? p.platform ?? `Profile ${p.id.slice(0, 6)}`} ({p.platform || 'Social'})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="text-slate-400 absolute right-3 pointer-events-none" />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowModal(true); setSaveError(null); }}
              className="flex items-center gap-2 bg-[#4C1D95] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors"
            >
              <Plus size={16} /> New Post
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#4C1D95]" />
            <span className="text-sm text-slate-500">Loading calendar...</span>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
            <AlertTriangle size={32} className="text-red-400" />
            <span className="text-sm text-red-600">{error}</span>
            <button onClick={fetchPosts} className="mt-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>{MONTH_NAMES[month]} {year}</h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => navigateMonth(-1)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-md transition-colors"><ChevronLeft size={18} /></button>
                  <button onClick={() => navigateMonth(1)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-md transition-colors"><ChevronRight size={18} /></button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full"><Check size={12} /> {approvedCount} Approved</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full"><Clock size={12} /> {pendingCount} Pending</span>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-r border-slate-100 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-fr bg-slate-100 gap-px">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-before-${String(i)}`} className="bg-slate-50 min-h-[100px] p-2" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayPosts = posts.filter((p) => {
                  const d = p.scheduled_date || p.date;
                  return d?.startsWith(dateKey);
                });

                return (
                  <div key={dayNum} className="bg-white min-h-[100px] p-2 flex flex-col justify-between hover:bg-slate-50/50 transition-colors">
                    <span className="text-xs font-semibold text-slate-500">{dayNum}</span>
                    <div className="space-y-1 mt-1 flex-1">
                      {dayPosts.map((post) => (
                        <div key={post.id} className="p-1.5 rounded-lg bg-[#4C1D95]/10 border border-[#4C1D95]/20 text-xs flex items-center gap-1.5">
                          {platformIcon(post.platform)}
                          <span className="truncate font-medium text-slate-900 flex-1">{post.title || 'Untitled Post'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* New Post Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="button" tabIndex={0} onClick={() => setShowModal(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowModal(false); }}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">New Social Post</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{saveError}</div>
              )}
              <div>
                <label htmlFor="social-post-title" className="block text-xs font-semibold text-slate-600 mb-1">Post Title <span className="text-red-500">*</span></label>
                <input
                  id="social-post-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                  placeholder="e.g. Summer Campaign Teaser Video"
                />
              </div>
              <div>
                <label htmlFor="social-target-profile" className="block text-xs font-semibold text-slate-600 mb-1">Target Profile <span className="text-red-500">*</span></label>
                <select
                  id="social-target-profile"
                  value={form.profile_id || (selectedProfileId !== 'all' ? selectedProfileId : '')}
                  onChange={(e) => setForm({ ...form, profile_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                >
                  <option value="">Select Profile...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name ?? p.handle ?? `Profile ${p.id.slice(0, 6)}`}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="social-platform" className="block text-xs font-semibold text-slate-600 mb-1">Platform</label>
                  <select
                    id="social-platform"
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Twitter">Twitter</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="social-status" className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    id="social-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="social-scheduled-date" className="block text-xs font-semibold text-slate-600 mb-1">Scheduled Date</label>
                <input
                  id="social-scheduled-date"
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95]"
                />
              </div>
              <div>
                <label htmlFor="social-content-body" className="block text-xs font-semibold text-slate-600 mb-1">Content Body</label>
                <textarea
                  id="social-content-body"
                  rows={3}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#4C1D95] resize-none"
                  placeholder="Caption, hashtags, or post copy..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />} Create Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
