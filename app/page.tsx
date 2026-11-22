'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';

/* ══════════════ Types ══════════════ */
type Player = { id: number; name: string; ping: number };
type AiMsg = { role: 'user' | 'assistant'; content: string };
type ApiData = { ok: boolean; gate: string; online: number; max: number; players: Player[]; updatedAt: string; error?: string };
type AuthStatus = 'LOADING' | 'UNAUTHORIZED' | 'PENDING' | 'APPROVED' | 'ADMIN' | 'BANNED' | 'TIMEOUT';
type Role = 'SUPER' | 'MOD';
type AccessRequest = { id: string; ipAddress: string; deviceId: string; status: string; timeoutUntil: string | null; reason: string | null; lastActive: string; createdAt: string; updatedAt: string };
type AuditLog = { id: string; adminName: string; action: string; targetDeviceId: string; details: string; createdAt: string };
type AdminUser = { id: string; deviceId: string; name: string; role: Role };
type BugReport = { id: string; deviceId: string; message: string; status: string; createdAt: string };
type Side = 'GOOD' | 'BAD' | 'NONE';
type FactionDef = { id: string; label: string; short: string; matchType: string; side?: Side; color?: string | null; badge: string; dot: string };
type Theme = 'dark' | 'light' | 'glass' | 'cyberpunk' | 'nord' | 'ios' | 'iosdark';
type Settings = { theme: Theme; refreshMs: number; compact: boolean; tagStyle: 'pill' | 'widget'; pageSize: number; notifyJoin: boolean; notifyRestart: boolean };
type EnrichedPlayer = Player & { faction: string; side: Side | 'CIVIL' };
type SessionRec = { start: number | null; last: number; total: number; count: number };
type AiStats = {
  config: { total: number; faction: number; factionEnabled: boolean };
  today: { tokens: number; input: number; output: number; calls: number; cacheHits: number; errors: number; estimatedCalls: number; chat: number; faction: number };
  days: { day: string; chat: number; faction: number }[];
  last7: number; last14: number;
  topDevices: { deviceId: string; tokens: number; calls: number }[];
  cacheRows: number;
};
type HistoryPoint = { t: number; online: number };
type ToastItem = { id: number; text: string; kind: 'info' | 'good' | 'bad' | 'watch' };
type SortKey = 'id' | 'name' | 'ping' | 'session';
type GroupId = 'ALL' | 'GOOD' | 'BAD' | 'CIVILIAN';
type Relasi = { id: string; citizenId: string; firstName: string; lastName: string; dob: string | null; sex: string | null; nationality: string | null; relation: string | null; notes: string | null; robberyMissionCompleted: boolean; responsiblePerson: string | null; joinedAt: string | null; bloodOathDate: string | null; idCardUrl: string | null; bloodOathVideoUrl: string | null; active: boolean; createdBy: string; createdAt: string; updatedAt: string };
type RelasiForm = { id?: string; citizenId: string; firstName: string; lastName: string; dob: string; sex: string; nationality: string; relation: string; notes: string; robberyMissionCompleted: boolean; responsiblePerson: string; joinedAt: string; bloodOathDate: string; idCardUrl: string; bloodOathVideoUrl: string; active: boolean };

const DEFAULT_SETTINGS: Settings = { theme: 'dark', refreshMs: 60000, compact: false, tagStyle: 'widget', pageSize: 25, notifyJoin: true, notifyRestart: false };

const WARGA: FactionDef = {
  id: 'WARGA', short: 'Civilian', label: 'Civilian', matchType: 'NONE', side: 'NONE',
  badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20', dot: 'bg-slate-400',
};

const FALLBACK_FACTIONS: FactionDef[] = [
  // CC multi-alias supaya "CCxKERTA", "CCX ashley", "Crimson Creed" semua kebaca
  { id: 'cc', label: 'Crimson Creed', short: 'CC,CCX,CRIMSON', matchType: 'STARTS_WITH', side: 'BAD', badge: 'bg-[#2a1515] text-[#f08a8a] border-[#5a2525]', dot: 'bg-[#ef4444]' },
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
// CCX/CRIMSON ditambahkan supaya side resolver tahu CC = BAD
const BAD_SIDE_SHORTS = ['CC', 'CCX', 'CRIMSON', '4B', 'JRZ', 'HT', 'HTH', 'BURGENK', 'DTF', 'ALLSTAR', 'ALLSTARS', 'NSN', 'WT', '24S', 'OMC', '5TAR', 'MX', 'RCMC', 'RC1', 'BMC', 'CBMC', 'RAGE', 'ALTION', 'NN', 'SIN', 'MFL', 'DW', 'RSG', 'BDF'];

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
function withCitizenReference<T extends { citizenId: string }>(record: T): T {
  return { ...record, citizenId: record.citizenId.trim() || `AUTO${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}` };
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

/* Pecah nama jadi kata-kata utuh (dipisah spasi, simbol, atau tanda baca) */
const nameTokens = (s: string) => s.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);

/* Pencocokan per KATA:
   1) exact token di mana pun ("VINCI CC", "CC - Name", "[CC] Name")
   2) awalan menempel pada kata PERTAMA ("CCxKERTA", "MX69"), tetapi hanya jika awalannya ditulis KAPITAL.
      Jadi "Dwi Saputra" / "Sinta" tidak salah masuk DW / SIN.
   Nama dengan pemisah " - " hanya dicek bagian sebelum pemisah (tag faction). */
function detectFaction(name: string, matchers: Matcher[]): string {
  const scope = name.includes(' - ') ? name.split(' - ')[0] : name;
  const toks = nameTokens(scope);
  if (toks.length === 0) return 'WARGA';
  const first = toks[0];
  const rawFirst = (scope.match(/[A-Za-z0-9]+/) ?? [''])[0];
  for (const m of matchers) {
    if (toks.includes(m.alias)) return m.id;
    if (first.length > m.alias.length && first.startsWith(m.alias) && rawFirst.slice(0, m.alias.length) === m.alias) return m.id;
  }
  return 'WARGA';
}

/* Relasi dianggap online jika SEMUA kata nama depan + belakang ada di nama player */
function findRelasiPlayer(r: { firstName: string; lastName: string }, players: EnrichedPlayer[]): EnrichedPlayer | null {
  const need = [...nameTokens(r.firstName), ...nameTokens(r.lastName)];
  if (need.length === 0) return null;
  for (const p of players) {
    const have = new Set(nameTokens(p.name));
    if (need.every(t => have.has(t))) return p;
  }
  return null;
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
  const [framed, setFramed] = useState(false);

  const [showChangelog, setShowChangelog] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [factions, setFactions] = useState<FactionDef[]>(FALLBACK_FACTIONS);
  const [relasi, setRelasi] = useState<Relasi[]>([]);
  const [relasiOpen, setRelasiOpen] = useState(false);
  const [relasiEditorOpen, setRelasiEditorOpen] = useState(false);
  const [relasiForm, setRelasiForm] = useState<RelasiForm>({ citizenId: '', firstName: '', lastName: '', dob: '', sex: '', nationality: '', relation: '', notes: '', robberyMissionCompleted: false, responsiblePerson: '', joinedAt: '', bloodOathDate: '', idCardUrl: '', bloodOathVideoUrl: '', active: true });
  const [relasiSaving, setRelasiSaving] = useState(false);
  const [relasiError, setRelasiError] = useState('');
  const [search, setSearch] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const announcedHangarounds = useRef(new Set<string>());

  // State khusus moderator
  const [viewMode, setViewMode] = useState<'ALL' | 'CC'>('CC');

  useEffect(() => {
    // Anti-iframe (cadangan; yang utama adalah header frame-ancestors di next.config.js)
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
    setViewMode(window.location.pathname === '/factions' ? 'ALL' : 'CC');
    setSettings(loadSettings());

    const lastVersion = localStorage.getItem('ime-changelog-version');
    if (lastVersion !== 'v1.2') setShowChangelog(true);
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
        // Role kosong = pemilik lama (SUPER). Role terisi tapi tidak dikenal = MOD (hak akses terkecil), bukan SUPER.
        const r = String(json.role ?? '').trim().toUpperCase();
        setRole(r === '' || r.includes('SUPER') || r.includes('OWNER') ? 'SUPER' : 'MOD');
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

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError('');
    try {
      const [playersRes, factionsRes] = await Promise.all([
        fetch('/api/players', { cache: 'no-store' }),
        fetch('/api/factions', { cache: 'no-store' }),
      ]);
      const playerJson = await playersRes.json().catch(() => null);
      if (!playersRes.ok || !playerJson?.ok) throw new Error(playerJson?.error || 'Gagal memuat data pemain');
      setData(playerJson);
      if (factionsRes.ok) {
        const factionJson = await factionsRes.json();
        if (Array.isArray(factionJson)) setFactions(mergeFactions(factionJson));
      }
    } catch (e: any) {
      setDashboardError(e?.message || 'Gagal memuat dashboard');
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadRelasi = useCallback(async () => {
    if (authStatus !== 'ADMIN') return;
    try {
      const res = await fetch('/api/relasi', { headers: staffHeaders(deviceId, false), cache: 'no-store' });
      if (res.ok) setRelasi(await res.json());
    } catch { /* ignore */ }
  }, [authStatus, deviceId]);

  useEffect(() => {
    if (authStatus === 'LOADING' || ['UNAUTHORIZED', 'PENDING', 'BANNED', 'TIMEOUT'].includes(authStatus)) return;
    loadDashboard();
    const id = setInterval(loadDashboard, settings.refreshMs);
    return () => clearInterval(id);
  }, [authStatus, settings.refreshMs, loadDashboard]);

  useEffect(() => {
    if (authStatus !== 'ADMIN') return;
    loadRelasi();
    const id = setInterval(loadRelasi, 30000);
    return () => clearInterval(id);
  }, [authStatus, loadRelasi]);

  const matchers = useMemo(() => buildMatchers(factions), [factions]);
  const factionMap = useMemo(() => {
    const map = new Map<string, FactionDef>();
    factions.forEach(f => map.set(f.id, f));
    return map;
  }, [factions]);
  const ccIds = useMemo(() => new Set(factions.filter(f => f.short.split(',').map(clean).includes('CC')).map(f => f.id)), [factions]);
  const enriched = useMemo<EnrichedPlayer[]>(() => (data?.players ?? []).map(p => {
    const faction = detectFaction(p.name, matchers);
    return { ...p, faction, side: faction === 'WARGA' ? 'CIVIL' : resolveSide(factionMap.get(faction)) };
  }), [data, matchers, factionMap]);
  const shownPlayers = useMemo(() => {
    let rows = viewMode === 'CC' ? enriched.filter(p => ccIds.has(p.faction)) : enriched;
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q));
    return rows;
  }, [enriched, ccIds, viewMode, search]);
  const ccOnline = useMemo(() => enriched.filter(player => ccIds.has(player.faction)).length, [enriched, ccIds]);
  const unregisteredHangarounds = useMemo(() => enriched.filter(player => {
    const hasHangaroundTag = /#HG\b/i.test(player.name);
    return ccIds.has(player.faction) && hasHangaroundTag && !relasi.some(member => findRelasiPlayer(member, [player]));
  }), [enriched, ccIds, relasi]);

  useEffect(() => {
    if (authStatus !== 'ADMIN') return;
    for (const player of unregisteredHangarounds) {
      const key = `${player.id}:${player.name.toLowerCase()}`;
      if (announcedHangarounds.current.has(key)) continue;
      announcedHangarounds.current.add(key);
      browserNotify('Hangaround CC belum tercatat', `${player.name} (#${player.id}) belum ditemukan di data Relasi.`);
    }
  }, [authStatus, unregisteredHangarounds]);

  const openNewRelasi = () => {
    setRelasiError('');
    setRelasiForm({ citizenId: '', firstName: '', lastName: '', dob: '', sex: '', nationality: '', relation: '', notes: '', robberyMissionCompleted: false, responsiblePerson: '', joinedAt: '', bloodOathDate: '', idCardUrl: '', bloodOathVideoUrl: '', active: true });
    setRelasiEditorOpen(true);
  };

  const saveRelasi = async () => {
    setRelasiError('');
    if (!relasiForm.firstName.trim() || !relasiForm.lastName.trim()) {
      setRelasiError('Nama depan dan nama belakang wajib diisi.'); return;
    }
    if (!relasiForm.id && (!relasiForm.responsiblePerson.trim() || !relasiForm.joinedAt)) {
      setRelasiError('Penanggung jawab dan tanggal masuk wajib diisi.'); return;
    }
    if (relasiForm.bloodOathDate && !relasiForm.robberyMissionCompleted) {
      setRelasiError('Misi rampok harus selesai sebelum tanggal sumpah darah.'); return;
    }
    setRelasiSaving(true);
    try {
      const res = await fetch('/api/relasi', {
        method: relasiForm.id ? 'PUT' : 'POST',
        headers: staffHeaders(deviceId),
        body: JSON.stringify(withCitizenReference(relasiForm)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan relasi');
      await loadRelasi();
      setRelasiEditorOpen(false);
    } catch (e: any) { setRelasiError(e?.message || 'Gagal menyimpan relasi'); }
    finally { setRelasiSaving(false); }
  };

  const [saving, setSaving] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);

  const uploadMedia = async (file: File, kind: 'id-card' | 'oath-video', onProgress: (percentage: number) => void = () => {}) => {
    setRelasiError('');
    if (file.size > 10 * 1024 * 1024) { onProgress(-1); setRelasiError('Ukuran file maksimal 10 MB.'); return; }
    setMediaBusy(true);
    try {
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '-').slice(-80) || 'upload';
      const blob = await upload(`relasi-media/${kind}/${crypto.randomUUID()}-${safeName}`, file, {
        access: 'private',
        handleUploadUrl: '/api/relasi/upload',
        clientPayload: JSON.stringify({ deviceId, kind }),
        onUploadProgress: event => onProgress(event.percentage),
      });
      setRelasiForm(f => ({ ...f, [kind === 'id-card' ? 'idCardUrl' : 'bloodOathVideoUrl']: blob.pathname }));
      onProgress(100);
    } catch (e: any) { onProgress(-1); setRelasiError(e?.message || 'Upload media gagal'); }
    finally { setMediaBusy(false); }
  };

  const [editorOpen, setEditorOpen] = useState(false);

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

  return (
    <div className="relative min-h-screen bg-app text-main overflow-hidden">
      <div className={`transition-all duration-300 ease-out ${isBlurred ? 'blur-[30px] scale-[0.95] opacity-10 pointer-events-none' : ''}`}>
        <main className="min-h-screen bg-app px-4 pb-16 pt-6 text-main sm:px-6">
          <div className="mx-auto max-w-5xl">
            <header className="mb-6 flex flex-col gap-4">
              {viewMode === 'CC' ? (
                <div className="flex items-center gap-4 rounded-2xl border border-[#8B1E2D]/30 bg-[linear-gradient(110deg,#111214_0%,#171012_58%,#111214_100%)] px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
                  <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#8B1E2D]/25 bg-black/30 sm:h-20 sm:w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/cc_rotate.gif" alt="Crimson Creed" className="h-full w-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a58a55]">Crimson Creed</div>
                    <div className="mt-1 text-sm text-muted">Blood, loyalty, and legacy.</div>
                  </div>
                  <div className="ml-auto hidden h-10 w-px bg-line sm:block" />
                  <div className="hidden text-right sm:block"><div className="text-[10px] uppercase tracking-wider text-subtle">IME Roleplay</div><div className="mt-1 text-xs text-muted">Faction Monitor</div></div>
                </div>
              ) : (
                <div className="flex h-[72px] w-full items-center justify-center overflow-hidden rounded-2xl border border-line bg-[#090909] sm:h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/ime-roleplay.gif" alt="IME Roleplay" className="h-full w-full object-contain" />
                </div>
              )}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-subtle">IME Roleplay</div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{viewMode === 'CC' ? 'Crimson Creed Monitor' : 'Semua Faction Monitor'}</h1>
                  <p className="mt-1 text-sm text-muted">{viewMode === 'CC' ? 'Pantau anggota Crimson Creed dan relasi aktif.' : 'Pantau semua faction dari satu halaman.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { window.location.href = viewMode === 'CC' ? '/factions' : '/'; }} className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">{viewMode === 'CC' ? 'Semua Faction' : 'Crimson Creed'}</button>
                  {authStatus === 'ADMIN' && <button onClick={() => setRelasiOpen(true)} className="rounded-full border border-red-500/30 bg-card px-3 py-2 text-xs font-semibold text-red-400">Relasi <span className="ml-1 opacity-70">{relasi.length}</span></button>}
                  {authStatus === 'ADMIN' && <button onClick={() => setAdminOpen(true)} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500">Admin</button>}
                  <button onClick={() => setSettingsOpen(true)} className="rounded-full border border-line bg-card px-3 py-2 text-xs font-semibold text-muted">Pengaturan</button>
                </div>
              </div>
            </header>
            <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-line bg-card p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-subtle">CC Online</div><div className="mt-1 text-2xl font-bold text-emerald-500">{data ? fmt(ccOnline) : '—'}</div></div>
              <div className="rounded-2xl border border-line bg-card p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Max Slot</div><div className="mt-1 text-2xl font-bold">{data ? fmt(data.max) : '—'}</div></div>
              <div className="rounded-2xl border border-line bg-card p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Gate</div><div className="mt-1 truncate text-sm font-semibold">{data?.gate ?? '—'}</div></div>
              <div className="rounded-2xl border border-line bg-card p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Faction</div><div className="mt-1 text-2xl font-bold text-accent">{factions.length}</div></div>
            </section>
            {dashboardError && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{dashboardError}</div>}
            {authStatus === 'ADMIN' && unregisteredHangarounds.length > 0 && <section className="mb-4 rounded-xl border border-[#8B1E2D]/35 bg-[#8B1E2D]/10 p-4" role="status"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-semibold text-main">Hangaround Crimson Creed belum tercatat</div><p className="mt-1 text-xs text-muted">{unregisteredHangarounds.length} player bertag #HG tidak cocok dengan data Relasi.</p></div><div className="flex gap-2">{typeof Notification !== 'undefined' && Notification.permission === 'default' && <button onClick={() => { Notification.requestPermission().then(permission => { if (permission === 'granted' && unregisteredHangarounds[0]) browserNotify('Hangaround CC belum tercatat', `${unregisteredHangarounds[0].name} (#${unregisteredHangarounds[0].id}) belum ditemukan di data Relasi.`); }); }} className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-line-hover">Aktifkan notifikasi</button>}<button onClick={() => setRelasiOpen(true)} className="rounded-lg border border-[#8B1E2D]/40 px-3 py-2 text-xs font-semibold text-[#d98a94] transition-colors hover:bg-[#8B1E2D]/15">Periksa Relasi</button></div></div><div className="mt-3 flex flex-wrap gap-2">{unregisteredHangarounds.slice(0, 8).map(player => <span key={`${player.id}-${player.name}`} className="rounded-md border border-line bg-app/70 px-2.5 py-1.5 text-xs"><span className="font-medium">{player.name}</span><span className="ml-2 font-mono text-subtle">#{player.id}</span></span>)}</div></section>}
            <section className="mb-4 flex gap-3">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau kantong…" className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-2.5 text-sm outline-none focus:border-accent" />
              <button onClick={loadDashboard} disabled={dashboardLoading} className="rounded-xl border border-line bg-card px-4 py-2.5 text-sm disabled:opacity-40">{dashboardLoading ? 'Memuat…' : 'Refresh'}</button>
            </section>
            <section className="overflow-hidden rounded-2xl border border-line bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-hover text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-4 py-3">Kantong</th><th className="px-4 py-3">Nama Player</th><th className="px-4 py-3">Faction</th><th className="px-4 py-3 text-right">Ping</th></tr></thead>
                  <tbody>
                    {dashboardLoading ? <tr><td colSpan={4} className="px-4 py-16 text-center text-subtle">Memuat data player…</td></tr>
                    : shownPlayers.length === 0 ? <tr><td colSpan={4} className="px-4 py-16 text-center text-subtle">Tidak ada player ditemukan.</td></tr>
                    : shownPlayers.map(p => {
                      const fac = factionMap.get(p.faction) ?? WARGA;
                      return <tr key={`${p.id}-${p.name}`} className="border-t border-line transition hover:bg-hover/60"><td className="px-4 py-3 font-mono text-xs text-main">#{p.id}</td><td className="px-4 py-3 font-medium text-main">{p.name}</td><td className="px-4 py-3"><FactionTag fac={fac} variant="pill" /></td><td className="px-4 py-3 text-right"><span className={`rounded border px-2 py-1 font-mono text-xs ${pingClass(p.ping)}`}>{p.ping}</span></td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      </div>

      <button
        onClick={() => setBugReportOpen(true)}
        className="fixed bottom-6 right-6 z-[80] flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition-all hover:scale-110 active:scale-95"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        title="Laporkan Bug"
      >
        <BugIcon className="h-6 w-6" />
      </button>

      {authStatus === 'ADMIN' && <CompactRelasiPanel open={relasiOpen} onClose={() => setRelasiOpen(false)} deviceId={deviceId} items={relasi} onReload={loadRelasi} />}
      {authStatus === 'ADMIN' && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} role={role} deviceId={deviceId} />}

      {settingsOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-5"><h2 className="text-lg font-bold">Pengaturan</h2><div className="mt-4 space-y-3"><label className="block text-xs text-muted">Tema<select value={settings.theme} onChange={e => setSettings(s => ({ ...s, theme: e.target.value as Theme }))} className="mt-1 w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm text-main"><option value="dark">Dark</option><option value="light">Light</option><option value="glass">Glass</option><option value="cyberpunk">Cyberpunk</option><option value="nord">Nord</option></select></label><label className="block text-xs text-muted">Auto refresh<select value={settings.refreshMs} onChange={e => setSettings(s => ({ ...s, refreshMs: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm text-main"><option value={30000}>30 detik</option><option value={60000}>60 detik</option><option value={120000}>2 menit</option></select></label><div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"><div className="min-w-0"><div className="text-[10px] text-subtle">Device ID</div><div className="mt-1 break-all font-mono text-xs">{deviceId}</div></div><CopyButton value={deviceId} /></div></div><div className="mt-5 flex gap-2"><button onClick={() => setSettingsOpen(false)} className="flex-1 rounded-xl bg-hover py-2.5 text-sm">Batal</button><button onClick={() => { handleSaveSettings(settings); setSettingsOpen(false); }} className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-text">Simpan</button></div></div>
        </div>
      )}

      {bugReportOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-md rounded-2xl border border-line bg-card p-5"><h2 className="text-lg font-bold">Laporkan Bug</h2><textarea id="bug-message" rows={5} placeholder="Jelaskan masalah yang ditemukan…" className="mt-4 w-full resize-none rounded-xl border border-line bg-app p-3 text-sm" /><div className="mt-4 flex gap-2"><button onClick={() => setBugReportOpen(false)} className="flex-1 rounded-xl bg-hover py-2.5 text-sm">Batal</button><button onClick={async () => { const el = document.getElementById('bug-message') as HTMLTextAreaElement | null; const message = el?.value.trim(); if (!message) return; await fetch('/api/reports', { method: 'POST', headers: staffHeaders(deviceId), body: JSON.stringify({ deviceId, message }) }).catch(() => {}); setBugReportOpen(false); }} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white">Kirim</button></div></div></div>
      )}
    </div>
  );
}

/* ═════════ [A] Mod Selection Screen (animasi) ═════════ */
type Mode = 'ALL' | 'CC';

/* Taruh GIF di public/ime-server-up.gif (jangan hotlink Discord: link-nya kedaluwarsa) */
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

.ms-blob { position: absolute; border-radius: 9999px; pointer-events: none; background: radial-gradient(circle at center, rgba(var(--c), .5), rgba(var(--c), 0) 65%); animation: ms-aurora 16s ease-in-out infinite; will-change: transform; }
.ms-grid { position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse at center, #000 20%, transparent 70%); mask-image: radial-gradient(ellipse at center, #000 20%, transparent 70%); }
.ms-dot { position: absolute; bottom: -10px; border-radius: 9999px; background: rgba(var(--c), .85); box-shadow: 0 0 6px rgba(var(--c), .8); animation: ms-float linear infinite; pointer-events: none; }
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
.ms-load { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; overflow: hidden; color: #fff; text-align: center;
  background: radial-gradient(ellipse at center, rgba(var(--tint), .30), rgba(5,6,10,.97) 62%), #05060a; animation: ms-fadein .5s ease backwards; }
.ms-scan { position: absolute; left: 0; right: 0; top: -140px; height: 140px; pointer-events: none; background: linear-gradient(180deg, transparent, rgba(var(--tint), .2), transparent); animation: ms-scanline 2.8s linear infinite; }
@keyframes ms-scanline { to { transform: translateY(calc(100vh + 140px)); } }
.ms-ring { position: relative; width: 168px; height: 168px; animation: ms-rise .7s cubic-bezier(.2,.8,.2,1) backwards; }
.ms-ring svg { transform: rotate(-90deg); }
.ms-ring-track { stroke: rgba(255,255,255,.08); }
.ms-ring-bar { stroke: rgb(var(--tint)); stroke-linecap: round; filter: drop-shadow(0 0 8px rgba(var(--tint), .9)); transition: stroke-dashoffset .25s linear; }
.ms-orbit { position: absolute; inset: -16px; border-radius: 9999px; border: 1px dashed rgba(var(--tint), .35); animation: ms-orbit 8s linear infinite; }
.ms-orbit::after { content: ''; position: absolute; top: -4px; left: 50%; width: 8px; height: 8px; margin-left: -4px; border-radius: 9999px; background: rgb(var(--tint)); box-shadow: 0 0 14px rgb(var(--tint)); }
@keyframes ms-orbit { to { transform: rotate(360deg); } }
.ms-pct { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
.ms-step { min-height: 20px; font-size: 13px; color: rgba(255,255,255,.65); animation: ms-stepin .35s ease; }
@keyframes ms-stepin { from { opacity: 0; transform: translateY(6px); } }
.ms-tint { position: absolute; inset: 0; pointer-events: none; transition: opacity .6s ease; }
.ms-tint-cc { background: radial-gradient(ellipse 70% 60% at 12% 55%, rgba(239,68,68,.26), transparent 70%); }
.ms-tint-all { background: radial-gradient(ellipse 70% 60% at 88% 55%, rgba(59,130,246,.26), transparent 70%); }
.ms-beam { position: absolute; left: 50%; top: 50%; width: 140vmax; height: 140vmax; margin: -70vmax 0 0 -70vmax; pointer-events: none; opacity: .55; will-change: transform;
  background: conic-gradient(from 0deg, transparent 0deg, rgba(239,68,68,.11) 18deg, transparent 52deg, transparent 180deg, rgba(59,130,246,.11) 198deg, transparent 232deg);
  -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 62%); mask-image: radial-gradient(circle, #000 0%, transparent 62%);
  animation: ms-spin 45s linear infinite; }
@keyframes ms-spin { to { transform: rotate(360deg); } }
.ms-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 48%; overflow: hidden; pointer-events: none; perspective: 420px;
  -webkit-mask-image: linear-gradient(to top, #000 8%, transparent 88%); mask-image: linear-gradient(to top, #000 8%, transparent 88%); }
.ms-floor > div { position: absolute; left: -60%; right: -60%; top: 0; bottom: -120px; transform-origin: 50% 0; transform: rotateX(62deg); will-change: transform;
  background-image: linear-gradient(rgba(255,255,255,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.13) 1px, transparent 1px); background-size: 60px 60px;
  animation: ms-floor 2.4s linear infinite; }
@keyframes ms-floor { from { transform: rotateX(62deg) translateY(0); } to { transform: rotateX(62deg) translateY(60px); } }
.ms-streak { position: absolute; height: 1.5px; width: 190px; pointer-events: none; opacity: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.95), transparent); animation: ms-streak 7s ease-in infinite; }
@keyframes ms-streak { 0% { opacity: 0; transform: translate3d(0,0,0) rotate(-30deg); } 3% { opacity: 1; } 13% { opacity: 0; transform: translate3d(-560px,323px,0) rotate(-30deg); } 100% { opacity: 0; transform: translate3d(-560px,323px,0) rotate(-30deg); } }
.ms-spot { position: fixed; top: 0; left: 0; width: 600px; height: 600px; border-radius: 9999px; pointer-events: none; will-change: transform; transform: translate3d(-9999px,-9999px,0);
  background: radial-gradient(circle, rgba(255,255,255,.08), transparent 60%); }
.ms-noise { position: absolute; inset: 0; pointer-events: none; opacity: .06;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"); }
.ms-vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.65)); }
@media (prefers-reduced-motion: reduce) { .ms-root *, .ms-root *::before { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
`;

function ModeCard({ title, desc, tint, tilt, delay, icon, badge, state, onPick, onHover }: {
  title: string; desc: string; tint: string; tilt: string; delay: string; icon: string; badge?: string; onHover?: (on: boolean) => void;
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
    onHover?.(false);
    const el = ref.current; if (!el) return;
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--mx', '50%'); el.style.setProperty('--my', '50%');
  };
  return (
    <button
      ref={ref} onClick={onPick} onPointerMove={move} onPointerEnter={() => onHover?.(true)} onPointerLeave={reset}
      className={`ms-card ${state === 'picked' ? 'is-picked' : state === 'dim' ? 'is-dim' : ''}`}
      style={{ ['--tint' as string]: tint, ['--delay' as string]: delay, ['--tilt' as string]: tilt }}
    >
      <span className="ms-shine" />
      {badge && <span className="ms-badge"><i />{badge}</span>}
      <div className="ms-icon">
        <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} /></svg>
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mx-auto max-w-[260px] text-sm leading-relaxed text-white/60">{desc}</p>
      <div className="ms-go">Masuk <span>→</span></div>
    </button>
  );
}

/* Background layar pilihan: hanya animasi transform/opacity (ringan di GPU), tanpa blur filter besar */
function MsBackground({ hover, lite, gifOk, onGifError }: { hover: Mode | null; lite: boolean; gifOk: boolean; onGifError: () => void }) {
  const spot = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  // Cahaya yang mengikuti kursor (diperbarui langsung ke DOM, tanpa re-render React)
  useEffect(() => {
    const el = spot.current;
    if (!el || lite) return;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => { el.style.transform = `translate3d(${e.clientX - 300}px, ${e.clientY - 300}px, 0)`; });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf.current); };
  }, [lite]);

  const dots = useMemo(() => {
    const colors = ['239,68,68', '59,130,246', '255,255,255'];
    return Array.from({ length: lite ? 10 : 26 }, (_, i) => ({
      left: (i * 37) % 100, size: 2 + (i % 4), dur: 9 + (i % 7) * 2, delay: -((i * 1.7) % 12), drift: ((i % 5) - 2) * 18, c: colors[i % 3],
    }));
  }, [lite]);

  return (
    <>
      {gifOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={IME_GIF} alt="" aria-hidden onError={onGifError} draggable={false} className="ms-bg pointer-events-none absolute inset-0 h-full w-full scale-105 select-none object-cover opacity-30" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#05060a]/65 via-[#05060a]/80 to-[#05060a]" />

      {/* Warna latar ikut berubah saat kursor di atas kartu */}
      <div className="ms-tint ms-tint-cc" style={{ opacity: hover === 'CC' ? 1 : 0 }} />
      <div className="ms-tint ms-tint-all" style={{ opacity: hover === 'ALL' ? 1 : 0 }} />

      <div className="ms-blob" style={{ top: '-22%', left: '-14%', width: '58%', height: '58%', ['--c' as string]: '239,68,68' }} />
      <div className="ms-blob" style={{ bottom: '-24%', right: '-14%', width: '60%', height: '60%', animationDelay: '-6s', ['--c' as string]: '59,130,246' }} />
      <div className="ms-blob" style={{ top: '28%', left: '36%', width: '34%', height: '34%', animationDelay: '-11s', ['--c' as string]: '168,85,247' }} />

      {!lite && <div className="ms-beam" />}
      <div className="ms-floor"><div /></div>

      {!lite && (
        <>
          <span className="ms-streak" style={{ top: '6%', left: '82%', animationDelay: '1s' }} />
          <span className="ms-streak" style={{ top: '16%', left: '94%', animationDelay: '3.6s', width: 140 }} />
          <span className="ms-streak" style={{ top: '30%', left: '70%', animationDelay: '5.4s', width: 220 }} />
        </>
      )}

      {dots.map((d, i) => (
        <span key={i} className="ms-dot" style={{ left: `${d.left}%`, width: d.size, height: d.size, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s`, ['--d' as string]: `${d.drift}px`, ['--c' as string]: d.c }} />
      ))}

      {!lite && <div ref={spot} className="ms-spot" />}
      <div className="ms-noise" />
      <div className="ms-vignette" />
    </>
  );
}

const MS_STEPS: Record<Mode, string[]> = {
  CC: ['Menyambungkan ke server…', 'Menyinkronkan data faction…', 'Memuat anggota Crimson Creed…', 'Menyiapkan panel relasi…'],
  ALL: ['Menyambungkan ke server…', 'Menyinkronkan data faction…', 'Memuat seluruh player…', 'Menyiapkan dashboard…'],
};
const RING_C = 2 * Math.PI * 76;

function ModSelectionScreen({ role, onSelect }: { role: Role; onSelect: (mode: Mode) => void }) {
  const [picked, setPicked] = useState<{ mode: Mode; x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<'idle' | 'ripple' | 'loading'>('idle');
  const [pct, setPct] = useState(0);
  const [gifOk, setGifOk] = useState(true);
  const [stats, setStats] = useState<{ all: number; cc: number } | null>(null);
  const [hover, setHover] = useState<Mode | null>(null);
  // Perangkat lemah / hemat gerak => efek berat dimatikan otomatis
  const [lite] = useState(() => typeof window !== 'undefined' && ((navigator.hardwareConcurrency ?? 8) <= 4 || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { timers.current.forEach(clearTimeout); if (poll.current) clearInterval(poll.current); }, []);

  // Jumlah online langsung di kartu (pakai aturan deteksi faction yang sama dengan dashboard)
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
    }).catch(() => { /* kartu tetap tampil tanpa angka */ });
    return () => { off = true; };
  }, []);

  const choose = (mode: Mode, e: React.MouseEvent<HTMLButtonElement>) => {
    if (picked) return;
    let x = e.clientX, y = e.clientY;
    if (!x && !y) { const r = e.currentTarget.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; } // dipicu keyboard
    setPicked({ mode, x, y });
    setPhase('ripple');

    const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const MIN = reduce ? 700 : 2400;
    timers.current.push(setTimeout(() => setPhase('loading'), reduce ? 0 : 800));

    // Loading sungguhan: ikut menunggu data player + faction (maks 5 detik), minimal MIN ms agar animasi tidak berkedip
    const t0 = Date.now();
    let ready = false;
    Promise.race([
      Promise.allSettled([fetch('/api/players', { cache: 'no-store' }), fetch('/api/factions')]),
      new Promise(r => setTimeout(r, 5000)),
    ]).then(() => { ready = true; });

    poll.current = setInterval(() => {
      const t = Date.now() - t0;
      const finished = ready && t >= MIN;
      const target = finished ? 100 : Math.min(92, (t / MIN) * 92);
      setPct(prev => Math.max(prev, Math.round(target)));
      if (finished) {
        if (poll.current) clearInterval(poll.current);
        timers.current.push(setTimeout(() => onSelect(mode), 450));
      }
    }, 60);
  };
  const stateOf = (m: Mode): 'idle' | 'picked' | 'dim' => (!picked ? 'idle' : picked.mode === m ? 'picked' : 'dim');

  const steps = picked ? MS_STEPS[picked.mode] : MS_STEPS.ALL;
  const stepIdx = Math.min(steps.length - 1, Math.floor(pct / (100 / steps.length)));

  return (
    <div className="ms-root relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05060a] p-4 font-sans" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <style>{MS_CSS}</style>

      <MsBackground hover={hover} lite={lite} gifOk={gifOk} onGifError={() => setGifOk(false)} />

      <div className="relative z-10 w-full max-w-4xl">
        <div className="mb-10 text-center sm:mb-12" style={{ opacity: picked ? 0 : 1, transition: 'opacity .4s' }}>
          {gifOk && (
            <div className="ms-hero mx-auto mb-6 w-fit max-w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-1.5 shadow-[0_0_80px_-20px_rgba(239,68,68,.55)] backdrop-blur-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IME_GIF} alt="IME Roleplay" onError={() => setGifOk(false)} draggable={false} className="max-h-32 w-auto max-w-full rounded-[20px] object-contain sm:max-h-44" />
            </div>
          ) }
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
            title="Crimson Creed Only" desc="Fokus memantau anggota dan relasi Crimson Creed."
            tint="239,68,68" tilt="-6deg" delay=".25s" state={stateOf('CC')} onPick={e => choose('CC', e)} onHover={on => setHover(on ? 'CC' : null)}
            badge={stats ? `${stats.cc} online` : undefined}
            icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
          <ModeCard
            title="All Factions" desc="Lihat semua player: semua faction, Civilian, serta Good dan Bad Side."
            tint="59,130,246" tilt="6deg" delay=".4s" state={stateOf('ALL')} onPick={e => choose('ALL', e)} onHover={on => setHover(on ? 'ALL' : null)}
            badge={stats ? `${stats.all} online` : undefined}
            icon="M3.055 11H5a2 2 0 0 0 2 2v1a2 2 0 0 0 2 2 2 2 0 0 0 4 0 2 2 0 0 0 2-2h1.064M15 20.488V18a2 2 0 0 0 2-2h3.064M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
          />
        </div>
      </div>

      {picked && <div className="ms-ripple" style={{ left: picked.x, top: picked.y, background: picked.mode === 'CC' ? '#ef4444' : '#3b82f6' }} />}

      {phase === 'loading' && picked && (
        <div className="ms-load" style={{ ['--tint' as string]: picked.mode === 'CC' ? '239,68,68' : '59,130,246' }}>
          {gifOk && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={IME_GIF} alt="" aria-hidden draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-20 blur-sm" />
          )}
          <div className="ms-scan" />
          <div className="ms-ring">
            <div className="ms-orbit" />
            <svg width="168" height="168" viewBox="0 0 168 168">
              <circle className="ms-ring-track" cx="84" cy="84" r="76" fill="none" strokeWidth="6" />
              <circle className="ms-ring-bar" cx="84" cy="84" r="76" fill="none" strokeWidth="6" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - pct / 100)} />
            </svg>
            <div className="ms-pct">
              <span className="text-4xl font-bold">{pct}<span className="text-lg text-white/50">%</span></span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">memuat</span>
            </div>
          </div>
          <div className="relative">
            <div className="text-2xl font-bold tracking-tight" style={{ textShadow: `0 0 30px rgba(${picked.mode === 'CC' ? '239,68,68' : '59,130,246'},.7)` }}>{picked.mode === 'CC' ? 'Crimson Creed' : 'All Factions'}</div>
            <div key={stepIdx} className="ms-step mt-2">{steps[stepIdx]}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════ Relasi Editor Component ══════════════ */
function RelasiEditor({ open, form, setForm, saving, mediaBusy, error, onClose, onSave, onUpload }: {
  open: boolean;
  form: RelasiForm;
  setForm: React.Dispatch<React.SetStateAction<RelasiForm>>;
  saving: boolean;
  mediaBusy: boolean;
  error: string;
  onClose: () => void;
  onSave: () => void;
  onUpload: (file: File, kind: 'id-card' | 'oath-video', onProgress: (percentage: number) => void) => void;
}) {
  if (!open) return null;
  const setField = <K extends keyof RelasiForm>(key: K, value: RelasiForm[K]) => setForm(f => ({ ...f, [key]: value }));
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relasi-editor flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-2xl sm:rounded-2xl">
        <header className="relasi-editor__header sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-line bg-card px-5 py-4">
          <h2 className="font-bold">{form.id ? 'Edit Relasi' : 'Tambah Relasi'}</h2>
          <button onClick={onClose} className="rounded-lg bg-hover px-3 py-2 text-sm">Tutup</button>
        </header>
        <div className="relasi-editor__body min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={form.firstName} onChange={e => setField('firstName', e.target.value)} placeholder="Nama depan *" className="rounded-xl border border-line bg-app px-3 py-2.5 text-sm" />
            <input value={form.lastName} onChange={e => setField('lastName', e.target.value)} placeholder="Nama belakang *" className="rounded-xl border border-line bg-app px-3 py-2.5 text-sm" />
            <label className="text-[11px] text-muted sm:col-span-2">Citizen ID <span className="text-subtle">(opsional)</span><input value={form.citizenId} onChange={e => setField('citizenId', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} maxLength={16} placeholder="Boleh dikosongkan" className="mt-1 w-full rounded-xl border border-line bg-app px-3 py-2.5 font-mono text-sm" /></label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={form.responsiblePerson} onChange={e => setField('responsiblePerson', e.target.value)} placeholder="Penanggung jawab *" className="rounded-xl border border-line bg-app px-3 py-2.5 text-sm" />
            <label className="text-[11px] text-muted">Tanggal masuk CC *<input type="date" value={form.joinedAt} onChange={e => setField('joinedAt', e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm text-main" /></label>
            <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm"><span>Misi rampok selesai</span><input type="checkbox" checked={form.robberyMissionCompleted} onChange={e => { setField('robberyMissionCompleted', e.target.checked); if (!e.target.checked) setField('bloodOathDate', ''); }} /></label>
            <label className="text-[11px] text-muted">Tanggal sumpah darah<input type="date" disabled={!form.robberyMissionCompleted} value={form.bloodOathDate} onChange={e => setField('bloodOathDate', e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm text-main disabled:opacity-40" /></label>
          </div>
          <input value={form.relation} onChange={e => setField('relation', e.target.value)} placeholder="Hubungan / keterangan" className="w-full rounded-xl border border-line bg-app px-3 py-2.5 text-sm" />
          <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} placeholder="Catatan" className="w-full resize-none rounded-xl border border-line bg-app px-3 py-2.5 text-sm" />
          <section className="grid grid-cols-1 gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
            <RelasiUploadField label="Foto KTP" kind="id-card" accept="image/jpeg,image/png,image/webp" stored={Boolean(form.idCardUrl)} disabled={mediaBusy} onUpload={onUpload} />
            <RelasiUploadField label="Video sumpah darah" kind="oath-video" accept="video/mp4,video/webm,video/quicktime" stored={Boolean(form.bloodOathVideoUrl)} disabled={mediaBusy || !form.robberyMissionCompleted} onUpload={onUpload} />
          </section>
          {error && <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</div>}
        </div>
        <footer className="relasi-editor__footer sticky bottom-0 z-10 flex shrink-0 gap-2 border-t border-line bg-card p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}><button onClick={onClose} className="flex-1 rounded-xl bg-hover py-3 text-sm">Batal</button><button onClick={onSave} disabled={saving || mediaBusy} className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-accent-text disabled:opacity-50">{saving ? 'Menyimpan…' : mediaBusy ? 'Mengunggah…' : form.id ? 'Simpan Perubahan' : 'Tambah Relasi'}</button></footer>
      </div>
    </div>
  );
}

function RelasiUploadField({ label, kind, accept, stored, disabled, onUpload }: { label: string; kind: 'id-card' | 'oath-video'; accept: string; stored: boolean; disabled: boolean; onUpload: (file: File, kind: 'id-card' | 'oath-video', onProgress: (percentage: number) => void) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setProgress(0);
    onUpload(selected, kind, setProgress);
  };
  const sizeLabel = file ? file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB` : '';
  return (
    <div className={`relasi-upload rounded-lg border border-line bg-hover/60 p-3 transition-colors ${dragging ? 'border-accent bg-accent/5' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}>
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-semibold">{label}</span><span className="text-[10px] text-subtle">{kind === 'oath-video' ? 'Maks. 10 MB' : 'Opsional'}</span></div>
      {previewUrl && file ? <div className="mb-3 overflow-hidden rounded-md border border-line bg-app">{kind === 'id-card' ? <><div className="h-28 bg-center bg-contain bg-no-repeat" style={{ backgroundImage: `url("${previewUrl}")` }} /><span className="sr-only">Preview foto KTP</span></> : <video src={previewUrl} controls className="max-h-36 w-full bg-black object-contain" />}</div> : <div className="relasi-upload__drop mb-3 flex min-h-24 flex-col items-center justify-center rounded-md border border-dashed border-line px-3 py-4 text-center text-[11px] text-subtle"><svg className="mb-2 h-5 w-5 text-[#b99a5c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg><span>{stored ? 'File tersimpan privat' : 'Tarik & lepas file ke sini'}</span><span className="mt-1 text-[10px] text-subtle">atau pilih melalui tombol di bawah</span></div>}
      <input ref={inputRef} type="file" accept={accept} disabled={disabled} onChange={event => { selectFile(event.target.files?.[0]); event.target.value = ''; }} className="hidden" />
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="w-full rounded-md border border-line px-3 py-2 text-left text-xs text-muted transition-colors hover:border-line-hover disabled:opacity-50">{file ? file.name : stored ? 'Klik untuk mengganti file' : 'Klik untuk memilih file'}</button>
      {file && <div className="mt-2"><div className="flex justify-between gap-2 text-[10px] text-subtle"><span className="truncate">{sizeLabel}</span><span>{progress < 0 ? 'Upload gagal' : progress >= 100 ? 'Selesai' : `${Math.round(progress)}%`}</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-app"><div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div></div>}
    </div>
  );
}

/* ══════════════ Compact Relasi Panel Component ══════════════ */
function CompactRelasiPanel({ open, onClose, deviceId, items, onReload }: { open: boolean; onClose: () => void; deviceId: string; items: Relasi[]; onReload: () => void }) {
  const empty: RelasiForm = { citizenId: '', firstName: '', lastName: '', dob: '', sex: '', nationality: '', relation: '', notes: '', robberyMissionCompleted: false, responsiblePerson: '', joinedAt: '', bloodOathDate: '', idCardUrl: '', bloodOathVideoUrl: '', active: true };
  const [editor, setEditor] = useState(false);
  const [tab, setTab] = useState<'relasi' | 'members'>('relasi');
  const [form, setForm] = useState<RelasiForm>(empty);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const members = items.filter(item => Boolean(item.bloodOathDate));
  const relations = items.filter(item => !item.bloodOathDate);
  const visibleItems = tab === 'members' ? members : relations;
  const timeline = [...items].sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt)).slice(0, 5);

  const uploadMedia = async (file: File, kind: 'id-card' | 'oath-video', onProgress: (percentage: number) => void = () => {}) => {
    setError('');
    if (file.size > 10 * 1024 * 1024) { onProgress(-1); setError('Ukuran file maksimal 10 MB.'); return; }
    setMediaBusy(true);
    try {
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '-').slice(-80) || 'upload';
      const blob = await upload(`relasi-media/${kind}/${crypto.randomUUID()}-${safeName}`, file, {
        access: 'private',
        handleUploadUrl: '/api/relasi/upload',
        clientPayload: JSON.stringify({ deviceId, kind }),
        onUploadProgress: event => onProgress(event.percentage),
      });
      setForm(f => ({ ...f, [kind === 'id-card' ? 'idCardUrl' : 'bloodOathVideoUrl']: blob.pathname }));
      onProgress(100);
    } catch (e: any) { onProgress(-1); setError(e?.message || 'Upload media gagal'); }
    finally { setMediaBusy(false); }
  };

  const setField = <K extends keyof RelasiForm>(key: K, value: RelasiForm[K]) => setForm(f => ({ ...f, [key]: value }));
  const save = async () => {
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('Nama depan dan nama belakang wajib diisi.'); return; }
    if (!form.id && (!form.responsiblePerson.trim() || !form.joinedAt)) { setError('Penanggung jawab dan tanggal masuk wajib diisi.'); return; }
    if (form.bloodOathDate && !form.robberyMissionCompleted) { setError('Misi rampok harus ditandai selesai sebelum sumpah darah.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/relasi', { method: form.id ? 'PUT' : 'POST', headers: staffHeaders(deviceId), body: JSON.stringify(withCitizenReference(form)) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan relasi');
      setEditor(false); onReload();
    } catch (e: any) { setError(e?.message || 'Gagal menyimpan relasi'); }
    finally { setSaving(false); }
  };
  if (!open) return null;
  return (
    <div className="relasi-panel fixed inset-0 z-[100] flex flex-col bg-app">
      <header className="border-b border-line bg-card px-4 py-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b99a5c]">Crimson Creed</div><h1 className="relasi-display mt-1 truncate text-lg font-bold">Relasi &amp; Sumpah Darah</h1><p className="text-[11px] text-muted">{items.length} catatan tersimpan</p></div>
          <div className="flex shrink-0 gap-2"><button onClick={() => { setForm(empty); setError(''); setEditor(true); }} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-text transition-colors hover:bg-accent-hover sm:px-4">+ Tambah</button><button onClick={onClose} className="rounded-lg border border-line bg-hover px-3 py-2 text-sm transition-colors hover:border-line-hover">Tutup</button></div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Statistik Relasi">
            <div className="relasi-stat relasi-stat--crimson rounded-xl border border-line bg-card p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Total relasi</div><div className="mt-1 text-2xl font-semibold">{items.length}</div></div>
            <div className="relasi-stat relasi-stat--gold rounded-xl border border-[#a58a55]/20 bg-card p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-[#b99a5c]">Sumpah darah</div><div className="mt-1 text-2xl font-semibold">{members.length}</div></div>
            <div className="relasi-stat relasi-stat--neutral rounded-xl border border-line bg-card p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Aktif</div><div className="mt-1 text-2xl font-semibold">{items.filter(item => item.active).length}</div></div>
          </section>
          <div className="mb-5 flex border-b border-line" role="tablist" aria-label="Kategori relasi Crimson Creed">
            <button type="button" role="tab" aria-selected={tab === 'relasi'} onClick={() => setTab('relasi')} className={`border-b-2 px-4 py-3 text-sm transition-colors ${tab === 'relasi' ? 'border-accent text-main' : 'border-transparent text-muted hover:text-main'}`}>Relasi <span className="relasi-tab-count ml-1">{relations.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === 'members'} onClick={() => setTab('members')} className={`border-b-2 px-4 py-3 text-sm transition-colors ${tab === 'members' ? 'border-accent text-main' : 'border-transparent text-muted hover:text-main'}`}>Sumpah Darah <span className="relasi-tab-count ml-1">{members.length}</span></button>
          </div>
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="min-w-0 space-y-3">
              {visibleItems.length === 0 ? <div className="rounded-xl border border-dashed border-line px-5 py-16 text-center"><div className="text-sm font-medium text-muted">{tab === 'members' ? 'Belum ada sumpah darah tercatat' : 'Belum ada relasi tersimpan'}</div><p className="mt-1 text-xs text-subtle">Data akan muncul di sini setelah dicatat.</p></div> : visibleItems.map(r => (
                <article key={r.id} className="relasi-card rounded-xl border border-line bg-card p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition duration-200 hover:-translate-y-0.5 hover:border-line-hover">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#8B1E2D]/35 bg-[#8B1E2D]/15 text-xs font-semibold uppercase tracking-wider text-[#d99aa2]">{`${r.firstName.charAt(0)}${r.lastName.charAt(0)}`}</div>
                      <div className="min-w-0"><div className="truncate font-semibold">{r.firstName} {r.lastName}</div><div className="mt-1 truncate font-mono text-[11px] text-subtle">{r.citizenId.startsWith('AUTO') ? 'Citizen ID tidak dicatat' : r.citizenId}</div></div>
                    </div>
                    <button aria-label={`Edit ${r.firstName} ${r.lastName}`} title="Edit relasi" onClick={() => { setForm({ id: r.id, citizenId: r.citizenId, firstName: r.firstName, lastName: r.lastName, dob: r.dob ?? '', sex: r.sex ?? '', nationality: r.nationality ?? '', relation: r.relation ?? '', notes: r.notes ?? '', robberyMissionCompleted: r.robberyMissionCompleted, responsiblePerson: r.responsiblePerson ?? '', joinedAt: r.joinedAt ?? '', bloodOathDate: r.bloodOathDate ?? '', idCardUrl: r.idCardUrl ?? '', bloodOathVideoUrl: r.bloodOathVideoUrl ?? '', active: r.active }); setError(''); setEditor(true); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:border-accent hover:text-accent"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" /></svg></button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`relasi-status rounded-full border px-2 py-1 text-[10px] ${r.robberyMissionCompleted ? 'relasi-status--complete' : 'relasi-status--pending'}`}>Misi {r.robberyMissionCompleted ? 'selesai' : 'belum'}</span>
                    <span className={`relasi-status rounded-full border px-2 py-1 text-[10px] ${r.bloodOathDate ? 'relasi-status--oath' : 'relasi-status--pending'}`}>{r.bloodOathDate ? 'Sumpah darah' : 'Belum sumpah'}</span>
                    {!r.active && <span className="relasi-status rounded-full border border-line px-2 py-1 text-[10px] text-subtle">Nonaktif</span>}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-3 text-xs sm:grid-cols-4">
                    <div><span className="block text-[10px] uppercase tracking-wider text-subtle">Tanggal masuk</span><span className="mt-1 block">{r.joinedAt || '—'}</span></div>
                    <div><span className="block text-[10px] uppercase tracking-wider text-subtle">Penanggung jawab</span><span className="mt-1 block truncate">{r.responsiblePerson || '—'}</span></div>
                    <div><span className="block text-[10px] uppercase tracking-wider text-subtle">Misi rampok</span><span className="mt-1 block">{r.robberyMissionCompleted ? 'Selesai' : 'Belum'}</span></div>
                    <div><span className="block text-[10px] uppercase tracking-wider text-subtle">Tanggal sumpah darah</span><span className="mt-1 block font-medium text-[#c2a76e]">{r.bloodOathDate || 'Belum dicatat'}</span></div>
                  </div>
                </article>
              ))}
            </div>
            <aside className="border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <h2 className="relasi-display text-xs font-semibold uppercase tracking-[0.16em] text-muted">Aktivitas terbaru</h2>
              {timeline.length === 0 ? <p className="mt-4 text-xs text-subtle">Belum ada aktivitas.</p> : <ol className="relasi-timeline mt-4 space-y-4">{timeline.map(item => <li key={item.id} className="relative border-l border-line pl-4"><span className="relasi-timeline__dot absolute -left-[4px] top-1 h-2 w-2 rounded-full bg-[#b99a5c]" /><div className="text-xs font-medium">{item.firstName} {item.lastName}</div><div className="mt-1 text-[10px] text-subtle">{item.bloodOathDate ? `Sumpah darah · ${item.bloodOathDate}` : 'Data relasi diperbarui'}</div><div className="mt-1 text-[10px] text-subtle">{new Date(item.updatedAt || item.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</div></li>)}</ol>}
            </aside>
          </div>
        </div>
      </div>
      {editor && <RelasiEditor open={editor} form={form} setForm={setForm} saving={saving} mediaBusy={mediaBusy} error={error} onClose={() => setEditor(false)} onSave={save} onUpload={uploadMedia} />}
    </div>
  );
}

/* ══════════════ Admin Panel Component ══════════════ */
function AdminPanel({ open, onClose, role, deviceId }: { open: boolean; onClose: () => void; role: Role; deviceId: string }) {
  const [tab, setTab] = useState<'requests' | 'reports' | 'admins' | 'audit' | 'factions'>('requests');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [factions, setFactions] = useState<FactionDef[]>([]);
  const [error, setError] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminDeviceId, setNewAdminDeviceId] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<Role>('MOD');
  const [adminSaving, setAdminSaving] = useState(false);
  const isSuper = role === 'SUPER';

  const load = useCallback(async () => {
    setError('');
    try {
      if (tab === 'requests') {
        const res = await fetch('/api/admin/requests', { headers: staffHeaders(deviceId, false), cache: 'no-store' });
        if (!res.ok) throw new Error(await httpError(res)); setRequests(await res.json());
      } else if (tab === 'reports') {
        const res = await fetch('/api/reports', { headers: staffHeaders(deviceId, false), cache: 'no-store' });
        if (!res.ok) throw new Error(await httpError(res)); setReports(await res.json());
      } else if (tab === 'admins' && isSuper) {
        const res = await fetch('/api/admin/admins', { headers: staffHeaders(deviceId, false), cache: 'no-store' });
        if (!res.ok) throw new Error(await httpError(res)); setAdmins(await res.json());
      } else if (tab === 'audit' && isSuper) {
        const res = await fetch('/api/admin/audit', { headers: staffHeaders(deviceId, false), cache: 'no-store' });
        if (!res.ok) throw new Error(await httpError(res)); setLogs(await res.json());
      } else if (tab === 'factions' && isSuper) {
        const res = await fetch('/api/factions', { cache: 'no-store' });
        if (!res.ok) throw new Error(await httpError(res)); setFactions(await res.json());
      }
    } catch (e: any) { setError(e?.message || 'Gagal memuat panel admin'); }
  }, [tab, isSuper, deviceId]);

  useEffect(() => { if (open) { load(); const id = setInterval(load, 15000); return () => clearInterval(id); } }, [open, load]);

  const action = async (id: string, nextAction: 'APPROVE' | 'REVOKE' | 'BAN') => {
    await fetch('/api/admin/requests', { method: 'PATCH', headers: staffHeaders(deviceId), body: JSON.stringify({ id, action: nextAction }) });
    load();
  };

  const addAdmin = async () => {
    setError('');
    setAdminSaving(true);
    try {
      const res = await fetch('/api/admin/admins', { method: 'POST', headers: staffHeaders(deviceId), body: JSON.stringify({ name: newAdminName, deviceId: newAdminDeviceId, role: newAdminRole === 'SUPER' ? 'SUPERMODERATOR' : 'MODERATOR' }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Gagal menambahkan moderator');
      setNewAdminName('');
      setNewAdminDeviceId('');
      setNewAdminRole('MOD');
      await load();
    } catch (e: any) { setError(e?.message || 'Gagal menambahkan moderator'); }
    finally { setAdminSaving(false); }
  };

  if (!open) return null;
  const tabs: { id: typeof tab; label: string }[] = [{ id: 'requests', label: 'Requests' }, { id: 'reports', label: 'Reports' }];
  if (isSuper) tabs.push({ id: 'admins', label: 'Admins' }, { id: 'audit', label: 'Audit' }, { id: 'factions', label: 'Factions' });

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-app">
      <header className="flex items-center justify-between border-b border-line bg-card px-4 py-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div><h1 className="text-lg font-bold">Admin Center</h1><p className="text-[11px] text-muted">{isSuper ? 'Super Admin' : 'Moderator'}</p></div>
        <button onClick={onClose} className="rounded-lg bg-hover px-4 py-2 text-sm">Tutup</button>
      </header>
      <nav className="flex gap-2 overflow-x-auto border-b border-line px-4 py-3">{tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab === t.id ? 'bg-accent text-accent-text' : 'bg-card text-muted'}`}>{t.label}</button>)}</nav>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
        {tab === 'requests' && <div className="mx-auto max-w-5xl space-y-2">{requests.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card p-4"><div className="min-w-0"><div className="text-sm font-semibold">{r.status}</div><div className="mt-1 break-all font-mono text-[11px] text-subtle">{r.deviceId} · {r.ipAddress}</div></div><div className="flex items-center gap-2"><CopyButton value={r.deviceId} /><button onClick={() => action(r.id, 'APPROVE')} className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">ACC</button><button onClick={() => action(r.id, 'REVOKE')} className="rounded-lg bg-hover px-3 py-2 text-xs">Revoke</button><button onClick={() => action(r.id, 'BAN')} className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">Ban</button></div></div>)}</div>}
        {tab === 'reports' && <div className="mx-auto max-w-5xl space-y-2">{reports.map(r => <div key={r.id} className="rounded-xl border border-line bg-card p-4"><div className="text-[11px] text-subtle">{r.deviceId} · {formatDate(r.createdAt)}</div><div className="mt-1 text-sm">{r.message}</div></div>)}</div>}
        {tab === 'admins' && <div className="mx-auto max-w-5xl space-y-5">
          <form onSubmit={event => { event.preventDefault(); void addAdmin(); }} className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2">
            <label className="text-xs text-muted">Nama moderator<input value={newAdminName} onChange={event => setNewAdminName(event.target.value)} maxLength={60} required placeholder="Nama staff" className="mt-1 w-full rounded-lg border border-line bg-app px-3 py-2.5 text-sm text-main" /></label>
            <label className="text-xs text-muted">Device ID<input value={newAdminDeviceId} onChange={event => setNewAdminDeviceId(event.target.value.trim())} required placeholder="Device ID moderator" className="mt-1 w-full rounded-lg border border-line bg-app px-3 py-2.5 font-mono text-xs text-main" /></label>
            <label className="text-xs text-muted sm:col-span-2">Role<select value={newAdminRole} onChange={event => setNewAdminRole(event.target.value as Role)} className="mt-1 w-full rounded-lg border border-line bg-app px-3 py-2.5 text-sm text-main"><option value="MOD">Moderator</option><option value="SUPER">Super Moderator</option></select></label>
            {newAdminRole === 'SUPER' && <p className="text-[11px] text-[#c2a76e] sm:col-span-2">Super Moderator mendapat hak Super Admin sesuai aturan akses yang berlaku.</p>}
            <button type="submit" disabled={adminSaving} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text transition-colors hover:bg-accent-hover disabled:opacity-50 sm:col-span-2">{adminSaving ? 'Menambahkan…' : 'Tambah staff'}</button>
          </form>
          <div className="space-y-2">{admins.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card p-4"><div className="min-w-0"><div className="text-sm font-medium">{a.name}</div><div className="mt-1 break-all font-mono text-[10px] text-subtle">{a.deviceId}</div></div><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] ${a.role === 'SUPER' ? 'border-[#a58a55]/30 bg-[#a58a55]/10 text-[#c2a76e]' : 'border-line text-muted'}`}>{a.role === 'SUPER' ? 'Super Moderator' : 'Moderator'}</span><CopyButton value={a.deviceId} /></div></div>)}</div>
        </div>}
        {tab === 'audit' && <div className="mx-auto max-w-5xl space-y-2">{logs.map(l => <div key={l.id} className="rounded-xl border border-line bg-card p-4"><div className="text-xs font-semibold">{l.action} · {l.adminName}</div><div className="mt-1 text-[11px] text-muted">{l.details || '-'}</div></div>)}</div>}
        {tab === 'factions' && <div className="mx-auto max-w-5xl grid gap-2 sm:grid-cols-2">{factions.map(f => <div key={f.id} className="rounded-xl border border-line bg-card p-4"><FactionTag fac={f} variant="pill" /><div className="mt-2 text-xs text-muted">{f.label}</div></div>)}</div>}
      </div>
    </div>
  );
}

function LockScreen({ deviceId, status, meta, onRefresh }: { deviceId: string; status: string; meta: any; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const requestAccess = async () => {
    setLoading(true); setMessage('');
    try {
      const res = await fetch('/api/auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setMessage(json.error || 'Permintaan akses gagal.');
      else onRefresh();
    } catch { setMessage('Gagal menghubungi server.'); }
    finally { setLoading(false); }
  };
  const title = status === 'BANNED' ? 'Akses Diblokir' : status === 'TIMEOUT' ? 'Akses Ditangguhkan' : status === 'PENDING' ? 'Menunggu Persetujuan' : 'Akses Terkunci';
  return (
    <main className="flex min-h-screen items-center justify-center bg-app p-4 text-main">
      <section className="w-full max-w-md rounded-2xl border border-line bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-500"><BugIcon className="h-8 w-8" /></div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{status === 'PENDING' ? 'Permintaan akses kamu sedang menunggu keputusan Admin atau Moderator.' : status === 'BANNED' ? 'Kamu tidak memiliki izin untuk mengakses halaman ini.' : 'Website bersifat privat dan akses harus disetujui oleh staff.'}</p>
        {(status === 'BANNED' || status === 'TIMEOUT') && meta?.reason && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-left text-sm text-red-400">{meta.reason}</div>}
        {status === 'TIMEOUT' && meta?.timeoutUntil && <div className="mt-3 text-xs text-muted">Dibuka kembali: {new Date(meta.timeoutUntil).toLocaleString('id-ID')}</div>}
        {message && <div className="mt-4 text-xs text-red-500">{message}</div>}
        {status === 'UNAUTHORIZED' && <button onClick={requestAccess} disabled={loading} className="mt-6 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-text disabled:opacity-50">{loading ? 'Memproses…' : 'Minta Akses'}</button>}
        <div className="mt-6 flex items-center justify-between gap-3 rounded-lg bg-hover px-3 py-2"><div className="min-w-0"><div className="text-[10px] text-subtle">Device ID</div><div className="mt-1 break-all font-mono text-[10px] text-muted">{deviceId}</div></div><CopyButton value={deviceId} /></div>
      </section>
    </main>
  );
}

const staffHeaders = (deviceId: string, json = true): HeadersInit => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  'x-device-id': deviceId,
});

async function httpError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try { const json = JSON.parse(text); if (json.error) return String(json.error); } catch { /* not JSON */ }
  return `HTTP ${res.status}${text ? `: ${text.slice(0, 180)}` : ''}`;
}

function BugIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h8l1.5 3H6.5L8 7Zm-2 3v5a6 6 0 0 0 12 0v-5M12 10v10M3 13h3m12 0h3M5 8l-2-2m16 2 2-2" /></svg>;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement('textarea');
      input.value = value;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copiedText = document.execCommand('copy');
      input.remove();
      if (!copiedText) return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return <button type="button" onClick={copy} className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-[10px] font-medium text-muted transition-colors hover:border-line-hover hover:text-main" aria-label="Salin Device ID">{copied ? 'Tersalin' : 'Salin'}</button>;
}

function FactionTag({ fac, variant }: { fac: FactionDef; variant: 'pill' | 'widget' }) {
  const label = fac.short.split(',')[0];
  if (variant === 'widget') return <span className="rounded-lg border border-line px-2 py-1 text-xs">{label}</span>;
  return <span className="inline-flex rounded-full border border-line bg-hover px-2.5 py-1 text-[10px] font-semibold">{label}</span>;
}
