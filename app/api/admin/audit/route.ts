import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getStaff } from '@/src/lib/staff';

export async function GET(req: Request) {
  const staff = await getStaff(req);
  if (!staff || !staff.role.toUpperCase().includes('SUPER')) return NextResponse.json({ error: 'Hanya Super Admin.' }, { status: 403 });
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return NextResponse.json(logs);
}
