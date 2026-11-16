import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-hans-ime');

async function isAdmin(req: Request) {
  const token = req.headers.get('cookie')?.split('; ').find(c => c.startsWith('admin_token='))?.split('=')[1];
  if (!token) return false;
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch { return false; }
}

export async function GET(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const requests = await prisma.accessRequest.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(requests);
}

export async function PATCH(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, status } = await req.json();
  await prisma.accessRequest.update({ where: { id }, data: { status } });
  return NextResponse.json({ success: true });
}
