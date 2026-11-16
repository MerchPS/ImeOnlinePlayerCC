import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-hans-ime');

export async function POST(req: Request) {
  const { username, password } = await req.json();

  // Auto-create admin pertama kali jika DB kosong
  const userCount = await prisma.user.count();
  if (userCount === 0 && username === 'Hans') {
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { username: 'Hans', password: hashed } });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return NextResponse.json({ error: 'Password salah' }, { status: 401 });

  // Buat JWT Token
  const token = await new SignJWT({ userId: user.id, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  const res = NextResponse.json({ success: true });
  res.headers.set('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; Max-Age=604800; SameSite=Lax`);
  return res;
}
