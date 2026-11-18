import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GATES = [
  { name: 'Main Gate', url: 'http://main.imeroleplay.com:30120' },
  { name: 'International Gate', url: 'http://inter.imeroleplay.com:30120' }
];

async function getJSON(url: string, timeoutMs = 8000) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'IME-Web-Monitor/1.0'
      },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error: any) {
    // Menangkap error asli dari sistem (misal: fetch failed, ETIMEDOUT)
    const cause = error.cause ? ` (${error.cause.code || error.cause.message})` : '';
    throw new Error(`${error.message}${cause}`);
  }
}

export async function GET() {
  let lastError: string | null = null;

  for (const gate of GATES) {
    try {
      console.log(`[Monitor API] Mencoba: ${gate.name}...`);
      
      const [players, dynamic] = await Promise.all([
        getJSON(`${gate.url}/players.json`, 8000),
        getJSON(`${gate.url}/dynamic.json`, 8000)
      ]);

      if (!Array.isArray(players)) throw new Error('Format players.json bukan Array');

      const cleaned = players.map((p: any) => ({
        id: Number(p.id ?? 0),
        name: String(p.name || 'Unknown').slice(0, 100),
        ping: Number(p.ping ?? 0)
      }));

      console.log(`[Monitor API] Sukses: ${gate.name} (${cleaned.length} players)`);

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
      lastError = err.message;
      console.warn(`[Monitor API] Gagal di ${gate.name}: ${lastError}`);
    }
  }

  // KEMBALIKAN PESAN ERROR ASLI KE FRONTEND
  return NextResponse.json(
    {
      ok: false,
      error: 'Semua gate IME tidak bisa dihubungi',
      detail: lastError, // Ini akan memberitahu Anda kenapa gagalnya
      hint: 'Jika detail berisi "fetch failed" atau "ETIMEDOUT", hosting Anda (seperti Vercel) memblokir port 30120. Anda butuh VPS untuk proxy.'
    },
    { status: 502 }
  );
}
