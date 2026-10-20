export interface Reservation {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  participants: string[]; // max 4 names
  court_name?: string; // e.g. "Court A - Sipetek Arena"
  note?: string;
  created_by: string; // email of creator
  created_at?: string;
  updated_at?: string;
}

export type UserRole = 'ADMIN' | 'GUEST';

export interface AuthUser {
  email: string | null;
  role: UserRole;
  isAuthenticated: boolean;
}

export const ADMIN_EMAIL = 'hrdsipetekfood@gmail.com';
export const MAX_SESSIONS_PER_DAY = 2;
export const REQUIRED_SESSION_DURATION_MINUTES = 60;
export const MAX_PARTICIPANTS_PER_SESSION = 4;
