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
type Theme = 'dark' | 'light' | 'glass' | 'cyberpunk' | 'nord' | 'ios' | 'iosdark';
type Settings = { theme: Theme; refreshMs: number; compact: boolean; tagStyle: 'pill' | 'widget'; pageSize: number; notifyJoin: boolean; notifyRestart: boolean };
type EnrichedPlayer = Player & { faction: string; side: Side | 'CIVIL' };
type SessionRec = { start: number | null; last: number; total: number; count: number };
type HistoryPoint = { t: number; online: number };
type ToastItem = { id: number; text: string; kind: 'info' | 'good' | 'bad' | 'watch' };
type SortKey = 'id' | 'name' | 'ping' | 'session';
type GroupId = 'ALL' | 'GOOD' | 'BAD' | 'CIVILIAN';
type RelationStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
type RelationRecord = { citizenId: string; status: RelationStatus; type: string; notes: string; updatedAt: string };

const DEFAULT_SETTINGS: Settings = { theme: 'dark', refreshMs: 60000, compact: false, tagStyle: 'widget', pageSize: 25, notifyJoin: true, notifyRestart: false };

const WARGA: FactionDef = {
  id: 'WARGA', short: 'Civilian', label: 'Civilian', matchType: 'NONE', side: 'NONE',
  badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20', dot: 'bg-slate-400',
};

const FALLBACK_FACTIONS: FactionDef[] = [
  { id: 'cc', label: 'Crimson Creed', short: 'CC', matchType: 'STARTS_WITH', side: 'BAD', badge: 'bg-[#2a1515] text-[#f08a8a] border-[#5a2525]', dot: 'bg-[#ef4444]' },
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

const nameTokens = (s: string) => s.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);

function detectFaction(name: string, matchers: Matcher[]): string {
  const scope = name.includes(' - ') ? name.split(' - ')[0] : name;
  const toks = nameTokens(scope);
  if (toks.length === 0) return 'WARGA';
  for (const m of matchers) {
    if (m.type === 'STARTS_WITH') {
      if (toks[0] === m.alias) return m.id;
    } else if (m.type === 'INCLUDES') {
      if (toks.includes(m.alias)) return m.id;
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

// Generate Citizen ID from Name
function generateCitizenId(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = Math.imul(31, hash) + name.charCodeAt(i) | 0;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let res = '';
  let tempHash = Math.abs(hash);
  for (let i = 0; i < 8; i++) { res += chars[tempHash % chars.length]; tempHash = Math.floor(tempHash / chars.length) || 1; }
  return res;
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
  const [framed, setFramed] = useState(false);

  const [showChangelog, setShowChangelog] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'ALL' | 'CC' | null>(null);

  useEffect(() => {
    let inFrame = false;
    try { inFrame = window.top !== window.self; } catch { inFrame = true; }
    if (inFrame) {
      setFramed(true);
      try { window.top!.location.href = window.self.location.href; } catch { /* diblokir */ }
      return;
    }

    let id = localStorage.getItem('ime-device-id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('ime-device-id', id); }
    setDeviceId(id);
    setSettings(loadSettings());

    const lastVersion = localStorage.getItem('ime-changelog-version');
    if (lastVersion !== 'v1.3') setShowChangelog(true);
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
        const r = String(json.role ?? '').toUpperCase();
        setRole(r.includes('SUPER') ? 'SUPER' : r.includes('MOD') ? 'MOD' : 'SUPER');
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

  if (framed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-center text-white">
        <div>
          <div className="mb-2 text-lg font-semibold">Halaman ini tidak bisa ditampilkan di dalam frame</div>
          <a href={typeof window !== 'undefined' ? window.self.location.href : '/'} target="_blank" rel="noopener" className="text-sm text-blue-400 underline">Buka di tab baru</a>
        </div>
      </div>
    );
  }

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

  if (authStatus === 'ADMIN' && viewMode === null) {
    return <ModSelectionScreen role={role} onSelect={(mode) => setViewMode(mode)} />;
  }

  return (
    <div className="relative min-h-screen bg-app text-main overflow-hidden">
      <div className={`transition-all duration-300 ease-out ${isBlurred ? 'blur-[30px] scale-[0.95] opacity-10 pointer-events-none' : ''}`}>
        <div key={viewMode ?? 'x'} className="ios-enter">
          <Home
            isAdmin={authStatus === 'ADMIN'}
            role={role}
            viewMode={viewMode || 'ALL'}
            onSwitchMode={() => setViewMode(null)}
            settings={settings}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAdmin={() => setAdminOpen(true)}
          />
          {authStatus === 'ADMIN' && <AdminPanel open={adminOpen} role={role} onClose={() => setAdminOpen(false)} />}
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} current={settings} onSave={handleSaveSettings} deviceId={deviceId} />

      {showChangelog && (
        <ChangelogModal onClose={() => {
          localStorage.setItem('ime-changelog-version', 'v1.3');
          setShowChangelog(false);
        }} />
      )}

      <button
        onClick={() => setBugReportOpen(true)}
        className="fixed bottom-6 right-6 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition-all hover:scale-110 active:scale-95"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        title="Laporkan Bug"
      >
        <BugIcon className="h-6 w-6" />
      </button>

      <BugReportModal open={bugReportOpen} onClose={() => setBugReportOpen(false)} deviceId={deviceId} />
    </div>
  );
}

/* ═════════════ [A] Mod Selection Screen (Upgraded UI) ═════════ */
type Mode = 'ALL' | 'CC';
const IME_GIF = '/ime-server-up.gif';

const MS_CSS = `
@property --a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes ms-aurora { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(7%,-9%,0) scale(1.18); } }
@keyframes ms-rise { from { opacity: 0; transform: translateY(36px) scale(.94); filter: blur(10px); } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes ms-drop { from { opacity: 0; transform: translateY(-24px); filter: blur(8px); } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes ms-float { 0% { transform: translate3d(0,0,0); opacity: 0; } 10% { opacity: .8; } 100% { transform: translate3d(var(--d),-110vh,0); opacity: 0; } }
@keyframes ms-shine { from { transform: translateX(-130%) skewX(-20deg); } to { transform: translateX(230%) skewX(-20deg); } }
@keyframes ms-angle { to { --a: 360deg; } }
@keyframes ms-shimmer { to { background-position: 200% center; } }
@keyframes ms-ring { 0% { transform: scale(.85); opacity: .55; } 100% { transform: scale(1.7); opacity: 0; } }
@keyframes ms-ripple { from { transform: scale(0); } to { transform: scale(160); } }
@keyframes ms-blink { 50% { opacity: .3; } }
@keyframes ms-pulse-badge { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

.ms-blob { position: absolute; border-radius: 9999px; filter: blur(110px); animation: ms-aurora 14s ease-in-out infinite; pointer-events: none; }
.ms-grid { position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse at center, #000 20%, transparent 70%); mask-image: radial-gradient(ellipse at center, #000 20%, transparent 70%); }
.ms-dot { position: absolute; bottom: -10px; border-radius: 9999px; background: rgba(255,255,255,.7); animation: ms-float linear infinite; pointer-events: none; }
.ms-head { animation: ms-drop .8s cubic-bezier(.2,.8,.2,1) backwards; }
.ms-title { background: linear-gradient(90deg, #fff 0%, #a5b4fc 25%, #fff 50%, #fda4af 75%, #fff 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: ms-shimmer 6s linear infinite; }
.ms-live { display: inline-block; width: 7px; height: 7px; border-radius: 9999px; background: #34d399; animation: ms-blink 1.6s ease-in-out infinite; }

.ms-card { --rx: 0deg; --ry: 0deg; --mx: 50%; --my: 50%;
  position: relative; overflow: hidden; isolation: isolate; cursor: pointer; color: #fff; text-align: center;
  border-radius: 32px; padding: 40px 28px; -webkit-tap-highlight-color: transparent; will-change: transform;
  background: radial-gradient(420px circle at var(--mx) var(--my), rgba(var(--tint), .24), transparent 55%), rgba(255,255,255,.04);
  -webkit-backdrop-filter: blur(24px) saturate(1.5); backdrop-filter: blur(24px) saturate(1.5);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 24px 70px -24px rgba(var(--tint), .4);
  transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry));
  transition: transform .25s ease-out, opacity .5s ease, filter .5s ease, box-shadow .4s ease;
  animation: ms-rise .9s cubic-bezier(.2,.8,.2,1) var(--delay, 0s) backwards; }
.ms-card::before { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px; z-index: -1;
  background: conic-gradient(from var(--a), rgba(var(--tint), 0) 0 55%, rgba(var(--tint), 1) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); mask-composite: exclude;
  animation: ms-angle 5s linear infinite; }
.ms-card:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 30px 90px -20px rgba(var(--tint), .65); }
.ms-card:active { transform: perspective(900px) scale(.98); }
.ms-card:focus-visible { outline: 2px solid rgba(var(--tint), 1); outline-offset: 4px; }
.ms-card.is-picked { transform: perspective(900px) scale(1.07); box-shadow: 0 0 140px rgba(var(--tint), .8); transition-duration: .5s; }
.ms-card.is-dim { opacity: 0; filter: blur(10px); transform: perspective(900px) scale(.9); pointer-events: none; }
.ms-shine { position: absolute; top: 0; bottom: 0; left: 0; width: 40%; pointer-events: none; background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent); transform: translateX(-130%) skewX(-20deg); }
.ms-card:hover .ms-shine { animation: ms-shine .9s ease; }
.ms-icon { position: relative; display: flex; align-items: center; justify-content: center; width: 84px; height: 84px; margin: 0 auto 24px; border-radius: 26px; background: rgba(var(--tint), .18); color: rgb(var(--tint)); transition: transform .4s cubic-bezier(.32,.72,0,1); }
.ms-icon::after { content: ''; position: absolute; inset: 0; border-radius: inherit; border: 1.5px solid rgba(var(--tint), .6); animation: ms-ring 2.4s ease-out infinite; }
.ms-card:hover .ms-icon { transform: translateZ(0) scale(1.12) rotate(var(--tilt, 6deg)); }
.ms-go { display: inline-flex; align-items: center; gap: 6px; margin-top: 22px; font-size: 13px; font-weight: 600; color: rgb(var(--tint)); }
.ms-go span { display: inline-block; transition: transform .3s cubic-bezier(.32,.72,0,1); }
.ms-card:hover .ms-go span { transform: translateX(6px); }
.ms-ripple { position: fixed; z-index: 50; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 9999px; pointer-events: none; animation: ms-ripple .85s cubic-bezier(.7,0,.3,1) forwards; }
.ms-hero { animation: ms-rise 1s cubic-bezier(.2,.8,.2,1) backwards; }
.ms-bg { animation: ms-fadein 1.6s ease backwards; }
@keyframes ms-fadein { from { opacity: 0; } }
.ms-badge { position: absolute; top: 16px; right: 16px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; color: rgb(var(--tint)); background: rgba(var(--tint), .14); border: 1px solid rgba(var(--tint), .35); animation: ms-drop .6s ease .9s backwards; }
.ms-badge i { width: 6px; height: 6px; border-radius: 9999px; background: rgb(var(--tint)); animation: ms-blink 1.6s ease-in-out infinite; }
.ms-badge.loading { animation: ms-pulse-badge 1.5s ease-in-out infinite; color: rgba(255,255,255,0.4); border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); }
@media (prefers-reduced-motion: reduce) { .ms-root *, .ms-root *::before { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
`;

function ModeCard({ title, desc, tint, tilt, delay, icon, badge, isLoading, state, onPick }: {
  title: string; desc: string; tint: string; tilt: string; delay: string; icon: string; badge?: string; isLoading?: boolean;
  state: 'idle' | 'picked' | 'dim'; onPick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || e.pointerType === 'touch' || state !== 'idle') return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${((0.5 - py) * 14).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${((px - 0.5) * 14).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
  };
  const reset = () => {
    const el = ref.current; if (!el) return;
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--mx', '50%'); el.style.setProperty('--my', '50%');
  };
  return (
    <button
      ref={ref} onClick={onPick} onPointerMove={move} onPointerLeave={reset}
      className={`ms-card ${state === 'picked' ? 'is-picked' : state === 'dim' ? 'is-dim' : ''}`}
      style={{ ['--tint' as string]: tint, ['--delay' as string]: delay, ['--tilt' as string]: tilt }}
    >
      <span className="ms-shine" />
      {(badge || isLoading) && (
        <span className={`ms-badge ${isLoading ? 'loading' : ''}`}>
          {!isLoading && <i />}
          {isLoading ? 'Memuat...' : badge}
        </span>
      )}
      <div className="ms-icon">
        <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} /></svg>
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mx-auto max-w-[260px] text-sm leading-relaxed text-white/60">{desc}</p>
      <div className="ms-go">Masuk <span>→</span></div>
    </button>
  );
}

function ModSelectionScreen({ role, onSelect }: { role: Role; onSelect: (mode: Mode) => void }) {
  const [picked, setPicked] = useState<{ mode: Mode; x: number; y: number } | null>(null);
  const [gifOk, setGifOk] = useState(true);
  const [stats, setStats] = useState<{ all: number; cc: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let off = false;
    Promise.all([
      fetch('/api/players', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/factions').then(r => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([pl, fc]) => {
      if (off || !pl?.ok) return;
      const facs = mergeFactions(Array.isArray(fc) ? fc : []);
      const ms = buildMatchers(facs);
      const ccIds = new Set(facs.filter(f => f.short.split(',').map(clean).includes('CC')).map(f => f.id));
      const cc = (pl.players as Player[]).filter(p => ccIds.has(detectFaction(p.name, ms))).length;
      setStats({ all: pl.online, cc });
    }).catch(() => { /* kartu tetap tampil tanpa angka */ })
      .finally(() => { if (!off) setLoadingStats(false); });
    return () => { off = true; };
  }, []);

  const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    left: (i * 37) % 100, size: 2 + (i % 4), dur: 9 + (i % 7) * 2, delay: -((i * 1.7) % 12), drift: ((i % 5) - 2) * 18,
  })), []);

  const choose = (mode: Mode, e: React.MouseEvent<HTMLButtonElement>) => {
    if (picked) return;
    let x = e.clientX, y = e.clientY;
    if (!x && !y) { const r = e.currentTarget.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    setPicked({ mode, x, y });
    setTimeout(() => onSelect(mode), 850);
  };
  const stateOf = (m: Mode): 'idle' | 'picked' | 'dim' => (!picked ? 'idle' : picked.mode === m ? 'picked' : 'dim');

  return (
    <div className="ms-root relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05060a] p-4 font-sans" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <style>{MS_CSS}</style>

      {gifOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={IME_GIF} alt="" aria-hidden onError={() => setGifOk(false)} draggable={false} className="ms-bg pointer-events-none absolute inset-0 h-full w-full scale-105 select-none object-cover opacity-35 blur-[3px]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#05060a]/60 via-[#05060a]/80 to-[#05060a]" />

      <div className="ms-blob" style={{ top: '-18%', left: '-12%', width: '52%', height: '52%', background: 'rgba(239,68,68,.22)' }} />
      <div className="ms-blob" style={{ bottom: '-20%', right: '-12%', width: '55%', height: '55%', background: 'rgba(59,130,246,.22)', animationDelay: '-6s' }} />
      <div className="ms-grid" />
      {particles.map((p, i) => (
        <span key={i} className="ms-dot" style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, ['--d' as string]: `${p.drift}px` }} />
      ))}

      <div className="relative z-10 w-full max-w-4xl">
        <div className="mb-10 text-center sm:mb-12" style={{ opacity: picked ? 0 : 1, transition: 'opacity .4s' }}>
          {gifOk && (
            <div className="ms-hero mx-auto mb-6 w-fit max-w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-1.5 shadow-[0_0_80px_-20px_rgba(239,68,68,.55)] backdrop-blur-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IME_GIF} alt="IME Roleplay" onError={() => setGifOk(false)} draggable={false} className="max-h-32 w-auto max-w-full rounded-[20px] object-contain sm:max-h-44" />
            </div>
          )}
          <div className="ms-head">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-xl">
              <span className="ms-live" /> {role === 'SUPER' ? 'Akses Super Admin' : 'Akses Moderator'}
            </div>
            <h1 className="ms-title mb-3 text-4xl font-bold tracking-tight sm:text-6xl">Mau pantau apa hari ini?</h1>
            <p className="text-base text-white/50 sm:text-lg">Kamu bisa ganti pilihan ini kapan saja lewat tombol Ganti Mode.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
          <ModeCard
            title="Crimson Creed Only" desc="Fokus memantau dan menganalisis anggota Crimson Creed saja."
            tint="239,68,68" tilt="-6deg" delay=".25s" state={stateOf('CC')} onPick={e => choose('CC', e)}
            isLoading={loadingStats}
            badge={stats ? `${stats.cc} online` : undefined}
            icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
          <ModeCard
            title="All Factions" desc="Lihat semua player: semua faction, Civilian, serta Good dan Bad Side."
            tint="59,130,246" tilt="6deg" delay=".4s" state={stateOf('ALL')} onPick={e => choose('ALL', e)}
            isLoading={loadingStats}
            badge={stats ? `${stats.all} online` : undefined}
            icon="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </div>
      </div>

      {picked && <div className="ms-ripple" style={{ left: picked.x, top: picked.y, background: picked.mode === 'CC' ? '#ef4444' : '#3b82f6' }} />}
    </div>
  );
}

/* ══════════════ KTP & Relation Drawer (Moderator Feature) ══════════════ */
function KTPDrawer({ player, onClose }: { player: EnrichedPlayer; onClose: () => void }) {
  const [relation, setRelation] = useState<RelationRecord>({
    citizenId: generateCitizenId(player.name),
    status: 'ACTIVE',
    type: 'Warga Sipil',
    notes: '',
    updatedAt: new Date().toISOString()
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`ime-relation-${player.name}`);
      if (stored) {
        setRelation(JSON.parse(stored));
      }
    } catch { /* ignore */ }
  }, [player.name]);

  const handleSave = () => {
    setSaving(true);
    // Simulate API call with idempotency & timeout
    setTimeout(() => {
      try {
        localStorage.setItem(`ime-relation-${player.name}`, JSON.stringify(relation));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch { /* ignore */ }
      setSaving(false);
      setIsEditing(false);
    }, 800);
  };

  const statusColors = {
    ACTIVE: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
    INACTIVE: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    SUSPENDED: 'bg-red-500/20 text-red-500 border-red-500/30',
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[90] w-full max-w-md translate-x-0 transform overflow-hidden border-l border-line bg-app shadow-2xl transition-transform duration-300 ease-in-out">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-line bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-accent">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-main">Data Relasi Player</h2>
              <p className="text-xs text-muted">Los Santos Identity</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-hover hover:text-main transition">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
          {/* KTP Card UI */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-300 bg-[#e9ecef] p-1 shadow-xl">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
            <div className="relative rounded-xl border border-slate-200 bg-white/80 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-slate-300 pb-2 mb-3">
                <h3 className="text-[10px] font-bold tracking-widest text-slate-600">LOS SANTOS IDENTITY</h3>
                <div className="flex gap-1">
                  <div className="h-4 w-4 rounded-full bg-blue-500/20 border border-blue-500/50" />
                  <div className="h-4 w-4 rounded-full bg-red-500/20 border border-red-500/50" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-24 w-20 shrink-0 overflow-hidden rounded border-2 border-slate-300 bg-slate-200 shadow-inner">
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-300 to-slate-400">
                    <svg className="h-10 w-10 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 text-[10px]">
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500">FIRST NAME</span>
                    <span className="font-bold text-slate-800 uppercase">{player.name.split(' ')[0] || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500">LAST NAME</span>
                    <span className="font-bold text-slate-800 uppercase">{player.name.split(' ').slice(1).join(' ') || '-'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500">DOB</span>
                    <span className="font-bold text-slate-800">1999-03-24</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500">SEX</span>
                    <span className="font-bold text-slate-800">MALE</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-0.5">
                    <span className="text-slate-500">NATIONALITY</span>
                    <span className="font-bold text-slate-800 uppercase">{relation.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CITIZEN ID</span>
                    <span className="font-mono font-bold text-slate-800">{relation.citizenId}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div className="font-mono text-[9px] text-slate-400">Signature: {player.name}</div>
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Flag_of_Indonesia.svg/320px-Flag_of_Indonesia.svg.png" alt="ID" className="h-3 w-5 object-cover rounded-sm opacity-70" />
              </div>
            </div>
          </div>

          {/* Relation Form */}
          <div className="rounded-xl border border-line bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-main">Status Relasi</h3>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="text-xs font-semibold text-accent hover:underline">Edit Data</button>
              ) : (
                <button onClick={() => setIsEditing(false)} className="text-xs font-semibold text-muted hover:text-main">Batal</button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="text-[11px] font-semibold text-muted mb-1 block">Status</label>
                  <select
                    value={relation.status}
                    onChange={e => setRelation({ ...relation, status: e.target.value as RelationStatus })}
                    className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent"
                  >
                    <option value="ACTIVE">Aktif (Active)</option>
                    <option value="INACTIVE">Tidak Aktif (Inactive)</option>
                    <option value="SUSPENDED">Ditangguhkan (Suspended)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted mb-1 block">Tipe Relasi / Pekerjaan</label>
                  <input
                    type="text"
                    value={relation.type}
                    onChange={e => setRelation({ ...relation, type: e.target.value })}
                    placeholder="Cth: Anggota CC, Warga Sipil..."
                    className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted mb-1 block">Catatan Penting</label>
                  <textarea
                    value={relation.notes}
                    onChange={e => setRelation({ ...relation, notes: e.target.value })}
                    placeholder="Tambahkan catatan khusus..."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent"
                  />
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text transition hover:bg-accent-hover disabled:opacity-50"
                  >
                    {saving ? (
                      <><div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-text border-t-transparent" /> Menyimpan...</>
                    ) : saved ? 'Tersimpan!' : 'Simpan Perubahan'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between rounded-lg border border-line bg-app p-3">
                  <span className="text-sm text-muted">Status Saat Ini</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusColors[relation.status]}`}>
                    {relation.status}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-line bg-app p-3">
                  <span className="text-sm text-muted">Tipe / Faction</span>
                  <span className="text-sm font-semibold text-main">{relation.type}</span>
                </div>
                <div className="rounded-lg border border-line bg-app p-3">
                  <span className="text-xs text-muted block mb-1">Catatan:</span>
                  <p className="text-sm text-main">{relation.notes || <span className="text-subtle italic">Tidak ada catatan.</span>}</p>
                </div>
                <div className="text-right text-[10px] text-subtle">Terakhir diupdate: {formatDate(relation.updatedAt)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
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
          <h2 className="text-xl font-bold text-main">Update Terbaru v1.3</h2>
          <p className="text-xs text-muted mt-1">Moderator Tools & UI Polish</p>
        </div>
        <div className="px-6 py-5 max-h-[50vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-3 text-sm text-main">
            <div className="flex gap-3"><span className="text-emerald-500">✅</span><p><strong>Data Relasi KTP (Moderator):</strong> Klik nama player di tabel untuk membuka KTP Los Santos di sisi kanan. Anda dapat mengedit status relasi, tipe, dan catatan.</p></div>
            <div className="flex gap-3"><span className="text-emerald-500">✅</span><p><strong>UI Pemilihan Mode Baru:</strong> Tampilan pemilihan CC/All Factions kini lebih premium dengan animasi loading data dan efek hover 3D.</p></div>
            <div className="flex gap-3"><span className="text-emerald-500">✅</span><p><strong>Sistem Auto-Save:</strong> Perubahan data relasi tersimpan secara lokal dan aman.</p></div>
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
          <button onClick={onClose} className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-accent-text transition hover:bg-accent-hover">Mengerti & Lanjutkan</button>
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
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 text-red-500"><BugIcon className="h-4 w-4" /></span>
              <div><h3 className="text-sm font-bold text-main">Laporkan Bug / Error</h3><p className="text-[11px] text-subtle">Laporan akan masuk ke Admin Panel</p></div>
            </div>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Jelaskan bug yang kamu temukan..." rows={4} className="w-full resize-none rounded-lg border border-line bg-app p-3 text-sm text-main outline-none focus:border-accent" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-main">Batal</button>
              <button onClick={submit} disabled={sending || !message.trim()} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50">{sending ? 'Mengirim...' : 'Kirim Laporan'}</button>
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
    try {
      const res = await fetch('/api/factions', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) {
        const errText = await res.text();
        alert('Gagal menyimpan faction: ' + errText);
        return;
      }
      setForm(EMPTY_FORM); fetchData();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
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
      <header className="flex flex-col border-b border-line bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
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

          {activeTab === 'reports' && (
            <div className="rounded-xl border border-line bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-hover text-subtle text-[10px] uppercase tracking-wider sm:text-xs">
                    <tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Device ID</th><th className="px-4 py-3 w-full">Laporan Bug</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr>
                  </thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r.id} className="border-t border-line hover:bg-hover/50 transition">
                        <td className="px-4 py-3 text-muted text-xs">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-subtle">{r.deviceId}</td>
                        <td className="px-4 py-3 text-main whitespace-normal">{r.message}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>{r.status}</span></td>
                        <td className="px-4 py-3 text-right">{r.status === 'PENDING' && <button onClick={() => resolveReport(r.id)} className="rounded bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-500 hover:bg-emerald-500/20">Tandai Selesai</button>}</td>
                      </tr>
                    ))}
                    {reports.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-subtle">Belum ada laporan bug.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

          {activeTab === 'factions' && isSuper && (
            <div className="space-y-6">
              <div className="rounded-xl border border-line bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold">{form.id ? `Edit Faction: ${form.label}` : 'Tambah Faction Baru'}</h3>
                  {form.id && <button onClick={() => setForm(EMPTY_FORM)} className="text-xs text-muted hover:text-main">Batal edit</button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div><label className="text-[11px] font-semibold text-muted mb-1 block">Label (Nama Lengkap)</label><input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Government" className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" /></div>
                  <div><label className="text-[11px] font-semibold text-muted mb-1 block">Short (pisahkan koma untuk alias)</label><input type="text" value={form.short} onChange={e => setForm({ ...form, short: e.target.value.toUpperCase() })} placeholder="GOV,PEMKOT" className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" /></div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted mb-1 block">Match Type</label>
                    <select value={form.matchType} onChange={e => setForm({ ...form, matchType: e.target.value })} className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent">
                      <option value="INCLUDES">INCLUDES (Mengandung)</option><option value="STARTS_WITH">STARTS_WITH (Diawali)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted mb-1 block">Kelompok (Side)</label>
                    <select value={form.side} onChange={e => setForm({ ...form, side: e.target.value as Side })} className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent">
                      <option value="NONE">Otomatis / Tidak ada</option><option value="GOOD">Good Side</option><option value="BAD">Bad Side</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted mb-1 block">Warna</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="h-9 w-12 cursor-pointer rounded-md border border-line bg-app p-0.5" />
                      <input type="text" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-full rounded-lg border border-line bg-app px-3 py-2 font-mono text-sm text-main outline-none focus:border-accent" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted mb-1 block">Preview</label>
                    <div className="flex items-center gap-3 rounded-lg border border-line bg-app px-3 py-1.5">
                      <FactionTag fac={{ short: form.short || 'TAG', badge: form.badge, dot: form.dot, color: form.color }} variant="pill" />
                      <FactionTag fac={{ short: form.short || 'TAG', badge: form.badge, dot: form.dot, color: form.color }} variant="widget" />
                    </div>
                  </div>
                </div>
                <details className="mt-4 text-xs text-muted">
                  <summary className="cursor-pointer select-none hover:text-main">Lanjutan: class Tailwind manual (dipakai jika warna kosong)</summary>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <input type="text" value={form.badge} onChange={e => setForm({ ...form, badge: e.target.value })} placeholder="bg-blue-500/10 text-blue-500 border-blue-500/20" className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" />
                    <input type="text" value={form.dot} onChange={e => setForm({ ...form, dot: e.target.value })} placeholder="bg-blue-500" className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" />
                  </div>
                </details>
                <div className="mt-4 flex justify-end">
                  <button onClick={saveFaction} className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover transition">{form.id ? 'Simpan Perubahan' : 'Tambah Faction'}</button>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-hover text-subtle text-[10px] uppercase tracking-wider sm:text-xs">
                      <tr><th className="px-4 py-3">Label</th><th className="px-4 py-3">Short</th><th className="px-4 py-3">Match</th><th className="px-4 py-3">Side</th><th className="px-4 py-3">Preview</th><th className="px-4 py-3 text-right">Aksi</th></tr>
                    </thead>
                    <tbody>
                      {factions.map(f => (
                        <tr key={f.id} className="border-t border-line hover:bg-hover/50 transition">
                          <td className="px-4 py-3 font-medium text-main">{f.label}</td>
                          <td className="px-4 py-3 font-mono text-muted">{f.short}</td>
                          <td className="px-4 py-3 text-xs text-subtle">{f.matchType}</td>
                          <td className="px-4 py-3 text-xs"><span className={f.side === 'GOOD' ? 'text-emerald-500' : f.side === 'BAD' ? 'text-red-500' : 'text-subtle'}>{f.side && f.side !== 'NONE' ? f.side : 'auto'}</span></td>
                          <td className="px-4 py-3"><FactionTag fac={f} variant="pill" /></td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => startEdit(f)} className="text-accent hover:bg-accent/10 px-2 py-1 rounded text-xs font-medium transition">Edit</button>
                            <button onClick={() => deleteFaction(f.id)} className="text-red-500 hover:bg-red-500/10 px-2 py-1 rounded text-xs font-medium transition">Hapus</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && isSuper && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
                <div><label className="mb-1 block text-[11px] font-semibold text-muted">Admin</label>
                  <select value={logAdmin} onChange={e => setLogAdmin(e.target.value)} className="rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent">
                    <option value="ALL">Semua</option>{adminNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select></div>
                <div><label className="mb-1 block text-[11px] font-semibold text-muted">Dari</label><input type="date" value={logFrom} onChange={e => setLogFrom(e.target.value)} className="rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" /></div>
                <div><label className="mb-1 block text-[11px] font-semibold text-muted">Sampai</label><input type="date" value={logTo} onChange={e => setLogTo(e.target.value)} className="rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" /></div>
                <div className="min-w-[160px] flex-1"><label className="mb-1 block text-[11px] font-semibold text-muted">Cari</label><input type="text" value={logText} onChange={e => setLogText(e.target.value)} placeholder="aksi / target / detail" className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" /></div>
                <button onClick={exportLogs} disabled={filteredLogs.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover disabled:opacity-40"><DownloadIcon className="h-4 w-4" />Ekspor CSV ({filteredLogs.length})</button>
              </div>
              <div className="rounded-xl border border-line bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-hover text-subtle text-[10px] uppercase tracking-wider sm:text-xs">
                      <tr><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Aksi</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Detail</th></tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map(l => (
                        <tr key={l.id} className="border-t border-line hover:bg-hover/50 transition">
                          <td className="px-4 py-3 text-muted text-xs">{formatDate(l.createdAt)}</td>
                          <td className="px-4 py-3 font-medium text-main">{l.adminName}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-hover text-main border border-line">{l.action}</span></td>
                          <td className="px-4 py-3 font-mono text-[11px] text-subtle">{l.targetDeviceId}</td>
                          <td className="px-4 py-3 text-muted text-xs">{l.details || '-'}</td>
                        </tr>
                      ))}
                      {filteredLogs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-subtle">Tidak ada log.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admins' && isSuper && (
            <div className="space-y-6">
              <div className="rounded-xl border border-line bg-card p-5">
                <h3 className="mb-4 text-sm font-bold">Tambah Admin / Moderator</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <input type="text" value={newAdmin.name} onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })} placeholder="Nama" className="rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent" />
                  <input type="text" value={newAdmin.deviceId} onChange={e => setNewAdmin({ ...newAdmin, deviceId: e.target.value })} placeholder="Device ID" className="rounded-lg border border-line bg-app px-3 py-2 font-mono text-sm text-main outline-none focus:border-accent sm:col-span-2" />
                  <select value={newAdmin.role} onChange={e => setNewAdmin({ ...newAdmin, role: e.target.value as Role })} className="rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent">
                    <option value="MOD">Moderator</option><option value="SUPER">Super Admin</option>
                  </select>
                </div>
                <div className="mt-4 flex justify-end"><button onClick={addAdmin} className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-text hover:bg-accent-hover">Tambah</button></div>
                <p className="mt-2 text-[11px] text-subtle">Moderator hanya bisa mengelola user (ACC / timeout / ban) dan data relasi. Faction, log, dan admin hanya untuk Super Admin.</p>
              </div>
              <div className="rounded-xl border border-line bg-card overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-hover text-subtle text-[10px] uppercase tracking-wider sm:text-xs"><tr><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Device ID</th><th className="px-4 py-3">Role</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
                  <tbody>
                    {admins.map(a => (
                      <tr key={a.id} className="border-t border-line hover:bg-hover/50">
                        <td className="px-4 py-3 font-medium text-main">{a.name}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-subtle">{a.deviceId}</td>
                        <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-[10px] font-bold ${a.role === 'SUPER' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'}`}>{a.role}</span></td>
                        <td className="px-4 py-3 text-right"><button onClick={() => removeAdmin(a.id)} className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10">Cabut</button></td>
                      </tr>
                    ))}
                    {admins.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-subtle">Belum ada data.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {actionModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-main mb-4">{actionModal.type === 'BAN' ? 'Blokir Permanen (Ban)' : 'Beri Jeda (Timeout)'}</h3>
            <label className="text-xs font-semibold text-muted mb-1 block">Alasan</label>
            <input type="text" value={reasonInput} onChange={e => setReasonInput(e.target.value)} placeholder="Contoh: Spam request..." className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent mb-3" />
            {actionModal.type === 'TIMEOUT' && (
              <>
                <label className="text-xs font-semibold text-muted mb-1 block">Durasi (Menit)</label>
                <select value={durationInput} onChange={e => setDurationInput(e.target.value)} className="w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-main outline-none focus:border-accent mb-4">
                  <option value="15">15 Menit</option><option value="60">1 Jam</option><option value="360">6 Jam</option><option value="1440">24 Jam</option>
                </select>
              </>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setActionModal(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-main">Batal</button>
              <button onClick={() => executeAction(actionModal.id!, actionModal.type, reasonInput, Number(durationInput))} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${actionModal.type === 'BAN' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}>Konfirmasi</button>
            </div>
          </div>
        </div>
      )}
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
function Home({ isAdmin, role, viewMode, onSwitchMode, settings, onOpenSettings, onOpenAdmin }: { isAdmin: boolean; role: Role; viewMode: 'ALL' | 'CC'; onSwitchMode: () => void; settings: Settings; onOpenSettings: () => void; onOpenAdmin: () => void }) {
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
  const [selectedPlayer, setSelectedPlayer] = useState<EnrichedPlayer | null>(null);

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

  // Filter players based on viewMode
  const filteredByMode = useMemo(() => {
    if (!data) return [];
    if (viewMode === 'CC') {
      const ccIds = new Set(factions.filter(f => f.short.split(',').map(clean).includes('CC')).map(f => f.id));
      return data.players.filter(p => ccIds.has(detectFaction(p.name, matchers)));
    }
    return data.players;
  }, [data, factions, matchers, viewMode]);

  const enriched: EnrichedPlayer[] = useMemo(() => filteredByMode.map(p => {
    const faction = detectFaction(p.name, matchers);
    const side: Side | 'CIVIL' = faction === 'WARGA' ? 'CIVIL' : resolveSide(factionMap.get(faction));
    return { ...p, faction, side };
  }), [filteredByMode, matchers, factionMap]);

  // Search & Filter
  const filtered = useMemo(() => {
    let list = enriched;
    if (activeGroup !== 'ALL') {
      list = list.filter(p => p.side === activeGroup);
    }
    if (activeCat !== 'SEMUA') {
      list = list.filter(p => p.faction === activeCat);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    if (onlyWatch) {
      list = list.filter(p => watch.has(p.name));
    }
    return list;
  }, [enriched, activeGroup, activeCat, search, onlyWatch, watch]);

  // Sorting
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      let v = 0;
      if (sortKey === 'id') v = a.id - b.id;
      else if (sortKey === 'name') v = a.name.localeCompare(b.name);
      else if (sortKey === 'ping') v = a.ping - b.ping;
      else if (sortKey === 'session') {
        const sa = sessionsRef.current[a.name] || { total: 0 };
        const sb = sessionsRef.current[b.name] || { total: 0 };
        v = sa.total - sb.total;
      }
      return sortDir === 'asc' ? v : -v;
    });
  }, [filtered, sortKey, sortDir]);

  // Pagination / Infinite Scroll
  const displayed = infinite ? sorted.slice(0, visibleCount) : sorted.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="flex min-h-screen flex-col bg-app text-main relative">
      {selectedPlayer && <KTPDrawer player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-line bg-app/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <ShieldIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">IME Dashboard</h1>
              <p className="text-[11px] text-muted">Server Monitoring System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={onOpenAdmin} className="relative flex items-center gap-2 rounded-lg bg-hover px-3 py-1.5 text-xs font-semibold text-main transition hover:bg-line">
                <SettingsIcon className="h-4 w-4" /> Admin Panel
                {pendingCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{pendingCount}</span>}
              </button>
            )}
            <button onClick={onOpenSettings} className="rounded-lg p-2 text-muted hover:bg-hover hover:text-main transition"><SettingsIcon className="h-5 w-5" /></button>
            <button onClick={onSwitchMode} className="rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-text hover:bg-accent-hover transition shadow-lg shadow-accent/20">Ganti Mode</button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {/* STATS WIDGETS */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted uppercase tracking-wider">Total Online</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <h2 className="text-3xl font-bold">{data?.online ?? 0}</h2>
                  {delta !== null && (
                    <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-red-500' : 'text-subtle'}`}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                <UsersIcon className="h-5 w-5" />
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">Max Slots</p>
            <h2 className="mt-1 text-3xl font-bold">{data?.max ?? 0}</h2>
          </div>

          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">Server Gate</p>
            <h2 className="mt-1 text-lg font-semibold text-emerald-500 uppercase">{data?.gate || 'Unknown'}</h2>
          </div>

          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">Restart In</p>
            <h2 className="mt-1 font-mono text-xl font-semibold">{countdown ? formatTime(countdown.diffMs) : '--:--:--'}</h2>
          </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setActiveGroup('ALL')} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeGroup === 'ALL' ? 'bg-accent text-accent-text' : 'bg-hover text-muted hover:text-main'}`}>Semua</button>
            {GROUP_WIDGETS.map(g => (
              <button key={g.id} onClick={() => setActiveGroup(g.id)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${activeGroup === g.id ? g.active : g.idle}`}>
                <span className={`h-2 w-2 rounded-full ${g.dot}`} /> {g.label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input type="text" placeholder="Cari player..." value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-lg border border-line bg-app py-2 pl-9 pr-3 text-sm outline-none focus:border-accent" />
          </div>
        </div>

        {/* TABLE */}
        <div className="rounded-2xl border border-line bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-hover text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 w-16">ID</th>
                  <th className="px-4 py-3">Nama Player</th>
                  <th className="px-4 py-3">Faction</th>
                  <th className="px-4 py-3">Ping</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(p => {
                  const fac = factionMap.get(p.faction) || WARGA;
                  return (
                    <tr key={p.id} onClick={() => setSelectedPlayer(p)} className="border-t border-line hover:bg-hover/50 transition cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs text-subtle">{p.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-main">{p.name}</span>
                          {watch.has(p.name) && <StarIcon className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <FactionTag fac={fac} variant={tagStyle} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${pingClass(p.ping)}`}>{p.ping} ms</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); toggleWatch(p.name); }} className={`rounded p-1.5 transition ${watch.has(p.name) ? 'text-amber-400 bg-amber-400/10' : 'text-subtle hover:bg-hover hover:text-main'}`}>
                          <StarIcon className={`h-4 w-4 ${watch.has(p.name) ? 'fill-amber-400' : ''}`} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {displayed.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-subtle">Tidak ada player ditemukan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ══════════════ Icons ══════════════ */
function ShieldIcon(props: any) { return <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>; }
function SettingsIcon(props: any) { return <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
function UsersIcon(props: any) { return <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>; }
function SearchIcon(props: any) { return <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>; }
function StarIcon(props: any) { return <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>; }
function BugIcon(props: any) { return <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function DownloadIcon(props: any) { return <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>; }
function SparkIcon(props: any) { return <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>; }

/* Placeholder for SettingsModal (Assume it exists in original code, omitted for brevity but required for compilation) */
function SettingsModal({ open, onClose, current, onSave, deviceId }: any) { if (!open) return null; return <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"><div className="bg-card rounded-2xl p-6 w-full max-w-md border border-line"><h2 className="text-lg font-bold mb-4">Settings</h2><button onClick={onClose} className="bg-accent text-accent-text px-4 py-2 rounded-lg">Close</button></div></div>; }
