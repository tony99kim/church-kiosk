import { NextResponse } from 'next/server';
import { resetOrders } from '@/lib/store';

export async function POST() {
  resetOrders();
  return NextResponse.json({ ok: true });
}
