import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/lib/store';

export async function POST(req: NextRequest) {
  const { cafeItems, foodItems, itemOptions } = await req.json();
  const order = createOrder(cafeItems ?? {}, foodItems ?? {}, itemOptions ?? {});
  return NextResponse.json(order);
}
