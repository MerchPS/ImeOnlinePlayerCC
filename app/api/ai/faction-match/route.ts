// Simpan sebagai: .../api/ai/faction-match/route.ts  (GANTI file lama)
//
// Hemat token:
//  1) Cache bersama di database (7 hari): nama yang pernah dikenali TIDAK dikirim lagi ke AI, lintas user.
//  2) Prompt ringkas + jawaban ringkas: AI hanya menulis nama yang punya faction (warga tidak ditulis).
//  3) Batas harian (AI_FACTION_DAILY_BUDGET), batas per perangkat, dan tombol mati (AI_FACTION_MATCH=off).
//  4) Wajib login (x-device-id) dan semua pemakaian tercatat untuk Admin Panel.
//
// Env: AI_API_KEY (wajib) · AI_BASE_URL · AI_FACTION_MODEL (opsional, pakai model non-reasoning yang murah) · AI_MODEL
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/src/lib/prisma';
import { getMember } from '@/src/lib/staff';
import { rateLimit } from '@/src/lib/rateLimit';
import { recordUsage, overBudget, estimateTokens, budgetConfig } from '@/src/lib/aiUsage';

export const maxDuration = 30;

const BASE_URL = (process.env.AI_BASE_URL || 'https://bandelbanget.xyz/v1').replace(/\/+$/, '');
const MODEL = process.env.AI_FACTION_MODEL || process.env.AI_MODEL || 'auto';
const CACHE_MS = 7 * 24 * 3600 * 1000;
const MAX_NAMES = 30;

type FactionInput = { id: string; label: string; short: string };
type Assignment = { name: string; factionId: string };
const norm = (n: string) => n.trim().toLowerCase();
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const who = await getMember(req);
  if (!who) return fail('Tidak diizinkan.', 401);

  const key = process.env.AI_API_KEY;
  if (!key) return fail('AI_API_KEY belum diisi', 501);

  const body = await req.json().catch(() => null);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const n of Array.isArray(body?.names) ? body.names : []) {
    const v = String(n ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80);
    if (v && !seen.has(norm(v))) { seen.add(norm(v)); names.push(v); }
    if (names.length >= MAX_NAMES) break;
  }
  const factions: FactionInput[] = (Array.isArray(body?.factions) ? body.factions : [])
    .filter((f: any) => f && typeof f.id === 'string')
    .slice(0, 80)
    .map((f: any) => ({ id: String(f.id).slice(0, 40), label: String(f.label ?? '').slice(0, 60), short: String(f.short ?? '').slice(0, 60) }));
  if (!names.length || !factions.length) return fail('names dan factions wajib', 400);

  const validIds = new Set(factions.map(f => f.id));
  const sig = createHash('sha1').update(factions.map(f => `${f.id}:${f.short}`).sort().join('|')).digest('hex').slice(0, 12);

  // 1) Cache bersama: jawaban gratis
  const cached = new Map<string, string>();
  try {
    const rows = await prisma.aiFactionCache.findMany({
      where: { name: { in: names.map(norm) }, sig, updatedAt: { gt: new Date(Date.now() - CACHE_MS) } },
      select: { name: true, factionId: true },
    });
    for (const r of rows) cached.set(r.name, r.factionId);
  } catch (e) { console.error('[faction-match] baca cache gagal', e); }

  const fromCache: Assignment[] = names.filter(n => cached.has(norm(n))).map(n => ({ name: n, factionId: cached.get(norm(n))! }));
  const todo = names.filter(n => !cached.has(norm(n)));
  if (fromCache.length) await recordUsage({ endpoint: 'faction', deviceId: who.deviceId, calls: 0, cacheHits: fromCache.length });
  if (!todo.length) return NextResponse.json({ assignments: fromCache });

  // 2) Pengaman biaya
  if (!budgetConfig().factionEnabled) return NextResponse.json({ assignments: fromCache, disabled: true });
  if (await overBudget('faction')) return NextResponse.json({ assignments: fromCache, budgetExceeded: true });
  if (!rateLimit(`fm:${who.deviceId}`, 6, 60_000)) return fail('Terlalu banyak permintaan.', 429);

  // 3) Prompt ringkas, jawaban ringkas
  const prompt =
`Faction (id=alias):
${factions.map(f => `${f.id}=${f.short}`).join('\n')}

Tentukan faction tiap nama player server roleplay. Tag faction ada di awal nama, boleh menempel (CCxNAMA → CC), atau di [ ] / sebelum " - ".
Jika tidak ada alias yang jelas cocok, JANGAN tulis nama itu (jangan menebak).
Balas HANYA JSON {"<no>":"<id>"} untuk nama yang punya faction, atau {} jika tidak ada.
Nama:
${todo.map((n, i) => `${i + 1}. ${n}`).join('\n')}`;
  const system = 'Balas hanya JSON valid.';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 1024, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[faction-match] upstream', res.status, err.slice(0, 300));
      await recordUsage({ endpoint: 'faction', deviceId: who.deviceId, error: true });
      return fail(`upstream ${res.status}`, 502);
    }

    const data: any = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '';
    const text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    const hasUsage = typeof data?.usage?.prompt_tokens === 'number';
    const promptTokens = hasUsage ? data.usage.prompt_tokens : estimateTokens(system + prompt);
    const completionTokens = typeof data?.usage?.completion_tokens === 'number' ? data.usage.completion_tokens : estimateTokens(raw);
    await recordUsage({ endpoint: 'faction', deviceId: who.deviceId, promptTokens, completionTokens, estimated: !hasUsage });

    const m = text.match(/\{[\s\S]*\}/);
    let parsed: Record<string, unknown> | null = null;
    try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
    if (!parsed || typeof parsed !== 'object') return fail('respons AI tidak valid', 502); // tidak disimpan ke cache

    const fresh: Assignment[] = todo.map((name, i) => {
      const id = parsed![String(i + 1)];
      return { name, factionId: typeof id === 'string' && validIds.has(id) ? id : 'WARGA' };
    });

    // Simpan SEMUA hasil (termasuk WARGA) supaya tidak ditanyakan lagi oleh siapa pun
    try {
      await prisma.$transaction(fresh.map(a => prisma.aiFactionCache.upsert({
        where: { name: norm(a.name) },
        create: { name: norm(a.name), factionId: a.factionId, sig },
        update: { factionId: a.factionId, sig },
      })));
    } catch (e) { console.error('[faction-match] simpan cache gagal', e); }

    return NextResponse.json({ assignments: [...fromCache, ...fresh] });
  } catch (e: any) {
    await recordUsage({ endpoint: 'faction', deviceId: who.deviceId, error: true });
    return fail(e?.name === 'AbortError' ? 'AI terlalu lama merespons' : 'Gagal menghubungi AI', e?.name === 'AbortError' ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
