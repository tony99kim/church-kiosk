import { NextRequest, NextResponse } from 'next/server';
import { deleteMenuItem, setMenuStock } from '@/lib/store';

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/menu/[id]'>
) {
  const { id } = await ctx.params;
  deleteMenuItem(Number(id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<'/api/menu/[id]'>
) {
  const { id } = await ctx.params;
  const { stock } = await req.json();
  const stockVal = (stock === null || stock === '' || stock === undefined) ? null : Number(stock);
  setMenuStock(Number(id), stockVal);
  return NextResponse.json({ ok: true });
}
