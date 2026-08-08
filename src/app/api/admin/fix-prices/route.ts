export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUnpricedItems, applyLegacyPrices } from '@/lib/store';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? undefined;
  return NextResponse.json(getUnpricedItems(date));
}

export async function POST(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? undefined;
  const prices = await req.json() as Record<string, number>;
  applyLegacyPrices(prices, date);
  return NextResponse.json({ ok: true });
}
