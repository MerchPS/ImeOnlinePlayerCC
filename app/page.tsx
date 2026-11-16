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
  badge: string;   // tailwind classes untuk badge
  dot: string;     // warna dot di nav
  match: (p: string) => boolean;
};

const FACTIONS: FactionDef[] = [
  { id: 'CC',    short: 'CC',    label: 'Crimson Creed',             badge: 'bg-[#3a1f1a] text-[#e09b7a] border-[#5a2f25]', dot: 'bg-[#c97a5c]', match: p => p.includes('CC') },
  { id: 'LSPD',  short: 'LSPD',  label: 'Polisi Kota',                badge: 'bg-[#1a2535] text-[#82aed8] border-[#253a55]', dot: 'bg-[#6a9dd8]', match: p => p.includes('LSPD') },
  { id: '4B',    short: '4B',    label: '4Bloods',                    badge: 'bg-[#2f1a1a] text-[#d47878] border-[#4a2525]', dot: 'bg-[#c95c5c]', match: p => p.includes('4B') },
  { id: 'DOC',   short: 'DOC',   label: 'Department Of Correction',   badge: 'bg-[#252525] text-[#b0b0b0] border-[#3a3a3a]', dot: 'bg-[#a0a0a0]', match: p => p.includes('DOC') },
  { id: 'LSSD',  short: 'LSSD',  label: 'Serif',                      badge: 'bg-[#2f2a1a] text-[#dcc878] border-[#4a4525]', dot: 'bg-[#c9b05c]', match: p => p.includes('LSSD') },
  { id: 'MEDIC', short: 'MED',   label: 'Dokter Kota',                badge: 'bg-[#25302a] text-[#9dd88c] border-[#3a4a35]', dot: 'bg-[#8cc97a]', match: p => p.includes('MEDIC') },
  { id: 'RH',    short: 'RH',    label: 'Roxwood Hospital',           badge: 'bg-[#1a2f2a] text-[#7ad8b0] border-[#254a3f]', dot: 'bg-[#6ac9a0]', match: p => p.includes('RH') },
  { id: 'ICR',   short: 'ICR',   label: 'Mekanik IME',                badge: 'bg-[#3a2f1a] text-[#dcc878] border-[#5a4a25]', dot: 'bg-[#c9a95c]', match: p => p.includes('ICR') },
  { id: 'DOJ',   short: 'DOJ',   label: 'Department Of Justice',      badge: 'bg-[#2a1f35] text-[#b48fd8] border-[#3f2f55]', dot: 'bg-[#a07ac9]', match: p => p.includes('DOJ') },
  { id: 'JRZ',   short: 'JRZ',   label: 'Jeruzalem',                  badge: 'bg-[#3a351a] text-[#dcd478] border-[#5a5525]', dot: 'bg-[#c9c05c]', match: p => p.includes('JRZ') },
  { id: 'HT',    short: 'HT',    label: 'HighTable',                  badge: 'bg-[#2a2515] text-[#e0b88a] border-[#453f25]', dot: 'bg-[#d4a574]', match: p => p.includes('HT') },
  { id: 'IME',   short: 'IME',   label: 'Helper',                     badge: 'bg-[#1a2f35] text-[#7ad8e0] border-[#254a55]', dot: 'bg-[#6ac9d8]', match: p => p.includes('#IME') }
];

const WARGA: FactionDef = {
  id: 'WARGA', short: 'Warga', label: 'Civilian',
  badge: 'bg-[#252320] text-[#a09889] border-[#3a3630]',
  dot: 'bg-[#8f8578]',
  match: () => true
};

function detectFaction(name: string): string {
  const prefix = name.split(' - ')[0].toUpperCase();
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
  if (p < 80)  return 'bg-[#1a2418] text-[#9dd88c] border-[#2a3a25]';
  if (p < 150) return 'bg-[#2a2015] text-[#dcc878] border-[#4a3a25]';
  return 'bg-[#2a1512] text-[#e09b7a] border-[#4a2520]';
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

  /* Fetch loop */
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

  /* Enrich players with faction */
  const enriched = useMemo(
    () => (data?.players ?? []).map(p => ({ ...p, faction: detectFaction(p.name) })),
    [data]
  );

  /* Faction counts */
  const counts = useMemo(() => {
    const c: Record<string, number> = { SEMUA: enriched.length };
    for (const f of [...FACTIONS, WARGA]) c[f.id] = 0;
    for (const p of enriched) c[p.faction] = (c[p.faction] ?? 0) + 1;
    return c;
  }, [enriched]);

  /* Filter: category → search */
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

  /* Nav categories */
  const navCats = useMemo(() => {
    const items = [
      { id: 'SEMUA', short: 'Semua', dot: 'bg-[#d4a574]' },
      ...FACTIONS.map(f => ({ id: f.id, short: f.short, dot: f.dot })),
      { id: 'WARGA', short: 'Warga', dot: WARGA.dot }
    ];
    // sembunyikan faction kosong kecuali aktif
    return items.filter(it => (counts[it.id] ?? 0) > 0 || it.id === activeCat);
  }, [counts, activeCat]);

  return (
    <main className="min-h-screen bg-[#0c0a08] text-[#ebe3d5]">
      {/* ── Floating pill nav (dynamic island) ── */}
      <div className="fixed top-3 left-1/2 z-40 max-w-[calc(100vw-24px)] -translate-x-1/2">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full border border-[#2a2520] bg-[#15120f]/95 px-1.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
          {navCats.map(cat => {
            const active = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  active
                    ? 'bg-[#d4a574] text-[#0c0a08]'
                    : 'text-[#8a8073] hover:bg-[#1c1815] hover:text-[#ebe3d5]'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#0c0a08]' : cat.dot}`} />
                <span>{cat.short}</span>
                <span className={`text-[10px] ${active ? 'text-[#0c0a08]/70' : 'text-[#5a554c]'}`}>
                  {counts[cat.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-16 pt-20 sm:px-6">
        {/* ── Header ── */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[#5a554c]">
              IME Roleplay
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Player Monitor
            </h1>
            <p className="mt-1 text-sm text-[#8a8073]">
              Pantau siapa saja yang sedang bermain sekarang
            </p>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge error={error} loading={loading} refreshing={refreshing} />
            <button
              onClick={() => setAiOpen(true)}
              className="group flex items-center gap-2 rounded-full border border-[#3a3025] bg-[#1c1815] px-4 py-2 text-xs font-medium text-[#d4a574] transition hover:border-[#d4a574]/50 hover:bg-[#221d18]"
            >
              <SparkIcon className="h-3.5 w-3.5" />
              Tanya AI
            </button>
          </div>
        </header>

        {/* ── Stats ── */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Online"       value={data ? fmt(data.online) : '—'} accent="text-[#9dd88c]" />
          <Stat label="Max Slots"    value={data ? fmt(data.max)    : '—'} accent="text-[#82aed8]" />
          <Stat label="Gate"         value={data?.gate ?? '—'}             accent="text-[#d4a574]" small />
          <Stat label="Terakhir"     value={lastFetch ? lastFetch.toLocaleTimeString('id-ID') : '—'} accent="text-[#a09889]" small />
        </section>

        {error && (
          <div className="mb-4 rounded-lg border border-[#5a2f25] bg-[#2a1512] px-4 py-3 text-sm text-[#e09b7a]">
            ⚠ {error}
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5a554c]" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau kantong…"
              className="w-full rounded-lg border border-[#2a2520] bg-[#15120f] py-2.5 pl-10 pr-4 text-sm text-[#ebe3d5] placeholder-[#5a554c] outline-none transition focus:border-[#d4a574]/50 focus:ring-2 focus:ring-[#d4a574]/15"
            />
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2a2520] bg-[#15120f] px-4 py-2.5 text-sm font-medium text-[#ebe3d5] transition hover:border-[#d4a574]/40 disabled:opacity-40"
          >
            <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Table ── */}
        <div className="overflow-hidden rounded-xl border border-[#2a2520] bg-[#12100e]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2520] bg-[#15120f] text-left text-[10px] font-semibold uppercase tracking-wider text-[#5a554c]">
                  <th className="w-28 px-4 py-3">Kantong</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="w-20 px-4 py-3 text-right">Ping</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr><td colSpan={3} className="px-4 py-16 text-center text-[#5a554c]">Memuat data…</td></tr>
                ) : slice.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-16 text-center text-[#5a554c]">
                    {filtered.length ? 'Tidak ada hasil.' : 'Tidak ada player di kategori ini.'}
                  </td></tr>
                ) : slice.map(p => {
                  const fac = factionOf(p.faction);
                  return (
                    <tr key={p.id} className="border-b border-[#1e1b17] transition hover:bg-[#16130f]">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-md border border-[#3a3630] bg-[#252320] px-2 py-0.5 font-mono text-[11px] font-medium text-[#ebe3d5]">
                          #{p.id}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${fac.badge}`}>
                            {fac.short}
                          </span>
                          <span className="truncate text-[13px] text-[#ebe3d5]">{p.name}</span>
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

        {/* ── Footer ── */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#5a554c]">
          <div>Auto-refresh 60 detik · {filtered.length} player</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage <= 0}
              className="rounded-md border border-[#2a2520] bg-[#15120f] px-3 py-1.5 font-medium text-[#ebe3d5] transition hover:border-[#d4a574]/40 disabled:opacity-30"
            >
              ← Prev
            </button>
            <span className="min-w-[52px] text-center font-mono text-[#a09889]">
              {safePage + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded-md border border-[#2a2520] bg-[#15120f] px-3 py-1.5 font-medium text-[#ebe3d5] transition hover:border-[#d4a574]/40 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ── AI Drawer ── */}
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
    <div className="rounded-lg border border-[#2a2520] bg-[#12100e] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5a554c]">{label}</div>
      <div className={`mt-1 truncate font-semibold ${accent} ${small ? 'text-base' : 'text-xl'}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ error, loading, refreshing }: { error: string | null; loading: boolean; refreshing: boolean }) {
  const state = error ? 'err' : loading ? 'wait' : 'ok';
  const map = {
    ok:   { dot: 'bg-[#9dd88c]', text: 'text-[#9dd88c]', label: 'Live' },
    wait: { dot: 'bg-[#d4a574]', text: 'text-[#d4a574]', label: 'Memuat' },
    err:  { dot: 'bg-[#e09b7a]', text: 'text-[#e09b7a]', label: 'Offline' }
  } as const;
  const s = map[state];
  return (
    <div className="flex items-center gap-2 rounded-full border border-[#2a2520] bg-[#15120f] px-3 py-1.5 text-[11px]">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${refreshing ? 'animate-pulse' : ''}`} />
      <span className={s.text}>{s.label}</span>
    </div>
  );
}

/* ─── AI Drawer ─── */
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
    // ringkasan faction
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
        className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-[#2a2520] bg-[#0f0d0a] transition-transform duration-300 sm:w-[440px] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2520] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d4a574]/15">
              <SparkIcon className="h-4 w-4 text-[#d4a574]" />
            </span>
            <div>
              <div className="text-sm font-semibold">Analisis AI</div>
              <div className="text-[11px] text-[#5a554c]">Punya konteks data player realtime</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#5a554c] transition hover:bg-[#1c1815] hover:text-[#ebe3d5]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {msgs.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-[#8a8073]">
                Tanya apa saja soal server yang lagi online. Contoh:
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-[#2a2520] bg-[#15120f] px-3 py-2 text-left text-[13px] text-[#8a8073] transition hover:border-[#d4a574]/40 hover:bg-[#1a1714] hover:text-[#ebe3d5]"
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
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#d4a574] text-[#0c0a08]'
                    : 'border border-[#2a2520] bg-[#15120f] text-[#ebe3d5]'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-xl border border-[#2a2520] bg-[#15120f] px-3.5 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5a554c]" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5a554c]" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#5a554c]" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[#2a2520] p-3">
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
              className="flex-1 resize-none rounded-lg border border-[#2a2520] bg-[#15120f] px-3 py-2 text-[13px] text-[#ebe3d5] placeholder-[#5a554c] outline-none transition focus:border-[#d4a574]/50 focus:ring-2 focus:ring-[#d4a574]/15"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex shrink-0 items-center justify-center rounded-lg bg-[#d4a574] px-3 text-[#0c0a08] transition hover:bg-[#e0b88a] disabled:opacity-30"
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
