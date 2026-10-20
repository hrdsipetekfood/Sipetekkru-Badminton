import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Reservation, AuthUser, ADMIN_EMAIL } from '../types/reservation';
import {
  validateReservationForm,
  validateMaxSessionsPerDay,
  validateSessionDuration,
  validateParticipants,
  checkIsAdmin,
} from '../utils/reservationRules';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const STORAGE_KEY = 'sipetekkru_badminton_reservations_v1';
const AUTH_KEY = 'sipetekkru_active_user_v1';

// In-memory cache for fallback
let cachedReservations: Reservation[] = [];

// Realtime listeners
type RealtimeUpdateCallback = (reservations: Reservation[], meta?: { type: string; details?: string }) => void;
type ClientCountCallback = (count: number) => void;

let updateListeners: RealtimeUpdateCallback[] = [];
let clientCountListeners: ClientCountCallback[] = [];
let eventSource: EventSource | null = null;
let isConnectedToRealtime = false;

// Connect to Server-Sent Events stream for cross-device instant sync
export function initRealtimeConnection() {
  if (typeof window === 'undefined' || eventSource) return;

  try {
    eventSource = new EventSource('/api/realtime/stream');

    eventSource.onopen = () => {
      isConnectedToRealtime = true;
      console.log('⚡ Connected to Sipetekkru Real-Time Sync Stream');
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'INIT' || payload.type === 'RESET') {
          if (Array.isArray(payload.reservations)) {
            cachedReservations = payload.reservations;
            updateListeners.forEach((cb) => cb(payload.reservations, { type: payload.type }));
          }
          if (typeof payload.clientCount === 'number') {
            clientCountListeners.forEach((cb) => cb(payload.clientCount));
          }
        } else if (payload.type === 'CLIENT_COUNT') {
          if (typeof payload.clientCount === 'number') {
            clientCountListeners.forEach((cb) => cb(payload.clientCount));
          }
        } else if (payload.type === 'CREATE' || payload.type === 'UPDATE' || payload.type === 'DELETE') {
          if (Array.isArray(payload.reservations)) {
            cachedReservations = payload.reservations;
            const actionText =
              payload.type === 'CREATE'
                ? 'A new badminton slot was added'
                : payload.type === 'UPDATE'
                ? 'A reservation was modified'
                : 'A reservation was deleted';
            updateListeners.forEach((cb) => cb(payload.reservations, { type: payload.type, details: actionText }));
          }
        }
      } catch (e) {
        console.warn('Error parsing SSE event data', e);
      }
    };

    eventSource.onerror = (err) => {
      isConnectedToRealtime = false;
      console.warn('Real-Time SSE connection interrupted, retrying automatically...');
    };
  } catch (err) {
    console.warn('Failed to initialize SSE EventSource', err);
  }

  // Also setup Supabase Realtime Channel if configured
  if (supabase) {
    try {
      const channel = supabase
        .channel('public:reservations')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'reservations' },
          async (payload) => {
            console.log('⚡ Supabase Realtime postgres_changes received', payload);
            const fresh = await ReservationService.getAll();
            updateListeners.forEach((cb) => cb(fresh, { type: payload.eventType }));
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

  // Trigger init connection if not already running
  initRealtimeConnection();

  return () => {
    updateListeners = updateListeners.filter((cb) => cb !== onUpdate);
    if (onCountChange) {
      clientCountListeners = clientCountListeners.filter((cb) => cb !== onCountChange);
    }
  };
}

// Public API Service
export const ReservationService = {
  // Fetch all reservations from server
  async getAll(): Promise<Reservation[]> {
    // 1. Try server API endpoint
    try {
      const res = await fetch('/api/reservations');
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          cachedReservations = json.data;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(json.data));
          } catch (e) {}
          return json.data;
        }
      }
    } catch (err) {
      console.warn('Server API not reachable, trying Supabase or local cache', err);
    }

    // 2. Try Supabase if configured
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('reservations')
          .select('*')
          .order('date', { ascending: true })
          .order('start_time', { ascending: true });

        if (!error && data) {
          cachedReservations = data as Reservation[];
          return data as Reservation[];
        }
      } catch (err) {
        console.warn('Supabase fetch failed', err);
      }
    }

    // 3. Fallback to local storage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        cachedReservations = JSON.parse(raw);
        return cachedReservations;
      }
    } catch (e) {}

    return cachedReservations;
  },

  // Create a reservation (strictly enforces Admin RBAC and business constraints)
  async create(
    reservation: Omit<Reservation, 'id' | 'created_at' | 'updated_at'>,
    currentUser: AuthUser
  ): Promise<{ data?: Reservation; error?: string }> {
    // 1. Client-Side RBAC Check
    if (!currentUser.isAuthenticated || !checkIsAdmin(currentUser.email)) {
      return {
        error: `Permission Denied: Only Admin (${ADMIN_EMAIL}) has permission to create reservation schedules.`,
      };
    }

    // 2. Validate constraints
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

    // 3. Send to Server API (which persists and broadcasts to ALL connected devices in real time)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email || '',
        },
        body: JSON.stringify({
          ...reservation,
          participants: cleanParticipants,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        return { error: json.error || 'Failed to create reservation on server.' };
      }

      // Also persist to Supabase if configured
      if (supabase && json.data) {
        try {
          await supabase.from('reservations').insert([json.data]);
        } catch (e) {
          console.warn('Supabase sync warning', e);
        }
      }

      return { data: json.data };
    } catch (err: any) {
      console.warn('Server fetch error during create', err);
      return { error: err.message || 'Network error while creating reservation.' };
    }
  },

  // Update a reservation (Admin only)
  async update(
    id: string,
    updates: Partial<Reservation>,
    currentUser: AuthUser
  ): Promise<{ data?: Reservation; error?: string }> {
    if (!currentUser.isAuthenticated || !checkIsAdmin(currentUser.email)) {
      return {
        error: `Permission Denied: Only Admin (${ADMIN_EMAIL}) can update reservations.`,
      };
    }

    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email || '',
        },
        body: JSON.stringify(updates),
      });

      const json = await res.json();
      if (!res.ok) {
        return { error: json.error || 'Failed to update reservation on server.' };
      }

      if (supabase && json.data) {
        try {
          await supabase.from('reservations').update(json.data).eq('id', id);
        } catch (e) {
          console.warn('Supabase update warning', e);
        }
      }

      return { data: json.data };
    } catch (err: any) {
      return { error: err.message || 'Network error while updating reservation.' };
    }
  },

  // Delete a reservation (Admin only)
  async delete(id: string, currentUser: AuthUser): Promise<{ success: boolean; error?: string }> {
    if (!currentUser.isAuthenticated || !checkIsAdmin(currentUser.email)) {
      return {
        success: false,
        error: `Permission Denied: Only Admin (${ADMIN_EMAIL}) can delete schedules.`,
      };
    }

    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': currentUser.email || '',
        },
      });

      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error || 'Failed to delete on server.' };
      }

      if (supabase) {
        try {
          await supabase.from('reservations').delete().eq('id', id);
        } catch (e) {}
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error while deleting.' };
    }
  },

  // Reset to initial demo dataset (Admin convenience for testing)
  async resetDemoData(): Promise<Reservation[]> {
    try {
      const res = await fetch('/api/reservations/reset', { method: 'POST' });
      const json = await res.json();
      if (json.data) {
        cachedReservations = json.data;
        return json.data;
      }
    } catch (e) {}
    return cachedReservations;
  },
};

// Auth State Helper
export const AuthService = {
  getCurrentUser(): AuthUser {
    // Check URL parameters first for shared links (e.g. ?role=guest)
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('role') === 'guest' || params.get('guest') === 'true') {
          const guestUser: AuthUser = {
            email: null,
            role: 'GUEST',
            isAuthenticated: false,
          };
          this.saveUser(guestUser);
          return guestUser;
        }
        if (params.get('role') === 'admin' || params.get('admin') === 'true') {
          const adminUser: AuthUser = {
            email: ADMIN_EMAIL,
            role: 'ADMIN',
            isAuthenticated: true,
          };
          this.saveUser(adminUser);
          return adminUser;
        }
      } catch (e) {}
    }

    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        return {
          email: user.email,
          isAuthenticated: Boolean(user.isAuthenticated),
          role: checkIsAdmin(user.email) ? 'ADMIN' : 'GUEST',
        };
      }
    } catch (e) {
      console.warn('Failed to parse current user from storage');
    }

    // Default: Authenticated as Admin 'hrdsipetekfood@gmail.com' for initial preview convenience
    const defaultAdmin: AuthUser = {
      email: ADMIN_EMAIL,
      role: 'ADMIN',
      isAuthenticated: true,
    };
    this.saveUser(defaultAdmin);
    return defaultAdmin;
  },

  saveUser(user: AuthUser): void {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
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

  loginWithCustomEmail(email: string): AuthUser {
    const normalized = email.trim();
    const isAdmin = checkIsAdmin(normalized);
    const user: AuthUser = {
      email: normalized,
      role: isAdmin ? 'ADMIN' : 'GUEST',
      isAuthenticated: true,
    };
    this.saveUser(user);
    return user;
  },

  logout(): AuthUser {
    return this.loginAsGuest();
  },
};
