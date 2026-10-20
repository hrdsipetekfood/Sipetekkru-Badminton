import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Users,
  ShieldCheck,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Search,
  RotateCcw,
  Sparkles,
  Info,
  ChevronRight,
  Plus,
} from 'lucide-react';
import {
  Reservation,
  AuthUser,
  ADMIN_EMAIL,
  MAX_SESSIONS_PER_DAY,
  REQUIRED_SESSION_DURATION_MINUTES,
  MAX_PARTICIPANTS_PER_SESSION,
} from './types/reservation';
import { ReservationService, AuthService, subscribeToRealtime } from './services/supabaseService';
import { Header } from './components/Header';
import { MonthCalendar } from './components/MonthCalendar';
import { WeekCalendar } from './components/WeekCalendar';
import { DayDetailModal } from './components/DayDetailModal';
import { ReservationFormModal } from './components/ReservationFormModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { SupabaseModal } from './components/SupabaseModal';
import { AuthModal } from './components/AuthModal';
import { ShareModal } from './components/ShareModal';

export default function App() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentUser, setCurrentUser] = useState<AuthUser>(AuthService.getCurrentUser());
  const [connectedDevicesCount, setConnectedDevicesCount] = useState<number>(1);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [formInitialDate, setFormInitialDate] = useState<string | undefined>(undefined);
  const [deletingReservation, setDeletingReservation] = useState<Reservation | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'ADMIN';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await ReservationService.getAll();
      setReservations(data);
    } catch (err) {
      console.error('Failed to load reservations', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to multi-device real-time sync
    const unsubscribe = subscribeToRealtime(
      (updatedReservations, meta) => {
        setReservations(updatedReservations);
        if (meta?.details) {
          showToast(`⚡ ${meta.details} (Auto-synced across devices)`);
        }
      },
      (count) => {
        setConnectedDevicesCount(Math.max(1, count));
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Switch between Admin and Guest for rapid testing
  const handleToggleRole = () => {
    if (currentUser.role === 'ADMIN') {
      const guest = AuthService.loginAsGuest();
      setCurrentUser(guest);
      showToast('Switched to Guest mode (Read-Only). Write controls hidden.');
    } else {
      const admin = AuthService.loginAsAdmin();
      setCurrentUser(admin);
      showToast(`Switched to Admin (${ADMIN_EMAIL}). Full CRUD unlocked.`);
    }
  };

  // Reset demo data
  const handleResetData = async () => {
    const data = await ReservationService.resetDemoData();
    setReservations(data);
    showToast('Reset schedule to default Sipetekkru demo matches.');
  };

  // Open Create Modal
  const handleOpenCreateModal = (dateStr?: string) => {
    setEditingReservation(null);
    setFormInitialDate(dateStr || new Date().toISOString().split('T')[0]);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (res: Reservation) => {
    setEditingReservation(res);
    setFormInitialDate(res.date);
    setIsFormModalOpen(true);
  };

  // Save Reservation (Create or Edit)
  const handleSaveReservation = async (data: {
    date: string;
    start_time: string;
    end_time: string;
    participants: string[];
    court_name: string;
    note: string;
  }): Promise<{ error?: string }> => {
    if (editingReservation) {
      const res = await ReservationService.update(
        editingReservation.id,
        {
          date: data.date,
          start_time: data.start_time,
          end_time: data.end_time,
          participants: data.participants,
          court_name: data.court_name,
          note: data.note,
        },
        currentUser
      );
      if (res.error) return { error: res.error };
      await loadData();
      showToast('Reservation updated successfully.');
      return {};
    } else {
      const res = await ReservationService.create(
        {
          date: data.date,
          start_time: data.start_time,
          end_time: data.end_time,
          participants: data.participants,
          court_name: data.court_name,
          note: data.note,
          created_by: currentUser.email || ADMIN_EMAIL,
        },
        currentUser
      );
      if (res.error) return { error: res.error };
      await loadData();
      showToast('New badminton reservation slot created.');
      return {};
    }
  };

  // Delete Reservation
  const handleDeleteReservation = async (id: string): Promise<{ error?: string }> => {
    const res = await ReservationService.delete(id, currentUser);
    if (res.error) return { error: res.error };
    await loadData();
    showToast('Reservation slot removed.');
    return {};
  };

  // Search Filtered Reservations
  const filteredReservations = useMemo(() => {
    if (!searchQuery.trim()) return reservations;
    const q = searchQuery.toLowerCase().trim();
    return reservations.filter(
      (r) =>
        r.date.includes(q) ||
        r.participants.some((p) => p.toLowerCase().includes(q)) ||
        (r.court_name && r.court_name.toLowerCase().includes(q)) ||
        (r.note && r.note.toLowerCase().includes(q))
    );
  }, [reservations, searchQuery]);

  // Statistics Calculation
  const stats = useMemo(() => {
    const total = reservations.length;
    const fullCapacityCount = reservations.filter((r) => r.participants.length >= 4).length;
    const totalParticipants = reservations.reduce((sum, r) => sum + r.participants.length, 0);
    const availableSlots = total * 4 - totalParticipants;

    return {
      total,
      fullCapacityCount,
      totalParticipants,
      availableSlots: Math.max(0, availableSlots),
    };
  }, [reservations]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <Header
        currentUser={currentUser}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenCreateModal={() => handleOpenCreateModal()}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onToggleRole={handleToggleRole}
        onResetData={handleResetData}
        totalReservations={reservations.length}
        connectedDevicesCount={connectedDevicesCount}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-slate-950" />
            <span className="text-xs">{toastMessage}</span>
          </div>
        )}

        {/* Guest View Banner if Read-Only */}
        {!isAdmin && (
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-200">
                  Guest Read-Only Mode Active
                </h4>
                <p className="text-xs text-amber-300/80">
                  You can view the Sipetekkru reservation calendar. Full CRUD controls are strictly restricted to{' '}
                  <strong className="text-amber-100 font-mono">{ADMIN_EMAIL}</strong> via Supabase RLS.
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleRole}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-sm shrink-0"
            >
              Log in as Admin ({ADMIN_EMAIL})
            </button>
          </div>
        )}

        {/* Stats & Core Rule Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Max 2 Sessions / Day */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold">Daily Session Cap</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
                Rule 1
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white flex items-baseline gap-1">
              <span>{MAX_SESSIONS_PER_DAY}</span>
              <span className="text-xs font-normal text-slate-400">max / day</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Strict max 2 slots daily</p>
          </div>

          {/* Card 2: 60 Minutes Duration */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold">Slot Duration</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
                Rule 2
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white flex items-baseline gap-1">
              <span>{REQUIRED_SESSION_DURATION_MINUTES}</span>
              <span className="text-xs font-normal text-slate-400">minutes</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Exact 60 mins required</p>
          </div>

          {/* Card 3: Max 4 Participants */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold">Max Participants</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
                Rule 3
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white flex items-baseline gap-1">
              <span>{MAX_PARTICIPANTS_PER_SESSION}</span>
              <span className="text-xs font-normal text-slate-400">players / session</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Dynamic player names</p>
          </div>

          {/* Card 4: Total Bookings */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold">Scheduled Matches</span>
              <span className="text-[10px] text-teal-400 bg-teal-950/80 px-1.5 py-0.5 rounded border border-teal-800/60">
                Live
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white flex items-baseline gap-1">
              <span>{stats.total}</span>
              <span className="text-xs font-normal text-slate-400">
                ({stats.fullCapacityCount} FULL)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {stats.availableSlots} open player slots
            </p>
          </div>
        </div>

        {/* Filter & Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search player, court, or YYYY-MM-DD..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 pl-9 pr-3 py-1.5 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Info & Reset Button */}
          <div className="flex items-center space-x-2 text-xs w-full sm:w-auto justify-end">
            <button
              onClick={handleResetData}
              title="Reset sample Sipetekkru reservation data"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Data</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => handleOpenCreateModal()}
                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Book Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Calendar View Container */}
        {isLoading ? (
          <div className="text-center py-24 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading Sipetekkru badminton schedule...</p>
          </div>
        ) : viewMode === 'month' ? (
          <MonthCalendar
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            reservations={filteredReservations}
            currentUser={currentUser}
            onSelectDate={(dateStr) => setSelectedDayDate(dateStr)}
            onSelectReservation={(res) => setSelectedDayDate(res.date)}
            onOpenCreateForDate={(dateStr) => handleOpenCreateModal(dateStr)}
          />
        ) : (
          <WeekCalendar
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            reservations={filteredReservations}
            currentUser={currentUser}
            onSelectDate={(dateStr) => setSelectedDayDate(dateStr)}
            onSelectReservation={(res) => setSelectedDayDate(res.date)}
            onOpenCreateForDate={(dateStr) => handleOpenCreateModal(dateStr)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © 2026 Sipetekkru Badminton Club • Powered by Supabase RLS & React
          </span>
          <div className="flex items-center space-x-3 text-[11px]">
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className="text-emerald-400 hover:underline"
            >
              PostgreSQL RLS Schema
            </button>
            <span>•</span>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-slate-400 hover:text-white"
            >
              RBAC: {currentUser.role}
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {/* 1. Day Detail Modal */}
      <DayDetailModal
        isOpen={Boolean(selectedDayDate)}
        onClose={() => setSelectedDayDate(null)}
        dateStr={selectedDayDate}
        reservations={reservations}
        currentUser={currentUser}
        onEdit={(res) => {
          setSelectedDayDate(null);
          handleOpenEditModal(res);
        }}
        onDelete={(res) => {
          setSelectedDayDate(null);
          setDeletingReservation(res);
        }}
        onAddSession={(dateStr) => {
          setSelectedDayDate(null);
          handleOpenCreateModal(dateStr);
        }}
      />

      {/* 2. Create / Edit Reservation Modal (Admin Only) */}
      <ReservationFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveReservation}
        editingReservation={editingReservation}
        initialDate={formInitialDate}
        existingReservations={reservations}
        currentUser={currentUser}
      />

      {/* 3. Delete Confirmation Modal (Admin Only) */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingReservation)}
        onClose={() => setDeletingReservation(null)}
        reservation={deletingReservation}
        onConfirm={handleDeleteReservation}
        currentUser={currentUser}
      />

      {/* 4. Supabase Schema & Instructions Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />

      {/* 5. Auth / Role Switcher Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChange={(newUser) => setCurrentUser(newUser)}
      />

      {/* 6. Share Modal (WhatsApp & Public Guest Link) */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        sharedUrl={
          typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
            ? window.location.origin
            : 'https://ais-pre-b2d4jgxm7fmujrghwywm36-807083370301.asia-southeast1.run.app'
        }
        adminEmail={ADMIN_EMAIL}
      />
    </div>
  );
}
