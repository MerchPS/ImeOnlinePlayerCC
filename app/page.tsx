'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ══════════════ Types ══════════════ */
type Player = { id: number; name: string; ping: number };
type AiMsg = { role: 'user' | 'assistant'; content: string };
type ApiData = { ok: boolean; gate: string; online: number; max: number; players: Player[]; updatedAt: string; error?: string };
type AuthStatus = 'LOADING' | 'UNAUTHORIZED' | 'PENDING' | 'APPROVED' | 'ADMIN' | 'BANNED' | 'TIMEOUT';
type Role = 'SUPER' | 'MOD';
type AccessRequest = { id: string; ipAddress: string; deviceId: string; status: string; timeoutUntil: string | null; reason: string | null; lastActive: string; createdAt: string };
type AuditLog = { id: string; adminName: string; action: string; targetDeviceId: string; details: string; createdAt: string };
type AdminUser = { id: string; deviceId: string; name: string; role: Role };
type BugReport = { id: string; deviceId: string; message: string; status: string; createdAt: string };
type Side = 'GOOD' | 'BAD' | 'NONE';
type FactionDef = { id: string; label: string; short: string; matchType: string; side?: Side; color?: string | null; badge: string; dot: string };
type Theme = 'dark' | 'light' | 'glass' | 'cyberpunk' | 'nord';
type Settings = { theme: Theme; refreshMs: number; compact: boolean; tagStyle: 'pill' | 'widget'; pageSize: number; notifyJoin: boolean; notifyRestart: boolean };
type EnrichedPlayer = Player & { faction: string; side: Side | 'CIVIL' };
type SessionRec = { start: number | null; last: number; total: number; count: number };
type HistoryPoint = { t: number; online: number };
type ToastItem = { id: number; text: string; kind: 'info' | 'good' | 'bad' | 'watch' };
type SortKey = 'id' | 'name' | 'ping' | 'session';
type GroupId = 'ALL' | 'GOOD' | 'BAD' | 'CIVILIAN';

const DEFAULT_SETTINGS: Settings = { theme: 'dark', refreshMs: 60000, compact: false, tagStyle: 'widget', pageSize: 25, notifyJoin: true, notifyRestart: false };

const WARGA: FactionDef = {
  id: 'WARGA', short: 'Civilian', label: 'Civilian', matchType: 'NONE', side: 'NONE',
  badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20', dot: 'bg-slate-400',
};

const FALLBACK_FACTIONS: FactionDef[] = [
  { id: 'bmc', label: 'BMC', short: 'BMC', matchType: 'STARTS_WITH', side: 'BAD', badge: 'bg-[#2a1a2e] text-[#d89ee8] border-[#4a2555]', dot: 'bg-[#c96ce8]' },
  { id: 'cbmc', label: 'CBMC', short: 'CBMC', matchType: 'STARTS_WITH', side: 'BAD', badge: 'bg-[#2e1a2a] text-[#e89ec9] border-[#55254a]', dot: 'bg-[#e86caa]' },
  { id: 'sin', label: 'Sinister', short: 'SIN', matchType: 'STARTS_WITH', side: 'BAD', badge: 'bg-[#1a1a1a] text-[#e0e0e0] border-[#333333]', dot: 'bg-[#888888]' },
  { id: 'mfl', label: 'Mapendos', short: 'MFL', matchType: 'STARTS_WITH', side: 'BAD', badge: 'bg-[#2a1a15] text-[#e8b08a] border-[#4a2f25]', dot: 'bg-[#d4885c]' },
  { id: 'dw', label: 'DW', short: 'DW', matchType: 'STARTS_WITH', side: 'BAD', badge: 'bg-[#1a2a15] text-[#a0e08a] border-[#2f4a25]', dot: 'bg-[#7ac95c]' },
  { id: 'rsg', label: 'RSG', short: 'RSG', matchType: 'STARTS_WITH', side: 'BAD', badge: 'bg-[#2a151a] text-[#e08a9e] border-[#4a2530]', dot: 'bg-[#c95c74]' },
  { id: 'bdf', label: 'BDF', short: 'BDF', matchType: 'STARTS_WITH', side: 'BAD', badge: 'bg-[#152a2a] text-[#8ae0e0] border-[#254a4a]', dot: 'bg-[#5cc9c9]' },
  { id: 'gov', label: 'Government', short: 'GOV', matchType: 'INCLUDES', side: 'GOOD', badge: 'bg-[#1a2f35] text-[#82d8d8] border-[#254a55]', dot: 'bg-[#6ac9d8]' },
  { id: 'una', label: 'UP N Atom', short: 'UNA', matchType: 'STARTS_WITH', side: 'GOOD', badge: 'bg-[#2a152a] text-[#e08ae0] border-[#4a254a]', dot: 'bg-[#c95cc9]' },
  { id: '969g', label: '969 Garage', short: '969G', matchType: 'STARTS_WITH', side: 'GOOD', badge: 'bg-[#1a1a2a] text-[#8a9ee0] border-[#25254a]', dot: 'bg-[#5c74c9]' },
  { id: 'rb', label: 'Queen Beach', short: 'RB', matchType: 'STARTS_WITH', side: 'GOOD', badge: 'bg-[#2a1515] text-[#e08a8a] border-[#4a2525]', dot: 'bg-[#c95c5c]' },
];

const GOOD_SIDE_SHORTS = ['GOV', 'LSPD', 'DOC', 'LSSD', 'MEDIC', 'RH', 'ICR', 'DOJ', '#IME', 'UNA', '969G', 'RB'];
const BAD_SIDE_SHORTS = ['CC', '4B', 'JRZ', 'HT', 'HTH', 'BURGENK', 'DTF', 'ALLSTAR', 'ALLSTARS', 'NSN', 'WT', '24S', 'OMC', '5TAR', 'MX', 'RCMC', 'RC1', 'BMC', 'CBMC', 'RAGE', 'ALTION', 'NN', 'SIN', 'MFL', 'DW', 'RSG', 'BDF'];

const SESSION_GAP_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/* ══════════════ Utils ══════════════ */
const fmt = (n: number) => n.toLocaleString('id-ID');
const clean = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const GOOD_SET = new Set(GOOD_SIDE_SHORTS.map(clean));
const BAD_SET = new Set(BAD_SIDE_SHORTS.map(clean));

function pingClass(p: number) {
  if (p < 80) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  if (p < 150) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  return 'bg-red-500/10 text-red-500 border-red-500/20';
}
function formatTime(ms: number) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSecs / 3600), m = Math.floor((totalSecs % 3600) / 60), s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function formatDate(iso: string) { return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); }
function fmtDuration(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '<1m';
  const h = Math.floor(m / 60);
  return h ? `${h}j ${m % 60}m` : `${m}m`;
}
function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}
function hexA(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function toCsv(rows: (string | number)[][]) {
  return rows.map(r => r.map(v => {
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}
function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function browserNotify(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body });
  } catch { /* ignore */ }
}
function stripThink(text: string) { return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim(); }

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('ime-settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  const s = { ...DEFAULT_SETTINGS };
  const t = localStorage.getItem('ime-theme'); if (t) s.theme = t as Theme;
  const r = localStorage.getItem('ime-refresh'); if (r) s.refreshMs = Number(r) || s.refreshMs;
  const c = localStorage.getItem('ime-compact'); if (c) s.compact = c === 'true';
  const tg = localStorage.getItem('ime-tag-style'); if (tg === 'pill' || tg === 'widget') s.tagStyle = tg;
  return s;
}

function mergeFactions(db: FactionDef[]): FactionDef[] {
  const seen = new Set<string>();
  db.forEach(f => f.short.split(',').forEach(a => seen.add(clean(a))));
  return [...db, ...FALLBACK_FACTIONS.filter(fb => !seen.has(clean(fb.short)))];
}

type Matcher = { alias: string; type: string; id: string };
function buildMatchers(factions: FactionDef[]): Matcher[] {
  const list: Matcher[] = [];
  for (const f of factions) {
    for (const raw of f.short.split(',')) {
      const alias = clean(raw);
      if (alias) list.push({ alias, type: f.matchType, id: f.id });
    }
  }
  return list.sort((a, b) => b.alias.length - a.alias.length);
}

function detectFaction(name: string, matchers: Matcher[]): string {
  const hasSep = name.includes(' - ');
  const cleanPrefix = clean(name.split(' - ')[0].trim());
  const cleanFull = clean(name);
  for (const m of matchers) {
    if (m.type === 'STARTS_WITH') {
      if (cleanPrefix.startsWith(m.alias)) return m.id;
      if (!hasSep && cleanFull.startsWith(m.alias)) return m.id;
    } else if (m.type === 'INCLUDES') {
      if (cleanPrefix.includes(m.alias)) return m.id;
      if (!hasSep && cleanFull.includes(m.alias)) return m.id;
    }
  }
  return 'WARGA';
}

function resolveSide(f?: FactionDef): Side {
  if (!f) return 'NONE';
  if (f.side === 'GOOD' || f.side === 'BAD') return f.side;
  const aliases = f.short.split(',').map(clean);
  if (aliases.some(a => GOOD_SET.has(a))) return 'GOOD';
  if (aliases.some(a => BAD_SET.has(a))) return 'BAD';
  return 'NONE';
}

function renderMarkdown(text: string) {
  const cleanText = stripThink(text);
  return cleanText.split('\n').map((line, i) => {
    const parseBold = (str: string) => str.split(/(\*\*.*?\*\*)/g).map((part, j) => part.startsWith('**') && part.endsWith('**') ? <strong key={j} className="font-semibold text-accent">{part.slice(2, -2)}</strong> : part);
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) { const level = line.match(/^#+/)?.[0].length || 1; return <div key={i} className={`font-semibold text-main mt-3 mb-1 ${level === 1 ? 'text-base' : 'text-sm'}`}>{line.replace(/^#+\s+/, '')}</div>; }
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) return <div key={i} className="flex gap-2 ml-1 my-0.5"><span className="text-subtle">•</span><span>{parseBold(line.replace(/^[-*]\s+/, ''))}</span></div>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <div key={i} className="my-0.5">{parseBold(line)}</div>;
  });
}

/* ══════════════ Main App Component ══════════════ */
export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('LOADING');
  const [role, setRole] = useState<Role>('SUPER');
  const [deviceId, setDeviceId] = useState<string>('');
  const [authMeta, setAuthMeta] = useState<{ timeoutUntil?: string; reason?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // Changelog & Bug Report States
  const [showChangelog, setShowChangelog] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem('ime-device-id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('ime-device-id', id); }
    setDeviceId(id);
    setSettings(loadSettings());

    // Cek apakah changelog harus muncul
    const lastVersion = localStorage.getItem('ime-changelog-version');
    if (lastVersion !== 'v1.2') {
      setShowChangelog(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const handleSaveSettings = (s: Settings) => {
    setSettings(s);
    localStorage.setItem('ime-settings', JSON.stringify(s));
    if (s.notifyRestart && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    setSettingsOpen(false);
  };

  useEffect(() => {
    if (!deviceId) return;
    const checkAuth = async () => {
      try {
        const res = await fetch(`/api/auth/status?deviceId=${deviceId}`);
        const json = await res.json();
        setAuthStatus(json.status);
        setRole(json.role === 'MOD' ? 'MOD' : 'SUPER');
        setAuthMeta({ timeoutUntil: json.timeoutUntil, reason: json.reason });
      } catch { setAuthStatus('UNAUTHORIZED'); }
    };
    checkAuth();
    const interval = setInterval(checkAuth, 10000);
    return () => clearInterval(interval);
  }, [deviceId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) setIsBlurred(true);
      else setTimeout(() => setIsBlurred(false), 300);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'u'].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key === 'PrintScreen') {
        navigator.clipboard.writeText('⚠️ Screenshot dilarang!').catch(() => {});
        setIsBlurred(true);
        setTimeout(() => setIsBlurred(false), 2000);
      }
    };
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  if (authStatus === 'LOADING') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app text-main">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm font-mono text-muted">Memeriksa akses...</span>
        </div>
      </div>
    );
  }

  if (['UNAUTHORIZED', 'PENDING', 'BANNED', 'TIMEOUT'].includes(authStatus)) {
    return <LockScreen deviceId={deviceId} status={authStatus} meta={authMeta} onRefresh={() => window.location.reload()} />;
  }

  return (
    <div className="relative min-h-screen bg-app text-main overflow-hidden">
      <div className={`transition-all duration-300 ease-out ${isBlurred ? 'blur-[30px] scale-[0.95] opacity-10 pointer-events-none' : ''}`}>
        <Home
          isAdmin={authStatus === 'ADMIN'}
          settings={settings}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAdmin={() => setAdminOpen(true)}
        />
        {authStatus === 'ADMIN' && <AdminPanel open={adminOpen} role={role} onClose={() => setAdminOpen(false)} />}
      </div>
      
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} current={settings} onSave={handleSaveSettings} />
      
      {/* Popup Changelog */}
      {showChangelog && (
        <ChangelogModal onClose={() => {
          localStorage.setItem('ime-changelog-version', 'v1.2');
          setShowChangelog(false);
        }} />
      )}

      {/* Floating Bug Report Button */}
      <button
        onClick={() => setBugReportOpen(true)}
        className="fixed bottom-6 right-6 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition-all hover:scale-110 active:scale-95"
        title="Laporkan Bug"
      >
        <BugIcon className="h-6 w-6" />
      </button>

      <BugReportModal open={bugReportOpen} onClose={() => setBugReportOpen(false)} deviceId={deviceId} />
    </div>
  );
}

/* ══════════════ Changelog Modal ══════════════ */
function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-card shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="border-b border-line bg-accent/10 px-6 py-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-accent">
            <SparkIcon className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-main">Update Terbaru v1.2</h2>
          <p className="text-xs text-muted mt-1">Fitur baru & perbaikan sistem</p>
        </div>
        <div className="px-6 py-5 max-h-[50vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-3 text-sm text-main">
            <div className="flex gap-3">
              <span className="text-emerald-500">✅</span>
              <p><strong>Watchlist & Sesi Player:</strong> Klik ikon bintang (⭐) untuk memantau player. Klik nama player untuk *copy* nama mereka.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-500">✅</span>
              <p><strong>Grafik Tren Online:</strong> Lihat riwayat player online 24 jam terakhir.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-500">✅</span>
              <p><strong>Widget Kubu (Good/Bad/Civilian):</strong> Filter player berdasarkan kubu dengan lebih rapi.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-500">✅</span>
              <p><strong>Tombol Report Bug:</strong> Tombol merah di pojok kanan bawah untuk melapor jika ada error.</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500">
            <div className="font-bold flex items-center gap-2 mb-1">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Catatan Penting
            </div>
            <p className="text-amber-200/80 leading-relaxed">
              Website ini masih dalam tahap pengembangan. Kedepannya akan banyak penyesuaian dan update fitur baru. Mohon tunggu info lebih lanjut!
            </p>
          </div>
        </div>
        <div className="border-t border-line bg-app p-4 text-center">
          <button onClick={onClose} className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-text transition hover:bg-accent-hover">
            Mengerti & Lanjutkan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════ Bug Report Modal ══════════════ */
function BugReportModal({ open, onClose, deviceId }: { open: boolean; onClose: () => void; deviceId: string }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, message: message.trim() })
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => {
          onClose();
          setSent(false);
          setMessage('');
        }, 2000);
      }
    } catch {
      alert('Gagal mengirim laporan.');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95">
        {sent ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-lg font-bold text-main">Laporan Terkirim!</h3>
            <p className="text-sm text-muted mt-1">Terima kasih atas laporanmu.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 text-red-500">
                <BugIcon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-main">Laporkan Bug / Error</h3>
                <p className="text-[11px] text-subtle">Laporan akan masuk ke Admin Panel</p>
              </div>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Jelaskan bug yang kamu temukan... (misal: Faction X nyasar ke Y)"
              rows={4}
              className="w-full resize-none rounded-lg border border-line bg-app p-3 text-sm text-main outline-none focus:border-accent"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-main">Batal</button>
              <button onClick={submit} disabled={sending || !message.trim()} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50">
                {sending ? 'Mengirim...' : 'Kirim Laporan'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════ Lock Screen ══════════════ */
function LockScreen({ deviceId, status, meta, onRefresh }: { deviceId: string; status: string; meta: any; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const requestAccess = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await fetch('/api/auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId }) });
      if (res.status === 429) { const data = await res.json(); setErrorMsg(data.error); }
      else { onRefresh(); }
    } catch { setErrorMsg('Gagal menghubungi server.'); }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app p-4 text-main">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 text-center shadow-2xl">
        <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${status === 'BANNED' || status === 'TIMEOUT' ? 'bg-red-500/15 text-red-500' : 'bg-accent/15 text-accent'}`}>
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {status === 'BANNED' || status === 'TIMEOUT' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />}
          </svg>
        </div>

        <h1 className="text-xl font-bold">
          {status === 'BANNED' ? 'Akses Diblokir' : status === 'TIMEOUT' ? 'Akses Ditangguhkan' : 'Akses Terkunci'}
        </h1>

        <p className="mt-2 text-sm text-muted">
          {status === 'BANNED' ? 'Kamu telah melanggar aturan dan dilarang mengakses web ini.' :
            status === 'TIMEOUT' ? 'Akses kamu ditangguhkan sementara.' :
              status === 'PENDING' ? '⏳ Menunggu Hans (Admin) menyetujui permintaan akses kamu.' :
                'Website ini bersifat privat. Kamu harus meminta izin akses dari Admin Hans terlebih dahulu.'}
        </p>

        {(status === 'BANNED' || status === 'TIMEOUT') && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-left">
            <div className="text-xs font-semibold uppercase text-red-400">Alasan:</div>
            <div className="mt-1 text-sm text-red-200">{meta?.reason || 'Tidak ada alasan spesifik.'}</div>
            {status === 'TIMEOUT' && meta?.timeoutUntil && (
              <div className="mt-3 text-xs text-red-300">Dibuka kembali pada: <br /><span className="font-mono font-bold text-red-200">{new Date(meta.timeoutUntil).toLocaleString('id-ID')}</span></div>
            )}
          </div>
        )}

        {errorMsg && <div className="mt-4 text-xs font-semibold text-orange-500">{errorMsg}</div>}
        {status === 'UNAUTHORIZED' && (
          <button onClick={requestAccess} disabled={loading} className="mt-6 w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-text transition hover:bg-accent-hover disabled:opacity-50">
            {loading ? 'Memproses...' : 'Minta Akses Sekarang'}
          </button>
        )}
        <div className="mt-6 text-[10px] text-subtle font-mono bg-hover py-2 rounded-lg">Device ID: {deviceId}</div>
      </div>
    </div>
  );
}

/* ══════════════ Faction Tag ══════════════ */
function FactionTag({ fac, variant }: { fac: Pick<FactionDef, 'badge' | 'dot' | 'short' | 'color'>; variant: 'pill' | 'widget' }) {
  const label = fac.short.split(',')[0];
  const custom = fac.color && hexA(fac.color, 1) ? fac.color : null;
  const boxStyle = custom ? { backgroundColor: hexA(custom, 0.15), color: custom, borderColor: hexA(custom, 0.35) } : undefined;
  const dotStyle = custom ? { backgroundColor: custom } : undefined;
  const boxCls = custom ? '' : fac.badge;
  const dotCls = custom ? '' : fac.dot;

  if (variant === 'pill') {
    return (
      <div className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${boxCls}`} style={boxStyle}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} style={dotStyle} />
        {label}
      </div>
    );
  }
  return (
    <div className={`inline-flex shrink-0 items-center gap-2 rounded-[14px] border px-3 py-1.5 text-[11px] font-semibold shadow-sm backdrop-blur-md ${boxCls}`} style={boxStyle}>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full ${dotCls}`} style={dotStyle}>
        <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
      </span>
      {label}
    </div>
  );
}

/* ══════════════ Admin Panel ══════════════ */
type FactionForm = { id?: string; label: string; short: string; matchType: string; side: Side; color: string; badge: string; dot: string };
const EMPTY_FORM: FactionForm = { label: '', short: '', matchType: 'INCLUDES', side: 'NONE', color: '#8b5cf6', badge: 'bg-gray-500/10 text-gray-500 border-gray-500/20', dot: 'bg-gray-500' };

function AdminPanel({ open, onClose, role }: { open: boolean; onClose: () => void; role: Role }) {
  const isSuper = role === 'SUPER';
  const [activeTab, setActiveTab] = useState<'requests' | 'factions' | 'audit' | 'admins' | 'reports'>('requests');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionModal, setActionModal] = useState<{ type: 'BAN' | 'TIMEOUT'; id?: string } | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [durationInput, setDurationInput] = useState('60');
  const [expireHours, setExpireHours] = useState('72');
  const [factions, setFactions] = useState<FactionDef[]>([]);
  const [form, setForm] = useState<FactionForm>(EMPTY_FORM);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logAdmin, setLogAdmin] = useState('ALL');
  const [logFrom, setLogFrom] = useState('');
  const [logTo, setLogTo] = useState('');
  const [logText, setLogText] = useState('');
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdmin, setNewAdmin] = useState<{ name: string; deviceId: string; role: Role }>({ name: '', deviceId: '', role: 'MOD' });
  const [reports, setReports] = useState<BugReport[]>([]);

  const fetchData = useCallback(async () => {
    try {
      if (activeTab === 'requests') { const res = await fetch('/api/admin/requests'); if (res.ok) setRequests(await res.json()); }
      else if (activeTab === 'audit') { const res = await fetch('/api/admin/audit'); if (res.ok) setLogs(await res.json()); }
      else if (activeTab === 'factions') { const res = await fetch('/api/factions'); if (res.ok) setFactions(await res.json()); }
      else if (activeTab === 'admins') { const res = await fetch('/api/admin/admins'); if (res.ok) setAdmins(await res.json()); }
      else if (activeTab === 'reports') { const res = await fetch('/api/reports'); if (res.ok) setReports(await res.json()); }
    } catch { /* abaikan */ }
  }, [activeTab]);

  useEffect(() => {
    if (!open) return;
    fetchData();
    const int = setInterval(() => { if (activeTab !== 'factions') fetchData(); }, 5000);
    return () => clearInterval(int);
  }, [open, fetchData, activeTab]);

  const executeAction = async (id: string, action: string, reason?: string, durationMinutes?: number) => {
    await fetch('/api/admin/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, reason, durationMinutes }) });
    fetchData(); setActionModal(null); setReasonInput('');
  };

  const executeBulk = async (action: string) => {
    if (selected.size === 0) return;
    if (action === 'BAN' && !confirm(`Yakin ingin mem-ban ${selected.size} user sekaligus?`)) return;
    await fetch('/api/admin/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selected), action }) });
    setSelected(new Set()); fetchData();
  };

  const expirePending = async () => {
    if (!confirm(`Hapus semua request PENDING yang lebih lama dari ${expireHours} jam?`)) return;
    await fetch('/api/admin/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'EXPIRE_PENDING', olderThanHours: Number(expireHours) }) });
    fetchData();
  };

  const saveFaction = async () => {
    if (!form.label.trim() || !form.short.trim()) return;
    const res = await fetch('/api/factions', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!res.ok) { alert('Gagal menyimpan faction.'); return; }
    setForm(EMPTY_FORM); fetchData();
  };

  const startEdit = (f: FactionDef) => {
    setForm({ id: f.id, label: f.label, short: f.short, matchType: f.matchType, side: f.side ?? 'NONE', color: f.color || '#8b5cf6', badge: f.badge, dot: f.dot });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteFaction = async (id: string) => {
    if (!confirm('Hapus faction ini?')) return;
    await fetch(`/api/factions?id=${id}`, { method: 'DELETE' });
    if (form.id === id) setForm(EMPTY_FORM);
    fetchData();
  };

  const addAdmin = async () => {
    if (!newAdmin.name.trim() || !newAdmin.deviceId.trim()) return;
    const res = await fetch('/api/admin/admins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAdmin) });
    if (!res.ok) { alert('Gagal menambah admin.'); return; }
    setNewAdmin({ name: '', deviceId: '', role: 'MOD' }); fetchData();
  };

  const removeAdmin = async (id: string) => {
    if (!confirm('Cabut akses admin ini?')) return;
    await fetch(`/api/admin/admins?id=${id}`, { method: 'DELETE' }); fetchData();
  };

  const resolveReport = async (id: string) => {
    await fetch('/api/reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'RESOLVE' }) });
    fetchData();
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const filtered = requests.filter(r => {
    const matchSearch = r.ipAddress.includes(search) || r.deviceId.includes(search);
    const matchFilter = filter === 'ALL' ? true : r.status === filter;
    return matchSearch && matchFilter;
  });

  const adminNames = useMemo(() => Array.from(new Set(logs.map(l => l.adminName))), [logs]);
  const filteredLogs = useMemo(() => {
    const q = logText.trim().toLowerCase();
    return logs.filter(l => {
      const d = new Date(l.createdAt);
      if (logAdmin !== 'ALL' && l.adminName !== logAdmin) return false;
      if (logFrom && d < new Date(`${logFrom}T00:00:00`)) return false;
      if (logTo && d > new Date(`${logTo}T23:59:59`)) return false;
      if (q && !`${l.action} ${l.targetDeviceId} ${l.details}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, logAdmin, logFrom, logTo, logText]);

  const exportLogs = () => {
    const rows: (string | number)[][] = [['Waktu', 'Admin', 'Aksi', 'Target', 'Detail']];
    filteredLogs.forEach(l => rows.push([formatDate(l.createdAt), l.adminName, l.action, l.targetDeviceId, l.details || '']));
    downloadCsv(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  if (!open) return null;

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'requests', label: 'Users' },
    { id: 'reports', label: 'Reports' },
    ...(isSuper ? [{ id: 'factions' as const, label: 'Factions' }, { id: 'audit' as const, label: 'Logs' }, { id: 'admins' as const, label: 'Admins' }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-app">
      <header className="flex flex-col border-b border-line bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 sm:text-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </span>Admin Center
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${isSuper ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'}`}>{isSuper ? 'SUPER ADMIN' : 'MODERATOR'}</span>
          </h1>
        </div>
        <div className="mt-4 flex items-center gap-2 sm:mt-0 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex rounded-lg border border-line bg-app p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${activeTab === t.id ? 'bg-card text-main shadow-sm' : 'text-muted hover:text-main'}`}>{t.label}</button>
            ))}
          </div>
          <button onClick={onClose} className="rounded-lg bg-hover px-4 py-2 text-sm font-medium hover:bg-line transition">Tutup</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          
          {/* TAB REPORTS */}
          {activeTab === 'reports' && (
            <div className="rounded-xl border border-line bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-hover text-subtle text-[10px] uppercase tracking-wider sm:text-xs">
                    <tr>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Device ID</th>
                      <th className="px-4 py-3 w-full">Laporan Bug</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r.id} className="border-t border-line hover:bg-hover/50 transition">
                        <td className="px-4 py-3 text-muted text-xs">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-subtle">{r.deviceId}</td>
                        <td className="px-4 py-3 text-main whitespace-normal">{r.message}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.status === 'PENDING' && (
                            <button onClick={() => resolveReport(r.id)} className="rounded bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-500 hover:bg-emerald-500/20">Tandai Selesai</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reports.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-subtle">Belum ada laporan bug.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB REQUESTS */}
          {activeTab === 'requests' && (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {['ALL', 'PENDING', 'APPROVED', 'BANNED'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 text-xs font-medium transition sm:text-sm ${filter === f ? 'bg-accent text-accent-text' : 'bg-card border border-line text-muted hover:text-main'}`}>{f}</button>
                  ))}
                  <div className="h-6 w-px bg-line mx-1" />
                  <button onClick={() => executeBulk('APPROVE')} disabled={selected.size === 0} className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-30">ACC Selected ({selected.size})</button>
                  <button onClick={() => executeBulk('BAN')} disabled={selected.size === 0} className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20 disabled:opacity-30">Ban Selected ({selected.size})</button>
                </div>
                <input type="text" placeholder="Cari IP / Device ID..." value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-lg border border-line bg-card px-4 py-2 text-sm outline-none focus:border-accent sm:w-64" />
              </div>

              <div className="rounded-xl border border-line bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-hover text-subtle text-[10px] uppercase tracking-wider sm:text-xs">
                      <tr>
                        <th className="px-4 py-3 w-10"><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={(e) => e.target.checked ? setSelected(new Set(filtered.map(r => r.id))) : setSelected(new Set())} className="cursor-pointer accent-accent" /></th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">User Info</th>
                        <th className="px-4 py-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => {
                        const isOnline = new Date(r.lastActive).getTime() > Date.now() - 60000;
                        const isTimeout = r.timeoutUntil && new Date(r.timeoutUntil) > new Date();
                        return (
                          <tr key={r.id} className="border-t border-line hover:bg-hover/50 transition">
                            <td className="px-4 py-4"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="cursor-pointer accent-accent" /></td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-line'}`} />
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-500' : r.status === 'PENDING' ? 'bg-amber-500/20 text-amber-500' : r.status === 'BANNED' ? 'bg-red-500/20 text-red-500' : 'bg-gray-500/20 text-gray-500'}`}>{r.status}</span>
                                {isTimeout && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-500">TO</span>}
                              </div>
                              {r.reason && <div className="mt-1 text-[10px] text-muted max-w-[120px] truncate" title={r.reason}>Ket: {r.reason}</div>}
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-medium text-main">{r.ipAddress}</div>
                              <div className="font-mono text-[11px] text-subtle mt-0.5">{r.deviceId}</div>
                              <div className="text-[10px] text-subtle mt-0.5">Diminta: {formatDate(r.createdAt)}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {r.status === 'BANNED' ? <button onClick={() => executeAction(r.id, 'REVOKE')} className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-2 py-1 rounded text-[11px] font-medium">Unban</button>
                                  : isTimeout ? <button onClick={() => executeAction(r.id, 'CLEAR_TIMEOUT')} className="bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 px-2 py-1 rounded text-[11px] font-medium">Hapus TO</button>
                                    : (
                                      <>
                                        {r.status !== 'APPROVED' && <button onClick={() => executeAction(r.id, 'APPROVE')} className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-2 py-1 rounded text-[11px] font-medium">ACC</button>}
                                        {r.status === 'APPROVED' && <button onClick={() => executeAction(r.id, 'REVOKE')} className="bg-hover text-muted hover:text-main px-2 py-1 rounded text-[11px] font-medium">Revoke</button>}
                                        <button onClick={() => { setActionModal({ type: 'TIMEOUT', id: r.id }); setReasonInput(''); setDurationInput('60'); }} className="text-orange-500 hover:bg-orange-500/10 px-2 py-1 rounded text-[11px] font-medium border border-transparent">Timeout</button>
                                        <button onClick={() => { setActionModal({ type: 'BAN', id: r.id }); setReasonInput(''); }} className="text-red-500 hover:bg-red-500/10 px-2 py-1 rounded text-[11px] font-medium border border-transparent">Ban</button>
                                      </>
                                    )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* (Sisa tab Factions, Audit, Admins sama persis seperti kodemu sebelumnya) */}
          {/* ... */}
        </div>
      </div>
    </div>
  );
}

/* ══════════════ Online Chart ══════════════ */
function OnlineChart({ points }: { points: HistoryPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div className="py-8 text-center text-xs text-subtle">Data tren masih dikumpulkan… biarkan halaman terbuka beberapa menit.</div>;
  const W = 600, H = 140, P = 8;
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const span = Math.max(t1 - t0, 1);
  const maxV = Math.max(...points.map(p => p.online), 1);
  const minV = Math.min(...points.map(p => p.online));
  const top = Math.ceil(maxV * 1.1);
  const avg = Math.round(points.reduce((a, p) => a + p.online, 0) / points.length);
  const peak = points.reduce((a, p) => (p.online > a.online ? p : a), points[0]);
  const x = (t: number) => P + ((t - t0) / span) * (W - 2 * P);
  const y = (v: number) => H - P - (v / top) * (H - 2 * P);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.online).toFixed(1)}`).join(' ');
  const area = `${line} L${x(t1).toFixed(1)},${H - P} L${x(t0).toFixed(1)},${H - P} Z`;
  const hm = (t: number) => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = t0 + ratio * span;
    let best = 0, bestD = Infinity;
    points.forEach((p, i) => { const d = Math.abs(p.t - target); if (d < bestD) { bestD = d; best = i; } });
    setHover(best);
  };
  const hp = hover != null ? points[hover] : null;
  return (
    <div>
      <div className="relative text-accent">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full touch-pan-y" preserveAspectRatio="none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <defs><linearGradient id="onlineGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.35" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
          {[0.25, 0.5, 0.75].map(r => <line key={r} x1={P} x2={W - P} y1={H - P - r * (H - 2 * P)} y2={H - P - r * (H - 2 * P)} stroke="currentColor" strokeOpacity="0.08" />)}
          <path d={area} fill="url(#onlineGrad)" />
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {hp && <line x1={x(hp.t)} x2={x(hp.t)} y1={P} y2={H - P} stroke="currentColor" strokeOpacity="0.4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>
        {hp && (
          <div className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-md border border-line bg-card px-2 py-1 text-[11px] text-main shadow-lg" style={{ left: `${Math.min(88, Math.max(12, (x(hp.t) / W) * 100))}%` }}>
            <span className="font-mono font-bold">{hp.online}</span> <span className="text-subtle">· {hm(hp.t)}</span>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-subtle"><span>{hm(t0)}</span><span>{hm(t1)}</span></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-hover px-2 py-2"><div className="text-[10px] uppercase tracking-wider text-subtle">Puncak</div><div className="text-sm font-semibold text-main">{peak.online} <span className="text-[10px] font-normal text-muted">({hm(peak.t)})</span></div></div>
        <div className="rounded-lg bg-hover px-2 py-2"><div className="text-[10px] uppercase tracking-wider text-subtle">Rata-rata</div><div className="text-sm font-semibold text-main">{avg}</div></div>
        <div className="rounded-lg bg-hover px-2 py-2"><div className="text-[10px] uppercase tracking-wider text-subtle">Terendah</div><div className="text-sm font-semibold text-main">{minV}</div></div>
      </div>
    </div>
  );
}

/* ══════════════ Group widget config ══════════════ */
const GROUP_WIDGETS: { id: Exclude<GroupId, 'ALL'>; label: string; icon: string; active: string; idle: string; iconActive: string; iconIdle: string; text: string; dot: string }[] = [
  { id: 'GOOD', label: 'Good Side', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', active: 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50', idle: 'border-line bg-card hover:border-emerald-500/30 hover:bg-emerald-500/5', iconActive: 'bg-emerald-500 text-white', iconIdle: 'bg-emerald-500/10 text-emerald-500', text: 'text-emerald-500', dot: 'bg-emerald-500' },
  { id: 'BAD', label: 'Bad Side', icon: 'M13 10V3L4 14h7v7l9-11h-7z', active: 'border-red-500/50 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)] ring-1 ring-red-500/50', idle: 'border-line bg-card hover:border-red-500/30 hover:bg-red-500/5', iconActive: 'bg-red-500 text-white', iconIdle: 'bg-red-500/10 text-red-500', text: 'text-red-500', dot: 'bg-red-500' },
  { id: 'CIVILIAN', label: 'Civilian', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', active: 'border-slate-500/50 bg-slate-500/10 shadow-[0_0_20px_rgba(100,116,139,0.15)] ring-1 ring-slate-500/50', idle: 'border-line bg-card hover:border-slate-500/30 hover:bg-slate-500/5', iconActive: 'bg-slate-500 text-white', iconIdle: 'bg-slate-500/10 text-slate-400', text: 'text-slate-400', dot: 'bg-slate-400' },
];

/* ══════════════ Main Home ══════════════ */
function Home({ isAdmin, settings, onOpenSettings, onOpenAdmin }: { isAdmin: boolean; settings: Settings; onOpenSettings: () => void; onOpenAdmin: () => void }) {
  const { refreshMs, compact: compactMode, tagStyle } = settings;
  const infinite = settings.pageSize === 0;
  const pageSize = settings.pageSize || 25;

  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<GroupId>('ALL');
  const [activeCat, setActiveCat] = useState<string>('SEMUA');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [onlyWatch, setOnlyWatch] = useState(false);
  const [page, setPage] = useState(0);
  const [visibleCount, setVisibleCount] = useState(50);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);
  const [pull, setPull] = useState(0);
  const [urlReady, setUrlReady] = useState(false);

  const [factions, setFactions] = useState<FactionDef[]>(FALLBACK_FACTIONS);
  const [factionsError, setFactionsError] = useState(false);
  const [countdown, setCountdown] = useState<{ diffMs: number; target: Date } | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [watch, setWatch] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const settingsRef = useRef(settings); settingsRef.current = settings;
  const watchRef = useRef(watch); watchRef.current = watch;
  const sessionsRef = useRef<Record<string, SessionRec>>({});
  const prevNamesRef = useRef<Set<string> | null>(null);
  const prevOnlineRef = useRef<number | null>(null);
  const toastId = useRef(0);
  const notifiedRestartRef = useRef<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const navRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const onMouseDown = (e: React.MouseEvent) => { if (!navRef.current) return; setIsDragging(true); setStartX(e.pageX - navRef.current.offsetLeft); setScrollLeft(navRef.current.scrollLeft); };
  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);
  const onMouseMove = (e: React.MouseEvent) => { if (!isDragging || !navRef.current) return; e.preventDefault(); const x = e.pageX - navRef.current.offsetLeft; const walk = (x - startX) * 2; navRef.current.scrollLeft = scrollLeft - walk; };
  const onWheel = (e: React.WheelEvent) => { if (navRef.current) navRef.current.scrollLeft += e.deltaY; };

  const pushToast = useCallback((text: string, kind: ToastItem['kind'] = 'info') => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);

  useEffect(() => {
    try { sessionsRef.current = JSON.parse(localStorage.getItem('ime-sessions') || '{}'); } catch { sessionsRef.current = {}; }
    try {
      const h: HistoryPoint[] = JSON.parse(localStorage.getItem('ime-online-history') || '[]');
      const cutoff = Date.now() - DAY_MS;
      setHistory(h.filter(p => p.t > cutoff));
    } catch { /* ignore */ }
    try { setWatch(new Set<string>(JSON.parse(localStorage.getItem('ime-watchlist') || '[]'))); } catch { /* ignore */ }
    fetch('/api/stats/history').then(r => (r.ok ? r.json() : Promise.reject())).then((rows: { t: string | number; online: number }[]) => {
      const server: HistoryPoint[] = rows.map(r => ({ t: typeof r.t === 'number' ? r.t : Date.parse(r.t), online: r.online })).filter(p => !Number.isNaN(p.t));
      if (server.length < 2) return;
      const lastT = server[server.length - 1].t;
      setHistory(prev => [...server, ...prev.filter(p => p.t > lastT)]);
    }).catch(() => { /* fallback */ });
  }, []);

  useEffect(() => {
    try { localStorage.setItem('ime-online-history', JSON.stringify(history)); } catch { /* ignore */ }
  }, [history]);

  const toggleWatch = useCallback((name: string) => {
    setWatch(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      try { localStorage.setItem('ime-watchlist', JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const g = sp.get('group');
    if (g === 'GOOD' || g === 'BAD' || g === 'CIVILIAN') setActiveGroup(g);
    const c = sp.get('cat'); if (c) setActiveCat(c);
    const q = sp.get('q'); if (q) setSearch(q);
    const s = sp.get('sort');
    if (s === 'id' || s === 'name' || s === 'ping' || s === 'session') { setSortKey(s); setSortDir(sp.get('dir') === 'desc' ? 'desc' : 'asc'); }
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const sp = new URLSearchParams();
    if (activeGroup !== 'ALL') sp.set('group', activeGroup);
    if (activeCat !== 'SEMUA') sp.set('cat', activeCat);
    if (search.trim()) sp.set('q', search.trim());
    if (sortKey) { sp.set('sort', sortKey); sp.set('dir', sortDir); }
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [urlReady, activeGroup, activeCat, search, sortKey, sortDir]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); pushToast('Link filter disalin', 'good'); }
    catch { pushToast('Gagal menyalin link', 'bad'); }
  };

  useEffect(() => {
    const activeEl = navRef.current?.querySelector('[data-active="true"]') as HTMLElement;
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeCat]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/factions')
      .then(res => { if (!res.ok) throw new Error('bad status'); return res.json(); })
      .then((rows: FactionDef[]) => { if (!cancelled) { setFactions(mergeFactions(Array.isArray(rows) ? rows : [])); setFactionsError(false); } })
      .catch(() => { if (!cancelled) { setFactions(FALLBACK_FACTIONS); setFactionsError(true); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchPending = async () => {
      try {
        const res = await fetch('/api/admin/requests');
        if (res.ok) { const reqs = await res.json(); setPendingCount(reqs.filter((r: any) => r.status === 'PENDING').length); }
      } catch { /* ignore */ }
    };
    fetchPending(); const int = setInterval(fetchPending, 15000); return () => clearInterval(int);
  }, [isAdmin]);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date(); const wibOffset = 7 * 60 * 60 * 1000; const nowWib = new Date(now.getTime() + wibOffset); const h = nowWib.getUTCHours();
      const targetWib = new Date(nowWib); targetWib.setUTCHours(0, 0, 0, 0);
      if (h < 6) targetWib.setUTCHours(6, 0, 0, 0); else if (h < 18) targetWib.setUTCHours(18, 0, 0, 0); else { targetWib.setUTCDate(targetWib.getUTCDate() + 1); targetWib.setUTCHours(6, 0, 0, 0); }
      const diffMs = targetWib.getTime() - nowWib.getTime(); setCountdown({ diffMs, target: new Date(targetWib.getTime() - wibOffset) });
    };
    updateTimer(); const id = setInterval(updateTimer, 1000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!countdown || !settings.notifyRestart) return;
    const key = countdown.target.getTime();
    if (countdown.diffMs < 30 * 60 * 1000 && notifiedRestartRef.current !== key) {
      notifiedRestartRef.current = key;
      browserNotify('Server akan restart', `Restart dalam ${formatTime(countdown.diffMs)}`);
      pushToast(`⚠ Server restart dalam ${fmtDuration(countdown.diffMs)}`, 'bad');
    }
  }, [countdown, settings.notifyRestart, pushToast]);

  const handleSnapshot = useCallback((json: ApiData) => {
    const now = Date.now();
    const names = new Set(json.players.map(p => p.name));
    const prev = prevNamesRef.current;
    if (prev) {
      const joined = Array.from(names).filter(n => !prev.has(n));
      const left = Array.from(prev).filter(n => !names.has(n));
      const w = watchRef.current;
      joined.filter(n => w.has(n)).forEach(n => { pushToast(`⭐ ${n} sekarang online`, 'watch'); browserNotify('Watchlist online', `${n} masuk server`); });
      left.filter(n => w.has(n)).forEach(n => pushToast(`⭐ ${n} keluar`, 'info'));
      if (settingsRef.current.notifyJoin && (joined.length || left.length)) {
        const sample = (arr: string[]) => arr.slice(0, 2).join(', ') + (arr.length > 2 ? ` +${arr.length - 2}` : '');
        const parts: string[] = [];
        if (joined.length) parts.push(`+${joined.length} join (${sample(joined)})`);
        if (left.length) parts.push(`-${left.length} leave (${sample(left)})`);
        pushToast(parts.join(' · '), joined.length >= left.length ? 'good' : 'bad');
      }
    }
    prevNamesRef.current = names;

    const sess = sessionsRef.current;
    names.forEach(n => {
      const rec = sess[n] ?? { start: null, last: 0, total: 0, count: 0 };
      if (rec.start != null && now - rec.last > SESSION_GAP_MS) { rec.total += rec.last - rec.start; rec.start = null; }
      if (rec.start == null) { rec.start = now; rec.count += 1; }
      rec.last = now;
      sess[n] = rec;
    });
    Object.keys(sess).forEach(n => {
      const rec = sess[n];
      if (!names.has(n) && rec.start != null) { rec.total += rec.last - rec.start; rec.start = null; }
    });
    const keys = Object.keys(sess);
    if (keys.length > 600) {
      keys.filter(k => sess[k].start == null).sort((a, b) => sess[a].last - sess[b].last).slice(0, keys.length - 600).forEach(k => delete sess[k]);
    }
    try { localStorage.setItem('ime-sessions', JSON.stringify(sess)); } catch { /* ignore */ }

    setHistory(h => {
      const cutoff = now - DAY_MS;
      const last = h[h.length - 1];
      const base = last && now - last.t < 50_000 ? h : [...h, { t: now, online: json.online }];
      return base.filter(p => p.t > cutoff);
    });
  }, [pushToast]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/players', { cache: 'no-store' }); const json: ApiData = await res.json();
      if (!json.ok) throw new Error(json.error || 'Gagal memuat data');
      setDelta(prevOnlineRef.current == null ? null : json.online - prevOnlineRef.current);
      prevOnlineRef.current = json.online;
      handleSnapshot(json);
      setData(json); setError(null); setLastFetch(new Date());
    } catch (e: any) { setError(e.message || 'Terjadi kesalahan'); } finally { setLoading(false); setRefreshing(false); }
  }, [handleSnapshot]);

  const loadRef = useRef(load); loadRef.current = load;
  useEffect(() => { load(); const id = setInterval(load, refreshMs); return () => clearInterval(id); }, [load, refreshMs]);

  useEffect(() => {
    let startY = 0, active = false, dist = 0;
    const ts = (e: TouchEvent) => { if (window.scrollY <= 0 && e.touches.length === 1) { startY = e.touches[0].clientY; active = true; dist = 0; } };
    const tm = (e: TouchEvent) => {
      if (!active) return;
      const d = e.touches[0].clientY - startY;
      if (d > 0 && window.scrollY <= 0) { dist = Math.min(d * 0.5, 90); setPull(dist); } else { dist = 0; setPull(0); }
    };
    const te = () => { if (active && dist >= 60) loadRef.current(); active = false; dist = 0; setPull(0); };
    window.addEventListener('touchstart', ts, { passive: true });
    window.addEventListener('touchmove', tm, { passive: true });
    window.addEventListener('touchend', te, { passive: true });
    return () => { window.removeEventListener('touchstart', ts); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', te); };
  }, []);

  const matchers = useMemo(() => buildMatchers(factions), [factions]);
  const factionMap = useMemo(() => { const m = new Map<string, FactionDef>(); factions.forEach(f => m.set(f.id, f)); return m; }, [factions]);

  const enriched: EnrichedPlayer[] = useMemo(() => (data?.players ?? []).map(p => {
    const faction = detectFaction(p.name, matchers);
    const side: Side | 'CIVIL' = faction === 'WARGA' ? 'CIVIL' : resolveSide(factionMap.get(faction));
    return { ...p, faction, side };
  }), [data, matchers, factionMap]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { SEMUA: enriched.length, GOOD: 0, BAD: 0, CIVILIAN: 0 };
    for (const f of factions) c[f.id] = 0;
    c.WARGA = 0;
    for (const p of enriched) {
      c[p.faction] = (c[p.faction] ?? 0) + 1;
      if (p.side === 'CIVIL') c.CIVILIAN++;
      else if (p.side === 'GOOD') c.GOOD++;
      else if (p.side === 'BAD') c.BAD++;
    }
    return c;
  }, [enriched, factions]);

  const sessionMs = useCallback((name: string) => {
    const rec = sessionsRef.current[name];
    return rec && rec.start != null ? Date.now() - rec.start : 0;
  }, []);

  const filtered = useMemo(() => {
    let list = enriched;
    if (activeGroup !== 'ALL') {
      list = list.filter(p => activeGroup === 'CIVILIAN' ? p.side === 'CIVIL' : p.side === activeGroup);
    }
    if (activeCat !== 'SEMUA') list = list.filter(p => p.faction === activeCat);
    if (onlyWatch) list = list.filter(p => watch.has(p.name));
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q));
    return list;
  }, [enriched, activeGroup, activeCat, search, onlyWatch, watch]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'id': return (a.id - b.id) * dir;
        case 'ping': return (a.ping - b.ping) * dir;
        case 'name': return a.name.localeCompare(b.name, 'id') * dir;
        case 'session': return (sessionMs(a.name) - sessionMs(b.name)) * dir;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir, sessionMs]);

  const toggleSort = (k: SortKey) => {
    if (sortKey !== k) { setSortKey(k); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else setSortKey(null);
  };

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const slice = infinite ? sorted.slice(0, visibleCount) : sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);
  useEffect(() => { setPage(0); setVisibleCount(50); }, [search, activeCat, activeGroup, onlyWatch, pageSize]);

  useEffect(() => {
    if (!infinite || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) setVisibleCount(v => v + 50); }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [infinite, sorted.length, visibleCount]);

  const navCats = useMemo(() => {
    const items = [
      { id: 'SEMUA', short: 'Semua', dot: 'bg-accent', color: null as string | null | undefined },
      ...factions.filter(f => {
        if (activeGroup === 'ALL') return true;
        if (activeGroup === 'CIVILIAN') return false;
        return resolveSide(f) === activeGroup;
      }).map(f => ({ id: f.id, short: f.short.split(',')[0], dot: f.dot, color: f.color })),
      { id: 'WARGA', short: WARGA.short, dot: WARGA.dot, color: null },
    ];
    return items.filter(it => {
      if (it.id === 'WARGA') return activeGroup === 'ALL' || activeGroup === 'CIVILIAN';
      return (counts[it.id] ?? 0) > 0 || it.id === activeCat || it.id === 'SEMUA';
    });
  }, [counts, activeCat, factions, activeGroup]);

  const isWarning = countdown && countdown.diffMs < 30 * 60 * 1000;

  const copyName = async (name: string) => {
    try { await navigator.clipboard.writeText(name); pushToast(`Disalin: ${name}`, 'info'); }
    catch { pushToast('Gagal menyalin', 'bad'); }
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [['Kantong', 'Nama', 'Faction', 'Side', 'Ping']];
    sorted.forEach(p => {
      const f = p.faction === 'WARGA' ? WARGA : factionMap.get(p.faction);
      rows.push([p.id, p.name, f?.label ?? 'Civilian', p.side === 'CIVIL' ? 'Civilian' : p.side, p.ping]);
    });
    downloadCsv(`players-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`, toCsv(rows));
    pushToast(`${sorted.length} player diekspor`, 'good');
  };

  const sortTh = (k: SortKey, label: string, cls: string) => (
    <th className={cls}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-main">
        {label}
        <span className={sortKey === k ? 'text-accent' : 'opacity-30'}>{sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );

  const rowH = compactMode ? 'h-10' : 'h-14';

  return (
    <main className="min-h-screen bg-app text-main">
      {pull > 0 && (
        <div className="pointer-events-none fixed left-0 right-0 top-14 z-50 flex justify-center" style={{ transform: `translateY(${pull * 0.6}px)`, opacity: Math.min(1, pull / 60) }}>
          <div className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-[11px] text-muted shadow-lg">
            <RefreshIcon className={`h-3.5 w-3.5 ${pull >= 60 ? 'text-accent' : ''}`} />{pull >= 60 ? 'Lepas untuk refresh' : 'Tarik untuk refresh'}
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-[200] flex flex-col items-center gap-2 px-3">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-2.5 text-xs font-medium shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 ${t.kind === 'good' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400' : t.kind === 'bad' ? 'border-red-500/30 bg-red-500/15 text-red-400' : t.kind === 'watch' ? 'border-amber-500/40 bg-amber-500/15 text-amber-400' : 'border-line bg-card text-main'}`}>
            {t.text}
          </div>
        ))}
      </div>

      <div className="fixed top-3 left-0 right-0 z-40 flex justify-center px-3">
        <div className="relative w-full max-w-5xl overflow-hidden rounded-full">
          <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-12 bg-gradient-to-r from-app via-app/80 to-transparent rounded-l-full backdrop-blur-[2px]" />
          <div
            ref={navRef} onMouseDown={onMouseDown} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={onMouseMove} onWheel={onWheel}
            className={`nav-scroll no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-nav px-3 py-1.5 shadow-[0_4px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            {navCats.map(cat => {
              const active = activeCat === cat.id;
              return (
                <button key={cat.id} data-active={active} onClick={() => setActiveCat(cat.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 ${active ? 'bg-accent text-accent-text shadow-[0_0_12px_var(--accent)]' : 'text-muted hover:bg-hover hover:text-main'}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full transition-colors ${active ? 'bg-accent-text' : cat.color ? '' : cat.dot}`} style={!active && cat.color ? { backgroundColor: cat.color } : undefined} />
                  <span>{cat.short}</span>
                  <span className={`text-[10px] ${active ? 'text-accent-text/80' : 'text-subtle'}`}>{counts[cat.id] ?? 0}</span>
                </button>
              );
            })}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-12 bg-gradient-to-l from-app via-app/80 to-transparent rounded-r-full backdrop-blur-[2px]" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-20 sm:px-6">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-subtle">IME Roleplay</div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Player Monitor
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted">Pantau siapa saja yang sedang bermain sekarang</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {countdown && (
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono transition-colors ${isWarning ? 'border-red-500/50 bg-red-500/10 text-red-500' : 'border-line bg-card text-muted'}`}>
                <span className="hidden sm:inline">Restart dalam</span><span className="sm:hidden">Restart</span><span className="font-bold">{formatTime(countdown.diffMs)}</span>
              </div>
            )}
            {isAdmin && (
              <button onClick={onOpenAdmin} className="relative flex h-8 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-emerald-500 transition hover:bg-emerald-500/20" title="Admin Panel">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                <span className="text-xs font-semibold">Admin</span>
                {pendingCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-app">{pendingCount}</span>}
              </button>
            )}
            <button onClick={() => setHistoryOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted transition hover:border-accent/50 hover:text-main" title="Riwayat sesi"><ClockIcon className="h-4 w-4" /></button>
            <button onClick={onOpenSettings} className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted transition-all duration-300 hover:border-accent/50 hover:text-main hover:rotate-90" title="Pengaturan"><GearIcon className="h-4 w-4" /></button>
            <button onClick={() => setAiOpen(true)} className="group flex items-center gap-2 rounded-full border border-line bg-card px-4 py-1.5 text-xs font-medium text-accent transition hover:border-accent/50 hover:bg-hover"><SparkIcon className="h-3.5 w-3.5" />Tanya AI</button>
          </div>
        </header>

        {isWarning && countdown && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500 animate-pulse">
            <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div><span className="font-bold tracking-wide">PERINGATAN BADAI:</span> Server akan direstart dalam <span className="font-mono font-bold">{formatTime(countdown.diffMs)}</span>.</div>
          </div>
        )}

        {factionsError && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-500">Daftar faction dari server gagal dimuat — memakai daftar bawaan.</div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Online" value={data ? fmt(data.online) : '—'} accent="text-emerald-500" pulse delta={delta} />
          <Stat label="Max Slots" value={data ? fmt(data.max) : '—'} accent="text-blue-500" />
          <Stat label="Gate" value={data?.gate ?? '—'} accent="text-accent" small />
          <Stat label="Terakhir" value={lastFetch ? lastFetch.toLocaleTimeString('id-ID') : '—'} accent="text-muted" small />
        </section>

        <section className="mb-6 rounded-2xl border border-line bg-card p-4">
          <button onClick={() => setChartOpen(o => !o)} className="flex w-full items-center justify-between text-left">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Tren Online · 24 jam terakhir</div>
              <div className="mt-0.5 text-xs text-muted">Lihat jam ramai & perkiraan jam sepi</div>
            </div>
            <span className={`text-subtle transition-transform ${chartOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {chartOpen && <div className="mt-3"><OnlineChart points={history} /></div>}
        </section>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {GROUP_WIDGETS.map(w => {
            const on = activeGroup === w.id;
            return (
              <button key={w.id}
                onClick={() => { setActiveGroup(on ? 'ALL' : w.id); setActiveCat('SEMUA'); }}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 ${on ? w.active : w.idle}`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${on ? w.iconActive : w.iconIdle}`}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={w.icon} /></svg>
                  </div>
                  {on && <span className={`flex h-2 w-2 rounded-full animate-pulse ${w.dot}`} />}
                </div>
                <div className="mt-4">
                  <div className={`text-[10px] font-semibold uppercase tracking-wider ${w.text}`}>{w.label}</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-main">{counts[w.id]}</span>
                    <span className="text-xs text-muted">player</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">⚠ {error}</div>}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau kantong…" className="w-full rounded-lg border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-main placeholder-subtle outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/15" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setOnlyWatch(o => !o)} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${onlyWatch ? 'border-amber-500/50 bg-amber-500/10 text-amber-500' : 'border-line bg-card text-main hover:border-amber-500/40'}`} title="Hanya watchlist">
              <StarIcon className="h-4 w-4" filled={onlyWatch} /><span className="text-xs">{watch.size}</span>
            </button>
            <button onClick={exportCsv} disabled={sorted.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-card px-3 py-2.5 text-sm font-medium text-main transition hover:border-accent/40 disabled:opacity-40" title="Ekspor CSV (sesuai filter)"><DownloadIcon className="h-4 w-4" /><span className="hidden sm:inline">CSV</span></button>
            <button onClick={copyLink} className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-card px-3 py-2.5 text-sm font-medium text-main transition hover:border-accent/40" title="Salin link dengan filter ini"><LinkIcon className="h-4 w-4" /><span className="hidden sm:inline">Link</span></button>
            <button onClick={load} disabled={refreshing} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium text-main transition hover:border-accent/40 disabled:opacity-40 sm:flex-none">
              <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className={`border-b border-line bg-hover text-left text-[10px] font-semibold uppercase tracking-wider text-subtle ${compactMode ? 'h-9' : 'h-11'}`}>
                  <th className="w-10 pl-4" />
                  {sortTh('id', 'Kantong', 'w-24 px-4')}
                  {sortTh('name', 'Nama', 'px-4')}
                  {sortTh('session', 'Sesi', 'hidden w-24 px-4 sm:table-cell')}
                  {sortTh('ping', 'Ping', 'w-20 px-4 text-right')}
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className={`border-b border-line ${rowH}`}>
                      <td className="pl-4"><div className="h-4 w-4 animate-pulse rounded bg-hover" /></td>
                      <td className="px-4"><div className="h-5 w-12 animate-pulse rounded bg-hover" /></td>
                      <td className="px-4"><div className="flex items-center gap-2"><div className="h-6 w-16 animate-pulse rounded-full bg-hover" /><div className="h-4 w-40 animate-pulse rounded bg-hover" /></div></td>
                      <td className="hidden px-4 sm:table-cell"><div className="h-4 w-10 animate-pulse rounded bg-hover" /></td>
                      <td className="px-4 text-right"><div className="ml-auto h-5 w-10 animate-pulse rounded bg-hover" /></td>
                    </tr>
                  ))
                ) : slice.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-16 text-center text-subtle">{filtered.length ? 'Tidak ada hasil.' : onlyWatch ? 'Tidak ada pemain watchlist yang online.' : 'Tidak ada player di kategori ini.'}</td></tr>
                ) : slice.map(p => {
                  const fac = p.faction === 'WARGA' ? WARGA : factionMap.get(p.faction) ?? WARGA;
                  const watched = watch.has(p.name);
                  return (
                    <tr key={p.id} onClick={() => copyName(p.name)} title="Klik untuk menyalin nama" className={`cursor-pointer border-b border-line transition hover:bg-hover ${rowH} ${watched ? 'bg-amber-500/5' : ''}`}>
                      <td className="pl-4">
                        <button onClick={e => { e.stopPropagation(); toggleWatch(p.name); }} className={`flex h-6 w-6 items-center justify-center rounded transition ${watched ? 'text-amber-500' : 'text-subtle hover:text-amber-500'}`} title={watched ? 'Hapus dari watchlist' : 'Tambah ke watchlist'}>
                          <StarIcon className="h-4 w-4" filled={watched} />
                        </button>
                      </td>
                      <td className="px-4"><span className="inline-flex items-center rounded-md border border-line bg-app px-2 py-0.5 font-mono text-[11px] font-medium text-main">#{p.id}</span></td>
                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          <FactionTag fac={fac} variant={tagStyle} />
                          <span className="truncate text-[13px] text-main max-w-[120px] sm:max-w-none">{p.name}</span>
                        </div>
                      </td>
                      <td className="hidden px-4 font-mono text-[11px] text-muted sm:table-cell">{fmtDuration(sessionMs(p.name))}</td>
                      <td className="px-4 text-right"><span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[11px] font-medium ${pingClass(p.ping)}`}>{p.ping}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {infinite && visibleCount < sorted.length && <div ref={sentinelRef} className="py-6 text-center text-xs text-subtle">Memuat lebih banyak…</div>}

        <div className="mt-4 flex flex-col items-center justify-between gap-4 text-xs text-muted sm:flex-row">
          <div className="order-2 sm:order-1">Auto-refresh {refreshMs / 1000} detik · {sorted.length} player{infinite ? ` · menampilkan ${Math.min(visibleCount, sorted.length)}` : ''}</div>
          {!infinite && (
            <div className="order-1 flex w-full items-center justify-between gap-2 sm:order-2 sm:w-auto">
              <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage <= 0} className="flex-1 rounded-lg border border-line bg-card py-2 font-medium text-main transition hover:border-accent/40 disabled:opacity-30 sm:flex-none sm:px-4 sm:py-1.5">← Prev</button>
              <span className="min-w-[52px] text-center font-mono text-muted">{safePage + 1}/{totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1} className="flex-1 rounded-lg border border-line bg-card py-2 font-medium text-main transition hover:border-accent/40 disabled:opacity-30 sm:flex-none sm:px-4 sm:py-1.5">Next →</button>
            </div>
          )}
        </div>
      </div>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} sessions={sessionsRef.current} onlineNames={prevNamesRef.current} watch={watch} onToggleWatch={toggleWatch} />
      <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)} data={data} enriched={enriched} counts={counts} activeCat={activeCat} factionMap={factionMap} />
    </main>
  );
}

/* ══════════════ Riwayat Sesi Modal ══════════════ */
function HistoryModal({ open, onClose, sessions, onlineNames, watch, onToggleWatch }: { open: boolean; onClose: () => void; sessions: Record<string, SessionRec>; onlineNames: Set<string> | null; watch: Set<string>; onToggleWatch: (n: string) => void }) {
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    if (!open) return [];
    const needle = q.trim().toLowerCase();
    return Object.entries(sessions)
      .filter(([name]) => !needle || name.toLowerCase().includes(needle))
      .map(([name, rec]) => ({ name, rec, online: rec.start != null && !!onlineNames?.has(name), cur: rec.start != null ? rec.last - rec.start : 0 }))
      .sort((a, b) => (a.online === b.online ? b.rec.last - a.rec.last : a.online ? -1 : 1))
      .slice(0, 200);
  }, [open, q, sessions, onlineNames]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div><div className="text-sm font-semibold text-main">Riwayat Sesi Pemain</div><div className="text-[11px] text-subtle">Terakhir terlihat & total waktu main</div></div>
          <button onClick={onClose} className="rounded-md p-1.5 text-subtle transition hover:bg-hover hover:text-main"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="border-b border-line p-3"><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama…" className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent/50" /></div>
        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? <div className="px-4 py-12 text-center text-sm text-subtle">Belum ada data sesi.</div> : rows.map(r => (
            <div key={r.name} className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button onClick={() => onToggleWatch(r.name)} className={watch.has(r.name) ? 'text-amber-500' : 'text-subtle hover:text-amber-500'}><StarIcon className="h-4 w-4" filled={watch.has(r.name)} /></button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-main">{r.name}</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {r.online ? <span className="text-emerald-500">● Online · sesi {fmtDuration(Date.now() - (r.rec.start ?? Date.now()))}</span> : <>Terakhir: {timeAgo(r.rec.last)}</>}
                </div>
              </div>
              <div className="text-right text-[11px] text-muted"><div className="font-mono text-main">{fmtDuration(r.rec.total + r.cur)}</div><div>{r.rec.count}× sesi</div></div>
            </div>
          ))}
        </div>
        <div className="border-t border-line bg-app px-5 py-2 text-[10px] text-subtle">Dicatat dari browser ini hanya saat halaman terbuka, jadi angka bisa lebih kecil dari waktu main sebenarnya.</div>
      </div>
    </div>
  );
}

/* ══════════════ Settings Modal ══════════════ */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-hover'}`}>
      <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function SettingsModal({ open, onClose, current, onSave }: { open: boolean; onClose: () => void; current: Settings; onSave: (s: Settings) => void }) {
  const [draft, setDraft] = useState<Settings>(current);
  useEffect(() => { if (open) setDraft(current); }, [open, current]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft(d => ({ ...d, [k]: v }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15"><GearIcon className="h-4 w-4 text-accent" /></span>
            <div><div className="text-sm font-semibold text-main">Pengaturan</div><div className="text-[11px] text-subtle">Tampilan & preferensi</div></div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-subtle transition hover:bg-hover hover:text-main"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="space-y-6 px-5 py-5">
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Tema Tampilan</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([
                { id: 'dark', label: 'Dark', bg: 'bg-[#0c0a08]', border: 'border-[#2a2520]' },
                { id: 'light', label: 'Light', bg: 'bg-[#f8fafc]', border: 'border-[#e2e8f0]' },
                { id: 'glass', label: 'Glass', bg: 'bg-[#09090b]', border: 'border-white/10' },
                { id: 'cyberpunk', label: 'Cyberpunk', bg: 'bg-[#050505]', border: 'border-[#fcee0a]' },
                { id: 'nord', label: 'Nord', bg: 'bg-[#2e3440]', border: 'border-[#4c566a]' },
              ] as { id: Theme; label: string; bg: string; border: string }[]).map(t => (
                <button key={t.id} onClick={() => set('theme', t.id)} className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all ${draft.theme === t.id ? 'border-accent ring-2 ring-accent/20' : 'border-line hover:border-accent/40'}`}>
                  <div className={`h-10 w-full rounded-md border ${t.bg} ${t.border} flex items-center justify-center`}><div className={`h-1.5 w-6 rounded-full ${draft.theme === t.id ? 'bg-accent' : 'bg-line'}`} /></div>
                  <span className={`text-xs font-medium ${draft.theme === t.id ? 'text-accent' : 'text-muted group-hover:text-main'}`}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-line" />

          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Gaya Tag Faction</div>
            <div className="flex rounded-lg border border-line bg-app p-1">
              <button onClick={() => set('tagStyle', 'pill')} className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${draft.tagStyle === 'pill' ? 'bg-card text-main shadow-sm' : 'text-muted hover:text-main'}`}>Pill (Bulat)</button>
              <button onClick={() => set('tagStyle', 'widget')} className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${draft.tagStyle === 'widget' ? 'bg-card text-main shadow-sm' : 'text-muted hover:text-main'}`}>Widget (Soft Card)</button>
            </div>
          </div>

          <hr className="border-line" />
          <div>
            <div className="mb-3 flex items-center justify-between"><div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Interval Refresh</div><div className="text-[11px] text-muted">{draft.refreshMs / 1000} detik</div></div>
            <div className="flex rounded-lg border border-line bg-app p-1">
              {[30, 60, 120].map(s => (
                <button key={s} onClick={() => set('refreshMs', s * 1000)} className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${draft.refreshMs === s * 1000 ? 'bg-card text-main shadow-sm' : 'text-muted hover:text-main'}`}>{s} Detik</button>
              ))}
            </div>
          </div>

          <hr className="border-line" />
          <div className="flex items-center justify-between">
            <div><div className="text-sm font-medium text-main">Mode Ringkas</div><div className="text-[11px] text-muted mt-0.5">Kurangi jarak antar baris tabel agar muat lebih banyak.</div></div>
            <Toggle on={draft.compact} onChange={v => set('compact', v)} />
          </div>
        </div>
        <div className="border-t border-line bg-app px-5 py-3 text-right sticky bottom-0 z-10">
          <button onClick={() => onSave(draft)} className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-text transition hover:bg-accent-hover">Simpan & Tutup</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════ AI Drawer ══════════════ */
function AIDrawer({ open, onClose, data, enriched, counts, activeCat, factionMap }: any) {
  const [msgs, setMsgs] = useState<AiMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, sending]);

  const buildContext = useCallback(() => {
    if (!data) return null;
    const factionSummary: any = {};
    for (const [id, count] of Object.entries(counts)) {
      if (id === 'SEMUA' || id === 'GOOD' || id === 'BAD' || id === 'CIVILIAN' || !count) continue;
      const f = factionMap.get(id);
      factionSummary[id] = { label: f?.label || 'Unknown', count };
    }
    return { totalOnline: data.online, maxSlots: data.max, gate: data.gate, updatedAt: data.updatedAt, currentFilter: activeCat, factions: factionSummary, players: enriched.slice(0, 150).map((p: any) => ({ kantong: p.id, nama: p.name, faction: factionMap.get(p.faction)?.label || 'Untagged', ping: p.ping })) };
  }, [data, counts, activeCat, enriched, factionMap]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const next: AiMsg[] = [...msgs, { role: 'user', content: trimmed }];
    setMsgs(next); setInput(''); setSending(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next, context: buildContext() }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal');
      setMsgs([...next, { role: 'assistant', content: json.text }]);
    } catch (e: any) { setMsgs([...next, { role: 'assistant', content: `⚠ ${e.message}` }]); } finally { setSending(false); }
  }

  const SUGGESTIONS = ['Ringkas siapa saja yang online sekarang', 'Faction apa yang paling banyak online?', 'Siapa saja polisi (LSPD/LSSD) yang online?', 'Ada berapa CC dan siapa nama mereka?', 'Player mana yang pingnya paling buruk?'];

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} />
      <aside className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-line bg-app transition-transform duration-300 sm:w-[440px] ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15"><SparkIcon className="h-4 w-4 text-accent" /></span><div><div className="text-sm font-semibold text-main">Analisis AI</div><div className="text-[11px] text-subtle">Konteks data realtime</div></div></div>
          <button onClick={onClose} className="rounded-md p-1.5 text-subtle transition hover:bg-hover hover:text-main"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {msgs.length === 0 && (<div className="space-y-3"><p className="text-sm text-muted">Tanya apa saja soal server yang lagi online. Contoh:</p><div className="flex flex-col gap-2">{SUGGESTIONS.map(s => (<button key={s} onClick={() => send(s)} className="rounded-lg border border-line bg-card px-3 py-2 text-left text-[13px] text-muted transition hover:border-accent/40 hover:bg-hover hover:text-main">{s}</button>))}</div></div>)}
          {msgs.map((m, i) => (<div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-accent text-accent-text whitespace-pre-wrap' : 'border border-line bg-card text-main'}`}>{m.role === 'user' ? m.content : renderMarkdown(m.content)}</div></div>))}
          {sending && (<div className="flex justify-start"><div className="flex gap-1 rounded-xl border border-line bg-card px-3.5 py-3"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: '0ms' }} /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: '150ms' }} /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: '300ms' }} /></div></div>)}
        </div>
        <div className="border-t border-line p-3">
          <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Tanya soal player, faction, ping…" rows={1} className="flex-1 resize-none rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-main placeholder-subtle outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/15" />
            <button type="submit" disabled={sending || !input.trim()} className="flex shrink-0 items-center justify-center rounded-lg bg-accent px-3 text-accent-text transition hover:bg-accent-hover disabled:opacity-30"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></button>
          </form>
        </div>
      </aside>
    </div>
  );
}

/* ══════════════ UI Bits & Icons ══════════════ */
function Stat({ label, value, accent, small, pulse, delta }: any) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
        )}
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className={`mt-1 truncate font-semibold ${accent} ${small ? 'text-base' : 'text-xl'}`}>{value}</div>
        {delta !== null && delta !== undefined && delta !== 0 && (
          <span className={`text-[10px] font-bold ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{delta > 0 ? `+${delta}` : delta}</span>
        )}
      </div>
    </div>
  );
}
function SearchIcon({ className }: any) { return (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>); }
function RefreshIcon({ className }: any) { return (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>); }
function SparkIcon({ className }: any) { return (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z" /></svg>); }
function GearIcon({ className }: any) { return (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>); }
function ClockIcon({ className }: any) { return (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>); }
function StarIcon({ className, filled }: any) { return (<svg className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>); }
function DownloadIcon({ className }: any) { return (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>); }
function LinkIcon({ className }: any) { return (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>); }
function BugIcon({ className }: any) { return (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>); }
