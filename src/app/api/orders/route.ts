import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/lib/store';

export async function POST(req: NextRequest) {
  let body: { cafeItems?: unknown; foodItems?: unknown; itemOptions?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const cafeItems = (body.cafeItems && typeof body.cafeItems === 'object' && !Array.isArray(body.cafeItems))
    ? body.cafeItems as Record<string, number> : {};
  const foodItems = (body.foodItems && typeof body.foodItems === 'object' && !Array.isArray(body.foodItems))
    ? body.foodItems as Record<string, number> : {};
  const itemOptions = (body.itemOptions && typeof body.itemOptions === 'object' && !Array.isArray(body.itemOptions))
    ? body.itemOptions as Record<string, Record<string, Record<string, number>>> : {};

  if (Object.keys(cafeItems).length === 0 && Object.keys(foodItems).length === 0) {
    return NextResponse.json({ error: 'empty order' }, { status: 400 });
  }

  let order;
  try {
    order = createOrder(cafeItems, foodItems, itemOptions);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.startsWith('sold_out:')) {
      const name = msg.slice('sold_out:'.length);
      return NextResponse.json({ error: 'sold_out', name }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json(order);
}
