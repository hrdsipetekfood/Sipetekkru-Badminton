import {
  Calendar as CalendarIcon,
  Plus,
  ShieldCheck,
  Eye,
  Database,
  UserCheck,
  LogOut,
  CalendarDays,
  CalendarRange,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { AuthUser, ADMIN_EMAIL } from '../types/reservation';

interface HeaderProps {
  currentUser: AuthUser;
  viewMode: 'month' | 'week';
  setViewMode: (mode: 'month' | 'week') => void;
  onOpenCreateModal: () => void;
  onOpenSupabaseModal: () => void;
  onOpenAuthModal: () => void;
  onOpenShareModal: () => void;
  onToggleRole: () => void;
  onResetData: () => void;
  totalReservations: number;
  connectedDevicesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  viewMode,
  setViewMode,
  onOpenCreateModal,
  onOpenSupabaseModal,
  onOpenAuthModal,
  onOpenShareModal,
  onToggleRole,
  onResetData,
  totalReservations,
  connectedDevicesCount,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-2.5 sm:py-3 gap-2.5 sm:gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black text-lg tracking-tighter shrink-0">
                🏸
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h1 className="font-bold text-base sm:text-lg text-white tracking-tight flex items-center gap-1">
                    Sipetekkru <span className="text-emerald-400 font-extrabold">Badminton</span>
                  </h1>
                  <span className="text-[9px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.2 rounded-full">
                    Schedule
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <span>Court Booking & RBAC</span>
                  <span className="text-slate-600">•</span>
                  {/* Real-Time Live Sync Indicator */}
                  <span
                    title="Real-Time multi-device sync is active. Any changes instantly update across all connected phones and computers."
                    className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Live Sync ({connectedDevicesCount} online)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile-only right quick action */}
            <div className="flex sm:hidden items-center space-x-1.5">
              <button
                onClick={onOpenShareModal}
                title="Bagikan Jadwal"
                className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenSupabaseModal}
                title="Supabase SQL"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 rounded-lg text-xs"
              >
                <Database className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenAuthModal}
                title="Auth Settings"
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg"
              >
                <UserCheck className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Controls: View Switcher, Role, New Slot */}
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 flex-wrap">
            {/* Share Public Link Button */}
            <button
              onClick={onOpenShareModal}
              title="Bagikan Link Jadwal ke WhatsApp / Tim"
              className="hidden sm:flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Bagikan Link</span>
            </button>

            {/* View Switcher */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 p-0.5 rounded-lg shrink-0">
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'month'
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Month</span>
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === 'week'
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Week</span>
              </button>
            </div>

            {/* Desktop Supabase Button */}
            <button
              onClick={onOpenSupabaseModal}
              title="View Supabase PostgreSQL Schema & RLS Policies"
              className="hidden sm:flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase RLS</span>
            </button>

            {/* Role indicator badge with quick-switch */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700 px-2 py-1 rounded-lg text-xs shrink-0">
              {isAdmin ? (
                <div className="flex items-center space-x-1.5 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-[10px] leading-tight text-white flex items-center gap-1">
                      Admin
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </span>
                    <span className="text-[9px] text-slate-400 truncate max-w-[90px] sm:max-w-[120px]">
                      {currentUser.email}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-[10px] leading-tight text-amber-300">
                      Guest View
                    </span>
                    <span className="text-[9px] text-slate-400">Read-Only</span>
                  </div>
                </div>
              )}

              {/* Quick toggle button */}
              <button
                onClick={onToggleRole}
                className="ml-2 px-1.5 py-0.5 text-[9px] rounded font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                title={isAdmin ? 'Switch to Guest Mode' : 'Switch to Admin'}
              >
                {isAdmin ? 'Guest' : 'Admin'}
              </button>
            </div>

            {/* Admin-only "New Slot" CTA */}
            {isAdmin && (
              <button
                onClick={onOpenCreateModal}
                className="flex items-center space-x-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Slot</span>
              </button>
            )}

            {/* Desktop Auth Settings trigger */}
            <button
              onClick={onOpenAuthModal}
              title="Auth & Account Settings"
              className="hidden sm:block p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
