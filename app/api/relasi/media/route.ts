import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getStaff } from '@/src/lib/staff';

export async function GET(request: Request) {
  if (!(await getStaff(request))) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
  const pathname = new URL(request.url).searchParams.get('pathname') || '';
  if (!pathname.startsWith('relasi-media/') || pathname.includes('..')) {
    return NextResponse.json({ error: 'Referensi media tidak valid.' }, { status: 400 });
  }

  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) return new NextResponse('Media tidak ditemukan.', { status: 404 });
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse('Gagal memuat media.', { status: 502 });
  }
}