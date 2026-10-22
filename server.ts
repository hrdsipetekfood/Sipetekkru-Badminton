import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'reservations.json');

app.use(express.json());

// Domain constants
const ADMIN_EMAIL = 'hrdsipetekfood@gmail.com';
const MAX_SESSIONS_PER_DAY = 2;
const REQUIRED_SESSION_DURATION_MINUTES = 60;
const MAX_PARTICIPANTS_PER_SESSION = 4;

interface Reservation {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  participants: string[];
  court_name: string;
  note?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Generate realistic default seed data
function getDefaultSeedData(): Reservation[] {
  const today = new Date();
  const format = (d: Date) => d.toISOString().split('T')[0];

  const d0 = new Date(today);
  const d1 = new Date(today);
  d1.setDate(d1.getDate() + 1);
  const d2 = new Date(today);
  d2.setDate(d2.getDate() + 2);
  const d4 = new Date(today);
  d4.setDate(d4.getDate() + 4);

  return [
    {
      id: 'res-seed-1',
      date: format(d0),
      start_time: '18:00',
      end_time: '19:00',
      participants: ['Rian', 'Budi', 'Siti', 'Agus'],
      court_name: 'Court 1 - Sipetek Arena',
      note: 'Team Regular Doubles Match',
      created_by: ADMIN_EMAIL,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'res-seed-2',
      date: format(d0),
      start_time: '19:30',
      end_time: '20:30',
      participants: ['Dewi', 'Indra'],
      court_name: 'Court 2 - Sipetek Arena',
      note: 'Mixed Doubles Casual',
      created_by: ADMIN_EMAIL,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'res-seed-3',
      date: format(d1),
      start_time: '19:00',
      end_time: '20:00',
      participants: ['Fajar', 'Kevin', 'Marcus'],
      court_name: 'Court 1 - Sipetek Arena',
      note: 'Speed & Agility Practice',
      created_by: ADMIN_EMAIL,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'res-seed-4',
      date: format(d4),
      start_time: '17:00',
      end_time: '18:00',
      participants: ['Arif', 'Taufik', 'Hendra', 'Ahsan'],
      court_name: 'Court 1 - Sipetek Arena',
      note: 'All-Star Sipetekkru Tournament Pre-match',
      created_by: ADMIN_EMAIL,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

// Ensure data file exists
function loadReservations(): Reservation[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const initial = getDefaultSeedData();
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading reservations file', err);
    return getDefaultSeedData();
  }
}

function saveReservations(data: Reservation[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing reservations file', err);
  }
}

// In-memory cache synced with disk
let reservationsCache: Reservation[] = loadReservations();

// SSE Connected Clients Registry for Live Real-Time Multi-Device Sync
interface SSEClient {
  id: string;
  res: Response;
}
let sseClients: SSEClient[] = [];

function broadcast(event: {
  type: 'INIT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'RESET' | 'CLIENT_COUNT';
  reservation?: Reservation;
  id?: string;
  reservations?: Reservation[];
  clientCount?: number;
}) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch (e) {
      console.warn('Failed to write to client', client.id);
    }
  });
}

function broadcastClientCount() {
  broadcast({
    type: 'CLIENT_COUNT',
    clientCount: sseClients.length,
  });
}

// Validation helper functions
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return -1;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

function validateDuration(start: string, end: string): boolean {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s === -1 || e === -1) return false;
  let diff = e - s;
  if (diff < 0) diff += 1440;
  return diff === REQUIRED_SESSION_DURATION_MINUTES;
}

function checkIsAdmin(email?: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// ==========================================
// API Routes
// ==========================================

// 1. SSE Real-Time Stream Endpoint
app.get('/api/realtime/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const clientId = 'client-' + Math.random().toString(36).substring(2, 9);
  const newClient: SSEClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial data to this connected device
  const initialPayload = `data: ${JSON.stringify({
    type: 'INIT',
    reservations: reservationsCache,
    clientCount: sseClients.length,
  })}\n\n`;
  res.write(initialPayload);

  // Notify other devices of updated peer count
  broadcastClientCount();

  // Heartbeat keep-alive every 20 seconds
  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter((c) => c.id !== clientId);
    broadcastClientCount();
  });
});

// 2. GET all reservations
app.get('/api/reservations', (_req: Request, res: Response) => {
  res.json({
    data: reservationsCache,
    connectedDevices: sseClients.length,
  });
});

// 3. POST create reservation (Admin RBAC enforced + constraints)
app.post('/api/reservations', (req: Request, res: Response) => {
  const userEmail = req.headers['x-user-email'] as string | undefined;

  // RBAC check
  if (!checkIsAdmin(userEmail)) {
    return res.status(403).json({
      error: `Access Denied: Only authorized Admin (${ADMIN_EMAIL}) can create schedules.`,
    });
  }

  const { date, start_time, end_time, participants, court_name, note } = req.body;

  if (!date || !start_time || !end_time || !Array.isArray(participants)) {
    return res.status(400).json({ error: 'Missing required reservation fields.' });
  }

  // Constraint 1: Max 2 sessions per day
  const sessionsOnDate = reservationsCache.filter((r) => r.date === date.trim());
  if (sessionsOnDate.length >= MAX_SESSIONS_PER_DAY) {
    return res.status(400).json({
      error: `Constraint violation: Maximum of ${MAX_SESSIONS_PER_DAY} sessions allowed per day for date ${date}.`,
    });
  }

  // Constraint 2: Exactly 60 minutes duration
  if (!validateDuration(start_time, end_time)) {
    return res.status(400).json({
      error: `Constraint violation: Each session duration must be exactly ${REQUIRED_SESSION_DURATION_MINUTES} minutes.`,
    });
  }

  // Constraint 3: Max 4 participants, min 1
  const cleanParticipants = participants
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0);

  if (cleanParticipants.length < 1 || cleanParticipants.length > MAX_PARTICIPANTS_PER_SESSION) {
    return res.status(400).json({
      error: `Constraint violation: Maximum of ${MAX_PARTICIPANTS_PER_SESSION} participants allowed per session (min 1).`,
    });
  }

  const newReservation: Reservation = {
    id: 'res-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
    date: date.trim(),
    start_time: start_time.trim(),
    end_time: end_time.trim(),
    participants: cleanParticipants,
    court_name: court_name?.trim() || 'Court 1 - Sipetek Arena',
    note: note?.trim() || '',
    created_by: userEmail || ADMIN_EMAIL,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  reservationsCache.push(newReservation);
  saveReservations(reservationsCache);

  // Broadcast to all connected devices in real time!
  broadcast({
    type: 'CREATE',
    reservation: newReservation,
    reservations: reservationsCache,
    clientCount: sseClients.length,
  });

  res.status(201).json({ data: newReservation });
});

// 4. PUT update reservation
app.put('/api/reservations/:id', (req: Request, res: Response) => {
  const userEmail = req.headers['x-user-email'] as string | undefined;

  if (!checkIsAdmin(userEmail)) {
    return res.status(403).json({
      error: `Access Denied: Only authorized Admin (${ADMIN_EMAIL}) can update schedules.`,
    });
  }

  const { id } = req.params;
  const index = reservationsCache.findIndex((r) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Reservation not found.' });
  }

  const existing = reservationsCache[index];
  const { date, start_time, end_time, participants, court_name, note } = req.body;

  const targetDate = (date || existing.date).trim();
  const targetStartTime = (start_time || existing.start_time).trim();
  const targetEndTime = (end_time || existing.end_time).trim();
  const rawParticipants = participants || existing.participants;

  // Check max sessions if date changed
  if (date && date !== existing.date) {
    const dayCount = reservationsCache.filter((r) => r.date === targetDate && r.id !== id).length;
    if (dayCount >= MAX_SESSIONS_PER_DAY) {
      return res.status(400).json({
        error: `Constraint violation: Maximum of ${MAX_SESSIONS_PER_DAY} sessions allowed per day for date ${targetDate}.`,
      });
    }
  }

  // Check 60 mins duration
  if (!validateDuration(targetStartTime, targetEndTime)) {
    return res.status(400).json({
      error: `Constraint violation: Session duration must be exactly 60 minutes.`,
    });
  }

  // Check participants <= 4
  const cleanParticipants = rawParticipants
    .map((p: any) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p: string) => p.length > 0);

  if (cleanParticipants.length < 1 || cleanParticipants.length > MAX_PARTICIPANTS_PER_SESSION) {
    return res.status(400).json({
      error: `Constraint violation: Maximum of ${MAX_PARTICIPANTS_PER_SESSION} participants allowed per session.`,
    });
  }

  const updated: Reservation = {
    ...existing,
    date: targetDate,
    start_time: targetStartTime,
    end_time: targetEndTime,
    participants: cleanParticipants,
    court_name: (court_name || existing.court_name).trim(),
    note: note !== undefined ? note.trim() : existing.note,
    updated_at: new Date().toISOString(),
  };

  reservationsCache[index] = updated;
  saveReservations(reservationsCache);

  // Broadcast to all connected devices in real time!
  broadcast({
    type: 'UPDATE',
    reservation: updated,
    reservations: reservationsCache,
    clientCount: sseClients.length,
  });

  res.json({ data: updated });
});

// 5. DELETE reservation
app.delete('/api/reservations/:id', (req: Request, res: Response) => {
  const userEmail = req.headers['x-user-email'] as string | undefined;

  if (!checkIsAdmin(userEmail)) {
    return res.status(403).json({
      error: `Access Denied: Only authorized Admin (${ADMIN_EMAIL}) can delete schedules.`,
    });
  }

  const { id } = req.params;
  const index = reservationsCache.findIndex((r) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Reservation not found.' });
  }

  reservationsCache.splice(index, 1);
  saveReservations(reservationsCache);

  // Broadcast to all connected devices in real time!
  broadcast({
    type: 'DELETE',
    id,
    reservations: reservationsCache,
    clientCount: sseClients.length,
  });

  res.json({ success: true });
});

// 6. Reset demo data
app.post('/api/reservations/reset', (req: Request, res: Response) => {
  const seed = getDefaultSeedData();
  reservationsCache = seed;
  saveReservations(reservationsCache);

  broadcast({
    type: 'RESET',
    reservations: reservationsCache,
    clientCount: sseClients.length,
  });

  res.json({ data: reservationsCache });
});

// ==========================================
// Vite Integration (Dev) / Static Serve (Prod)
// ==========================================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(distPath);

  if (hasDist) {
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏸 Sipetekkru Badminton Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
