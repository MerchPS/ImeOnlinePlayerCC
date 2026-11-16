import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function POST(req: Request) {
  try {
    const { deviceId, message } = await req.json();
    if (!deviceId || !message) return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    
    await prisma.bugReport.create({ data: { deviceId, message } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const reports = await prisma.bugReport.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(reports);
  } catch {
    return NextResponse.json({ error: 'Gagal' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, action } = await req.json();
    if (action === 'RESOLVE') {
      await prisma.bugReport.update({ where: { id }, data: { status: 'RESOLVED' } });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal' }, { status: 500 });
  }
}
