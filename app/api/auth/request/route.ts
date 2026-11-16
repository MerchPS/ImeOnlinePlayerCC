import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function POST(req: Request) {
  const { deviceId } = await req.json();
  const ip = req.headers.get('x-forwarded-for') || 'Unknown IP';

  if (!deviceId) return NextResponse.json({ error: 'Device ID required' }, { status: 400 });

  const existing = await prisma.accessRequest.findUnique({ where: { deviceId } });
  
  // RATE LIMITER: Cek apakah kurang dari 5 menit (300.000 ms)
  if (existing && existing.lastRequestedAt) {
    const timeDiff = Date.now() - new Date(existing.lastRequestedAt).getTime();
    if (timeDiff < 5 * 60 * 1000) {
      const remainingSeconds = Math.ceil((5 * 60 * 1000 - timeDiff) / 1000);
      return NextResponse.json(
        { error: `Tunggu ${remainingSeconds} detik lagi sebelum meminta akses.` }, 
        { status: 429 }
      );
    }
  }

  const updated = await prisma.accessRequest.upsert({
    where: { deviceId },
    update: { ipAddress: ip, status: 'PENDING', reason: null, timeoutUntil: null, lastRequestedAt: new Date() },
    create: { deviceId, ipAddress: ip, status: 'PENDING', lastRequestedAt: new Date() }
  });

  // Kirim Webhook hanya jika status sebelumnya bukan PENDING (artinya request baru)
  if ((!existing || existing.status !== 'PENDING') && process.env.DISCORD_WEBHOOK_URL) {
    fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🚨 **PERMINTAAN AKSES BARU**\nIP: \`${ip}\`\nDevice: \`${deviceId}\`\nSegera buka Admin Panel!`
      })
    }).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
