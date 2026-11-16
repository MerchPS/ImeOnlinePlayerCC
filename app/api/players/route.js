import { NextResponse } from 'next/server';

const GATES = [
  { name: 'Main Gate', url: 'http://main.imeroleplay.com:30120' },
  { name: 'International Gate', url: 'http://inter.imeroleplay.com:30120' }
];

async function getJSON(url: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: 'application/json',
      'User-Agent': 'IME-Web-Monitor/1.0'
    },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function GET() {
  let lastError: Error | null = null;

  for (const gate of GATES) {
    try {
      const [players, dynamic] = await Promise.all([
        getJSON(`${gate.url}/players.json`),
        getJSON(`${gate.url}/dynamic.json`)
      ]);

      if (!Array.isArray(players)) throw new Error('Invalid players.json');

      const cleaned = players.map((p: any) => ({
        id: Number(p.id ?? 0),
        name: String(p.name || 'Unknown').slice(0, 100),
        ping: Number(p.ping ?? 0)
      }));

      return NextResponse.json(
        {
          ok: true,
          gate: gate.name,
          online: Number(dynamic.clients ?? cleaned.length),
          max: Number(dynamic.sv_maxclients ?? 2048),
          players: cleaned,
          updatedAt: new Date().toISOString()
        },
        {
          headers: {
            'Cache-Control': 's-maxage=15, stale-while-revalidate=45'
          }
        }
      );
    } catch (err: any) {
      lastError = err;
      console.warn(`[${gate.name}] failed: ${err.message}`);
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'Semua gate IME tidak bisa dihubungi',
      detail: lastError?.message ?? null
    },
    { status: 502 }
  );
}