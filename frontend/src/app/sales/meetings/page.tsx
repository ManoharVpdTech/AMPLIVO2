'use client';
import { useState } from 'react';
import { SalesHeader } from '@/components/sales/SalesSidebar';
import { useSalesStore } from '@/store/salesStore';
import { ScheduleMeetingModal } from '@/components/sales/ScheduleMeetingModal';
import { CalendarDays, Clock, Video, Phone, MapPin, Monitor, CheckCircle2, Plus, Filter } from 'lucide-react';
import Link from 'next/link';
import { Meeting } from '@/types';
import { getEffectiveMeetingStatus } from '@/lib/utils';

const TypeIcon = ({ type }: { type: Meeting['type'] }) => {
  const cls = "w-5 h-5";
  if (type === 'Video Call') return <Video className={cls} />;
  if (type === 'Phone Call') return <Phone className={cls} />;
  if (type === 'In-Person') return <MapPin className={cls} />;
  return <Monitor className={cls} />;
};

const statusStyle = {
  Scheduled: 'bg-violet-50 text-violet-700 border-violet-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  'No-Show': 'bg-red-50 text-red-600 border-red-200',
};

const typeStyle: Record<Meeting['type'], string> = {
  'Video Call': 'bg-blue-50 text-blue-700',
  'Phone Call': 'bg-cyan-50 text-cyan-700',
  'In-Person': 'bg-emerald-50 text-emerald-700',
  'Demo': 'bg-violet-50 text-violet-700',
};

type FilterType = 'All' | 'Upcoming' | 'Completed' | 'No-Show';

export default function MeetingsPage() {
  const { meetings, leads, scheduleMeeting, completeMeeting } = useSalesStore();
  const [filter, setFilter] = useState<FilterType>('All');
  const [showModal, setShowModal] = useState(false);
  // Bug 14 fixed: let user pick which lead to schedule a meeting for
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');

  const filtered = meetings.filter((m) => {
    const effectiveStatus = getEffectiveMeetingStatus(m);
    if (filter === 'Upcoming') return effectiveStatus === 'Scheduled';
    if (filter === 'Completed') return effectiveStatus === 'Completed';
    if (filter === 'No-Show') return effectiveStatus === 'No-Show';
    return true;
  }).sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

  const counts = {
    All: meetings.length,
    Upcoming: meetings.filter((m) => getEffectiveMeetingStatus(m) === 'Scheduled').length,
    Completed: meetings.filter((m) => getEffectiveMeetingStatus(m) === 'Completed').length,
    'No-Show': meetings.filter((m) => getEffectiveMeetingStatus(m) === 'No-Show').length,
  };

  // For the modal, default to first lead
  const defaultLead = leads[0];

  return (
    <div>
      <SalesHeader
        title="Meetings"
        badge={`${meetings.filter((m) => getEffectiveMeetingStatus(m) === 'Scheduled').length} Upcoming`}
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] transition-colors"
          >
            <Plus size={15} /> Schedule Meeting
          </button>
        }
      />

      <div className="p-6 space-y-5">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['All', 'Upcoming', 'Completed', 'No-Show'] as FilterType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                filter === tab
                  ? 'bg-[#4C1D95] text-white border-[#4C1D95]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#4C1D95]/30'
              }`}
            >
              {tab}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                filter === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {counts[tab]}
              </span>
            </button>
          ))}
          <button className="ml-auto flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <Filter size={14} /> Filter
          </button>
        </div>

        {/* Meeting Cards Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <CalendarDays size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No meetings in this category</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((meeting) => {
              const effectiveStatus = getEffectiveMeetingStatus(meeting);
              const isOverdue = meeting.status === 'Scheduled' && effectiveStatus === 'No-Show';
              return (
              <div
                key={meeting.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-violet-200 transition-all card-hover"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeStyle[meeting.type]}`}>
                      <TypeIcon type={meeting.type} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{meeting.leadName}</div>
                      <div className="text-xs text-slate-400">{meeting.company}</div>
                    </div>
                  </div>
                  <span
                    title={isOverdue ? 'Meeting time has passed without being marked complete' : undefined}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full border ${statusStyle[effectiveStatus]}`}
                  >
                    {isOverdue ? 'No-Show' : meeting.status}
                  </span>
                </div>

                {/* Date + Time */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays size={13} className="text-slate-300" />{meeting.date}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock size={13} className="text-slate-300" />
                    {new Date(`1970-01-01T${meeting.time}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </div>
                  <div className="text-xs text-slate-400">{meeting.duration} min</div>
                </div>

                {/* Agenda / Notes */}
                {(meeting.notes || meeting.agenda) && (
                  <div className="p-3 bg-slate-50 rounded-xl mb-4">
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {meeting.notes || meeting.agenda}
                    </p>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <Link
                    href={`/sales/leads/${meeting.leadId}`}
                    className="flex-1 text-center text-xs font-semibold text-[#4C1D95] bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    View Lead
                  </Link>
                  {meeting.status === 'Scheduled' && (
                    <button
                      onClick={() => completeMeeting(meeting.id, meeting.notes || '')}
                      className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition-colors"
                    >
                      <CheckCircle2 size={12} /> Mark Done
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <>
          {/* Bug 14 fixed: show lead selector before opening the meeting modal */}
          {!selectedLeadId ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" role="button" tabIndex={0} onClick={() => setShowModal(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowModal(false); }} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 p-6">
                <h2 className="font-bold text-slate-900 text-lg mb-4">Select Lead</h2>
                <select
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20 focus:border-[#4C1D95] mb-4"
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                >
                  <option value="">-- Choose a lead --</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.firstName} {l.lastName} · {l.company}</option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">Cancel</button>
                  <button
                    type="button"
                    disabled={!selectedLeadId}
                    onClick={() => { /* selectedLeadId is set, modal will render */ }}
                    className="flex-1 px-4 py-2.5 bg-[#4C1D95] text-white rounded-xl text-sm font-semibold hover:bg-[#3b1574] disabled:opacity-50"
                  >Continue</button>
                </div>
              </div>
            </div>
          ) : (() => {
            const lead = leads.find((l) => l.id === selectedLeadId)!;
            return (
              <ScheduleMeetingModal
                leadId={lead.id}
                leadName={`${lead.firstName} ${lead.lastName}`}
                company={lead.company}
                onClose={() => { setShowModal(false); setSelectedLeadId(''); }}
                onSchedule={(m) => { scheduleMeeting(m); setSelectedLeadId(''); }}
              />
            );
          })()}
        </>
      )}
    </div>
  );
}
