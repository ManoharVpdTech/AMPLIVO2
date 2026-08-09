'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Loader2, X, Check, XCircle } from 'lucide-react';
import { contentCalendarService } from '@/services/moduleServices';
import { useToastStore } from '@/store/toastStore';

interface CalendarEvent {
  id: string;
  title: string;
  content_type: string;
  platform: string | null;
  scheduled_date: string | null;
  status: string;
  content_brief: string | null;
}

const CONTENT_TYPES = ['social_post', 'reel', 'blog', 'email', 'ad'];
const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'Twitter', 'Email'];

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  const load = () => {
    setLoading(true);
    setError(false);
    contentCalendarService
      .getAll({ page_size: 200 })
      .then((res) => setEvents(res?.items ?? res ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => (e.scheduled_date || '').slice(0, 10) === dateStr);
  };

  const getPlatformIcon = (platform: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('instagram')) return { color: '#E1306C', label: 'IG' };
    if (p.includes('linkedin')) return { color: '#0A66C2', label: 'LI' };
    if (p.includes('facebook')) return { color: '#1877F2', label: 'FB' };
    if (p.includes('twitter') || p.includes('x')) return { color: '#1DA1F2', label: 'TW' };
    return { color: '#6B7280', label: 'SM' };
  };

  const handleStatusChange = async (event: CalendarEvent, status: string) => {
    try {
      await contentCalendarService.update(event.id, { status });
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status } : e)));
      setSelectedEvent((prev) => (prev && prev.id === event.id ? { ...prev, status } : prev));
      showToast(`Post ${status === 'approved' ? 'approved' : 'sent back for changes'}.`, 'success');
    } catch {
      showToast('Failed to update post status.', 'error');
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
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Sora', sans-serif" }}>Content Calendar</h1>
          <p className="text-slate-500 text-sm mt-1">Review and approve upcoming social media posts.</p>
        </div>

        <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 bg-[#4C1D95] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3b1574] transition-colors">
          <Plus size={16} /> Request Post
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6">
          Couldn&apos;t load the content calendar. <button onClick={load} className="underline font-medium">Retry</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-900">{monthName}</h2>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"><ChevronLeft size={18} /></button>
              <button onClick={nextMonth} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {events.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-400 border-b border-slate-100">No content scheduled yet — request a post to get started.</div>
        )}

        <div className="grid grid-cols-7 auto-rows-[120px] bg-slate-200 gap-px">
          {Array.from({ length: 35 }).map((_, i) => {
            const day = i - firstDay + 1;
            const isCurrentMonth = day > 0 && day <= daysInMonth;
            const dayEvents = isCurrentMonth ? getEventsForDay(day) : [];
            const isToday = isCurrentMonth && day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

            return (
              <div key={i} className={`bg-white p-2 ${!isCurrentMonth ? 'opacity-50 bg-slate-50' : ''}`}>
                <span className={`text-sm font-medium ${isToday ? 'bg-[#4C1D95] text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-500'}`}>
                  {isCurrentMonth ? day : ''}
                </span>

                <div className="mt-2 space-y-1.5">
                  {dayEvents.map((event) => {
                    const platform = getPlatformIcon(event.platform || '');
                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="w-full text-left bg-slate-50 border border-slate-200 rounded p-1.5 cursor-pointer hover:border-[#4C1D95] transition-colors group relative"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold px-1 py-0.5 rounded text-white" style={{ backgroundColor: platform.color }}>{platform.label}</span>
                          <span className="text-[10px] font-semibold text-slate-700 truncate">{event.content_type || 'Post'}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 truncate leading-tight">{event.title || 'Untitled'}</div>
                        <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                          event.status === 'approved' || event.status === 'published' ? 'bg-green-500' :
                          event.status === 'pending' || event.status === 'draft' || event.status === 'scheduled' ? 'bg-amber-500' : 'bg-slate-300'
                        }`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-6 mt-6 px-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-slate-500">Approved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-xs text-slate-500">Pending Review</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-300" />
          <span className="text-xs text-slate-500">Draft</span>
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">{selectedEvent.title}</h3>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="text-sm text-slate-500 mb-4 space-y-1">
              <p>Type: <span className="capitalize text-slate-700">{selectedEvent.content_type}</span></p>
              {selectedEvent.platform && <p>Platform: <span className="text-slate-700">{selectedEvent.platform}</span></p>}
              {selectedEvent.scheduled_date && <p>Scheduled: <span className="text-slate-700">{new Date(selectedEvent.scheduled_date).toLocaleDateString()}</span></p>}
              <p>Status: <span className="capitalize text-slate-700">{selectedEvent.status}</span></p>
            </div>
            {selectedEvent.content_brief && <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-4">{selectedEvent.content_brief}</p>}
            {(selectedEvent.status === 'draft' || selectedEvent.status === 'pending' || selectedEvent.status === 'scheduled') && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleStatusChange(selectedEvent, 'approved')} className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100">
                  <Check size={16} /> Approve
                </button>
                <button onClick={() => handleStatusChange(selectedEvent, 'changes_requested')} className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100">
                  <XCircle size={16} /> Request Changes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showRequestModal && (
        <RequestPostModal
          onClose={() => setShowRequestModal(false)}
          onCreated={(e) => {
            setEvents((prev) => [...prev, e]);
            showToast('Post request submitted.', 'success');
          }}
        />
      )}
    </div>
  );
}

function RequestPostModal({ onClose, onCreated }: { onClose: () => void; onCreated: (e: CalendarEvent) => void }) {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState(CONTENT_TYPES[0]);
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [brief, setBrief] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const showToast = useToastStore((s) => s.showToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !contentType || !platform || !scheduledDate || !brief.trim()) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const created = await contentCalendarService.create({
        title: title.trim(),
        content_type: contentType,
        platform,
        scheduled_date: scheduledDate || undefined,
        status: 'draft',
        content_brief: brief.trim() || undefined,
      });
      onCreated(created);
      onClose();
    } catch {
      setErrorMsg('Failed to submit request.');
      showToast('Failed to submit post request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Request a Post</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{errorMsg}</p>}
          <div>
            <label htmlFor="post-req-title" className="block text-xs font-medium text-slate-500 mb-1">Title <span className="text-red-500">*</span></label>
            <input id="post-req-title" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/30" placeholder="e.g. Diwali sale announcement" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="post-req-type" className="block text-xs font-medium text-slate-500 mb-1">Content Type <span className="text-red-500">*</span></label>
              <select id="post-req-type" value={contentType} onChange={(e) => setContentType(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm capitalize">
                {CONTENT_TYPES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="post-req-platform" className="block text-xs font-medium text-slate-500 mb-1">Platform <span className="text-red-500">*</span></label>
              <select id="post-req-platform" value={platform} onChange={(e) => setPlatform(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="post-req-date" className="block text-xs font-medium text-slate-500 mb-1">Preferred Date <span className="text-red-500">*</span></label>
            <input id="post-req-date" type="date" min={new Date().toISOString().split('T')[0]} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/30" />
          </div>
          <div>
            <label htmlFor="post-req-brief" className="block text-xs font-medium text-slate-500 mb-1">Brief / Notes <span className="text-red-500">*</span></label>
            <textarea id="post-req-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/30" placeholder="What should this post be about?" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm font-medium text-slate-600">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 bg-[#4C1D95] text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
