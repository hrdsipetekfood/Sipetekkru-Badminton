import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Clock, Calendar, Users } from 'lucide-react';
import { Reservation, AuthUser } from '../types/reservation';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  onConfirm: (id: string) => Promise<{ error?: string }>;
  currentUser: AuthUser;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  reservation,
  onConfirm,
  currentUser,
}) => {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !reservation) return null;

  const handleDelete = async () => {
    if (currentUser.role !== 'ADMIN') {
      setError('Only Admin (hrdsipetekfood@gmail.com) is authorized to delete schedules.');
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      const res = await onConfirm(reservation.id);
      if (res.error) {
        setError(res.error);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete session.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center space-x-3 text-rose-400">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Delete Reservation Slot</h3>
            <p className="text-xs text-slate-400">This action cannot be undone.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl space-y-2">
            <p className="font-semibold">{error}</p>
            {error.includes('RLS') && (
              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1.5 text-slate-300">
                <p className="text-amber-300 font-bold">💡 Solusi Cepat di Supabase SQL Editor:</p>
                <p className="text-slate-400">Jalankan perintah ini di Supabase SQL Editor untuk mengizinkan hapus:</p>
                <div className="bg-slate-900 p-2 rounded font-mono text-[10px] text-emerald-400 select-all border border-slate-800">
                  ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;
                </div>
              </div>
            )}
          </div>
        )}

        {/* Details Card */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Date:
            </span>
            <span className="font-semibold text-white font-mono">{reservation.date}</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> Time (60m):
            </span>
            <span className="font-semibold text-white font-mono">
              {reservation.start_time} - {reservation.end_time}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Users className="w-3.5 h-3.5 text-emerald-400" /> Participants:
            </span>
            <span className="font-semibold text-white">
              {reservation.participants.join(', ')} ({reservation.participants.length}/4)
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/30 flex items-center gap-1.5 disabled:opacity-50"
          >
            {isDeleting ? (
              <span>Deleting...</span>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
