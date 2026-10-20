export const ADMIN_EMAIL = 'hrdsipetekfood@gmail.com';
export const MAX_SESSIONS_PER_DAY = 2;
export const REQUIRED_SESSION_DURATION_MINUTES = 60;
export const MAX_PARTICIPANTS_PER_SESSION = 4;

export interface ExistingSessionRef {
  id: string;
  date: string;
}

/**
 * Converts HH:mm to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return -1;
  const parts = timeStr.trim().split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return -1;
  return hours * 60 + minutes;
}

/**
 * Converts minutes from midnight to HH:mm string (24h)
 */
export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Calculates end time exactly 60 minutes after startTime
 */
export function calculateEndTime(startTime: string): string {
  const mins = parseTimeToMinutes(startTime);
  if (mins === -1) return '';
  return minutesToTime(mins + REQUIRED_SESSION_DURATION_MINUTES);
}

/**
 * Validates that the session duration is strictly 60 minutes
 */
export function validateSessionDuration(
  startTime: string,
  endTime: string
): { valid: boolean; durationMinutes: number; error?: string } {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);

  if (startMins === -1 || endMins === -1) {
    return {
      valid: false,
      durationMinutes: 0,
      error: 'Invalid start time or end time format. Expected HH:mm.',
    };
  }

  // Handle cross-midnight or normal difference
  let diff = endMins - startMins;
  if (diff < 0) {
    diff += 1440;
  }

  if (diff !== REQUIRED_SESSION_DURATION_MINUTES) {
    return {
      valid: false,
      durationMinutes: diff,
      error: `Each session duration must be exactly 60 minutes (currently ${diff} minutes).`,
    };
  }

  return { valid: true, durationMinutes: diff };
}

/**
 * Validates that maximum 2 sessions are scheduled for the given day
 */
export function validateMaxSessionsPerDay(
  existingSessions: ExistingSessionRef[],
  targetDate: string,
  excludeId?: string
): { allowed: boolean; currentCount: number; error?: string } {
  if (!targetDate) {
    return { allowed: false, currentCount: 0, error: 'Target date is required.' };
  }

  const normalizedTarget = targetDate.trim();
  const daySessions = existingSessions.filter(
    (s) => s.date === normalizedTarget && (!excludeId || s.id !== excludeId)
  );

  const currentCount = daySessions.length;

  if (currentCount >= MAX_SESSIONS_PER_DAY) {
    return {
      allowed: false,
      currentCount,
      error: `Maximum of ${MAX_SESSIONS_PER_DAY} sessions allowed per day. This day (${normalizedTarget}) is already fully booked.`,
    };
  }

  return { allowed: true, currentCount };
}

/**
 * Validates dynamic participants array (max 4, min 1, no blank strings)
 */
export function validateParticipants(participants: string[]): {
  valid: boolean;
  count: number;
  error?: string;
  cleanList: string[];
} {
  if (!Array.isArray(participants)) {
    return {
      valid: false,
      count: 0,
      cleanList: [],
      error: 'Participants list is missing.',
    };
  }

  const cleanList = participants
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0);

  if (cleanList.length === 0) {
    return {
      valid: false,
      count: 0,
      cleanList: [],
      error: 'At least 1 participant is required for the session.',
    };
  }

  if (cleanList.length > MAX_PARTICIPANTS_PER_SESSION) {
    return {
      valid: false,
      count: cleanList.length,
      cleanList,
      error: `Maximum of ${MAX_PARTICIPANTS_PER_SESSION} participants allowed per session (provided: ${cleanList.length}).`,
    };
  }

  return { valid: true, count: cleanList.length, cleanList };
}

/**
 * Strictly verifies whether an email is the authorized administrator
 */
export function checkIsAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Full reservation form validation
 */
export function validateReservationForm(
  data: {
    date: string;
    startTime: string;
    endTime: string;
    participants: string[];
  },
  existingSessions: ExistingSessionRef[],
  excludeId?: string
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.date) {
    errors.date = 'Reservation date is required.';
  } else {
    const dayCheck = validateMaxSessionsPerDay(existingSessions, data.date, excludeId);
    if (!dayCheck.allowed) {
      errors.date = dayCheck.error || `Date already has ${MAX_SESSIONS_PER_DAY} sessions.`;
    }
  }

  if (!data.startTime) {
    errors.startTime = 'Start time is required.';
  }

  if (!data.endTime) {
    errors.endTime = 'End time is required.';
  } else if (data.startTime) {
    const durationCheck = validateSessionDuration(data.startTime, data.endTime);
    if (!durationCheck.valid) {
      errors.endTime = durationCheck.error || 'Duration must be 60 minutes.';
    }
  }

  const partCheck = validateParticipants(data.participants);
  if (!partCheck.valid) {
    errors.participants = partCheck.error || 'Invalid participants.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
