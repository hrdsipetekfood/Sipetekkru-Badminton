import React from 'react';
import {
  X,
  Clock,
  MapPin,
  Users,
  Edit2,
  Trash2,
  Plus,
  ShieldCheck,
  Eye,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { Reservation, AuthUser, MAX_SESSIONS_PER_DAY } from '../types/reservation';

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string | null;
  reservations: Reservation[];
  currentUser: AuthUser;
  onEdit: (reservation: Reservation) => void;
  onDelete: (reservation: Reservation) => void;
  onAddSession: (dateStr: string) => void;
}

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  reservations,
  currentUser,
  onEdit,
  onDelete,
  onAddSession,
}) => {
  if (!isOpen || !dateStr) return null;

  const isAdmin = currentUser.role === 'ADMIN';

  // Filter reservations for this day
  const daySessions = reservations.filter((r) => r.date === dateStr);
  const isFull = daySessions.length >= MAX_SESSIONS_PER_DAY;

  // Format date display (e.g. Monday, October 26, 2026)
  const dateObj = new Date(dateStr + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('default', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{formattedDate}</h3>
              <p className="text-xs text-slate-400 font-mono">{dateStr}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Day Status Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 font-medium">Daily Limit:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded-full ${
                  isFull
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {daySessions.length} / {MAX_SESSIONS_PER_DAY} Sessions {isFull ? '(Day FULL)' : 'Scheduled'}
              </span>
            </div>

            {isAdmin && !isFull && (
              <button
                onClick={() => onAddSession(dateStr)}
                className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Slot</span>
              </button>
            )}
          </div>

          {/* RBAC Notice for Guests */}
          {!isAdmin && (
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-400 text-xs flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                You are viewing this schedule as a <strong>Guest</strong>. Mutation controls (Edit/Delete) are restricted to <code>hrdsipetekfood@gmail.com</code>.
              </span>
            </div>
          )}

          {/* Sessions List */}
          <div className="space-y-3">
            {daySessions.length === 0 ? (
              <div className="text-center py-10 bg-slate-950/30 rounded-xl border border-slate-800/60">
                <p className="text-sm font-semibold text-slate-300">No sessions booked yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Up to {MAX_SESSIONS_PER_DAY} 60-minute sessions can be scheduled on this day.
                </p>
                {isAdmin && (
                  <button
                    onClick={() => onAddSession(dateStr)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Book First Session
                  </button>
                )}
              </div>
            ) : (
              daySessions.map((session, idx) => {
                const count = session.participants.length;
                const isFullParticipants = count >= 4;

                return (
                  <div
                    key={session.id}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                  >
                    {/* Top Row: Time & Badges */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          Session {idx + 1}
                        </span>
                        <span className="font-mono text-base font-bold text-emerald-400 flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {session.start_time} - {session.end_time}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          60 mins
                        </span>
                      </div>

                      {/* Participant count indicator */}
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isFullParticipants
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {isFullParticipants ? 'FULL (4/4)' : `${count}/4 filled`}
                      </span>
                    </div>

                    {/* Court Location */}
                    <div className="flex items-center space-x-2 text-xs text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold">{session.court_name || 'Court 1 - Sipetek Arena'}</span>
                    </div>

                    {/* Participants List */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          Participants ({count}/4):
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {4 - count > 0 ? `${4 - count} slots open` : 'Capacity reached'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {session.participants.map((name, pIdx) => (
                          <span
                            key={pIdx}
                            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded-md font-medium"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Note if present */}
                    {session.note && (
                      <div className="text-xs text-slate-400 italic bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                        &ldquo;{session.note}&rdquo;
                      </div>
                    )}

                    {/* Footer: Creator & Admin Actions */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <span className="text-[11px] text-slate-500">
                        Created by: <span className="text-slate-400">{session.created_by}</span>
                      </span>

                      {/* Admin CRUD Actions (Only rendered if isAdmin) */}
                      {isAdmin && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onEdit(session)}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                          >
                            <Edit2 className="w-3 h-3 text-emerald-400" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => onDelete(session)}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/30 transition-colors"
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
