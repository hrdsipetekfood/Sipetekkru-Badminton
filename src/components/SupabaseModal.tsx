import React, { useState, useEffect } from 'react';
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
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Save,
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveCustomSupabaseConfig,
  ReservationService,
  getActiveDataSource,
} from '../services/supabaseService';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => Promise<void>;
}

const SQL_SCHEMA_CONTENT = `-- ==============================================================================
-- Sipetekkru Badminton Reservation Schedule Schema & Row Level Security (RLS)
-- Target: Supabase (PostgreSQL 15+)
-- Admin Email: hrdsipetekfood@gmail.com
-- ==============================================================================

-- 1. Buat tabel reservations
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

    -- Constraint 1: Durasi tepat 60 menit
    CONSTRAINT check_exact_60_minutes_duration 
      CHECK (end_time = (start_time + INTERVAL '60 minutes')),

    -- Constraint 2: Maksimal 4 peserta, minimal 1 peserta
    CONSTRAINT check_max_four_participants 
      CHECK (array_length(participants, 1) >= 1 AND array_length(participants, 1) <= 4)
);

-- Index performa query kalender
CREATE INDEX IF NOT EXISTS idx_reservations_date ON public.reservations(date);

-- 2. Trigger constraint: Maksimal 2 sesi per tanggal
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

-- 3. Trigger otomatis update timestamp updated_at
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
-- gunakan policy di bawah ini agar web app dapat membaca & menulis data:
-- ==============================================================================

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "Public can view reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public can insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public can delete reservations" ON public.reservations;
DROP POLICY IF EXISTS "Public and guests can view badminton schedules" ON public.reservations;
DROP POLICY IF EXISTS "Only admin can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Only admin can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Only admin can delete reservations" ON public.reservations;

-- READ: Semua orang (tamu/anggota) dapat melihat jadwal reservasi
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
ON CONFLICT (id) DO NOTHING;`;

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose, onRefreshData }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'config' | 'sql' | 'why_not_updating' | 'guide'>('config');

  // Input states
  const [urlInput, setUrlInput] = useState<string>('');
  const [anonKeyInput, setAnonKeyInput] = useState<string>('');
  const [configSource, setConfigSource] = useState<'env' | 'storage' | 'none'>('none');

  // Test status
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; rowCount?: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setUrlInput(cfg.url);
      setAnonKeyInput(cfg.anonKey);
      setConfigSource(cfg.source);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_CONTENT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    const saveRes = saveCustomSupabaseConfig(urlInput, anonKeyInput);
    if (!saveRes.success) {
      setIsTesting(false);
      setTestResult({ success: false, message: saveRes.error || 'Gagal menyimpan konfigurasi.' });
      return;
    }

    const cfg = getSupabaseConfig();
    setConfigSource(cfg.source);

    if (cfg.source === 'none') {
      setIsTesting(false);
      setTestResult({
        success: true,
        message: 'Kredensial dikosongkan. Web sekarang menggunakan mode Server/Local Storage.',
      });
      if (onRefreshData) await onRefreshData();
      return;
    }

    const test = await ReservationService.testConnection();
    setIsTesting(false);
    setTestResult(test);

    if (test.success && onRefreshData) {
      await onRefreshData();
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      if (onRefreshData) {
        await onRefreshData();
      }
      const test = await ReservationService.testConnection();
      setTestResult(test);
    } finally {
      setIsSyncing(false);
    }
  };

  const dataSourceInfo = getActiveDataSource();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Koneksi Supabase & Sinkronisasi Data
              </h3>
              <p className="text-xs text-slate-400">
                Pusat pengaturan database live, diagnosa RLS, dan SQL script
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

        {/* Live Status Bar */}
        <div className="px-6 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">Status Sumber Data:</span>
            {dataSourceInfo.source === 'SUPABASE' ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Supabase Connected
              </span>
            ) : dataSourceInfo.source === 'SERVER_API' ? (
              <span className="flex items-center gap-1.5 text-cyan-300 font-semibold bg-cyan-950/80 border border-cyan-800/60 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Server Cache (Cloud Run)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-300 font-semibold bg-amber-950/80 border border-amber-800/60 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Local Storage / Offline
              </span>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setActiveTab('config')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                activeTab === 'config'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Koneksi & Tes
            </button>
            <button
              onClick={() => setActiveTab('why_not_updating')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                activeTab === 'why_not_updating'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-amber-400/90 hover:text-amber-200 hover:bg-slate-800'
              }`}
            >
              Solusi Data Tidak Berubah
            </button>
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                activeTab === 'sql'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              SQL Script (RLS)
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                activeTab === 'guide'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Panduan
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: KONEKSI & TES */}
          {activeTab === 'config' && (
            <div className="space-y-5">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-emerald-400" />
                      Pengaturan Kredensial Supabase
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Kamu bisa memasukkan URL dan Anon Key langsung di sini agar web langsung terhubung ke database Supabase tanpa perlu redeploy Vercel!
                    </p>
                  </div>
                  {configSource !== 'none' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Aktif ({configSource.toUpperCase()})
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveAndTest} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Supabase Project URL:
                    </label>
                    <input
                      type="text"
                      placeholder="https://xyzabcdefghijklm.supabase.co"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Supabase Anon / Public Key:
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={anonKeyInput}
                      onChange={(e) => setAnonKeyInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data Sekarang'}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isTesting}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menghubungkan...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Simpan & Tes Koneksi</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Diagnostic feedback result */}
                {testResult && (
                  <div
                    className={`mt-4 p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                      testResult.success
                        ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold mb-0.5">
                        {testResult.success ? 'Koneksi Berhasil' : 'Koneksi Gagal / Perlu Dicek'}
                      </p>
                      <p className="text-[11px] leading-relaxed text-slate-300">
                        {testResult.message}
                      </p>
                      {!testResult.success && testResult.message.includes('RLS') && (
                        <button
                          onClick={() => setActiveTab('sql')}
                          className="mt-2 text-xs font-bold text-amber-400 underline hover:text-amber-300 block"
                        >
                          → Klik di sini untuk copy SQL perbaikan RLS Policy
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SOLUSI DATA TIDAK BERUBAH */}
          {activeTab === 'why_not_updating' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4">
                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Mengapa Data Reservasi Tidak Berubah Saat Di-update?
                </h4>
                <p className="leading-relaxed text-slate-300 mb-3">
                  Ada 3 kemungkinan penyebab utama dan solusi cepatnya:
                </p>

                <div className="space-y-3">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
                    <h5 className="font-bold text-white mb-1 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                        1
                      </span>
                      Row Level Security (RLS) di Supabase Memblokir Update
                    </h5>
                    <p className="text-slate-400 leading-relaxed mb-2">
                      Secara default, jika kamu memasang policy yang memeriksa <code className="text-amber-300">{"auth.jwt() ->> 'email'"}</code>, Supabase akan <strong>menolak perubahan</strong> dari website karena web app menggunakan Anon Key tanpa Supabase Auth User login.
                    </p>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[11px] text-emerald-400">
                      <strong>Solusi:</strong> Jalankan script SQL di tab <strong>"SQL Script (RLS)"</strong> yang sudah disesuaikan agar mengizinkan update menggunakan Anon Key.
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
                    <h5 className="font-bold text-white mb-1 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                        2
                      </span>
                      Mengubah Data Langsung di Supabase tapi Web Belum Sinkron
                    </h5>
                    <p className="text-slate-400 leading-relaxed mb-2">
                      Jika kamu mengubah data langsung di Supabase Table Editor, browser kamu mungkin masih menampilkan cache sebelumnya.
                    </p>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[11px] text-emerald-400">
                      <strong>Solusi:</strong> Klik tombol <strong>"Sinkronkan Data Sekarang"</strong> di tab Koneksi atau tombol Refresh di pojok atas web.
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
                    <h5 className="font-bold text-white mb-1 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                        3
                      </span>
                      Di Vercel Kredensial Supabase Belum Terbaca
                    </h5>
                    <p className="text-slate-400 leading-relaxed mb-2">
                      Di link Vercel kamu (<code className="text-teal-300">sipetekkru-badminton.vercel.app</code>), jika variabel <code className="text-amber-300">VITE_SUPABASE_URL</code> belum ditambahkan di Vercel Dashboard, web akan berjalan dalam mode offline/local storage.
                    </p>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[11px] text-emerald-400">
                      <strong>Solusi:</strong> Cukup buka website di Vercel, klik tombol <strong>Supabase RLS</strong>, dan tempelkan URL serta Anon Key kamu di tab <strong>Koneksi & Tes</strong> lalu klik Simpan. Web akan langsung terhubung ke database Supabase secara instan!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SQL SCRIPT */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              {/* Quick Fix Card for DELETE & UPDATE issue */}
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Solusi Cepat 1-Klik: Izinkan Hapus & Edit di Supabase</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] rounded-lg transition-colors shadow-sm flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy 1-Line Fix</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-300">
                  Jika jadwal tidak terhapus di database saat kamu klik Delete, jalankan perintah ini di <strong>Supabase SQL Editor</strong>:
                </p>
                <div className="bg-slate-950 p-2 rounded-lg font-mono text-xs text-emerald-400 border border-slate-800 select-all">
                  ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Atau jalankan skrip lengkap dengan RLS aktif:</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-lg transition-colors shadow-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Salin SQL Lengkap'}</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto max-h-[340px]">
                <pre>{SQL_SCHEMA_CONTENT}</pre>
              </div>
            </div>
          )}

          {/* TAB 4: SETUP GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-sm text-white">Langkah Cepat Setup Supabase:</h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-400">
                  <li>Buka dashboard Supabase kamu di <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline">supabase.com</a>.</li>
                  <li>Buka menu <strong>SQL Editor</strong> di bilah kiri, klik <strong>New Query</strong>.</li>
                  <li>Salin seluruh kode dari tab <strong>SQL Script (RLS)</strong> dan klik <strong>Run</strong>.</li>
                  <li>Buka <strong>Project Settings → API</strong> untuk menyalin <strong>Project URL</strong> dan <strong>anon / public key</strong>.</li>
                  <li>Masukkan kredensial tersebut ke tab <strong>Koneksi & Tes</strong> di web ini atau tambahkan ke Environment Variables di Vercel.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Sipetekkru Badminton Schedule • Supabase Integration</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
