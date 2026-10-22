-- ==============================================================================
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
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- PENTING: Karena aplikasi web menggunakan Kunci Anon (Client Anon Key),
-- gunakan policy di bawah ini agar web app dapat membaca & menulis data secara lancar:
-- ==============================================================================

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Public can view reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public can insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public can delete reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public and guests can view badminton schedules" ON public.reservations;
DROP POLICY IF EXISTS "Only admin can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Only admin can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Only admin can delete reservations" ON public.reservations;

-- READ: Semua orang (tamu & admin) dapat melihat jadwal reservasi
CREATE POLICY "Public can view reservations"
    ON public.reservations
    FOR SELECT
    USING (true);

-- INSERT: Web client dapat menambahkan jadwal
CREATE POLICY "Public can insert reservations"
    ON public.reservations
    FOR INSERT
    WITH CHECK (true);

-- UPDATE: Web client dapat mengubah jadwal
CREATE POLICY "Public can update reservations"
    ON public.reservations
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- DELETE: Web client dapat menghapus jadwal
CREATE POLICY "Public can delete reservations"
    ON public.reservations
    FOR DELETE
    USING (true);

-- ==============================================================================
-- 5. DATA AWAL (SEED DATA)
-- ==============================================================================
INSERT INTO public.reservations (id, date, start_time, end_time, participants, court_name, note, created_by)
VALUES 
  ('res-seed-1', CURRENT_DATE, '18:00', '19:00', ARRAY['Rian', 'Budi', 'Siti', 'Agus'], 'Court 1 - Sipetek Arena', 'Regular Sipetekkru Doubles Match', 'hrdsipetekfood@gmail.com'),
  ('res-seed-2', CURRENT_DATE, '19:30', '20:30', ARRAY['Dewi', 'Indra'], 'Court 2 - Sipetek Arena', 'Fun Mixed Match', 'hrdsipetekfood@gmail.com'),
  ('res-seed-3', CURRENT_DATE + INTERVAL '1 day', '19:00', '20:00', ARRAY['Fajar', 'Rian M.', 'Kevin'], 'Court 1 - Sipetek Arena', 'Team Sparring Session', 'hrdsipetekfood@gmail.com'),
  ('res-seed-4', CURRENT_DATE + INTERVAL '3 day', '17:00', '18:00', ARRAY['Arif', 'Taufik', 'Hendra', 'Ahsan'], 'Court 1 - Sipetek Arena', 'Pre-Championship Practice', 'hrdsipetekfood@gmail.com')
ON CONFLICT (id) DO NOTHING;
