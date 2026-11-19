// Simpan sebagai: src/lib/aiUsage.ts
// Pencatatan token + batas harian untuk semua fitur AI. Semua fungsi aman: kalau database error,
// fitur AI tetap jalan (pencatatan dilewati), kecuali batas harian yang memang sengaja menahan.
import { prisma } from '@/src/lib/prisma';

export type Endpoint = 'chat' | 'faction';

/** Hari dalam WIB (UTC+7) sebagai YYYY-MM-DD. */
export const dayKey = (t: number = Date.now()) => new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);

/** Perkiraan kasar token dari panjang teks (Indonesia ± 3,5 karakter per token). */
export const estimateTokens = (s: string) => Math.ceil(s.length / 3.5);

export function budgetConfig() {
  return {
    total: Number(process.env.AI_DAILY_TOKEN_BUDGET || 0),                 // 0 = tanpa batas
    faction: Number(process.env.AI_FACTION_DAILY_BUDGET ?? 60000),          // deteksi faction = fitur latar belakang, dibatasi ketat
    factionEnabled: process.env.AI_FACTION_MATCH !== 'off',
  };
}

// Memo 20 detik supaya cek batas tidak membebani database di setiap request
const memo: Record<string, { v: number; t: number }> = {};

export async function todayTokens(endpoint?: Endpoint): Promise<number> {
  const k = endpoint ?? '*';
  const m = memo[k];
  if (m && Date.now() - m.t < 20_000) return m.v;
  try {
    const r = await prisma.aiUsageDaily.aggregate({
      where: { day: dayKey(), ...(endpoint ? { endpoint } : {}) },
      _sum: { promptTokens: true, completionTokens: true },
    });
    const v = (r._sum.promptTokens ?? 0) + (r._sum.completionTokens ?? 0);
    memo[k] = { v, t: Date.now() };
    return v;
  } catch {
    return 0;
  }
}

/** true jika batas harian (total atau khusus endpoint) sudah terlewati. */
export async function overBudget(endpoint: Endpoint): Promise<boolean> {
  const c = budgetConfig();
  if (c.total > 0 && (await todayTokens()) >= c.total) return true;
  if (endpoint === 'faction' && c.faction > 0 && (await todayTokens('faction')) >= c.faction) return true;
  return false;
}

export type Usage = {
  endpoint: Endpoint;
  deviceId?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  calls?: number;        // default 1
  cacheHits?: number;
  error?: boolean;
  estimated?: boolean;
};

let lastPruneDay = '';

export async function recordUsage(u: Usage): Promise<void> {
  const day = dayKey();
  const deviceId = (u.deviceId || '-').slice(0, 100);
  const inc = {
    calls: u.calls ?? 1,
    cacheHits: u.cacheHits ?? 0,
    promptTokens: Math.max(0, Math.round(u.promptTokens ?? 0)),
    completionTokens: Math.max(0, Math.round(u.completionTokens ?? 0)),
    errors: u.error ? 1 : 0,
    estimated: u.estimated ? 1 : 0,
  };
  const where = { day_endpoint_deviceId: { day, endpoint: u.endpoint, deviceId } };

  for (let i = 0; i < 2; i++) {
    try {
      await prisma.aiUsageDaily.upsert({
        where,
        create: { day, endpoint: u.endpoint, deviceId, ...inc },
        update: {
          calls: { increment: inc.calls }, cacheHits: { increment: inc.cacheHits },
          promptTokens: { increment: inc.promptTokens }, completionTokens: { increment: inc.completionTokens },
          errors: { increment: inc.errors }, estimated: { increment: inc.estimated },
        },
      });
      break;
    } catch (e: any) {
      if (e?.code !== 'P2002' || i === 1) { console.error('[aiUsage] gagal mencatat:', e?.message); break; } // P2002 = dua request membuat baris yang sama bersamaan: ulangi sekali
    }
  }

  const add = inc.promptTokens + inc.completionTokens;
  for (const k of ['*', u.endpoint]) if (memo[k]) memo[k].v += add;

  // Bersihkan data lebih dari 90 hari, sekali per hari per instance
  if (lastPruneDay !== day) {
    lastPruneDay = day;
    prisma.aiUsageDaily.deleteMany({ where: { day: { lt: dayKey(Date.now() - 90 * 86400000) } } }).catch(() => {});
  }
}
