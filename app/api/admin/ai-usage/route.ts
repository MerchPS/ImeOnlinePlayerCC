// Simpan sebagai: .../api/admin/ai-usage/route.ts   (khusus SUPER ADMIN)
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getStaff, audit } from '@/src/lib/staff';
import { dayKey, budgetConfig } from '@/src/lib/aiUsage';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function superOnly(req: Request) {
  const s = await getStaff(req);
  return s && s.role.toUpperCase().includes('SUPER') ? s : null;
}

export async function GET(req: Request) {
  if (!(await superOnly(req))) return fail('Hanya Super Admin.', 403);

  const today = dayKey();
  const rows = await prisma.aiUsageDaily.findMany({ where: { day: { gte: dayKey(Date.now() - 13 * 86400000) } } });

  const days = new Map<string, { chat: number; faction: number }>();
  for (let i = 13; i >= 0; i--) days.set(dayKey(Date.now() - i * 86400000), { chat: 0, faction: 0 });

  const t = { tokens: 0, input: 0, output: 0, calls: 0, cacheHits: 0, errors: 0, estimatedCalls: 0, chat: 0, faction: 0 };
  const devices = new Map<string, { tokens: number; calls: number }>();

  for (const r of rows) {
    const tok = r.promptTokens + r.completionTokens;
    const d = days.get(r.day);
    if (d) { if (r.endpoint === 'chat') d.chat += tok; else d.faction += tok; }
    if (r.day === today) {
      t.tokens += tok; t.input += r.promptTokens; t.output += r.completionTokens;
      t.calls += r.calls; t.cacheHits += r.cacheHits; t.errors += r.errors; t.estimatedCalls += r.estimated;
      if (r.endpoint === 'chat') t.chat += tok; else t.faction += tok;
      const dv = devices.get(r.deviceId) ?? { tokens: 0, calls: 0 };
      dv.tokens += tok; dv.calls += r.calls;
      devices.set(r.deviceId, dv);
    }
  }

  const dayList = Array.from(days, ([day, v]) => ({ day, ...v }));
  const sum = (xs: { chat: number; faction: number }[]) => xs.reduce((a, d) => a + d.chat + d.faction, 0);
  const cacheRows = await prisma.aiFactionCache.count().catch(() => 0);

  return NextResponse.json({
    config: budgetConfig(),
    today: t,
    days: dayList,
    last7: sum(dayList.slice(-7)),
    last14: sum(dayList),
    topDevices: Array.from(devices, ([deviceId, v]) => ({ deviceId, ...v })).sort((a, b) => b.tokens - a.tokens).slice(0, 8),
    cacheRows,
  });
}

export async function POST(req: Request) {
  const staff = await superOnly(req);
  if (!staff) return fail('Hanya Super Admin.', 403);
  const body = await req.json().catch(() => null);
  if (body?.action !== 'CLEAR_CACHE') return fail('Aksi tidak dikenal.', 400);
  const r = await prisma.aiFactionCache.deleteMany();
  await audit(staff, 'AI_CACHE_CLEAR', '-', `${r.count} nama dihapus`);
  return NextResponse.json({ deleted: r.count });
}
