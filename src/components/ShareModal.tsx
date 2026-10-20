import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Smartphone,
  ExternalLink,
  MessageCircle,
  Eye,
  ShieldCheck,
  Zap,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedUrl: string;
  adminEmail: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  sharedUrl,
  adminEmail,
}) => {
  const [copiedActive, setCopiedActive] = useState<boolean>(false);
  const [copiedPublished, setCopiedPublished] = useState<boolean>(false);
  const [copiedWaText, setCopiedWaText] = useState<boolean>(false);

  if (!isOpen) return null;

  // The active running development server URL (works right now)
  const activeDevUrl = 'https://ais-dev-b2d4jgxm7fmujrghwywm36-807083370301.asia-southeast1.run.app?role=guest';

  // The published revision URL (activated after clicking Share/Publish in AI Studio UI)
  const publishedUrl = 'https://ais-pre-b2d4jgxm7fmujrghwywm36-807083370301.asia-southeast1.run.app?role=guest';

  // WhatsApp share template uses activeDevUrl so it opens immediately without 404!
  const waShareText = `🏸 *Jadwal Badminton Sipetekkru*\n\nHalo tim Sipetekkru! Jadwal booking lapangan badminton kita sudah bisa dicek secara live & real-time di link berikut:\n${activeDevUrl}\n\nJadwal otomatis ter-update setiap ada slot baru/perubahan!`;

  const waLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(waShareText)}`;

  const handleCopyActive = () => {
    navigator.clipboard.writeText(activeDevUrl);
    setCopiedActive(true);
    setTimeout(() => setCopiedActive(false), 2500);
  };

  const handleCopyPublished = () => {
    navigator.clipboard.writeText(publishedUrl);
    setCopiedPublished(true);
    setTimeout(() => setCopiedPublished(false), 2500);
  };

  const handleCopyWaText = () => {
    navigator.clipboard.writeText(waShareText);
    setCopiedWaText(true);
    setTimeout(() => setCopiedWaText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 p-6 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Bagikan Jadwal Badminton</h3>
              <p className="text-xs text-slate-400">
                Link Real-Time untuk Anggota Tim Sipetekkru
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real-Time Highlight Notice */}
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
            <Zap className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-emerald-300">Sinkronisasi Otomatis Secara Real-Time</p>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Semua orang yang membuka link ini di HP/laptop akan langsung melihat perubahan jadwal dalam hitungan detik <strong>tanpa perlu refresh</strong> saat Admin melakukan update.
            </p>
          </div>
        </div>

        {/* Link 1: Active Live Link (Directly working right now) */}
        <div className="space-y-1.5 p-3.5 bg-slate-950 border border-emerald-500/40 rounded-xl relative">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              1. Link Langsung Aktif Sekarang (Rekomendasi Utama)
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-1.5 py-0.2 rounded font-semibold">
              Live & Aktif
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Gunakan link ini untuk langsung dibagikan sekarang ke tim. Tidak akan error 404:
          </p>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              readOnly
              value={activeDevUrl}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-300 font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopyActive}
              className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1 shrink-0"
            >
              {copiedActive ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Link 2: Published / Shared Revision URL note */}
        <div className="space-y-1.5 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              2. Link Hasil Publish (`ais-pre-...`)
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded">
              Perlu Klik Publish
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Link <code className="text-slate-300 bg-slate-900 px-1 rounded">ais-pre-...</code> hanya akan aktif <strong>setelah Anda menekan tombol &quot;Share&quot; / &quot;Publish&quot;</strong> di pojok kanan atas layar AI Studio. Jika belum ditekan, server Google akan menampilkan <em>&quot;Page not found&quot;</em>.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              readOnly
              value={publishedUrl}
              className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopyPublished}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1 shrink-0"
            >
              {copiedPublished ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Share to WhatsApp */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            Share Langsung ke WhatsApp Tim:
          </label>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs space-y-2">
            <p className="text-[11px] text-slate-400 font-sans italic leading-relaxed whitespace-pre-line border-l-2 border-emerald-500/60 pl-2">
              {waShareText}
            </p>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Kirim ke WhatsApp</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
              </a>

              <button
                type="button"
                onClick={handleCopyWaText}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1"
              >
                {copiedWaText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Pesan WA</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Security / RBAC Note */}
        <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center gap-1.5 text-white font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hak Akses Terjamin Aman (RBAC):</span>
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
            <li>Tamu/Anggota hanya bisa <strong>melihat jadwal</strong> (Read-Only).</li>
            <li>Hanya Admin resmi (<strong>{adminEmail}</strong>) yang dapat membuat, mengubah, atau menghapus sesi.</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="pt-1 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
