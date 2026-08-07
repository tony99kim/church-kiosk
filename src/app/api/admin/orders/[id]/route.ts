export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { cancelOrder, editOrder } from '@/lib/store';

export async function DELETE(_req: Request, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const { id } = await ctx.params;
  cancelOrder(Number(id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const { id } = await ctx.params;
  const { cafeItems, foodItems, itemOptions } = await req.json();
  const ok = editOrder(Number(id), cafeItems, foodItems, itemOptions);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'not found' }, { status: 404 });
}
