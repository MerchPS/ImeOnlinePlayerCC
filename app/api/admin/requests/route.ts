import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getStaff, audit } from '@/src/lib/staff';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(req: Request) {
  if (!(await getStaff(req))) return fail('Tidak diizinkan.', 401);
  const requests = await prisma.accessRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  return NextResponse.json(requests);
}

export async function PATCH(req: Request) {
  const staff = await getStaff(req);
  if (!staff) return fail('Tidak diizinkan.', 401);
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id.slice(0, 64) : '';
  const action = body?.action;
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
  const durationMinutes = Number(body?.durationMinutes);
  if (!id) return fail('ID wajib diisi.', 400);
  if (!['APPROVE', 'REVOKE', 'BAN', 'TIMEOUT', 'CLEAR_TIMEOUT'].includes(action)) return fail('Aksi tidak valid.', 400);

  const data: any = {};
  let logDetails = '';

  if (action === 'APPROVE') { data.status = 'APPROVED'; data.reason = null; data.timeoutUntil = null; logDetails = 'Approved'; }
  if (action === 'REVOKE') { data.status = 'PENDING'; data.reason = null; data.timeoutUntil = null; logDetails = 'Revoked to Pending'; }
  if (action === 'BAN') { data.status = 'BANNED'; data.reason = reason || 'No reason provided'; logDetails = `Banned: ${data.reason}`; }
  if (action === 'TIMEOUT') { 
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 10080) return fail('Durasi timeout harus 1 sampai 10.080 menit.', 400);
    data.status = 'APPROVED'; // Tetap approved, tapi ditahan oleh timeout
    data.timeoutUntil = new Date(Date.now() + durationMinutes * 60000); 
    data.reason = reason || 'No reason provided'; 
    logDetails = `Timeout ${durationMinutes}m: ${data.reason}`;
  }
  if (action === 'CLEAR_TIMEOUT') { data.timeoutUntil = null; data.reason = null; data.status = 'APPROVED'; logDetails = 'Timeout Cleared'; }

  try {
    const updated = await prisma.accessRequest.update({ where: { id }, data });
    await audit(staff, action, updated.deviceId, logDetails);
  } catch (error: any) {
    if (error?.code === 'P2025') return fail('Request tidak ditemukan.', 404);
    return fail('Gagal memperbarui request.', 500);
  }

  return NextResponse.json({ success: true });
}

// Bulk Actions
export async function POST(req: Request) {
  const staff = await getStaff(req);
  if (!staff) return fail('Tidak diizinkan.', 401);
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
  if (action === 'EXPIRE_PENDING') {
    const hours = Number(body?.olderThanHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 8760) return fail('Batas usia harus 1 sampai 8.760 jam.', 400);
    const result = await prisma.accessRequest.deleteMany({ where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - hours * 3600000) } } });
    await audit(staff, 'EXPIRE_PENDING', 'requests', `${result.count} request lebih lama dari ${hours} jam`);
    return NextResponse.json({ success: true, count: result.count });
  }
  if (action !== 'APPROVE' && action !== 'BAN') return fail('Aksi bulk tidak valid.', 400);
  const ids: string[] = Array.isArray(body?.ids)
    ? Array.from(new Set<string>((body.ids as unknown[]).filter((id): id is string => typeof id === 'string' && id.length <= 64))).slice(0, 100)
    : [];
  if (ids.length === 0) return fail('Pilih setidaknya satu request.', 400);

  const data: any = {};
  if (action === 'APPROVE') { data.status = 'APPROVED'; data.reason = null; data.timeoutUntil = null; }
  if (action === 'BAN') { data.status = 'BANNED'; data.reason = reason || 'Bulk Ban'; }

  const result = await prisma.accessRequest.updateMany({
    where: { id: { in: ids } },
    data
  });
  await audit(staff, `BULK_${action}`, `${result.count} devices`, reason || `Bulk ${action}`);

  return NextResponse.json({ success: true, count: result.count });
}
