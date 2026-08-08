export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAvailableDates } from '@/lib/store';

export async function GET() {
  return NextResponse.json(getAvailableDates());
}
