import { getMember } from '@/src/lib/staff';
import { rateLimit } from '@/src/lib/rateLimit';

export const maxDuration = 60;

const BASE_URL = 'https://bandelbanget.xyz/v1';
const MODEL = process.env.AI_MODEL || 'auto';

const SYSTEM = `Kamu adalah asisten analis untuk server FiveM "IME Roleplay". Tugasmu membantu user memahami siapa saja yang online, komposisi faction, dan hal-hal lain terkait populasi server saat ini.

Aturan:
- Jawab dalam bahasa Indonesia yang santai, ringkas, to-the-point.
- Jangan bertele-tele. Kalau bisa dijawab 3 baris, jangan 3 paragraf.
- Kalau ditanya soal faction atau player, WAJIB rujuk ke data yang diberikan.
- Boleh pakai list atau bold singkat kalau membantu. UI sudah mendukung format Markdown (seperti **bold**, - list, dan ### header), jadi gunakanlah agar rapi.
- Kalau data tidak cukup, bilang saja — jangan ngarang.
- PENTING: "Kantong" = nomor slot server (id di data). 
- PENTING: "CC" SELALU merujuk pada faction "Crimson Creed". Jika user bertanya "ada berapa CC", maksudnya adalah berapa banyak player dari faction Crimson Creed, BUKAN "Character Count" atau hal lainnya.`;

const json = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Filter <think>...</think> stateful: aman walau tag terpotong di antara chunk.
class ThinkFilter {
  private inside = false;
  private buf = '';

  push(chunk: string): string {
    this.buf += chunk;
    let out = '';
    for (;;) {
      if (this.inside) {
        const idx = this.buf.indexOf('</think>');
        if (idx === -1) {
          // simpan ekor (maks 8 char) untuk jaga-jaga closing tag terbelah
          const keep = Math.min(8, this.buf.length);
          this.buf = this.buf.slice(this.buf.length - keep);
          return out;
        }
        this.buf = this.buf.slice(idx + 8);
        this.inside = false;
      } else {
        const idx = this.buf.indexOf('<think>');
        if (idx === -1) {
          // cek kemungkinan opening tag parsial di ekor
          const keep = Math.min(7, this.buf.length);
          const tail = this.buf.slice(this.buf.length - keep);
          if (keep > 0 && '<think>'.startsWith(tail)) {
            out += this.buf.slice(0, this.buf.length - keep);
            this.buf = tail;
            return out;
          }
          out += this.buf;
          this.buf = '';
          return out;
        }
        out += this.buf.slice(0, idx);
        this.buf = this.buf.slice(idx + 7);
        this.inside = true;
      }
    }
  }

  flush(): string {
    const out = this.inside ? '' : this.buf;
    this.buf = '';
    return out;
  }
}

export async function POST(req: Request) {
  try {
    const who = await getMember(req);
    if (!who) {
      return json(
        'Akses AI ditolak. Pastikan akunmu sudah di-ACC (cek nama model di lib/staff.ts).',
        401,
      );
    }
    if (!rateLimit(`ai:${who.deviceId}`, 15, 60_000)) {
      return json('Terlalu banyak pertanyaan, tunggu sebentar.', 429);
    }

    const key = process.env.AI_API_KEY;
    if (!key) {
      return json(
        'AI belum dikonfigurasi (AI_API_KEY belum diisi di environment Vercel).',
        501,
      );
    }

    const body: any = await req.json().catch(() => null);
    const raw = Array.isArray(body?.messages) ? body.messages : [];

    const messages = raw
      .slice(-10)
      .map((m: any) => ({
        role: m?.role === 'assistant' ? 'assistant' : 'user',
        content: String(m?.content ?? '').slice(0, 2000),
      }))
      .filter((m: { content: string }) => m.content.trim());

    while (messages.length && messages[0].role !== 'user') messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return json('Pesan tidak valid.', 400);
    }

    const ctxStr = body?.context
      ? JSON.stringify(body.context)
      : 'Tidak ada data player.';

    // Context disuntikkan ke pesan user pertama (seperti versi lama)
    const fullMessages = messages.map((m: any, i: number) => {
      if (i === 0 && m.role === 'user') {
        return {
          role: 'user',
          content: `[DATA PLAYER ONLINE — realtime]\n${ctxStr}\n\n[PERTANYAAN USER]\n${m.content}`,
        };
      }
      return { role: m.role, content: m.content };
    });

    // OpenAI-compatible: system prompt jadi message pertama
    const openaiMessages = [
      { role: 'system', content: SYSTEM },
      ...fullMessages,
    ];

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 55_000);
    req.signal.addEventListener('abort', () => ctrl.abort());

    let upstream: Response;
    try {
      upstream = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: openaiMessages,
          stream: true,
          max_tokens: 1024,
        }),
      });
    } catch {
      clearTimeout(timer);
      return json('Tidak bisa menghubungi layanan AI.', 502);
    }

    if (!upstream.ok || !upstream.body) {
      clearTimeout(timer);
      const errText = await upstream.text().catch(() => '');
      console.error('[AI] upstream', upstream.status, errText.slice(0, 300));
      return json(`Layanan AI menolak permintaan (${upstream.status}).`, 502);
    }

    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const filter = new ThinkFilter();
        let buf = '';
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });

            let i: number;
            while ((i = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, i).trim();
              buf = buf.slice(i + 1);
              if (!line.startsWith('data:')) continue;

              const payload = line.slice(5).trim();
              if (payload === '[DONE]') {
                const rest = filter.flush();
                if (rest) controller.enqueue(enc.encode(rest));
                clearTimeout(timer);
                controller.close();
                return;
              }

              try {
                const ev = JSON.parse(payload);
                const text = ev?.choices?.[0]?.delta?.content;
                if (typeof text === 'string' && text.length > 0) {
                  const filtered = filter.push(text);
                  if (filtered) controller.enqueue(enc.encode(filtered));
                }
              } catch {
                /* baris bukan JSON valid — lewati */
              }
            }
          }
          const rest = filter.flush();
          if (rest) controller.enqueue(enc.encode(rest));
        } catch {
          /* timeout / klien menutup koneksi */
        } finally {
          clearTimeout(timer);
          controller.close();
        }
      },
      cancel() {
        ctrl.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    console.error('[AI]', err);
    return json(err.message || 'Error', 500);
  }
}
