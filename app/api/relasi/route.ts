// Simpan sebagai: .../api/relasi/route.ts  (sejajar dengan folder api/factions)
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getStaff, audit } from '@/src/lib/staff';
import { rateLimit } from '@/src/lib/rateLimit';

const SEX = new Set(['MALE', 'FEMALE']);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const opt = (v: unknown, max: number) => str(v, max) || null;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

function parse(body: any): { error: string } | { data: Record<string, any> } {
  const firstName = str(body?.firstName, 60);
  const lastName = str(body?.lastName, 60);
  const citizenId = str(body?.citizenId, 16).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!firstName || !lastName) return { error: 'Nama depan dan belakang wajib diisi.' };
  if (!/^[A-Z0-9]{4,16}$/.test(citizenId)) return { error: 'Citizen ID tidak valid (4–16 huruf/angka).' };
  const dob = str(body?.dob, 10);
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { error: 'Format tanggal lahir harus YYYY-MM-DD.' };
  const sex = str(body?.sex, 10).toUpperCase();
  if (sex && !SEX.has(sex)) return { error: 'Jenis kelamin harus MALE atau FEMALE.' };
  return {
    data: {
      firstName, lastName, citizenId,
      dob: dob || null, sex: sex || null,
      nationality: opt(body?.nationality, 40), rank: opt(body?.rank, 60),
      relation: opt(body?.relation, 80), notes: opt(body?.notes, 500),
      active: body?.active !== false,
    },
  };
}

export async function GET(req: Request) {
  const staff = await getStaff(req);
  if (!staff) return fail('Tidak diizinkan.', 401);
  const rows = await prisma.relasi.findMany({ orderBy: [{ active: 'desc' }, { lastName: 'asc' }], take: 1000 });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const staff = await getStaff(req);
  if (!staff) return fail('Tidak diizinkan.', 401);
  if (!rateLimit(`relasi:w:${staff.deviceId}`, 30, 60_000)) return fail('Terlalu banyak permintaan, coba lagi sebentar.', 429);

  const body = await req.json().catch(() => null);
  const p = parse(body);
  if ('error' in p) return fail(p.error, 400);

  try {
    // Unik di level database (bukan cek-lalu-simpan) supaya aman dari race condition / double submit
    const row = await prisma.relasi.create({ data: { ...p.data, createdBy: staff.name } as any });
    await audit(staff, 'RELASI_ADD', row.citizenId, `${row.firstName} ${row.lastName}`);
    return NextResponse.json(row);
  } catch (e: any) {
    if (e?.code === 'P2002') return fail('Citizen ID sudah terdaftar.', 409);
    return fail('Gagal menyimpan data.', 500);
  }
}

export async function PUT(req: Request) {
  const staff = await getStaff(req);
  if (!staff) return fail('Tidak diizinkan.', 401);
  if (!rateLimit(`relasi:w:${staff.deviceId}`, 30, 60_000)) return fail('Terlalu banyak permintaan, coba lagi sebentar.', 429);

  const body = await req.json().catch(() => null);
  const id = str(body?.id, 40);
  if (!id) return fail('ID wajib diisi.', 400);
  const p = parse(body);
  if ('error' in p) return fail(p.error, 400);

  try {
    const row = await prisma.relasi.update({ where: { id }, data: p.data as any });
    await audit(staff, 'RELASI_EDIT', row.citizenId, `${row.firstName} ${row.lastName} · aktif=${row.active}`);
    return NextResponse.json(row);
  } catch (e: any) {
    if (e?.code === 'P2025') return fail('Data tidak ditemukan.', 404);
    if (e?.code === 'P2002') return fail('Citizen ID sudah dipakai relasi lain.', 409);
    return fail('Gagal menyimpan data.', 500);
  }
}

export async function DELETE(req: Request) {
  const staff = await getStaff(req);
  if (!staff) return fail('Tidak diizinkan.', 401);
  if (!rateLimit(`relasi:w:${staff.deviceId}`, 30, 60_000)) return fail('Terlalu banyak permintaan, coba lagi sebentar.', 429);

  const id = new URL(req.url).searchParams.get('id')?.slice(0, 40);
  if (!id) return fail('ID wajib diisi.', 400);
  try {
    const row = await prisma.relasi.delete({ where: { id } });
    await audit(staff, 'RELASI_DELETE', row.citizenId, `${row.firstName} ${row.lastName}`);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.code === 'P2025') return fail('Data tidak ditemukan.', 404);
    return fail('Gagal menghapus data.', 500);
  }
}
