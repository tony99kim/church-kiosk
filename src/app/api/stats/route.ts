export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getStats } from '@/lib/store';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? undefined;
  return NextResponse.json(getStats(date));
}
