import { NextResponse } from 'next/server';
import { cancelOrder } from '@/lib/store';

export async function DELETE(_req: Request, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const { id } = await ctx.params;
  cancelOrder(Number(id));
  return NextResponse.json({ ok: true });
}
