import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Eye,
  UserCheck,
  CheckCircle2,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { AuthUser, ADMIN_EMAIL } from '../types/reservation';
import { AuthService } from '../services/supabaseService';
import { checkIsAdmin } from '../utils/reservationRules';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  onUserChange: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
}) => {
  const [customEmail, setCustomEmail] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectAdmin = () => {
    const user = AuthService.loginAsAdmin();
    onUserChange(user);
    setMessage(`Switched to Admin (${ADMIN_EMAIL}) with full CRUD permissions.`);
    setTimeout(() => onClose(), 800);
  };

  const handleSelectGuest = () => {
    const user = AuthService.loginAsGuest();
    onUserChange(user);
    setMessage('Switched to Guest mode. Dashboard is now Read-Only.');
    setTimeout(() => onClose(), 800);
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;

    const user = AuthService.loginWithCustomEmail(customEmail.trim());
    onUserChange(user);
    if (checkIsAdmin(user.email)) {
      setMessage(`Logged in as Admin: ${user.email} (Full Access)`);
    } else {
      setMessage(`Logged in as ${user.email}. Role: GUEST (Read-Only access enforced).`);
    }
    setTimeout(() => onClose(), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Authentication & RBAC</h3>
              <p className="text-xs text-slate-400">Role-Based Access Control Simulation</p>
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

        {/* Feedback Message */}
        {message && (
          <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* Current Active Status */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
          <span className="text-slate-400 font-medium block">Current Active Session:</span>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {currentUser.role === 'ADMIN' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <Eye className="w-4 h-4 text-amber-400" />
              )}
              <span className="font-bold text-white">
                {currentUser.role === 'ADMIN' ? 'Authorized Admin' : 'Guest (Read-Only)'}
              </span>
            </div>
            <span
              className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                currentUser.role === 'ADMIN'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {currentUser.email || 'Anonymous'}
            </span>
          </div>
        </div>

        {/* Quick Role Selection Cards */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-300 block">
            Quick Switch Roles for Testing:
          </label>

          {/* Option 1: Admin */}
          <button
            type="button"
            onClick={handleSelectAdmin}
            className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
              currentUser.role === 'ADMIN'
                ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/40'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-xs flex items-center gap-1.5">
                  Admin User
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                    Full CRUD
                  </span>
                </div>
                <div className="text-[11px] text-emerald-400/90 font-mono mt-0.5">
                  {ADMIN_EMAIL}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Can create, edit, and delete badminton schedule slots.
                </p>
              </div>
            </div>
            {currentUser.role === 'ADMIN' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
          </button>

          {/* Option 2: Guest */}
          <button
            type="button"
            onClick={handleSelectGuest}
            className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
              currentUser.role === 'GUEST'
                ? 'bg-slate-800/80 border-slate-600 ring-1 ring-slate-500/40'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-slate-800 text-amber-400 shrink-0 mt-0.5">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-xs flex items-center gap-1.5">
                  Guest / Anonymous
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">
                    Read-Only
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Can only view calendars and schedules. No creation or modification allowed.
                </p>
              </div>
            </div>
            {currentUser.role === 'GUEST' && (
              <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>
        </div>

        {/* Custom Email Test */}
        <form onSubmit={handleCustomLogin} className="pt-2 border-t border-slate-800 space-y-2">
          <label htmlFor="custom-email" className="block text-xs font-semibold text-slate-300">
            Test Custom Email Verification:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                id="custom-email"
                type="email"
                placeholder="e.g. employee@sipetek.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 pl-8 pr-3 py-2 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={!customEmail.trim()}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1"
            >
              <span>Test</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            * Only exact match to <code>hrdsipetekfood@gmail.com</code> gains Admin rights. Any other email is assigned Guest (Read-Only).
          </p>
        </form>
      </div>
    </div>
  );
};
