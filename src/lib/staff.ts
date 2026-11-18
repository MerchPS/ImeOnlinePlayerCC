// Simpan sebagai: src/lib/staff.ts
import { prisma } from '@/src/lib/prisma';

export type StaffInfo = { id: string; name: string; role: string; deviceId: string };

/**
 * Verifikasi header `x-device-id` terhadap daftar admin/moderator.
 * Gagal / tidak ada = null (tolak). Fail-closed: kalau query error, akses ditolak.
 *
 * ⚠ SESUAIKAN: nama model admin di schema.prisma kamu. Tipe di page.tsx adalah
 *   AdminUser { id, deviceId, name, role }, jadi saya asumsikan `prisma.adminUser`.
 *
 * Opsional: SUPER_ADMIN_DEVICE_IDS="id1,id2" di .env untuk super admin pemilik
 * yang tidak ada di tabel (tidak ada kredensial yang ditulis di kode).
 */
export async function getStaff(req: Request): Promise<StaffInfo | null> {
  const deviceId = req.headers.get('x-device-id')?.trim();
  if (!deviceId || deviceId.length > 100) return null;

  const owners = (process.env.SUPER_ADMIN_DEVICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (owners.includes(deviceId)) return { id: 'env-owner', name: 'Super Admin', role: 'SUPER', deviceId };

  try {
    const admin = await (prisma as any).adminUser.findFirst({ where: { deviceId } });
    return admin ? { id: String(admin.id), name: String(admin.name), role: String(admin.role), deviceId } : null;
  } catch {
    return null;
  }
}

/** Catat ke Audit Log yang sudah ada. Aman: kalau model beda, diabaikan (tidak merusak request). */
export async function audit(staff: StaffInfo, action: string, target: string, details: string) {
  try {
    await (prisma as any).auditLog.create({ data: { adminName: staff.name, action, targetDeviceId: target, details } });
  } catch { /* abaikan */ }
}
