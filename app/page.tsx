'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ══════════════ Types ══════════════ */
type Player = { id: number; name: string; ping: number };
type AiMsg = { role: 'user' | 'assistant'; content: string };
type ApiData = {
  ok: boolean;
  gate: string;
  online: number;
  max: number;
  players: Player[];
  updatedAt: string;
  error?: string;
};

/* ══════════════ Faction system ══════════════ */
type FactionDef = {
  id: string;
  short: string;
  label: string;
  badge: string;
  dot: string;
  match: (p: string) => boolean;
};

const FACTIONS: FactionDef[] = [
  { id: 'CC',      short: 'CC',       label: 'Crimson Creed',             badge: 'bg-[#3a1f1a] text-[#e09b7a] border-[#5a2f25]', dot: 'bg-[#c97a5c]', match: p => p.includes('CC') },
  { id: 'LSPD',    short: 'LSPD',     label: 'Polisi Kota',                badge: 'bg-[#1a2535] text-[#82aed8] border-[#253a55]', dot: 'bg-[#6a9dd8]', match: p => p.includes('LSPD') },
  { id: '4B',      short: '4B',       label: '4Bloods',                    badge: 'bg-[#2f1a1a] text-[#d47878] border-[#4a2525]', dot: 'bg-[#c95c5c]', match: p => p.includes('4B') },
  { id: 'DOC',     short: 'DOC',      label: 'Department Of Correction',   badge: 'bg-[#252525] text-[#b0b0b0] border-[#3a3a3a]', dot: 'bg-[#a0a0a0]', match: p => p.includes('DOC') },
  { id: 'LSSD',    short: 'LSSD',     label: 'Serif',                      badge: 'bg-[#2f2a1a] text-[#dcc878] border-[#4a4525]', dot: 'bg-[#c9b05c]', match: p => p.includes('LSSD') },
  { id: 'MEDIC',   short: 'MED',      label: 'Dokter Kota',                badge: 'bg-[#25302a] text-[#9dd88c] border-[#3a4a35]', dot: 'bg-[#8cc97a]', match: p => p.includes('MEDIC') },
  { id: 'RH',      short: 'RH',       label: 'Roxwood Hospital',           badge: 'bg-[#1a2f2a] text-[#7ad8b0] border-[#254a3f]', dot: 'bg-[#6ac9a0]', match: p => p.includes('RH') },
  { id: 'ICR',     short: 'ICR',      label: 'Mekanik IME',                badge: 'bg-[#3a2f1a] text-[#dcc878] border-[#5a4a25]', dot: 'bg-[#c9a95c]', match: p => p.includes('ICR') },
  { id: 'DOJ',     short: 'DOJ',      label: 'Department Of Justice',      badge: 'bg-[#2a1f35] text-[#b48fd8] border-[#3f2f55]', dot: 'bg-[#a07ac9]', match: p => p.includes('DOJ') },
  { id: 'JRZ',     short: 'JRZ',      label: 'Jeruzalem',                  badge: 'bg-[#3a351a] text-[#dcd478] border-[#5a5525]', dot: 'bg-[#c9c05c]', match: p => p.includes('JRZ') },
  { id: 'HT',      short: 'HT',       label: 'HighTable',                  badge: 'bg-[#2a2515] text-[#e0b88a] border-[#453f25]', dot: 'bg-[#d4a574]', match: p => p.includes('HT') },
  { id: 'IME',     short: 'IME',      label: 'Helper',                     badge: 'bg-[#1a2f35] text-[#7ad8e0] border-[#254a55]', dot: 'bg-[#6ac9d8]', match: p => p.includes('#IME') },
  { id: 'BURGENK', short: 'Burgenk',  label: 'Burgenk',                    badge: 'bg-[#2a1a25] text-[#d882b0] border-[#4a2540]', dot: 'bg-[#c95c90]', match: p => p.includes('BURGENK') },
  { id: 'DTF',     short: 'DTF',      label: 'DTF',                        badge: 'bg-[#1a2525] text-[#82d8d8] border-[#254a4a]', dot: 'bg-[#6ac9c9]', match: p => p.includes('DTF') },
  { id: 'ALLSTAR', short: 'Allstars', label: 'Allstars',                   badge: 'bg-[#25251a] text-[#d8d882] border-[#4a4a25]', dot: 'bg-[#c9c95c]', match: p => p.includes('ALLSTAR') },
  { id: 'NSN',     short: 'NSN',      label: 'NSN',                        badge: 'bg-[#351a2a] text-[#d882b0] border-[#552540]', dot: 'bg-[#c95c90]', match: p => p.includes('NSN') },
  { id: 'WT',      short: 'WT',       label: 'WT',                         badge: 'bg-[#1a3525] text-[#82d8a0] border-[#254a35]', dot: 'bg-[#6ac980]', match: p => p.startsWith('WT') },
  { id: '24S',     short: '24S',      label: '24S',                        badge: 'bg-[#2a1a1a] text-[#d88282] border-[#4a2525]', dot: 'bg-[#c95c5c]', match: p => p.includes('24S') },
  { id: 'OMC',     short: 'OMC',      label: 'OMC',                        badge: 'bg-[#1a2a35] text-[#82b0d8] border-[#254055]', dot: 'bg-[#5c90c9]', match: p => p.includes('OMC') },
  { id: '5TAR',    short: '5TAR',     label: '5TAR',                       badge: 'bg-[#352a1a] text-[#d8b082] border-[#554025]', dot: 'bg-[#c9905c]', match: p => p.includes('5TAR') },
  { id: 'MX',      short: 'MX',       label: 'MX',                         badge: 'bg-[#2a1a35] text-[#b082d8] border-[#402555]', dot: 'bg-[#905cc9]', match: p => p.startsWith('MX') },
  { id: 'RCMC',    short: 'RCMC',     label: 'RCMC',                       badge: 'bg-[#35251a] text-[#d8a082] border-[#553a25]', dot: 'bg-[#c9805c]', match: p => p.includes('RCMC') || p.includes('RC1') },
  { id: 'RAGE',    short: 'RAGE',     label: 'RAGE',                       badge: 'bg-[#351a1a] text-[#d88282] border-[#552525]', dot: 'bg-[#c95c5c]', match: p => p.startsWith('RAGE') },
  { id: 'ALTION',  short: 'Altion',   label: 'Altion',                     badge: 'bg-[#1a352a] text-[#82d8b0] border-[#254a40]', dot: 'bg-[#5cc990]', match: p => p.includes('ALTION') },
  { id: 'NN',      short: 'NN',       label: 'NN',                         badge: 'bg-[#251a35] text-[#a082d8] border-[#352555]', dot: 'bg-[#805cc9]', match: p => p.startsWith('NN') }
];

const WARGA: FactionDef = {
  id: 'WARGA', short: 'Untagged', label: 'Untagged',
  badge: 'bg-hover text-muted border-line', // Menyesuaikan tema
  dot: 'bg-muted',
  match: () => true
};

function detectFaction(name: string): string {
  const prefix = name.split(' - ')[0].toUpperCase().trim();
  for (const f of FACTIONS) if (f.match(prefix)) return f.id;
  return 'WARGA';
}

function factionOf(id: string): FactionDef {
  return FACTIONS.find(f => f.id === id) ?? WARGA;
}

/* ══════════════ Utils ══════════════ */
const PAGE_SIZE = 25;
const REFRESH_MS = 60_000;
const fmt = (n: number) => n.toLocaleString('id-ID');

function pingClass(p: number) {
  if (p < 80)  return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  if (p < 150) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  return 'bg-red-500/10 text-red-500 border-red-500/20';
}

function formatTime(ms: number) {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ══════════════ Markdown Renderer ══════════════ */
function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    const parseBold = (str: string) => {
      return str.split(/(\*\*.*?\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j} className="font-semibold text-accent">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+\s+/, '');
      return <div key={i} className={`font-semibold text-main mt-3 mb-1 ${level === 1 ? 'text-base' : 'text-sm'}`}>{content}</div>;
    }

    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const content = line.replace(/^[-*]\s+/, '');
      return (
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-subtle">•</span>
          <span>{parseBold(content)}</span>
        </div>
      );
    }

    if (!line.trim()) return <div key={i} className="h-2" />;
    return <div key={i} className="my-0.5">{parseBold(line)}</div>;
  });
}

/* ══════════════ Main ══════════════ */
export default function Home() {
  const [data, setData]         = useState<ApiData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [activeCat, setActiveCat] = useState<string>('SEMUA');
  const [page, setPage]         = useState(0);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [aiOpen, setAiOpen]     = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light' | 'glass'>('dark');
  
  // Restart Timer State
  const [countdown, setCountdown] = useState<{ diffMs: number, target: Date } | null>(null);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Restart Timer Logic (06:00 & 18:00 WIB / UTC+7)
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const wibOffset = 7 * 60 * 60 * 1000;
      const nowWib = new Date(now.getTime() + wibOffset);
      const h = nowWib.getUTCHours();

      let targetWib = new Date(nowWib);
      targetWib.setUTCHours(0, 0, 0, 0);

      if (h < 6) {
        targetWib.setUTCHours(6, 0, 0, 0);
      } else if (h < 18) {
        targetWib.setUTCHours(18, 0, 0, 0);
      } else {
        targetWib.setUTCDate(targetWib.getUTCDate() + 1);
        targetWib.setUTCHours(6, 0, 0, 0);
      }

      const diffMs = targetWib.getTime() - nowWib.getTime();
      const targetReal = new Date(targetWib.getTime() - wibOffset);
      setCountdown({ diffMs, target: targetReal });
    };

    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/players', { cache: 'no-store' });
      const json: ApiData = await res.json();
      if (!json.ok) throw new Error(json.error || 'Gagal memuat data');
      setData(json);
      setError(null);
      setLastFetch(new Date());
    } catch (e: any) {
      setError(e.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const enriched = useMemo(
    () => (data?.players ?? []).map(p => ({ ...p, faction: detectFaction(p.name) })),
    [data]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { SEMUA: enriched.length };
    for (const f of [...FACTIONS, WARGA]) c[f.id] = 0;
    for (const p of enriched) c[p.faction] = (c[p.faction] ?? 0) + 1;
    return c;
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (activeCat !== 'SEMUA') list = list.filter(p => p.faction === activeCat);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        p => p.name.toLowerCase().includes(q) || String(p.id).includes(q)
      );
    }
    return list;
  }, [enriched, activeCat, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);
  useEffect(() => { setPage(0); }, [search, activeCat]);

  const navCats = useMemo(() => {
    const items = [
      { id: 'SEMUA', short: 'Semua', dot: 'bg-accent' },
      ...FACTIONS.map(f => ({ id: f.id, short: f.short, dot: f.dot })),
      { id: 'WARGA', short: WARGA.short, dot: WARGA.dot }
    ];
    return items.filter(it => (counts[it.id] ?? 0) > 0 || it.id === activeCat);
  }, [counts, activeCat]);

  const isWarning = countdown && countdown.diffMs < 30 * 60 * 1000;

  return (
    <main className="min-h-screen bg-app text-main">
      {/* ── Floating pill nav ── */}
      <div className="fixed top-3 left-1/2 z-40 w-full max-w-[100vw] -translate-x-1/2 px-3">
        <div className="relative mx-auto max-w-fit">
          {/* Left Fade */}
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-app to-transparent rounded-l-full" />
          
          <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-nav px-1.5 py-1.5 shadow-lg backdrop-blur-md">
            {navCats.map(cat => {
              const active = activeCat === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    active
                      ? 'bg-accent text-accent-text shadow-md'
                      : 'text-muted hover:bg-hover hover:text-main'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-accent-text' : cat.dot}`} />
                  <span>{cat.short}</span>
                  <span className={`text-[10px] ${active ? 'text-accent-text/70' : 'text-subtle'}`}>
                    {counts[cat.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
          
          {/* Right Fade */}
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-app to-transparent rounded-r-full" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-20 sm:px-6">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-subtle">
              IME Roleplay
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Player Monitor
            </h1>
            <p className="mt-1 text-sm text-muted">
              Pantau siapa saja yang sedang bermain sekarang
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {countdown && (
              <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono transition-colors ${isWarning ? 'border-red-500/50 bg-red-500/10 text-red-500' : 'border-line bg-card text-muted'}`}>
                <span>Restart dalam</span>
                <span className="font-bold">{formatTime(countdown.diffMs)}</span>
              </div>
            )}

            {/* Theme Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/50 hover:text-main">
                <SunIcon className="h-3.5 w-3.5" />
                Tema
              </button>
              <div className="absolute right-0 top-full mt-2 hidden w-28 flex-col gap-1 rounded-xl border border-line bg-card p-1 shadow-xl group-hover:flex z-50">
                <button onClick={() => setTheme('dark')} className="rounded-lg px-2 py-1.5 text-left text-xs text-muted hover:bg-hover hover:text-main transition">Dark</button>
                <button onClick={() => setTheme('light')} className="rounded-lg px-2 py-1.5 text-left text-xs text-muted hover:bg-hover hover:text-main transition">Light</button>
                <button onClick={() => setTheme('glass')} className="rounded-lg px-2 py-1.5 text-left text-xs text-muted hover:bg-hover hover:text-main transition">Glass</button>
              </div>
            </div>

            <StatusBadge error={error} loading={loading} refreshing={refreshing} />
            
            <button
              onClick={() => setAiOpen(true)}
              className="group flex items-center gap-2 rounded-full border border-line bg-card px-4 py-1.5 text-xs font-medium text-accent transition hover:border-accent/50 hover:bg-hover"
            >
              <SparkIcon className="h-3.5 w-3.5" />
              Tanya AI
            </button>
          </div>
        </header>

        {/* ⚠️ Restart Warning Banner */}
        {isWarning && (
          <div className="mb-6 flex items-start sm:items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500 animate-pulse">
            <svg className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <span className="font-bold tracking-wide">PERINGATAN BADAI:</span> Server akan direstart dalam <span className="font-mono font-bold">{formatTime(countdown.diffMs)}</span>. Segera cari tempat aman dan simpan progress roleplay kamu!
            </div>
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Online"       value={data ? fmt(data.online) : '—'} accent="text-emerald-500" />
          <Stat label="Max Slots"    value={data ? fmt(data.max)    : '—'} accent="text-blue-500" />
          <Stat label="Gate"         value={data?.gate ?? '—'}             accent="text-accent" small />
          <Stat label="Terakhir"     value={lastFetch ? lastFetch.toLocaleTimeString('id-ID') : '—'} accent="text-muted" small />
        </section>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            ⚠ {error}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau kantong…"
              className="w-full rounded-lg border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-main placeholder-subtle outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
            />
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium text-main transition hover:border-accent/40 disabled:opacity-40"
          >
            <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-hover text-left text-[10px] font-semibold uppercase tracking-wider text-subtle">
                  <th className="w-28 px-4 py-3">Kantong</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="w-20 px-4 py-3 text-right">Ping</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr><td colSpan={3} className="px-4 py-16 text-center text-subtle">Memuat data…</td></tr>
                ) : slice.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-16 text-center text-subtle">
                    {filtered.length ? 'Tidak ada hasil.' : 'Tidak ada player di kategori ini.'}
                  </td></tr>
                ) : slice.map(p => {
                  const fac = factionOf(p.faction);
                  return (
                    <tr key={p.id} className="border-b border-line transition hover:bg-hover">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-md border border-line bg-app px-2 py-0.5 font-mono text-[11px] font-medium text-main">
                          #{p.id}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${fac.badge}`}>
                            {fac.short}
                          </span>
                          <span className="truncate text-[13px] text-main">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[11px] font-medium ${pingClass(p.ping)}`}>
                          {p.ping}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <div>Auto-refresh 60 detik · {filtered.length} player</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage <= 0}
              className="rounded-md border border-line bg-card px-3 py-1.5 font-medium text-main transition hover:border-accent/40 disabled:opacity-30"
            >
              ← Prev
            </button>
            <span className="min-w-[52px] text-center font-mono text-muted">
              {safePage + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded-md border border-line bg-card px-3 py-1.5 font-medium text-main transition hover:border-accent/40 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <AIDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        data={data}
        enriched={enriched}
        counts={counts}
        activeCat={activeCat}
      />
    </main>
  );
}

/* ══════════════ Sub-components ══════════════ */

function Stat({ label, value, accent, small }: { label: string; value: string; accent: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{label}</div>
      <div className={`mt-1 truncate font-semibold ${accent} ${small ? 'text-base' : 'text-xl'}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ error, loading, refreshing }: { error: string | null; loading: boolean; refreshing: boolean }) {
  const state = error ? 'err' : loading ? 'wait' : 'ok';
  const map = {
    ok:   { dot: 'bg-emerald-500', text: 'text-emerald-500', label: 'Live' },
    wait: { dot: 'bg-amber-500', text: 'text-amber-500', label: 'Memuat' },
    err:  { dot: 'bg-red-500', text: 'text-red-500', label: 'Offline' }
  } as const;
  const s = map[state];
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-[11px]">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${refreshing ? 'animate-pulse' : ''}`} />
      <span className={s.text}>{s.label}</span>
    </div>
  );
}

function AIDrawer({
  open, onClose, data, enriched, counts, activeCat
}: {
  open: boolean;
  onClose: () => void;
  data: ApiData | null;
  enriched: (Player & { faction: string })[];
  counts: Record<string, number>;
  activeCat: string;
}) {
  const [msgs, setMsgs] = useState<AiMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, sending]);

  const buildContext = useCallback(() => {
    if (!data) return null;
    const factionSummary: Record<string, { label: string; count: number }> = {};
    for (const [id, count] of Object.entries(counts)) {
      if (id === 'SEMUA') continue;
      if (!count) continue;
      const fac = id === 'WARGA' ? WARGA : factionOf(id);
      factionSummary[id] = { label: fac.label, count };
    }
    return {
      totalOnline: data.online,
      maxSlots: data.max,
      gate: data.gate,
      updatedAt: data.updatedAt,
      currentFilter: activeCat,
      factions: factionSummary,
      players: enriched.slice(0, 150).map(p => ({
        kantong: p.id,
        nama: p.name,
        faction: factionOf(p.faction).label,
        ping: p.ping
      }))
    };
  }, [data, counts, activeCat, enriched]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const next: AiMsg[] = [...msgs, { role: 'user', content: trimmed }];
    setMsgs(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context: buildContext() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal');
      setMsgs([...next, { role: 'assistant', content: json.text }]);
    } catch (e: any) {
      setMsgs([...next, { role: 'assistant', content: `⚠ ${e.message}` }]);
    } finally {
      setSending(false);
    }
  }

  const SUGGESTIONS = [
    'Ringkas siapa saja yang online sekarang',
    'Faction apa yang paling banyak online?',
    'Siapa saja polisi (LSPD/LSSD) yang online?',
    'Ada berapa CC dan siapa nama mereka?',
    'Player mana yang pingnya paling buruk?'
  ];

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-line bg-app transition-transform duration-300 sm:w-[440px] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
              <SparkIcon className="h-4 w-4 text-accent" />
            </span>
            <div>
              <div className="text-sm font-semibold text-main">Analisis AI</div>
              <div className="text-[11px] text-subtle">Punya konteks data player realtime</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-subtle transition hover:bg-hover hover:text-main">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {msgs.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Tanya apa saja soal server yang lagi online. Contoh:
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-line bg-card px-3 py-2 text-left text-[13px] text-muted transition hover:border-accent/40 hover:bg-hover hover:text-main"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-accent text-accent-text whitespace-pre-wrap'
                    : 'border border-line bg-card text-main'
                }`}
              >
                {m.role === 'user' ? m.content : renderMarkdown(m.content)}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-xl border border-line bg-card px-3.5 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-subtle" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line p-3">
          <form
            onSubmit={e => { e.preventDefault(); send(input); }}
            className="flex gap-2"
          >
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Tanya soal player, faction, ping…"
              rows={1}
              className="flex-1 resize-none rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-main placeholder-subtle outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex shrink-0 items-center justify-center rounded-lg bg-accent px-3 text-accent-text transition hover:bg-accent-hover disabled:opacity-30"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}

/* ─── Icons ─── */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z" />
    </svg>
  );
}
function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
