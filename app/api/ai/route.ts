import { NextResponse } from 'next/server';

const API_KEY =
  process.env.AI_API_KEY || 'cr-live-586a4b4eccc4ea19b479b9b623c37f09c5d40d8a';
const API_URL = 'https://claudespro.web.id/v1/messages';
const MODEL = 'claude-3-7-sonnet-20250219';

const SYSTEM = `Kamu adalah asisten analis untuk server FiveM "IME Roleplay". Tugasmu membantu user memahami siapa saja yang online, komposisi faction, dan hal-hal lain terkait populasi server saat ini.

Aturan:
- Jawab dalam bahasa Indonesia yang santai, ringkas, to-the-point.
- Jangan bertele-tele. Kalau bisa dijawab 3 baris, jangan 3 paragraf.
- Kalau ditanya soal faction atau player, WAJIB rujuk ke data yang diberikan.
- Boleh pakai list atau bold singkat kalau membantu. UI sudah mendukung format Markdown (seperti **bold**, - list, dan ### header), jadi gunakanlah agar rapi.
- Kalau data tidak cukup, bilang saja — jangan ngarang.
- "Kantong" = nomor slot server (id di data). "CC" = Crimson Creed. Faction lain sudah disebut di data.`;

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const ctxStr = context
      ? JSON.stringify(context)
      : 'Tidak ada data player.';

    const fullMessages = messages.map((m: any, i: number) => {
      if (i === 0 && m.role === 'user') {
        return {
          role: 'user',
          content: `[DATA PLAYER ONLINE — realtime]\n${ctxStr}\n\n[PERTANYAAN USER]\n${m.content}`
        };
      }
      return { role: m.role, content: m.content };
    });

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        stream: false,
        system: SYSTEM,
        messages: fullMessages
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[AI] upstream', res.status, err.slice(0, 300));
      return NextResponse.json(
        { error: `AI upstream ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text =
      data?.content?.find((c: any) => c.type === 'text')?.text ??
      data?.content?.[0]?.text ??
      'Tidak ada respons.';
    return NextResponse.json({ text });
  } catch (err: any) {
    console.error('[AI]', err);
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}
