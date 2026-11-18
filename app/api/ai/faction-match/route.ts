import { NextResponse } from 'next/server';

export const maxDuration = 30;

const BASE_URL = 'https://bandelbanget.xyz/v1';
const MODEL = process.env.AI_MODEL || 'auto';

type FactionInput = { id: string; label: string; short: string };

export async function POST(req: Request) {
  const key = process.env.AI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'AI_API_KEY belum diisi' }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  const names: string[] = Array.isArray(body?.names)
    ? body.names.slice(0, 40).map((n: any) => String(n).slice(0, 200))
    : [];
  const factions: FactionInput[] = Array.isArray(body?.factions)
    ? body.factions
        .filter((f: any) => f && typeof f.id === 'string')
        .map((f: any) => ({
          id: String(f.id),
          label: String(f.label ?? ''),
          short: String(f.short ?? ''),
        }))
    : [];

  if (!names.length || !factions.length) {
    return NextResponse.json({ error: 'names dan factions wajib' }, { status: 400 });
  }

  const factionList = factions
    .map((f) => `- ${f.id} :: ${f.label} :: tag: ${f.short}`)
    .join('\n');

  const prompt = `Kamu classifier faction untuk server FiveM roleplay "IME Roleplay".

Daftar faction VALID (id :: nama :: tag yang mungkin muncul di nama player):
${factionList}

Tugas: tentukan faction untuk tiap nama player. Aturan PENTING:
1. Nama player biasanya berpola "<TAG> <nama>" atau "<TAG> - <nama>" atau "<nama> [<TAG>]" atau "<TAG><nama>" tanpa spasi (mis. "CCxKERTA" → tag "CC").
2. Cocokkan tag ke alias faction (short bisa berisi beberapa alias dipisah koma).
3. Kalau TIDAK ada tag yang cocok, WAJIB jawab "WARGA". Jangan mengarang.
4. Kalau ragu, jawab "WARGA".
5. Jangan mengembalikan faction id yang tidak ada di daftar.

Balas HANYA dengan JSON array valid, tanpa penjelasan, tanpa markdown code fence.
Format: [{"name":"<nama asli>","factionId":"<id atau WARGA>"}, ...]

Nama player:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Kamu hanya menjawab dengan JSON array valid. Tidak ada teks lain, tidak ada penjelasan, tidak ada markdown.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[ai/faction-match] upstream', res.status, err.slice(0, 300));
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '';
    const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('[ai/faction-match] bukan JSON:', cleaned.slice(0, 300));
      return NextResponse.json({ error: 'respons AI tidak valid' }, { status: 502 });
    }

    let parsed: any[];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: 'JSON AI rusak' }, { status: 502 });
    }

    const validIds = new Set(factions.map((f) => f.id));
    const assignments = (Array.isArray(parsed) ? parsed : [])
      .filter((a: any) => a && typeof a.name === 'string')
      .map((a: any) => {
        const fid = String(a.factionId ?? '');
        const safe = validIds.has(fid) ? fid : 'WARGA';
        return { name: String(a.name), factionId: safe };
      });

    return NextResponse.json({ assignments });
  } catch (e: any) {
    console.error('[ai/faction-match]', e);
    return NextResponse.json({ error: e.message || 'error' }, { status: 500 });
  }
}
