import { NextRequest, NextResponse } from 'next/server';
import { getMenuItems, addMenuItem } from '@/lib/store';

export async function GET() {
  return NextResponse.json(getMenuItems());
}

export async function POST(req: NextRequest) {
  const { name, type, price, stock } = await req.json();
  if (!name || !['cafe', 'food'].includes(type)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const stockVal = (stock !== undefined && stock !== '' && stock !== null) ? Number(stock) : null;
  const item = addMenuItem(String(name).trim(), type, Number(price) || 0, stockVal);
  return NextResponse.json(item);
}
