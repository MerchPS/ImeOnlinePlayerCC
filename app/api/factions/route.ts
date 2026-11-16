import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

const DEFAULT_FACTIONS = [
  { label: 'Crimson Creed', short: 'CC', matchType: 'INCLUDES', badge: 'bg-[#3a1f1a] text-[#e09b7a] border-[#5a2f25]', dot: 'bg-[#c97a5c]' },
  { label: 'Polisi Kota', short: 'LSPD', matchType: 'INCLUDES', badge: 'bg-[#1a2535] text-[#82aed8] border-[#253a55]', dot: 'bg-[#6a9dd8]' },
  { label: '4Bloods', short: '4B', matchType: 'INCLUDES', badge: 'bg-[#2f1a1a] text-[#d47878] border-[#4a2525]', dot: 'bg-[#c95c5c]' },
  { label: 'Department Of Correction', short: 'DOC', matchType: 'INCLUDES', badge: 'bg-[#252525] text-[#b0b0b0] border-[#3a3a3a]', dot: 'bg-[#a0a0a0]' },
  { label: 'Serif', short: 'LSSD', matchType: 'INCLUDES', badge: 'bg-[#2f2a1a] text-[#dcc878] border-[#4a4525]', dot: 'bg-[#c9b05c]' },
  { label: 'Dokter Kota', short: 'MED', matchType: 'INCLUDES', badge: 'bg-[#25302a] text-[#9dd88c] border-[#3a4a35]', dot: 'bg-[#8cc97a]' },
  { label: 'Roxwood Hospital', short: 'RH', matchType: 'INCLUDES', badge: 'bg-[#1a2f2a] text-[#7ad8b0] border-[#254a3f]', dot: 'bg-[#6ac9a0]' },
  { label: 'Mekanik IME', short: 'ICR', matchType: 'INCLUDES', badge: 'bg-[#3a2f1a] text-[#dcc878] border-[#5a4a25]', dot: 'bg-[#c9a95c]' },
  { label: 'Department Of Justice', short: 'DOJ', matchType: 'INCLUDES', badge: 'bg-[#2a1f35] text-[#b48fd8] border-[#3f2f55]', dot: 'bg-[#a07ac9]' },
  { label: 'Jeruzalem', short: 'JRZ', matchType: 'INCLUDES', badge: 'bg-[#3a351a] text-[#dcd478] border-[#5a5525]', dot: 'bg-[#c9c05c]' },
  { label: 'HighTable', short: 'HT', matchType: 'INCLUDES', badge: 'bg-[#2a2515] text-[#e0b88a] border-[#453f25]', dot: 'bg-[#d4a574]' },
  { label: 'Helper', short: 'IME', matchType: 'INCLUDES', badge: 'bg-[#1a2f35] text-[#7ad8e0] border-[#254a55]', dot: 'bg-[#6ac9d8]' },
  { label: 'Burgenk', short: 'Burgenk', matchType: 'INCLUDES', badge: 'bg-[#2a1a25] text-[#d882b0] border-[#4a2540]', dot: 'bg-[#c95c90]' },
  { label: 'DTF', short: 'DTF', matchType: 'INCLUDES', badge: 'bg-[#1a2525] text-[#82d8d8] border-[#254a4a]', dot: 'bg-[#6ac9c9]' },
  { label: 'Allstars', short: 'Allstars', matchType: 'INCLUDES', badge: 'bg-[#25251a] text-[#d8d882] border-[#4a4a25]', dot: 'bg-[#c9c95c]' },
  { label: 'NSN', short: 'NSN', matchType: 'INCLUDES', badge: 'bg-[#351a2a] text-[#d882b0] border-[#552540]', dot: 'bg-[#c95c90]' },
  { label: 'WT', short: 'WT', matchType: 'STARTS_WITH', badge: 'bg-[#1a3525] text-[#82d8a0] border-[#254a35]', dot: 'bg-[#6ac980]' },
  { label: '24S', short: '24S', matchType: 'INCLUDES', badge: 'bg-[#2a1a1a] text-[#d88282] border-[#4a2525]', dot: 'bg-[#c95c5c]' },
  { label: 'OMC', short: 'OMC', matchType: 'INCLUDES', badge: 'bg-[#1a2a35] text-[#82b0d8] border-[#254055]', dot: 'bg-[#5c90c9]' },
  { label: '5TAR', short: '5TAR', matchType: 'INCLUDES', badge: 'bg-[#352a1a] text-[#d8b082] border-[#554025]', dot: 'bg-[#c9905c]' },
  { label: 'MX', short: 'MX', matchType: 'STARTS_WITH', badge: 'bg-[#2a1a35] text-[#b082d8] border-[#402555]', dot: 'bg-[#905cc9]' },
  { label: 'RCMC', short: 'RCMC', matchType: 'INCLUDES', badge: 'bg-[#35251a] text-[#d8a082] border-[#553a25]', dot: 'bg-[#c9805c]' },
  { label: 'RAGE', short: 'RAGE', matchType: 'STARTS_WITH', badge: 'bg-[#351a1a] text-[#d88282] border-[#552525]', dot: 'bg-[#c95c5c]' },
  { label: 'Altion', short: 'Altion', matchType: 'INCLUDES', badge: 'bg-[#1a352a] text-[#82d8b0] border-[#254a40]', dot: 'bg-[#5cc990]' },
  { label: 'NN', short: 'NN', matchType: 'STARTS_WITH', badge: 'bg-[#251a35] text-[#a082d8] border-[#352555]', dot: 'bg-[#805cc9]' }
];

export async function GET() {
  let factions = await prisma.faction.findMany({ orderBy: { createdAt: 'asc' } });
  
  // Seed data jika database masih kosong
  if (factions.length === 0) {
    await prisma.faction.createMany({ data: DEFAULT_FACTIONS });
    factions = await prisma.faction.findMany({ orderBy: { createdAt: 'asc' } });
  }
  
  return NextResponse.json(factions);
}

export async function POST(req: Request) {
  const body = await req.json();
  const newFaction = await prisma.faction.create({
    data: {
      label: body.label,
      short: body.short,
      matchType: body.matchType,
      badge: body.badge,
      dot: body.dot
    }
  });
  return NextResponse.json(newFaction);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await prisma.faction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
