import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  Lock,
  Mail,
  ArrowRight,
  KeyRound,
  AlertTriangle,
  LogOut,
  Settings,
} from 'lucide-react';
import { AuthUser, ADMIN_EMAIL } from '../types/reservation';
import { AuthService } from '../services/supabaseService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  onUserChange: (user: AuthUser) => void;
}

const PIN_KEY = 'sipetekkru_admin_pin_v1';
const DEFAULT_PIN = 'sipetek2026';

export function getStoredAdminPin(): string {
  try {
    return localStorage.getItem(PIN_KEY) || DEFAULT_PIN;
  } catch (e) {
    return DEFAULT_PIN;
  }
}

export function setStoredAdminPin(newPin: string): void {
  try {
    localStorage.setItem(PIN_KEY, newPin.trim());
  } catch (e) {}
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
}) => {
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Change PIN sub-state (for logged-in Admin)
  const [showChangePin, setShowChangePin] = useState<boolean>(false);
  const [oldPinInput, setOldPinInput] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');

  if (!isOpen) return null;

  const isAdmin = currentUser.role === 'ADMIN';

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const activePin = getStoredAdminPin();

    if (!pinInput.trim()) {
      setErrorMessage('Silakan masukkan PIN / Password Admin.');
      return;
    }

    if (pinInput.trim() !== activePin) {
      setErrorMessage('PIN / Password salah. Masukkan PIN yang benar (Default: sipetek2026).');
      return;
    }

    const user = AuthService.loginAsAdmin();
    onUserChange(user);
    setSuccessMessage('Berhasil masuk sebagai Admin! Hak akses CRUD aktif.');
    setPinInput('');
    setTimeout(() => onClose(), 800);
  };

  const handleLogout = () => {
    const guest = AuthService.loginAsGuest();
    onUserChange(guest);
    setSuccessMessage('Berhasil keluar. Mode Tamu (Read-Only) aktif.');
    setTimeout(() => onClose(), 800);
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const activePin = getStoredAdminPin();

    if (oldPinInput.trim() !== activePin) {
      setErrorMessage('PIN lama tidak sesuai.');
      return;
    }

    if (newPinInput.trim().length < 4) {
      setErrorMessage('PIN baru minimal harus 4 karakter.');
      return;
    }

    setStoredAdminPin(newPinInput.trim());
    setSuccessMessage('PIN Admin berhasil diperbarui!');
    setOldPinInput('');
    setNewPinInput('');
    setShowChangePin(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Autentikasi Admin</h3>
              <p className="text-xs text-slate-400">Login dengan PIN / Password Admin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Current Status Box */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Status saat ini:</span>
            {isAdmin ? (
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin (CRUD Aktif)
              </span>
            ) : (
              <span className="font-bold text-amber-300 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                Tamu (Read-Only)
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            {currentUser.email || 'Guest Mode'}
          </span>
        </div>

        {/* Content: If currently Guest -> Show Admin PIN Login Form */}
        {!isAdmin ? (
          <form onSubmit={handleAdminLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Akun Admin Resmi:
              </label>
              <div className="flex items-center px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400">
                <Mail className="w-3.5 h-3.5 mr-2 text-slate-500" />
                <span>{ADMIN_EMAIL}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  PIN / Password Admin:
                </label>
                <span className="text-[10px] text-slate-500">
                  Default PIN: <code className="text-emerald-400 font-mono">sipetek2026</code>
                </span>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={showPin ? 'text' : 'password'}
                  placeholder="Masukkan PIN Admin (sipetek2026)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 pl-9 pr-10 py-2 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  title={showPin ? 'Sembunyikan' : 'Tampilkan PIN'}
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Masuk sebagai Admin</span>
            </button>
          </form>
        ) : (
          /* Content: If already Admin -> Show Logout and Option to Change PIN */
          <div className="space-y-3">
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl text-xs space-y-1">
              <p className="font-semibold text-emerald-300">
                Anda memiliki akses penuh Admin ({ADMIN_EMAIL})
              </p>
              <p className="text-slate-400 text-[11px]">
                Anda dapat menambah, mengubah, dan menghapus jadwal lapangan.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout ke Mode Tamu</span>
              </button>

              <button
                type="button"
                onClick={() => setShowChangePin(!showChangePin)}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ubah PIN</span>
              </button>
            </div>

            {/* Change PIN Expandable Form */}
            {showChangePin && (
              <form onSubmit={handleChangePinSubmit} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-xs">
                <span className="font-bold text-slate-200 block">Ubah PIN Admin:</span>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">PIN Lama:</label>
                  <input
                    type="password"
                    placeholder="Masukkan PIN saat ini"
                    value={oldPinInput}
                    onChange={(e) => setOldPinInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">PIN Baru (min 4 karakter):</label>
                  <input
                    type="password"
                    placeholder="Masukkan PIN baru"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 px-2.5 py-1.5 rounded text-xs text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowChangePin(false)}
                    className="px-2.5 py-1 text-slate-400 hover:text-white text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs"
                  >
                    Simpan PIN
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Sipetekkru Badminton Club</span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
