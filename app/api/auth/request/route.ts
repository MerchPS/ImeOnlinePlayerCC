import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function POST(req: Request) {
  const { deviceId } = await req.json();
  const ip = req.headers.get('x-forwarded-for') || 'Unknown IP';

  if (!deviceId) return NextResponse.json({ error: 'Device ID required' }, { status: 400 });

  const existing = await prisma.accessRequest.findUnique({ where: { deviceId } });
  
  await prisma.accessRequest.upsert({
    where: { deviceId },
    update: { ipAddress: ip, status: 'PENDING', reason: null, timeoutUntil: null },
    create: { deviceId, ipAddress: ip, status: 'PENDING' }
  });

  // Kirim Webhook jika ini request baru (bukan yang sudah ada)
  if (!existing && process.env.DISCORD_WEBHOOK_URL) {
    fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🚨 **PERMINTAAN AKSES BARU**\nIP: \`${ip}\`\nDevice: \`${deviceId}\`\nSegera buka Admin Panel untuk ACC!`
      })
    }).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
