// OPSIONAL. Simpan sebagai: .../api/admin/admins/route.ts
// Pakai HANYA jika pesan error di tab Admins menunjuk route ini bermasalah. Backup route lama dulu.
// Kontrak sama dengan page.tsx: GET (daftar), POST {name, deviceId, role}, DELETE ?id=
// Khusus Super Admin. Pemilik yang tidak ada di tabel bisa diisi lewat env SUPER_ADMIN_DEVICE_IDS="id1,id2".
import { NextResponse } from 'next/server';
import { getStaff, audit, adminModel } from '@/src/lib/staff';
import { rateLimit } from '@/src/lib/rateLimit';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const isSuper = (role: string) => role.toUpperCase().includes('SUPER');
const owners = () => (process.env.SUPER_ADMIN_DEVICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

async function guard(req: Request) {
  const staff = await getStaff(req);
  if (!staff) return { err: fail('Device ID kamu tidak dikenali sebagai admin (cek SUPER_ADMIN_DEVICE_IDS atau nama model di lib/staff.ts).', 401) };
  if (!isSuper(staff.role)) return { err: fail('Hanya Super Admin yang boleh mengelola admin.', 403) };
  const model = adminModel();
  if (!model) return { err: fail('Model admin tidak ditemukan di Prisma Client (lihat schema.prisma).', 500) };
  return { staff, model };
}

export async function GET(req: Request) {
  const g = await guard(req);
  if ('err' in g) return g.err;
  const rows: any[] = await g.model.findMany();
  const fromEnv = owners().filter(id => !rows.some(r => r.deviceId === id)).map(id => ({ id: `env-${id.slice(0, 8)}`, deviceId: id, name: 'Pemilik (env)', role: 'SUPER' }));
  return NextResponse.json([...fromEnv, ...rows.map(r => ({ id: r.id, deviceId: r.deviceId, name: r.name, role: r.role }))]);
}

export async function POST(req: Request) {
  const g = await guard(req);
  if ('err' in g) return g.err;
  if (!rateLimit(`admins:w:${g.staff.deviceId}`, 20, 60_000)) return fail('Terlalu banyak permintaan.', 429);

  const body: any = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim().slice(0, 60);
  const deviceId = String(body?.deviceId ?? '').trim();
  const role = isSuper(String(body?.role ?? '')) ? 'SUPER' : 'MOD';
  if (!name) return fail('Nama wajib diisi.', 400);
  if (!ID_RE.test(deviceId)) return fail('Device ID tidak valid (8–64 karakter huruf/angka/tanda minus, tanpa spasi).', 400);

  if (owners().includes(deviceId)) return fail('Device ID ini sudah menjadi pemilik (env).', 409);
  const dup = await g.model.findFirst({ where: { deviceId } });
  if (dup) return fail(`Device ID ini sudah terdaftar sebagai ${dup.name} (${dup.role}).`, 409);

  try {
    const row = await g.model.create({ data: { name, deviceId, role } });
    await audit(g.staff, 'ADMIN_ADD', deviceId, `${name} sebagai ${role}`);
    return NextResponse.json({ id: row.id, deviceId: row.deviceId, name: row.name, role: row.role });
  } catch (e: any) {
    if (e?.code === 'P2002') return fail('Device ID ini sudah terdaftar.', 409);
    console.error('[admins] create gagal', e);
    return fail(`Gagal menyimpan: ${String(e?.message ?? e).replace(/\s+/g, ' ').slice(-160)}`, 500);
  }
}

export async function DELETE(req: Request) {
  const g = await guard(req);
  if ('err' in g) return g.err;
  const id = new URL(req.url).searchParams.get('id')?.slice(0, 60);
  if (!id) return fail('ID wajib diisi.', 400);
  if (id.startsWith('env-')) return fail('Pemilik diatur lewat environment dan tidak bisa dicabut dari sini.', 400);

  const row = await g.model.findFirst({ where: { id } });
  if (!row) return fail('Data tidak ditemukan.', 404);
  if (row.deviceId === g.staff.deviceId) return fail('Kamu tidak bisa mencabut akses dirimu sendiri.', 400);
  if (isSuper(String(row.role))) {
    const supers = (await g.model.findMany()).filter((r: any) => isSuper(String(r.role))).length + owners().length;
    if (supers <= 1) return fail('Tidak bisa mencabut Super Admin terakhir.', 400);
  }
  await g.model.delete({ where: { id } });
  await audit(g.staff, 'ADMIN_REMOVE', row.deviceId, `${row.name} (${row.role})`);
  return NextResponse.json({ success: true });
}
