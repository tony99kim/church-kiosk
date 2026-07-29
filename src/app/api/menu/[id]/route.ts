import { NextResponse } from 'next/server';
import { deleteMenuItem } from '@/lib/store';

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/menu/[id]'>
) {
  const { id } = await ctx.params;
  deleteMenuItem(Number(id));
  return NextResponse.json({ ok: true });
}
