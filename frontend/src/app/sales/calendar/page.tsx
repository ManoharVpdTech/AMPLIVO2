'use client';
import { useState, useRef, useEffect } from 'react';
import { SalesHeader } from '@/components/sales/SalesSidebar';
import { useSalesStore } from '@/store/salesStore';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, Clock, Video, Phone, MapPin, Monitor } from 'lucide-react';
import Link from 'next/link';
import { Meeting } from '@/types';
import { getEffectiveMeetingStatus } from '@/lib/utils';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

const TypeIcon = ({ type }: { type: Meeting['type'] }) => {
  if (type === 'Video Call') return <Video size={12} />;
  if (type === 'Phone Call') return <Phone size={12} />;
  if (type === 'In-Person') return <MapPin size={12} />;
  return <Monitor size={12} />;
};

export default function CalendarPage() {
  const { meetings } = useSalesStore();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(today.toISOString().split('T')[0]);

  const [showJump, setShowJump] = useState(false);
  const [jumpMonth, setJumpMonth] = useState(currentDate.getMonth());
  const [jumpYear, setJumpYear] = useState(currentDate.getFullYear());
  const jumpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (jumpRef.current && !jumpRef.current.contains(e.target as Node)) setShowJump(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const goPrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const goNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const goPrevYear = () => setCurrentDate(new Date(year - 1, month, 1));
  const goNextYear = () => setCurrentDate(new Date(year + 1, month, 1));

  const openJump = () => {
    setJumpMonth(month);
    setJumpYear(year);
    setShowJump((o) => !o);
  };
  const applyJump = () => {
    setCurrentDate(new Date(jumpYear, jumpMonth, 1));
    setShowJump(false);
  };

  const getMeetingsForDate = (dateStr: string) =>
    meetings.filter((m) => m.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));

  const selectedMeetings = selectedDate ? getMeetingsForDate(selectedDate) : [];

  // Build calendar grid
  const calendarDays: { date: number; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    // Bug 15 fixed: use padded month (month is 0-indexed, so prev month = month, not month-1 string)
    const prevMonth = month === 0 ? 12 : month;
    const prevYear = month === 0 ? year - 1 : year;
    const ds = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ date: d, dateStr: ds, isCurrentMonth: false, isToday: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const todayStr = today.toISOString().split('T')[0];
    calendarDays.push({ date: d, dateStr: ds, isCurrentMonth: true, isToday: ds === todayStr });
  }
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    // Bug 16 fixed: handle December overflow (month+2 would be 13 for December)
    const nextMonth = (month + 2) > 12 ? 1 : month + 2;
    const nextYear = (month + 2) > 12 ? year + 1 : year;
    const ds = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ date: d, dateStr: ds, isCurrentMonth: false, isToday: false });
  }

  return (
    <div>
      <SalesHeader title="Calendar" subtitle="Meeting schedule overview" />
      <div className="p-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Month Nav */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 relative">
              <div className="relative" ref={jumpRef}>
                <button
                  type="button"
                  onClick={openJump}
                  className="font-bold text-slate-900 text-lg hover:text-[#4C1D95] transition-colors"
                  style={{ fontFamily: "'Sora', sans-serif" }}
                >
                  {MONTHS[month]} {year}
                </button>
                {showJump && (
                  <div className="absolute left-0 top-full mt-2 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-4 w-64">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <select
                        value={jumpMonth}
                        onChange={(e) => setJumpMonth(Number(e.target.value))}
                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20"
                      >
                        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                      </select>
                      <input
                        type="number"
                        value={jumpYear}
                        onChange={(e) => setJumpYear(Number(e.target.value))}
                        className="px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4C1D95]/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={applyJump}
                      className="w-full py-2 bg-[#4C1D95] text-white rounded-lg text-xs font-semibold hover:bg-[#3b1574] transition-colors"
                    >
                      Go to Date
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={goPrevYear}
                  title="Previous year"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={goPrev}
                  title="Previous month"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))}
                  className="px-3 py-1.5 text-xs font-semibold text-[#4C1D95] bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  title="Next month"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={goNextYear}
                  title="Next year"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const dayMeetings = getMeetingsForDate(day.dateStr);
                const isSelected = selectedDate === day.dateStr;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day.dateStr)}
                    className={`relative min-h-[80px] p-2 border-b border-r border-slate-50 text-left transition-all hover:bg-violet-50/50 ${
                      isSelected ? 'bg-violet-50 border-violet-100' : ''
                    } ${!day.isCurrentMonth ? 'opacity-30' : ''}`}
                  >
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold mb-1 ${
                      day.isToday
                        ? 'bg-[#4C1D95] text-white'
                        : isSelected
                        ? 'bg-violet-100 text-[#4C1D95]'
                        : 'text-slate-600'
                    }`}>
                      {day.date}
                    </span>
                    {dayMeetings.slice(0, 2).map((m, i) => (
                      <div
                        key={i}
                        title={`${formatTime(m.time)} · ${m.leadName} (${m.type})`}
                        className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md mb-0.5 truncate border ${
                          m.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : getEffectiveMeetingStatus(m) === 'Scheduled'
                              ? 'bg-violet-100 text-violet-700 border-violet-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        <TypeIcon type={m.type} />
                        <span className="opacity-70">{formatTime(m.time)}</span>
                        <span className="truncate">{m.leadName.split(' ')[0]}</span>
                      </div>
                    ))}
                    {dayMeetings.length > 2 && (
                      <div className="text-[9px] text-slate-400 font-medium">+{dayMeetings.length - 2} more</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Select a day'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{selectedMeetings.length} meetings</p>
            </div>
            <div className="p-4">
              {selectedMeetings.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays size={32} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No meetings on this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedMeetings.map((meeting) => (
                    <div key={meeting.id} className="p-4 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 text-[#4C1D95] flex items-center justify-center flex-shrink-0">
                          <TypeIcon type={meeting.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">{meeting.leadName}</div>
                          <div className="text-xs text-slate-400 truncate">{meeting.company}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1"><Clock size={11} />{formatTime(meeting.time)}</div>
                        <div>{meeting.duration} min</div>
                        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          meeting.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-600'
                            : getEffectiveMeetingStatus(meeting) === 'Scheduled'
                              ? 'bg-violet-50 text-violet-600'
                              : 'bg-slate-50 text-slate-400'
                        }`}>
                          {meeting.status === 'Scheduled' && getEffectiveMeetingStatus(meeting) === 'No-Show' ? 'No-Show' : meeting.status}
                        </span>
                      </div>
                      {meeting.agenda && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2">{meeting.agenda}</p>
                      )}
                      <Link href={`/sales/leads/${meeting.leadId}`} className="block mt-3 text-xs font-semibold text-[#4C1D95] hover:underline">
                        View Lead →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
