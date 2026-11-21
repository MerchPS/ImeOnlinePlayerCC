import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim().slice(0, 80) : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!username || !password || password.length > 200) return NextResponse.json({ error: 'Username atau password tidak valid.' }, { status: 400 });
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return NextResponse.json({ error: 'Login admin belum dikonfigurasi dengan aman.' }, { status: 503 });

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return NextResponse.json({ error: 'Password salah' }, { status: 401 });

  const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
  const token = await new SignJWT({ userId: user.id, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  const res = NextResponse.json({ success: true });
  res.headers.set('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; Max-Age=604800; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  return res;
}
