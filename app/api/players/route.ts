import { NextResponse } from 'next/server';

// Wajib ditambahkan agar Next.js menggunakan Node.js, bukan Edge Runtime.
// Edge Runtime sering memblokir koneksi ke port non-standar seperti 30120.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Memastikan data selalu fresh, tidak di-cache statis

const GATES = [
  { name: 'Main Gate', url: 'http://main.imeroleplay.com:30120' },
  { name: 'International Gate', url: 'http://inter.imeroleplay.com:30120' }
];

async function getJSON(url: string, timeoutMs = 8000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
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

  // Loop ini akan mengeksekusi Main Gate terlebih dahulu.
  // Jika Main Gate gagal (timeout/error), baru lanjut ke International Gate.
  for (const gate of GATES) {
    try {
      console.log(`[Monitor API] Mencoba menghubungi: ${gate.name}...`);
      
      // Kita beri timeout 8 detik untuk Main Gate
      const [players, dynamic] = await Promise.all([
        getJSON(`${gate.url}/players.json`, 8000),
        getJSON(`${gate.url}/dynamic.json`, 8000)
      ]);

      if (!Array.isArray(players)) throw new Error('Invalid players.json format');

      const cleaned = players.map((p: any) => ({
        id: Number(p.id ?? 0),
        name: String(p.name || 'Unknown').slice(0, 100),
        ping: Number(p.ping ?? 0)
      }));

      console.log(`[Monitor API] Sukses terhubung ke ${gate.name}. Total player: ${cleaned.length}`);

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
            // Cache selama 15 detik di CDN (Vercel/Next.js), lalu revalidate di background
            'Cache-Control': 's-maxage=15, stale-while-revalidate=45'
          }
        }
      );
    } catch (err: any) {
      lastError = err;
      // Jika Main Gate gagal, log akan muncul, lalu loop akan lanjut ke International Gate
      console.warn(`[Monitor API] ${gate.name} GAGAL: ${err.message}`);
    }
  }

  // Jika kedua gate gagal
  console.error(`[Monitor API] Semua gate gagal. Error terakhir: ${lastError?.message}`);
  
  return NextResponse.json(
    {
      ok: false,
      error: 'Semua gate IME tidak bisa dihubungi',
      detail: lastError?.message ?? null
    },
    { status: 502 }
  );
}
