import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-hans-ime');

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('deviceId');
  const token = req.headers.get('cookie')?.split('; ').find(c => c.startsWith('admin_token='))?.split('=')[1];

  // 1. Cek apakah Admin
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.json({ status: 'ADMIN' });
    } catch (e) {
      // Token invalid, abaikan
    }
  }

  // 2. Cek Device ID di Database
  if (!deviceId) return NextResponse.json({ status: 'UNAUTHORIZED' });

  const access = await prisma.accessRequest.findUnique({ where: { deviceId } });
  
  if (!access) return NextResponse.json({ status: 'UNAUTHORIZED' });
  if (access.status === 'APPROVED') return NextResponse.json({ status: 'APPROVED' });
  if (access.status === 'REJECTED') return NextResponse.json({ status: 'UNAUTHORIZED', rejected: true });
  
  return NextResponse.json({ status: 'PENDING' });
}
