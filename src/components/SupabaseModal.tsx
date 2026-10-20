import React, { useState } from 'react';
import {
  X,
  Database,
  Copy,
  Check,
  ShieldCheck,
  Terminal,
  ExternalLink,
  Key,
  Layers,
  Sparkles,
} from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabaseService';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCHEMA_CONTENT = `-- ==============================================================================
-- Sipetekkru Badminton Reservation Schedule Schema & Row Level Security (RLS)
-- Target: Supabase (PostgreSQL 15+)
-- Admin Email: hrdsipetekfood@gmail.com
-- ==============================================================================

-- 1. Create reservations table
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    start_time TIME WITHOUT TIME ZONE NOT NULL,
    end_time TIME WITHOUT TIME ZONE NOT NULL,
    participants TEXT[] NOT NULL,
    court_name TEXT NOT NULL DEFAULT 'Court 1 - Sipetek Arena',
    note TEXT,
    created_by TEXT NOT NULL DEFAULT 'hrdsipetekfood@gmail.com',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraint 1: Exact 60 minutes duration
    CONSTRAINT check_exact_60_minutes_duration 
      CHECK (end_time = (start_time + INTERVAL '60 minutes')),

    -- Constraint 2: Maximum 4 participants, minimum 1 participant
    CONSTRAINT check_max_four_participants 
      CHECK (array_length(participants, 1) >= 1 AND array_length(participants, 1) <= 4)
);

-- Index for date queries (calendar performance)
CREATE INDEX IF NOT EXISTS idx_reservations_date ON public.reservations(date);

-- 2. Enforce constraint: Maximum 2 sessions allowed per day via Postgres trigger
CREATE OR REPLACE FUNCTION public.check_max_sessions_per_day()
RETURNS TRIGGER AS $$
DECLARE
    session_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO session_count
    FROM public.reservations
    WHERE date = NEW.date
      AND (TG_OP = 'INSERT' OR id <> NEW.id);

    IF session_count >= 2 THEN
        RAISE EXCEPTION 'Constraint violation: Maximum of 2 sessions allowed per day for date %', NEW.date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_max_sessions_per_day ON public.reservations;
CREATE TRIGGER trigger_enforce_max_sessions_per_day
    BEFORE INSERT OR UPDATE OF date ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.check_max_sessions_per_day();

-- 3. Automatic updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_updated_at ON public.reservations;
CREATE TRIGGER trigger_set_updated_at
    BEFORE UPDATE ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) & RBAC POLICIES
-- ADMIN: hrdsipetekfood@gmail.com has full CRUD access
-- GUEST / PUBLIC: Read-Only access (SELECT only, no INSERT, UPDATE, or DELETE)
-- ==============================================================================

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Public and guests can view badminton schedules" ON public.reservations;
DROP POLICY IF EXISTS "Only admin can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Only admin can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Only admin can delete reservations" ON public.reservations;

-- READ POLICY: Everyone (authenticated or anonymous guest) can view schedules
CREATE POLICY "Public and guests can view badminton schedules"
    ON public.reservations
    FOR SELECT
    USING (true);

-- INSERT POLICY: Only admin 'hrdsipetekfood@gmail.com' can insert
CREATE POLICY "Only admin can create reservations"
    ON public.reservations
    FOR INSERT
    WITH CHECK (
        LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'hrdsipetekfood@gmail.com'
    );

-- UPDATE POLICY: Only admin 'hrdsipetekfood@gmail.com' can update
CREATE POLICY "Only admin can update reservations"
    ON public.reservations
    FOR UPDATE
    USING (
        LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'hrdsipetekfood@gmail.com'
    )
    WITH CHECK (
        LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'hrdsipetekfood@gmail.com'
    );

-- DELETE POLICY: Only admin 'hrdsipetekfood@gmail.com' can delete
CREATE POLICY "Only admin can delete reservations"
    ON public.reservations
    FOR DELETE
    USING (
        LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'hrdsipetekfood@gmail.com'
    );

-- ==============================================================================
-- 5. SEED DATA FOR SIPETEKKRU
-- ==============================================================================
INSERT INTO public.reservations (date, start_time, end_time, participants, court_name, note, created_by)
VALUES 
  (CURRENT_DATE, '18:00', '19:00', ARRAY['Rian', 'Budi', 'Siti', 'Agus'], 'Court 1 - Sipetek Arena', 'Regular Sipetekkru Doubles Match', 'hrdsipetekfood@gmail.com'),
  (CURRENT_DATE, '19:30', '20:30', ARRAY['Dewi', 'Indra'], 'Court 2 - Sipetek Arena', 'Fun Mixed Match', 'hrdsipetekfood@gmail.com'),
  (CURRENT_DATE + INTERVAL '1 day', '19:00', '20:00', ARRAY['Fajar', 'Rian M.', 'Kevin'], 'Court 1 - Sipetek Arena', 'Team Sparring Session', 'hrdsipetekfood@gmail.com'),
  (CURRENT_DATE + INTERVAL '3 day', '17:00', '18:00', ARRAY['Arif', 'Taufik', 'Hendra', 'Ahsan'], 'Court 1 - Sipetek Arena', 'Pre-Championship Practice', 'hrdsipetekfood@gmail.com')
ON CONFLICT DO NOTHING;`;

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'sql' | 'guide' | 'policies'>('sql');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_CONTENT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Supabase SQL Schema & Row Level Security (RLS)
              </h3>
              <p className="text-xs text-slate-400">
                Production-ready PostgreSQL DDL, constraints, triggers, and admin RBAC policies
              </p>
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

        {/* Status Bar */}
        <div className="px-6 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Supabase Status:</span>
            {isSupabaseConfigured ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected (Live Supabase Client)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-teal-300 font-semibold bg-teal-950/80 border border-teal-800/60 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                Active (Local High-Fidelity RLS Sandbox)
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                activeTab === 'sql'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              SQL Script
            </button>
            <button
              onClick={() => setActiveTab('policies')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                activeTab === 'policies'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              RLS Matrix
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                activeTab === 'guide'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Setup Guide
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Execute this script in Supabase SQL Editor:</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Full SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <pre className="p-4 text-xs font-mono text-emerald-300/90 leading-relaxed overflow-x-auto max-h-[460px]">
                  {SQL_SCHEMA_CONTENT}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'policies' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Row Level Security (RLS) Policy Architecture
                </h4>
                <p className="text-slate-400 text-xs">
                  Supabase RLS guarantees that even if a guest directly calls Supabase API endpoints via curl or Postman, PostgreSQL strictly denies write/edit/delete operations unless authorized.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3.5 font-semibold">Action</th>
                      <th className="py-2.5 px-3.5 font-semibold">Admin (hrdsipetekfood@gmail.com)</th>
                      <th className="py-2.5 px-3.5 font-semibold">Guest / Public</th>
                      <th className="py-2.5 px-3.5 font-semibold">PostgreSQL Constraint / Rule</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/40 text-slate-300">
                    <tr>
                      <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-400">SELECT (Read)</td>
                      <td className="py-2.5 px-3.5 text-emerald-300">✅ Allowed</td>
                      <td className="py-2.5 px-3.5 text-emerald-300">✅ Allowed</td>
                      <td className="py-2.5 px-3.5 text-slate-400">Policy: USING (true)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-400">INSERT (Create)</td>
                      <td className="py-2.5 px-3.5 text-emerald-300">✅ Full Access</td>
                      <td className="py-2.5 px-3.5 text-rose-400 font-semibold">❌ Blocked (RLS Error)</td>
                      <td className="py-2.5 px-3.5 text-slate-400">Max 2 sessions/day trigger + 60m check</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-400">UPDATE (Edit)</td>
                      <td className="py-2.5 px-3.5 text-emerald-300">✅ Full Access</td>
                      <td className="py-2.5 px-3.5 text-rose-400 font-semibold">❌ Blocked (RLS Error)</td>
                      <td className="py-2.5 px-3.5 text-slate-400">WITH CHECK (auth.email = admin)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3.5 font-bold font-mono text-emerald-400">DELETE</td>
                      <td className="py-2.5 px-3.5 text-emerald-300">✅ Full Access</td>
                      <td className="py-2.5 px-3.5 text-rose-400 font-semibold">❌ Blocked (RLS Error)</td>
                      <td className="py-2.5 px-3.5 text-slate-400">USING (auth.email = admin)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Business Logic Constraints list */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-2">
                <span className="font-bold text-white block">PostgreSQL Constraints Included:</span>
                <ul className="list-disc pl-5 space-y-1 text-slate-300 text-xs">
                  <li>
                    <strong className="text-emerald-400">check_exact_60_minutes_duration:</strong>{' '}
                    <code>end_time = start_time + INTERVAL '60 minutes'</code>
                  </li>
                  <li>
                    <strong className="text-emerald-400">check_max_four_participants:</strong>{' '}
                    <code>array_length(participants, 1) BETWEEN 1 AND 4</code>
                  </li>
                  <li>
                    <strong className="text-emerald-400">trigger_enforce_max_sessions_per_day:</strong>{' '}
                    Blocks insert/update if target date already has 2 sessions.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-white text-sm">Supabase Deployment Steps</h4>
                <ol className="list-decimal pl-5 space-y-2 text-slate-300">
                  <li>
                    Log in to your <strong>Supabase Dashboard</strong> and create a new project.
                  </li>
                  <li>
                    Navigate to the <strong>SQL Editor</strong> in the left sidebar.
                  </li>
                  <li>
                    Click the <strong>&quot;Copy Full SQL&quot;</strong> button on the first tab and paste it into the editor, then click <strong>Run</strong>.
                  </li>
                  <li>
                    Go to <strong>Authentication &gt; Users</strong> and create the admin user with email{' '}
                    <code className="text-emerald-400 font-bold bg-slate-900 px-1 py-0.5 rounded">
                      hrdsipetekfood@gmail.com
                    </code>.
                  </li>
                  <li>
                    In your project environment, set the two environment variables:
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-emerald-400 mt-2">
                      VITE_SUPABASE_URL=https://your-project.supabase.co<br />
                      VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Admin Auth Target: <span className="text-emerald-400 font-mono">hrdsipetekfood@gmail.com</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
