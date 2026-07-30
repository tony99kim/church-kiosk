import { NextRequest, NextResponse } from 'next/server';
import { saveMenuOptions } from '@/lib/store';

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<'/api/menu/[id]/options'>
) {
  const { id } = await ctx.params;
  const { groups } = await req.json();
  saveMenuOptions(Number(id), groups ?? []);
  return NextResponse.json({ ok: true });
}
