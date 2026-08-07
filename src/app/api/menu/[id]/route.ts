export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { deleteMenuItem, setMenuStock, moveMenuItem, updateMenuItem } from '@/lib/store';

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
  const body = await req.json();
  if ('move' in body) {
    moveMenuItem(Number(id), body.move);
  } else if ('name' in body || 'price' in body) {
    updateMenuItem(Number(id), { name: body.name, price: body.price !== undefined ? Number(body.price) : undefined });
  } else {
    const { stock } = body;
    const stockVal = (stock === null || stock === '' || stock === undefined) ? null : Number(stock);
    setMenuStock(Number(id), stockVal);
  }
  return NextResponse.json({ ok: true });
}
