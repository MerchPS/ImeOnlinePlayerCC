"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Player = { id: number; name: string; ping: number };
type ApiData = {
  ok: boolean;
  gate: string;
  online: number;
  max: number;
  players: Player[];
  updatedAt: string;
  error?: string;
};

const PAGE_SIZE = 25;
const REFRESH_MS = 60_000;

function pingStyle(ping: number) {
  if (ping < 80)
    return "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30";
  if (ping < 150) return "bg-amber-500/15 text-amber-400 ring-amber-500/30";
  return "bg-red-500/15 text-red-400 ring-red-500/30";
}

const fmt = (n: number) => n.toLocaleString("id-ID");

export default function Home() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/players", { cache: "no-store" });
      const json: ApiData = await res.json();
      if (!json.ok) throw new Error(json.error || "Gagal memuat data");
      setData(json);
      setError(null);
      setLastFetch(new Date());
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
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

  const filtered = useMemo(() => {
    const players = data?.players ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.id).includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);
  useEffect(() => {
    setPage(0);
  }, [search]);

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.18),_transparent_60%)]" />

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              IME Roleplay <span className="text-slate-600">•</span>{" "}
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Player Monitor
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Pantau siapa saja yang sedang bermain sekarang
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs">
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${error ? "bg-red-500" : "bg-emerald-400"} ${error ? "" : "animate-ping"} opacity-75`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${error ? "bg-red-500" : "bg-emerald-400"}`}
              />
            </span>
            <span className={error ? "text-red-400" : "text-emerald-400"}>
              {error ? "Offline" : loading ? "Menghubungkan…" : "Live"}
            </span>
          </div>
        </header>

        {/* Stat cards */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Online"
            value={data ? fmt(data.online) : "—"}
            accent="text-emerald-400"
          />
          <StatCard
            label="Max Slots"
            value={data ? fmt(data.max) : "—"}
            accent="text-blue-400"
          />
          <StatCard
            label="Gate"
            value={data?.gate ?? "—"}
            accent="text-purple-400"
            small
          />
          <StatCard
            label="Last Update"
            value={lastFetch ? lastFetch.toLocaleTimeString("id-ID") : "—"}
            accent="text-slate-300"
            small
          />
        </section>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            ⚠️ {error}
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau kantong…"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-blue-500/60 disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-semibold">Kantong</th>
                  <th className="px-4 py-3 font-semibold">Nama</th>
                  <th className="px-4 py-3 text-right font-semibold">Ping</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-16 text-center text-slate-500"
                    >
                      Memuat data…
                    </td>
                  </tr>
                ) : slice.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-16 text-center text-slate-500"
                    >
                      {filtered.length
                        ? "Tidak ada hasil pencarian."
                        : "Tidak ada player online."}
                    </td>
                  </tr>
                ) : (
                  slice.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-800/60 transition hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-blue-300 ring-1 ring-inset ring-blue-500/30">
                          Kantong #{p.id}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex rounded-md px-2.5 py-1 font-mono text-xs font-semibold ring-1 ring-inset ${pingStyle(p.ping)}`}
                        >
                          {p.ping} ms
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
          <div>
            Auto-refresh tiap 60 detik • {filtered.length} player
            {filtered.length === 1 ? "" : "s"} ditemukan
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage <= 0}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-blue-500/60 disabled:opacity-40"
            >
              ◀ Prev
            </button>
            <span className="min-w-[60px] text-center text-xs font-medium text-slate-300">
              {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-blue-500/60 disabled:opacity-40"
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 truncate font-bold ${accent} ${small ? "text-base" : "text-2xl"}`}
      >
        {value}
      </div>
    </div>
  );
}
