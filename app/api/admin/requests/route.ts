import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET() {
  const requests = await prisma.accessRequest.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(requests);
}

export async function PATCH(req: Request) {
  const { id, action, reason, durationMinutes } = await req.json();
  
  const data: any = {};
  let logDetails = '';

  if (action === 'APPROVE') { data.status = 'APPROVED'; data.reason = null; data.timeoutUntil = null; logDetails = 'Approved'; }
  if (action === 'REVOKE') { data.status = 'PENDING'; data.reason = null; data.timeoutUntil = null; logDetails = 'Revoked to Pending'; }
  if (action === 'BAN') { data.status = 'BANNED'; data.reason = reason || 'No reason provided'; logDetails = `Banned: ${data.reason}`; }
  if (action === 'TIMEOUT') { 
    data.status = 'APPROVED'; // Tetap approved, tapi ditahan oleh timeout
    data.timeoutUntil = new Date(Date.now() + (durationMinutes || 60) * 60000); 
    data.reason = reason || 'No reason provided'; 
    logDetails = `Timeout ${durationMinutes}m: ${data.reason}`;
  }
  if (action === 'CLEAR_TIMEOUT') { data.timeoutUntil = null; data.reason = null; data.status = 'APPROVED'; logDetails = 'Timeout Cleared'; }

  const updated = await prisma.accessRequest.update({ where: { id }, data });

  // Catat ke Audit Log
  await prisma.auditLog.create({
    data: { adminName: 'Hans', action, targetDeviceId: updated.deviceId, details: logDetails }
  });

  return NextResponse.json({ success: true });
}

// Bulk Actions
export async function POST(req: Request) {
  const { ids, action, reason } = await req.json();
  
  const data: any = {};
  if (action === 'APPROVE') { data.status = 'APPROVED'; data.reason = null; data.timeoutUntil = null; }
  if (action === 'BAN') { data.status = 'BANNED'; data.reason = reason || 'Bulk Ban'; }

  await prisma.accessRequest.updateMany({
    where: { id: { in: ids } },
    data
  });

  await prisma.auditLog.create({
    data: { adminName: 'Hans', action: `BULK_${action}`, targetDeviceId: `${ids.length} devices`, details: reason || `Bulk ${action}` }
  });

  return NextResponse.json({ success: true });
}
