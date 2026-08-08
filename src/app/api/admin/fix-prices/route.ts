export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUnpricedItems, applyLegacyPrices } from '@/lib/store';

export async function GET() {
  return NextResponse.json(getUnpricedItems());
}

export async function POST(req: NextRequest) {
  const prices = await req.json() as Record<string, number>;
  applyLegacyPrices(prices);
  return NextResponse.json({ ok: true });
}
