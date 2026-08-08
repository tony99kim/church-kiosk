export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { resetOrders, resetOrdersByDate } from '@/lib/store';

export async function POST(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? undefined;
  if (date) resetOrdersByDate(date);
  else resetOrders();
  return NextResponse.json({ ok: true });
}
