import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Plus,
  MapPin,
  CalendarRange,
} from 'lucide-react';
import { Reservation, AuthUser, MAX_SESSIONS_PER_DAY } from '../types/reservation';

interface WeekCalendarProps {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  reservations: Reservation[];
  currentUser: AuthUser;
  onSelectDate: (dateStr: string) => void;
  onSelectReservation: (reservation: Reservation) => void;
  onOpenCreateForDate: (dateStr: string) => void;
}

export const WeekCalendar: React.FC<WeekCalendarProps> = ({
  currentDate,
  setCurrentDate,
  reservations,
  currentUser,
  onSelectDate,
  onSelectReservation,
  onOpenCreateForDate,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  // Calculate start of week (Sunday)
  const startOfWeek = React.useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }, [currentDate]);

  // Build the 7 days of this week
  const weekDays = React.useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      return {
        dateObj: d,
        dateStr,
        dayName: d.toLocaleDateString('default', { weekday: 'short' }),
        dayNumber: d.getDate(),
        monthShort: d.toLocaleDateString('default', { month: 'short' }),
      };
    });
  }, [startOfWeek]);

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const weekRangeTitle = `${weekDays[0].monthShort} ${weekDays[0].dayNumber} - ${
    weekDays[6].monthShort
  } ${weekDays[6].dayNumber}, ${weekDays[6].dateObj.getFullYear()}`;

  // Map reservations by date string
  const reservationsByDate = React.useMemo(() => {
    const map = new Map<string, Reservation[]>();
    reservations.forEach((res) => {
      const list = map.get(res.date) || [];
      list.push(res);
      map.set(res.date, list);
    });
    return map;
  }, [reservations]);

  return (
    <div className="space-y-4">
      {/* Week Header / Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{weekRangeTitle}</h2>
            <p className="text-xs text-slate-400">
              Weekly schedule overview with 60-minute duration slots
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5">
            <button
              onClick={handlePrevWeek}
              aria-label="Previous Week"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextWeek}
              aria-label="Next Week"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Week Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const daySessions = reservationsByDate.get(day.dateStr) || [];
          const isToday = day.dateStr === todayStr;
          const isFullDay = daySessions.length >= MAX_SESSIONS_PER_DAY;
          const canAdminAdd = isAdmin && !isFullDay;

          return (
            <div
              key={day.dateStr}
              className={`flex flex-col bg-slate-900 border rounded-xl overflow-hidden shadow transition-all ${
                isToday
                  ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Day Header */}
              <div
                className={`p-3 border-b flex items-center justify-between ${
                  isToday
                    ? 'bg-emerald-950/40 border-emerald-800/60'
                    : 'bg-slate-950/50 border-slate-800'
                }`}
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {day.dayName}
                  </div>
                  <div className="text-lg font-bold text-white flex items-center gap-1.5">
                    {day.dayNumber}
                    <span className="text-xs text-slate-400 font-normal">
                      {day.monthShort}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      isFullDay
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                        : daySessions.length > 0
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {daySessions.length}/{MAX_SESSIONS_PER_DAY} {isFullDay ? 'FULL' : 'booked'}
                  </span>

                  {canAdminAdd && (
                    <button
                      onClick={() => onOpenCreateForDate(day.dateStr)}
                      className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      Add slot
                    </button>
                  )}
                </div>
              </div>

              {/* Day Sessions Content */}
              <div className="p-3 space-y-2.5 flex-1 min-h-[180px] flex flex-col justify-between bg-slate-900/60">
                <div className="space-y-2.5">
                  {daySessions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      <p>No sessions</p>
                      <p className="text-[10px] text-slate-600 mt-1">
                        Up to {MAX_SESSIONS_PER_DAY} sessions available
                      </p>
                    </div>
                  ) : (
                    daySessions.map((res) => {
                      const participantCount = res.participants.length;
                      const isMax = participantCount >= 4;

                      return (
                        <div
                          key={res.id}
                          onClick={() => onSelectReservation(res)}
                          className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 rounded-lg p-2.5 cursor-pointer transition-all shadow-sm group"
                        >
                          {/* Time & Duration badge */}
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {res.start_time} - {res.end_time}
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded">
                              60m
                            </span>
                          </div>

                          {/* Court Name */}
                          <div className="text-xs font-semibold text-slate-200 flex items-center gap-1 mb-2">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{res.court_name || 'Court 1'}</span>
                          </div>

                          {/* Capacity Indicator Pill */}
                          <div className="mb-2.5">
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="text-slate-400 font-medium">Participants</span>
                              <span
                                className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                  isMax
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {isMax ? 'FULL (4/4)' : `${participantCount}/4 filled`}
                              </span>
                            </div>

                            {/* Mini capacity progress bar */}
                            <div className="w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all rounded-full ${
                                  isMax ? 'bg-rose-400' : 'bg-emerald-400'
                                }`}
                                style={{ width: `${(participantCount / 4) * 100}%` }}
                              />
                            </div>
                          </div>

                          {/* Participant Names List */}
                          <div className="flex flex-wrap gap-1">
                            {res.participants.map((name, pIdx) => (
                              <span
                                key={pIdx}
                                className="bg-slate-700/80 border border-slate-600/70 text-slate-200 text-[10px] px-1.5 py-0.5 rounded"
                              >
                                {name}
                              </span>
                            ))}
                          </div>

                          {res.note && (
                            <p className="mt-2 text-[10px] text-slate-400 italic line-clamp-1 border-t border-slate-700/60 pt-1">
                              &ldquo;{res.note}&rdquo;
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Day Footer with date action */}
                <button
                  onClick={() => onSelectDate(day.dateStr)}
                  className="w-full mt-2 py-1.5 text-center text-[10px] font-semibold text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded transition-colors"
                >
                  View Day Details →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
