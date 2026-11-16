import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET() {
  const requests = await prisma.accessRequest.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(requests);
}

export async function PATCH(req: Request) {
  const { id, action } = await req.json();
  
  const data: any = {};
  
  if (action === 'APPROVE') data.status = 'APPROVED';
  if (action === 'REVOKE') data.status = 'PENDING';
  if (action === 'BAN') data.status = 'BANNED';
  if (action === 'REJECT') data.status = 'REJECTED';
  
  if (action === 'TIMEOUT_1H') {
    data.timeoutUntil = new Date(Date.now() + 60 * 60 * 1000);
  } else if (action === 'TIMEOUT_1D') {
    data.timeoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  } else if (action === 'CLEAR_TIMEOUT') {
    data.timeoutUntil = null;
    data.status = 'APPROVED';
  }

  await prisma.accessRequest.update({
    where: { id },
    data
  });

  return NextResponse.json({ success: true });
}
