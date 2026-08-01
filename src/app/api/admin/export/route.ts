import { getOrdersForExport, getItemSummary } from '@/lib/store';

export async function GET() {
  const summary = getItemSummary();
  const rows = getOrdersForExport();

  const directItems = summary.filter(s => !s.isOption);
  const optionItems = summary.filter(s => s.isOption);

  const summarySection = [
    '[품목별 집계]',
    '품목,수량',
    ...directItems.map(s => `${s.name},${s.qty}`),
    ...(optionItems.length > 0 ? ['[세트 옵션 집계]', ...optionItems.map(s => `${s.name},${s.qty}`)] : []),
    '',
  ].join('\n');

  const detailHeader = '[주문 상세]\n주문번호,시각,주문내역,옵션,합계금액,결제방식';
  const detailBody = rows
    .map(r => [r.id, r.date, `"${r.items}"`, `"${r.options}"`, r.total, r.payment].join(','))
    .join('\n');

  const csv = `﻿${summarySection}\n${detailHeader}\n${detailBody}`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="orders.csv"',
    },
  });
}
