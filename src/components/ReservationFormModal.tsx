import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Plus,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  Reservation,
  AuthUser,
  MAX_SESSIONS_PER_DAY,
  MAX_PARTICIPANTS_PER_SESSION,
  REQUIRED_SESSION_DURATION_MINUTES,
} from '../types/reservation';
import {
  calculateEndTime,
  validateSessionDuration,
  validateMaxSessionsPerDay,
  validateParticipants,
  validateReservationForm,
} from '../utils/reservationRules';

interface ReservationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    date: string;
    start_time: string;
    end_time: string;
    participants: string[];
    court_name: string;
    note: string;
  }) => Promise<{ error?: string }>;
  editingReservation?: Reservation | null;
  initialDate?: string;
  existingReservations: Reservation[];
  currentUser: AuthUser;
}

const DEFAULT_COURTS = [
  'Court 1 - Sipetek Arena',
  'Court 2 - Sipetek Arena',
  'Court 3 - Hall Serbaguna',
];

const SIPETEKKRU_TEAM_SUGGESTIONS = [
  'Rian',
  'Budi',
  'Siti',
  'Agus',
  'Dewi',
  'Indra',
  'Fajar',
  'Kevin',
  'Marcus',
  'Ahsan',
  'Hendra',
  'Taufik',
];

export const ReservationFormModal: React.FC<ReservationFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingReservation,
  initialDate,
  existingReservations,
  currentUser,
}) => {
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('18:00');
  const [endTime, setEndTime] = useState<string>('19:00');
  const [courtName, setCourtName] = useState<string>(DEFAULT_COURTS[0]);
  const [note, setNote] = useState<string>('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState<string>('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Initialize or reset form values
  useEffect(() => {
    if (editingReservation) {
      setDate(editingReservation.date);
      setStartTime(editingReservation.start_time);
      setEndTime(editingReservation.end_time);
      setCourtName(editingReservation.court_name || DEFAULT_COURTS[0]);
      setNote(editingReservation.note || '');
      setParticipants([...editingReservation.participants]);
    } else {
      const targetDate = initialDate || new Date().toISOString().split('T')[0];
      setDate(targetDate);
      setStartTime('18:00');
      setEndTime(calculateEndTime('18:00'));
      setCourtName(DEFAULT_COURTS[0]);
      setNote('');
      setParticipants(['Rian', 'Budi']); // sensible initial roster
    }
    setFormErrors({});
    setServerError(null);
    setParticipantInput('');
  }, [editingReservation, initialDate, isOpen]);

  if (!isOpen) return null;

  // Handle start time change -> automatically compute exact 60 minutes
  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    const computedEnd = calculateEndTime(val);
    setEndTime(computedEnd);
    if (formErrors.startTime || formErrors.endTime) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.startTime;
        delete next.endTime;
        return next;
      });
    }
  };

  // Add participant tag
  const handleAddParticipant = (nameToAdd?: string) => {
    const rawName = nameToAdd || participantInput;
    const trimmed = rawName.trim();
    if (!trimmed) return;

    if (participants.length >= MAX_PARTICIPANTS_PER_SESSION) {
      setFormErrors((prev) => ({
        ...prev,
        participants: `Maximum ${MAX_PARTICIPANTS_PER_SESSION} participants allowed per session.`,
      }));
      return;
    }

    if (participants.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setFormErrors((prev) => ({
        ...prev,
        participants: `"${trimmed}" is already added to this session.`,
      }));
      return;
    }

    setParticipants([...participants, trimmed]);
    setParticipantInput('');
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.participants;
      return next;
    });
  };

  // Remove participant tag
  const handleRemoveParticipant = (indexToRemove: number) => {
    const updated = participants.filter((_, idx) => idx !== indexToRemove);
    setParticipants(updated);
    if (updated.length === 0) {
      setFormErrors((prev) => ({
        ...prev,
        participants: 'At least 1 participant is required.',
      }));
    } else {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.participants;
        return next;
      });
    }
  };

  // Check how many sessions already booked on the selected date
  const dayCheck = validateMaxSessionsPerDay(
    existingReservations.map((r) => ({ id: r.id, date: r.date })),
    date,
    editingReservation?.id
  );

  // Validate duration
  const durationCheck = validateSessionDuration(startTime, endTime);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Front-end RBAC check
    if (currentUser.role !== 'ADMIN') {
      setServerError('Access Denied: Only Admin (hrdsipetekfood@gmail.com) can save reservations.');
      return;
    }

    // Comprehensive rules validation
    const validation = validateReservationForm(
      {
        date,
        startTime,
        endTime,
        participants,
      },
      existingReservations.map((r) => ({ id: r.id, date: r.date })),
      editingReservation?.id
    );

    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onSave({
        date,
        start_time: startTime,
        end_time: endTime,
        participants,
        court_name: courtName,
        note,
      });

      if (res.error) {
        setServerError(res.error);
      } else {
        onClose();
      }
    } catch (err: any) {
      setServerError(err?.message || 'Failed to save reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              🏸
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {editingReservation ? 'Edit Badminton Reservation' : 'New Badminton Reservation'}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Admin: {currentUser.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Server Error Alert */}
          {serverError && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Operation Blocked</p>
                <p>{serverError}</p>
              </div>
            </div>
          )}

          {/* Rule Indicator Badges Banner */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-xs space-y-1.5">
            <span className="font-bold text-slate-300 block mb-1">
              Sipetekkru Rules Enforced:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Max 2 sessions/day</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Strict 60-min duration</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Max 4 participants</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Admin RBAC Verified</span>
              </div>
            </div>
          </div>

          {/* 1. Date Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="res-date" className="block text-xs font-semibold text-slate-200">
                Reservation Date <span className="text-rose-400">*</span>
              </label>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  !dayCheck.allowed
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {dayCheck.currentCount} of {MAX_SESSIONS_PER_DAY} sessions booked on this date
              </span>
            </div>
            <div className="relative">
              <input
                id="res-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (formErrors.date) {
                    setFormErrors((prev) => {
                      const next = { ...prev };
                      delete next.date;
                      return next;
                    });
                  }
                }}
                className={`w-full bg-slate-950 border px-3.5 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-2 ${
                  formErrors.date || !dayCheck.allowed
                    ? 'border-rose-500 focus:ring-rose-500/40'
                    : 'border-slate-700 focus:ring-emerald-500/40 focus:border-emerald-500'
                }`}
                required
              />
            </div>
            {formErrors.date && (
              <p className="mt-1 text-xs text-rose-400 font-medium">{formErrors.date}</p>
            )}
            {!dayCheck.allowed && !formErrors.date && (
              <p className="mt-1 text-xs text-rose-400 font-medium">{dayCheck.error}</p>
            )}
          </div>

          {/* 2. Session Hours: Start Time & Computed 60-min End Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="res-start-time" className="block text-xs font-semibold text-slate-200 mb-1.5">
                Start Time <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="res-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 px-3.5 py-2.5 rounded-lg text-sm text-white font-mono"
                  required
                />
              </div>
              {formErrors.startTime && (
                <p className="mt-1 text-xs text-rose-400">{formErrors.startTime}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="res-end-time" className="block text-xs font-semibold text-slate-200">
                  End Time (Locked 60m)
                </label>
                <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> 60m strict
                </span>
              </div>
              <div className="relative">
                <input
                  id="res-end-time"
                  type="time"
                  value={endTime}
                  readOnly
                  title="Session duration is strictly locked to 60 minutes as per Sipetekkru reservation policy."
                  className="w-full bg-slate-950/70 border border-slate-800 text-slate-300 cursor-not-allowed px-3.5 py-2.5 rounded-lg text-sm font-mono"
                />
              </div>
              {formErrors.endTime && (
                <p className="mt-1 text-xs text-rose-400">{formErrors.endTime}</p>
              )}
            </div>
          </div>

          {/* Quick Start Time Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs text-slate-400">
            <span className="text-[10px] uppercase font-semibold text-slate-500 shrink-0">
              Popular times:
            </span>
            {['07:00', '17:00', '18:00', '19:00', '19:30', '20:00'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleStartTimeChange(preset)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                  startTime === preset
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* 3. Participants Input (Max 4, Dynamic and Flexible) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-200">
                Participants <span className="text-rose-400">*</span>
              </label>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  participants.length >= MAX_PARTICIPANTS_PER_SESSION
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                }`}
              >
                {participants.length}/{MAX_PARTICIPANTS_PER_SESSION} Participants
                {participants.length >= MAX_PARTICIPANTS_PER_SESSION ? ' (MAX)' : ''}
              </span>
            </div>

            {/* Tags preview */}
            <div className="min-h-[44px] p-2 bg-slate-950 border border-slate-700 rounded-lg flex flex-wrap gap-1.5 items-center mb-2">
              {participants.map((name, index) => (
                <span
                  key={index}
                  className="bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {name}
                  <button
                    type="button"
                    onClick={() => handleRemoveParticipant(index)}
                    aria-label={`Remove ${name}`}
                    className="text-emerald-400 hover:text-white p-0.5 hover:bg-emerald-900 rounded transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {participants.length === 0 && (
                <span className="text-xs text-slate-500 italic">
                  No participants added yet. Add between 1 and 4 players.
                </span>
              )}
            </div>

            {/* Input field + Add button */}
            {participants.length < MAX_PARTICIPANTS_PER_SESSION ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type player name (e.g. Hendra, Siti)..."
                  value={participantInput}
                  onChange={(e) => setParticipantInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddParticipant();
                    }
                  }}
                  className="flex-1 bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 px-3 py-2 rounded-lg text-sm text-white placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddParticipant()}
                  disabled={!participantInput.trim()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-md">
                Maximum capacity reached (4 participants). Remove a player above to add someone else.
              </p>
            )}

            {/* Quick team suggestions */}
            {participants.length < MAX_PARTICIPANTS_PER_SESSION && (
              <div className="mt-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                  Quick suggest Sipetekkru members:
                </span>
                <div className="flex flex-wrap gap-1">
                  {SIPETEKKRU_TEAM_SUGGESTIONS.filter(
                    (s) => !participants.some((p) => p.toLowerCase() === s.toLowerCase())
                  )
                    .slice(0, 6)
                    .map((suggested) => (
                      <button
                        key={suggested}
                        type="button"
                        onClick={() => handleAddParticipant(suggested)}
                        className="text-[10px] bg-slate-800/80 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-700 border border-slate-700 text-slate-300 px-2 py-0.5 rounded transition-colors"
                      >
                        + {suggested}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {formErrors.participants && (
              <p className="mt-1 text-xs text-rose-400 font-medium">{formErrors.participants}</p>
            )}
          </div>

          {/* 4. Court Name & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="court-select" className="block text-xs font-semibold text-slate-200 mb-1.5">
                Court Location
              </label>
              <select
                id="court-select"
                value={courtName}
                onChange={(e) => setCourtName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 px-3 py-2 rounded-lg text-sm text-white"
              >
                {DEFAULT_COURTS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notes-input" className="block text-xs font-semibold text-slate-200 mb-1.5">
                Session Note (Optional)
              </label>
              <input
                id="notes-input"
                type="text"
                placeholder="e.g. Doubles practice, Sparring"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 px-3 py-2 rounded-lg text-sm text-white placeholder-slate-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !dayCheck.allowed || !durationCheck.valid}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingReservation ? 'Save Changes' : 'Create Reservation'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
