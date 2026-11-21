import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getMember, getStaff, audit } from '@/src/lib/staff';
import { rateLimit } from '@/src/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const member = await getMember(req);
    if (!member) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
    if (!rateLimit(`report:${member.deviceId}`, 5, 60_000)) return NextResponse.json({ error: 'Terlalu banyak laporan, coba lagi nanti.' }, { status: 429 });
    const body = await req.json().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    if (!message) return NextResponse.json({ error: 'Isi laporan wajib diisi.' }, { status: 400 });
    await prisma.bugReport.create({ data: { deviceId: member.deviceId, message } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    if (!(await getStaff(req))) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
    const reports = await prisma.bugReport.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(reports);
  } catch {
    return NextResponse.json({ error: 'Gagal' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const staff = await getStaff(req);
    if (!staff) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === 'string' ? body.id.slice(0, 64) : '';
    if (!id || body?.action !== 'RESOLVE') return NextResponse.json({ error: 'Aksi tidak valid.' }, { status: 400 });
    const updated = await prisma.bugReport.update({ where: { id }, data: { status: 'RESOLVED' } });
    await audit(staff, 'REPORT_RESOLVE', updated.deviceId, updated.message.slice(0, 200));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal' }, { status: 500 });
  }
}
