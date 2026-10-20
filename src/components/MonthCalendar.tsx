import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Reservation, AuthUser, MAX_SESSIONS_PER_DAY } from '../types/reservation';

interface MonthCalendarProps {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  reservations: Reservation[];
  currentUser: AuthUser;
  onSelectDate: (dateStr: string) => void;
  onSelectReservation: (reservation: Reservation) => void;
  onOpenCreateForDate: (dateStr: string) => void;
}

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  currentDate,
  setCurrentDate,
  reservations,
  currentUser,
  onSelectDate,
  onSelectReservation,
  onOpenCreateForDate,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Month metadata
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

  // Month name
  const monthName = firstDayOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Map reservations by date string: YYYY-MM-DD
  const reservationsByDate = React.useMemo(() => {
    const map = new Map<string, Reservation[]>();
    reservations.forEach((res) => {
      const list = map.get(res.date) || [];
      list.push(res);
      map.set(res.date, list);
    });
    return map;
  }, [reservations]);

  // Build grid calendar cells
  const calendarCells = [];
  // Leading empty cells
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarCells.push(null);
  }
  // Days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarCells.push({ day, dateStr, dateObj: d });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* Month Header / Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white capitalize">{monthName}</h2>
            <p className="text-xs text-slate-400">
              Sipetekkru monthly court schedule (Max 2 sessions / day, 60 mins each)
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
              onClick={handlePrevMonth}
              aria-label="Previous Month"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              aria-label="Next Month"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/60 text-center text-xs font-semibold text-slate-400 py-2.5">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
            <div key={d} className={idx === 0 || idx === 6 ? 'text-emerald-400/80' : ''}>
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 auto-rows-fr bg-slate-950/40">
          {calendarCells.map((cell, idx) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[120px] sm:min-h-[140px] bg-slate-950/20 border-b border-r border-slate-800/60 p-2"
                />
              );
            }

            const daySessions = reservationsByDate.get(cell.dateStr) || [];
            const isToday = cell.dateStr === todayStr;
            const isFullDay = daySessions.length >= MAX_SESSIONS_PER_DAY;
            const canAdminAdd = isAdmin && !isFullDay;

            return (
              <div
                key={cell.dateStr}
                onClick={() => onSelectDate(cell.dateStr)}
                className={`min-h-[85px] sm:min-h-[140px] border-b border-r border-slate-800/80 p-1 sm:p-2 flex flex-col justify-between transition-colors relative group cursor-pointer ${
                  isToday ? 'bg-emerald-950/20 ring-1 ring-inset ring-emerald-500/40' : 'hover:bg-slate-800/30'
                }`}
              >
                {/* Cell Header: Day Number + Day Sessions Status */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`text-[11px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 group-hover:text-white'
                    }`}
                  >
                    {cell.day}
                  </span>

                  {/* Day Slot indicator */}
                  {daySessions.length > 0 && (
                    <span
                      className={`text-[8px] sm:text-[9px] font-semibold px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full ${
                        isFullDay
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                      }`}
                      title={`${daySessions.length} of ${MAX_SESSIONS_PER_DAY} allowed sessions booked`}
                    >
                      {daySessions.length}/{MAX_SESSIONS_PER_DAY}
                      <span className="hidden sm:inline ml-0.5">{isFullDay ? 'FULL' : 'Slots'}</span>
                    </span>
                  )}

                  {/* Admin quick add icon on hover if not full */}
                  {canAdminAdd && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCreateForDate(cell.dateStr);
                      }}
                      title="Add Badminton Session for this day"
                      className="hidden sm:block opacity-0 group-hover:opacity-100 p-1 rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-opacity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Sessions list */}
                <div className="space-y-1 sm:space-y-1.5 flex-1">
                  {daySessions.map((res) => {
                    const participantCount = res.participants.length;
                    const isMaxParticipants = participantCount >= 4;

                    return (
                      <div
                        key={res.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectReservation(res);
                        }}
                        className={`text-left p-1 sm:p-1.5 rounded-md border text-[9px] sm:text-[11px] transition-all hover:scale-[1.02] shadow-sm ${
                          isMaxParticipants
                            ? 'bg-slate-800/90 border-slate-700 hover:border-slate-500 text-slate-200'
                            : 'bg-emerald-950/40 border-emerald-800/60 hover:border-emerald-500 text-slate-100'
                        }`}
                      >
                        {/* Time & Duration */}
                        <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-semibold text-slate-300">
                          <span className="flex items-center gap-0.5 sm:gap-1 text-emerald-400 font-mono truncate">
                            <Clock className="w-2.5 h-2.5 shrink-0 hidden sm:inline" />
                            {res.start_time}
                          </span>
                          
                          {/* 4/4 filled or 2/4 filled badge */}
                          <span
                            className={`px-1 py-0.2 rounded font-medium text-[8px] sm:text-[9px] shrink-0 ${
                              isMaxParticipants
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            }`}
                          >
                            {isMaxParticipants ? 'FULL' : `${participantCount}/4`}
                          </span>
                        </div>

                        {/* Court Name - Hidden on very small mobile */}
                        <div className="text-[10px] text-slate-400 truncate mt-0.5 font-medium hidden sm:block">
                          {res.court_name || 'Court 1'}
                        </div>

                        {/* Participants Preview */}
                        <div className="flex items-center gap-1 mt-0.5 sm:mt-1 text-[8px] sm:text-[10px] text-slate-300 truncate">
                          <Users className="w-2.5 h-2.5 text-slate-400 shrink-0 hidden sm:inline" />
                          <span className="truncate">
                            {res.participants[0]}
                            {participantCount > 1 && ` +${participantCount - 1}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Empty State / Add Helper */}
                {daySessions.length === 0 && (
                  <div className="mt-auto pt-1 sm:pt-2 text-[8px] sm:text-[10px] text-slate-600 italic flex items-center justify-between">
                    <span className="hidden sm:inline">No sessions</span>
                    <span className="sm:hidden text-slate-700">-</span>
                    {isAdmin && (
                      <span className="text-[9px] text-emerald-500/70 font-sans not-italic hidden group-hover:inline">
                        + Add
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
