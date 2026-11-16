import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function POST(req: Request) {
  const { deviceId } = await req.json();
  const ip = req.headers.get('x-forwarded-for') || 'Unknown IP';

  if (!deviceId) return NextResponse.json({ error: 'Device ID required' }, { status: 400 });

  await prisma.accessRequest.upsert({
    where: { deviceId },
    update: { ipAddress: ip, status: 'PENDING' },
    create: { deviceId, ipAddress: ip, status: 'PENDING' }
  });

  return NextResponse.json({ success: true });
}
