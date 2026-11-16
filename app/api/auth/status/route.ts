import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');
  const ip = req.headers.get('x-forwarded-for') || 'Unknown IP';

  const SUPER_ADMIN_ID = '3c85d624-ca85-49be-86c3-e9364a796ace';
  if (deviceId === SUPER_ADMIN_ID) return NextResponse.json({ status: 'ADMIN' });

  if (!deviceId) return NextResponse.json({ status: 'UNAUTHORIZED' });

  let access = await prisma.accessRequest.findUnique({ where: { deviceId } });
  
  if (!access) return NextResponse.json({ status: 'UNAUTHORIZED' });

  if (access.timeoutUntil && access.timeoutUntil > new Date()) {
    return NextResponse.json({ 
      status: 'TIMEOUT', 
      timeoutUntil: access.timeoutUntil,
      reason: access.reason // <-- Kirim alasan
    });
  }

  if (access.timeoutUntil && access.timeoutUntil <= new Date()) {
    access = await prisma.accessRequest.update({
      where: { deviceId },
      data: { status: 'PENDING', timeoutUntil: null, reason: null }
    });
  }

  await prisma.accessRequest.update({
    where: { deviceId },
    data: { lastActive: new Date(), ipAddress: ip }
  });

  if (access.status === 'APPROVED') return NextResponse.json({ status: 'APPROVED' });
  if (access.status === 'BANNED') return NextResponse.json({ status: 'BANNED', reason: access.reason }); // <-- Kirim alasan
  if (access.status === 'REJECTED') return NextResponse.json({ status: 'UNAUTHORIZED', rejected: true });
  
  return NextResponse.json({ status: 'PENDING' });
}
