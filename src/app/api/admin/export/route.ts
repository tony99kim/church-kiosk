import { getOrdersForExport } from '@/lib/store';

export async function GET() {
  const rows = getOrdersForExport();
  const header = '주문번호,시간,주문내역,옵션,합계금액';
  const body = rows
    .map(r => [r.id, r.date, `"${r.items}"`, `"${r.options}"`, r.total].join(','))
    .join('\n');
  const csv = `﻿${header}\n${body}`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="orders.csv"',
    },
  });
}
