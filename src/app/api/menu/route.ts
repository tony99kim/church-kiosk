import { NextRequest, NextResponse } from 'next/server';
import { getMenuItems, addMenuItem } from '@/lib/store';

export async function GET() {
  return NextResponse.json(getMenuItems());
}

export async function POST(req: NextRequest) {
  const { name, type } = await req.json();
  if (!name || !['cafe', 'food'].includes(type)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const item = addMenuItem(String(name).trim(), type);
  return NextResponse.json(item);
}
