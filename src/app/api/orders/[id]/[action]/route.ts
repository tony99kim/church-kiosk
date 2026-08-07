export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { updateOrder } from '@/lib/store';

const VALID = new Set(['cafe-ready', 'food-ready', 'cafe-pickup', 'food-pickup']);

export async function POST(
  _req: Request,
  ctx: RouteContext<'/api/orders/[id]/[action]'>
) {
  const { id, action } = await ctx.params;
  if (!VALID.has(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }
  updateOrder(Number(id), action);
  return NextResponse.json({ ok: true });
}
