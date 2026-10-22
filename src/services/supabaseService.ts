import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Reservation, AuthUser, ADMIN_EMAIL } from '../types/reservation';
import {
  validateReservationForm,
  validateMaxSessionsPerDay,
  validateSessionDuration,
  validateParticipants,
  checkIsAdmin,
} from '../utils/reservationRules';

const STORAGE_KEY = 'sipetekkru_badminton_reservations_v1';
const AUTH_KEY = 'sipetekkru_active_user_v1';
const SUPABASE_URL_KEY = 'sipetekkru_supabase_url';
const SUPABASE_KEY_KEY = 'sipetekkru_supabase_anon_key';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSupabaseConfig(): { url: string; anonKey: string; source: 'env' | 'storage' | 'none' } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envKey && !envUrl.includes('your-project') && !envUrl.includes('example.supabase.co')) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }

  if (typeof window !== 'undefined') {
    try {
      const storedUrl = (localStorage.getItem(SUPABASE_URL_KEY) || '').trim();
      const storedKey = (localStorage.getItem(SUPABASE_KEY_KEY) || '').trim();
      if (storedUrl && storedKey) {
        return { url: storedUrl, anonKey: storedKey, source: 'storage' };
      }
    } catch (e) {}
  }

  return { url: '', anonKey: '', source: 'none' };
}

let activeClient: SupabaseClient | null = null;
let currentConfigSig = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (config.source === 'none' || !config.url || !config.anonKey) {
    activeClient = null;
    currentConfigSig = '';
    return null;
  }

  const sig = `${config.url}::${config.anonKey}`;
  if (activeClient && currentConfigSig === sig) {
    return activeClient;
  }

  try {
    activeClient = createClient(config.url, config.anonKey);
    currentConfigSig = sig;
    return activeClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    activeClient = null;
    currentConfigSig = '';
    return null;
  }
}

export function saveCustomSupabaseConfig(url: string, anonKey: string): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false, error: 'Window not available' };
  try {
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl || !cleanKey) {
      localStorage.removeItem(SUPABASE_URL_KEY);
      localStorage.removeItem(SUPABASE_KEY_KEY);
      activeClient = null;
      currentConfigSig = '';
      return { success: true };
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return { success: false, error: 'URL Supabase harus diawali dengan https://' };
    }

    localStorage.setItem(SUPABASE_URL_KEY, cleanUrl);
    localStorage.setItem(SUPABASE_KEY_KEY, cleanKey);
    activeClient = null;
    currentConfigSig = '';

    getSupabaseClient();
    initRealtimeConnection();

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Gagal menyimpan pengaturan Supabase' };
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().source !== 'none';
}

// In-memory cache
let cachedReservations: Reservation[] = [];
let activeDataSource: 'SUPABASE' | 'SERVER_API' | 'LOCAL_STORAGE' = 'LOCAL_STORAGE';
let lastSyncTime: Date | null = null;

export function getActiveDataSource(): { source: 'SUPABASE' | 'SERVER_API' | 'LOCAL_STORAGE'; lastSync: Date | null } {
  return { source: activeDataSource, lastSync: lastSyncTime };
}

// Normalize raw Supabase or JSON records
export function normalizeReservation(raw: any): Reservation {
  let cleanParticipants: string[] = [];
  if (Array.isArray(raw.participants)) {
    cleanParticipants = raw.participants.map((p: any) => String(p).trim()).filter(Boolean);
  } else if (typeof raw.participants === 'string') {
    cleanParticipants = raw.participants
      .replace(/[\{\}\[\]"']/g, '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  let startTime = '18:00';
  if (typeof raw.start_time === 'string' && raw.start_time.includes(':')) {
    startTime = raw.start_time.trim().slice(0, 5);
  }

  let endTime = '19:00';
  if (typeof raw.end_time === 'string' && raw.end_time.includes(':')) {
    endTime = raw.end_time.trim().slice(0, 5);
  }

  let dateStr = '';
  if (typeof raw.date === 'string') {
    dateStr = raw.date.includes('T') ? raw.date.split('T')[0] : raw.date.trim();
  } else if (raw.date instanceof Date) {
    dateStr = raw.date.toISOString().split('T')[0];
  }

  return {
    id: String(raw.id || generateUUID()),
    date: dateStr,
    start_time: startTime,
    end_time: endTime,
    participants: cleanParticipants.length > 0 ? cleanParticipants : ['Rian', 'Budi'],
    court_name: raw.court_name ? String(raw.court_name).trim() : 'Court 1 - Sipetek Arena',
    note: raw.note ? String(raw.note).trim() : '',
    created_by: raw.created_by ? String(raw.created_by).trim() : ADMIN_EMAIL,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString(),
  };
}

// Realtime listeners
type RealtimeUpdateCallback = (reservations: Reservation[], meta?: { type: string; details?: string }) => void;
type ClientCountCallback = (count: number) => void;

let updateListeners: RealtimeUpdateCallback[] = [];
let clientCountListeners: ClientCountCallback[] = [];
let eventSource: EventSource | null = null;
let isConnectedToRealtime = false;
let supabaseChannel: any = null;

export function initRealtimeConnection() {
  if (typeof window === 'undefined') return;

  // 1. SSE Stream if running fullstack
  if (!eventSource) {
    try {
      eventSource = new EventSource('/api/realtime/stream');
      eventSource.onopen = () => {
        isConnectedToRealtime = true;
      };
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'INIT' || payload.type === 'RESET') {
            if (Array.isArray(payload.reservations)) {
              // Only override with server SSE if Supabase is NOT the primary configured source
              if (!isSupabaseConfigured()) {
                cachedReservations = payload.reservations.map(normalizeReservation);
                activeDataSource = 'SERVER_API';
                lastSyncTime = new Date();
                updateListeners.forEach((cb) => cb(cachedReservations, { type: payload.type }));
              }
            }
            if (typeof payload.clientCount === 'number') {
              clientCountListeners.forEach((cb) => cb(payload.clientCount));
            }
          } else if (payload.type === 'CLIENT_COUNT') {
            if (typeof payload.clientCount === 'number') {
              clientCountListeners.forEach((cb) => cb(payload.clientCount));
            }
          } else if (payload.type === 'CREATE' || payload.type === 'UPDATE' || payload.type === 'DELETE') {
            if (Array.isArray(payload.reservations) && !isSupabaseConfigured()) {
              cachedReservations = payload.reservations.map(normalizeReservation);
              activeDataSource = 'SERVER_API';
              lastSyncTime = new Date();
              const actionText =
                payload.type === 'CREATE'
                  ? 'Jadwal baru ditambahkan'
                  : payload.type === 'UPDATE'
                  ? 'Jadwal telah diubah'
                  : 'Jadwal telah dihapus';
              updateListeners.forEach((cb) => cb(cachedReservations, { type: payload.type, details: actionText }));
            }
          }
        } catch (e) {}
      };
      eventSource.onerror = () => {
        isConnectedToRealtime = false;
      };
    } catch (e) {}
  }

  // 2. Supabase Realtime Channel
  const client = getSupabaseClient();
  if (client && !supabaseChannel) {
    try {
      supabaseChannel = client
        .channel('sipetekkru_realtime_reservations')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'reservations' },
          async (payload) => {
            console.log('⚡ Supabase Realtime event received:', payload);
            const fresh = await ReservationService.getAll(true);
            updateListeners.forEach((cb) =>
              cb(fresh, {
                type: payload.eventType,
                details: `Supabase Realtime: ${payload.eventType} sinkronisasi otomatis`,
              })
            );
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Failed to subscribe to Supabase Realtime channel', e);
    }
  }
}

export function subscribeToRealtime(
  onUpdate: RealtimeUpdateCallback,
  onCountChange?: ClientCountCallback
): () => void {
  updateListeners.push(onUpdate);
  if (onCountChange) {
    clientCountListeners.push(onCountChange);
  }

  initRealtimeConnection();

  return () => {
    updateListeners = updateListeners.filter((cb) => cb !== onUpdate);
    if (onCountChange) {
      clientCountListeners = clientCountListeners.filter((cb) => cb !== onCountChange);
    }
  };
}

// Service Methods
export const ReservationService = {
  // Test Supabase connection
  async testConnection(): Promise<{ success: boolean; message: string; rowCount?: number }> {
    const client = getSupabaseClient();
    if (!client) {
      return {
        success: false,
        message: 'Kredensial Supabase (URL & Anon Key) belum diisi.',
      };
    }

    try {
      const { data, error, count } = await client
        .from('reservations')
        .select('*', { count: 'exact' })
        .limit(5);

      if (error) {
        return {
          success: false,
          message: `Gagal query tabel 'reservations': ${error.message}. Kode: ${error.code}. (Periksa apakah tabel sudah dibuat di Supabase SQL Editor dan RLS policy mengizinkan SELECT).`,
        };
      }

      return {
        success: true,
        message: `Koneksi Supabase BERHASIL! Ditemukan ${count ?? data?.length ?? 0} data reservasi di tabel public.reservations.`,
        rowCount: count ?? data?.length ?? 0,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal menghubungkan ke Supabase: ${err.message || 'Network error'}`,
      };
    }
  },

  // Fetch all reservations
  // forceRefresh: if true, forces fresh network fetch bypassing memory
  async getAll(forceRefresh = false): Promise<Reservation[]> {
    const client = getSupabaseClient();

    // 1. SUPABASE IS THE FIRST PRIORITY WHEN CONFIGURED
    if (client) {
      try {
        const { data, error } = await client
          .from('reservations')
          .select('*')
          .order('date', { ascending: true })
          .order('start_time', { ascending: true });

        if (!error && Array.isArray(data)) {
          const normalized = data.map(normalizeReservation);
          cachedReservations = normalized;
          activeDataSource = 'SUPABASE';
          lastSyncTime = new Date();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          } catch (e) {}
          return normalized;
        } else if (error) {
          console.warn('Supabase query error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase network error during getAll:', err);
      }
    }

    // 2. TRY SERVER API IF RUNNING FULLSTACK (AI Studio Cloud Run)
    try {
      const res = await fetch('/api/reservations', { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          const normalized = json.data.map(normalizeReservation);
          cachedReservations = normalized;
          activeDataSource = 'SERVER_API';
          lastSyncTime = new Date();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          } catch (e) {}
          return normalized;
        }
      }
    } catch (err) {
      // Server API unreachable (e.g. running as static site on Vercel)
    }

    // 3. FALLBACK TO LOCAL STORAGE
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedReservations = parsed.map(normalizeReservation);
          activeDataSource = 'LOCAL_STORAGE';
          return cachedReservations;
        }
      }
    } catch (e) {}

    // 4. FALLBACK TO IN-MEMORY DEFAULT DATA
    return cachedReservations;
  },

  // Create reservation
  async create(
    reservation: Omit<Reservation, 'id' | 'created_at' | 'updated_at'>,
    currentUser: AuthUser
  ): Promise<{ data?: Reservation; error?: string }> {
    if (!currentUser.isAuthenticated || !checkIsAdmin(currentUser.email)) {
      return {
        error: `Akses ditolak: Hanya Admin (${ADMIN_EMAIL}) yang dapat membuat jadwal reservasi.`,
      };
    }

    const validation = validateReservationForm(
      {
        date: reservation.date,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        participants: reservation.participants,
      },
      cachedReservations.map((s) => ({ id: s.id, date: s.date }))
    );

    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      return { error: firstError };
    }

    const cleanParticipants = validateParticipants(reservation.participants).cleanList;
    const nowIso = new Date().toISOString();
    const fallbackId = generateUUID();

    const newReservation: Reservation = {
      id: fallbackId,
      date: reservation.date.trim(),
      start_time: reservation.start_time.trim().slice(0, 5),
      end_time: reservation.end_time.trim().slice(0, 5),
      participants: cleanParticipants,
      court_name: reservation.court_name?.trim() || 'Court 1 - Sipetek Arena',
      note: reservation.note?.trim() || '',
      created_by: currentUser.email || ADMIN_EMAIL,
      created_at: nowIso,
      updated_at: nowIso,
    };

    let savedToSupabase = false;
    let supabaseErrorMessage = '';

    // 1. Try Supabase
    const client = getSupabaseClient();
    if (client) {
      try {
        // Omit id so Postgres DEFAULT gen_random_uuid() generates the proper UUID
        let insertRes = await client
          .from('reservations')
          .insert([
            {
              date: newReservation.date,
              start_time: newReservation.start_time,
              end_time: newReservation.end_time,
              participants: newReservation.participants,
              court_name: newReservation.court_name,
              note: newReservation.note,
              created_by: newReservation.created_by,
            },
          ])
          .select()
          .single();

        // If table requires id explicitly (not null constraint without default), retry with valid RFC4122 UUID
        if (insertRes.error && (insertRes.error.code === '23502' || insertRes.error.message?.includes('null value in column "id"'))) {
          insertRes = await client
            .from('reservations')
            .insert([
              {
                id: fallbackId,
                date: newReservation.date,
                start_time: newReservation.start_time,
                end_time: newReservation.end_time,
                participants: newReservation.participants,
                court_name: newReservation.court_name,
                note: newReservation.note,
                created_by: newReservation.created_by,
              },
            ])
            .select()
            .single();
        }

        if (insertRes.error) {
          console.error('Supabase insert error:', insertRes.error);
          supabaseErrorMessage = `Supabase Error (${insertRes.error.code}): ${insertRes.error.message}`;
          savedToSupabase = false;
        } else {
          savedToSupabase = true;
          if (insertRes.data && insertRes.data.id) {
            newReservation.id = String(insertRes.data.id);
          }
        }
      } catch (err: any) {
        supabaseErrorMessage = err.message || 'Supabase network error';
        savedToSupabase = false;
      }
    }

    // 2. Try Server API sync (if available)
    try {
      await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email || '',
        },
        body: JSON.stringify(newReservation),
      });
    } catch (e) {}

    // 3. Always update local state & localStorage so UI is instantly responsive
    cachedReservations = [...cachedReservations, newReservation];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedReservations));
    } catch (e) {}

    // Notify listeners
    updateListeners.forEach((cb) =>
      cb(cachedReservations, { type: 'CREATE', details: 'Jadwal baru berhasil dibuat' })
    );

    if (client && !savedToSupabase) {
      return {
        data: newReservation,
        error: `Tersimpan secara lokal, namun gagal sync ke Supabase: ${supabaseErrorMessage}. Periksa apakah RLS Policy Supabase mengizinkan INSERT dari Anon key.`,
      };
    }

    return { data: newReservation };
  },

  // Update reservation
  async update(
    id: string,
    updates: Partial<Reservation>,
    currentUser: AuthUser
  ): Promise<{ data?: Reservation; error?: string }> {
    if (!currentUser.isAuthenticated || !checkIsAdmin(currentUser.email)) {
      return {
        error: `Akses ditolak: Hanya Admin (${ADMIN_EMAIL}) yang dapat mengubah reservasi.`,
      };
    }

    const index = cachedReservations.findIndex((r) => r.id === id);
    if (index === -1) {
      return { error: 'Data reservasi tidak ditemukan.' };
    }

    const existing = cachedReservations[index];
    const targetDate = (updates.date || existing.date).trim();
    const targetStartTime = (updates.start_time || existing.start_time).trim().slice(0, 5);
    const targetEndTime = (updates.end_time || existing.end_time).trim().slice(0, 5);
    const rawParticipants = updates.participants || existing.participants;

    // Check max sessions if date changed
    if (updates.date && updates.date !== existing.date) {
      const dayCount = cachedReservations.filter((r) => r.date === targetDate && r.id !== id).length;
      if (dayCount >= 2) {
        return {
          error: `Pelanggaran aturan: Maksimal 2 sesi per hari untuk tanggal ${targetDate}.`,
        };
      }
    }

    // Check duration 60 mins
    if (!validateSessionDuration(targetStartTime, targetEndTime).valid) {
      return {
        error: 'Pelanggaran aturan: Durasi sesi badminton harus tepat 60 menit.',
      };
    }

    // Check participants <= 4
    const cleanParticipants = validateParticipants(rawParticipants).cleanList;
    if (cleanParticipants.length < 1 || cleanParticipants.length > 4) {
      return {
        error: 'Pelanggaran aturan: Maksimal 4 peserta per sesi (minimal 1).',
      };
    }

    const updatedReservation: Reservation = {
      ...existing,
      date: targetDate,
      start_time: targetStartTime,
      end_time: targetEndTime,
      participants: cleanParticipants,
      court_name: (updates.court_name !== undefined ? updates.court_name : (existing?.court_name || '')).trim(),
      note: updates.note !== undefined ? updates.note.trim() : (existing?.note || ''),
      updated_at: new Date().toISOString(),
    };

    let savedToSupabase = false;
    let supabaseErrorMessage = '';

    // 1. Try Supabase
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error, count } = await client
          .from('reservations')
          .update(
            {
              date: updatedReservation.date,
              start_time: updatedReservation.start_time,
              end_time: updatedReservation.end_time,
              participants: updatedReservation.participants,
              court_name: updatedReservation.court_name,
              note: updatedReservation.note,
              updated_at: updatedReservation.updated_at,
            },
            { count: 'exact' }
          )
          .eq('id', id)
          .select();

        if (error) {
          console.error('Supabase update error:', error);
          supabaseErrorMessage = `Supabase Error (${error.code}): ${error.message}`;
          savedToSupabase = false;
        } else if (!data || data.length === 0 || count === 0) {
          console.warn('Supabase update matched 0 rows. RLS policy blocked UPDATE.');
          supabaseErrorMessage =
            'Database Supabase menolak perubahan (0 baris diubah). Ini karena Row Level Security (RLS) di Supabase memblokir UPDATE dari Anon key.';
          savedToSupabase = false;
        } else {
          savedToSupabase = true;
        }
      } catch (err: any) {
        supabaseErrorMessage = err.message || 'Supabase network error';
        savedToSupabase = false;
      }
    }

    // 2. Try Server API sync
    try {
      await fetch(`/api/reservations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email || '',
        },
        body: JSON.stringify(updatedReservation),
      });
    } catch (e) {}

    // If Supabase was configured but failed to update, report failure!
    if (client && !savedToSupabase) {
      return {
        data: updatedReservation,
        error: supabaseErrorMessage,
      };
    }

    // 3. Always update local state & localStorage immediately
    cachedReservations[index] = updatedReservation;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedReservations));
    } catch (e) {}

    // Notify listeners
    updateListeners.forEach((cb) =>
      cb(cachedReservations, { type: 'UPDATE', details: 'Jadwal berhasil diperbarui' })
    );

    return { data: updatedReservation };
  },

  // Delete reservation
  async delete(id: string, currentUser: AuthUser): Promise<{ success: boolean; error?: string }> {
    if (!currentUser.isAuthenticated || !checkIsAdmin(currentUser.email)) {
      return {
        success: false,
        error: `Akses ditolak: Hanya Admin (${ADMIN_EMAIL}) yang dapat menghapus jadwal.`,
      };
    }

    let savedToSupabase = false;
    let supabaseErrorMessage = '';

    // 1. Try Supabase
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error, count } = await client
          .from('reservations')
          .delete({ count: 'exact' })
          .eq('id', id)
          .select();

        if (error) {
          console.error('Supabase delete error:', error);
          supabaseErrorMessage = `Supabase Error (${error.code}): ${error.message}`;
          savedToSupabase = false;
        } else if (!data || data.length === 0 || count === 0) {
          // Zero rows deleted! RLS policy in Supabase blocked DELETE
          console.warn('Supabase delete matched 0 rows. RLS policy blocked DELETE.');
          supabaseErrorMessage =
            'Database Supabase menolak penghapusan (0 baris terhapus). Ini terjadi karena Row Level Security (RLS) di Supabase memblokir operasi DELETE dari Anon key.';
          savedToSupabase = false;
        } else {
          savedToSupabase = true;
        }
      } catch (err: any) {
        supabaseErrorMessage = err.message || 'Supabase network error';
        savedToSupabase = false;
      }
    }

    // 2. Try Server API sync
    try {
      await fetch(`/api/reservations/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': currentUser.email || '',
        },
      });
    } catch (e) {}

    // If Supabase was configured but failed to delete in database, report failure!
    if (client && !savedToSupabase) {
      return {
        success: false,
        error: supabaseErrorMessage,
      };
    }

    // 3. Only remove locally if successfully deleted from Supabase (or if Supabase is not configured)
    cachedReservations = cachedReservations.filter((r) => r.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedReservations));
    } catch (e) {}

    updateListeners.forEach((cb) =>
      cb(cachedReservations, { type: 'DELETE', details: 'Jadwal berhasil dihapus' })
    );

    return { success: true };
  },

  // Reset to initial demo dataset
  async resetDemoData(): Promise<Reservation[]> {
    try {
      const res = await fetch('/api/reservations/reset', { method: 'POST' });
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        cachedReservations = json.data.map(normalizeReservation);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedReservations));
        } catch (e) {}
        return cachedReservations;
      }
    } catch (e) {}
    return cachedReservations;
  },
};

// Auth State Helper - Defaults strictly to GUEST for any fresh browser visit.
// Admin session is preserved only in sessionStorage during active tab browsing after password verification.
const ADMIN_SESSION_KEY = 'sipetekkru_admin_session_v2';
const LEGACY_AUTH_KEY = 'sipetekkru_active_user_v1';

export const AuthService = {
  getCurrentUser(): AuthUser {
    if (typeof window !== 'undefined') {
      // Always purge legacy localStorage admin keys so old saved logins do not force Admin mode
      try {
        localStorage.removeItem(LEGACY_AUTH_KEY);
        localStorage.removeItem('sipetekkru_auth_user');
      } catch (e) {}

      // Only check active tab session in sessionStorage
      try {
        const rawSession = sessionStorage.getItem(ADMIN_SESSION_KEY);
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (parsed && parsed.isAuthenticated && checkIsAdmin(parsed.email)) {
            return {
              email: ADMIN_EMAIL,
              role: 'ADMIN',
              isAuthenticated: true,
            };
          }
        }
      } catch (e) {
        console.warn('Failed to parse admin session from sessionStorage');
      }
    }

    // Default for ANY visitor opening the website: Guest (Read-Only)
    return {
      email: null,
      role: 'GUEST',
      isAuthenticated: false,
    };
  },

  saveUser(user: AuthUser): void {
    if (typeof window === 'undefined') return;
    try {
      if (user.role === 'ADMIN' && user.isAuthenticated) {
        sessionStorage.setItem(
          ADMIN_SESSION_KEY,
          JSON.stringify({
            email: ADMIN_EMAIL,
            role: 'ADMIN',
            isAuthenticated: true,
            timestamp: Date.now(),
          })
        );
      } else {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
      }
      localStorage.removeItem(LEGACY_AUTH_KEY);
      localStorage.removeItem('sipetekkru_auth_user');
    } catch (e) {}
  },

  loginAsAdmin(): AuthUser {
    const user: AuthUser = {
      email: ADMIN_EMAIL,
      role: 'ADMIN',
      isAuthenticated: true,
    };
    this.saveUser(user);
    return user;
  },

  loginAsGuest(): AuthUser {
    const user: AuthUser = {
      email: null,
      role: 'GUEST',
      isAuthenticated: false,
    };
    this.saveUser(user);
    return user;
  },

  logout(): AuthUser {
    return this.loginAsGuest();
  },
};
