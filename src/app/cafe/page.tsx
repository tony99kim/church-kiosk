'use client';
import { useOrders } from '@/lib/useOrders';
import type { Order } from '@/lib/store';

function formatOptions(opts: unknown): string | null {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return null;
  const parts: string[] = [];
  for (const [, v] of Object.entries(opts as Record<string, unknown>)) {
    if (typeof v === 'string') { parts.push(v); continue; }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const s = Object.entries(v as Record<string, number>).filter(([, q]) => q > 0).map(([n, q]) => q > 1 ? `${n}×${q}` : n).join('+');
      if (s) parts.push(s);
    }
  }
  return parts.length ? parts.join(' / ') : null;
}

function SlotCard({ slot, order }: { slot: number; order?: Order }) {
  const ready = () => fetch(`/api/orders/${order!.id}/cafe-ready`, { method: 'POST' });
  const isReady = order?.cafeStatus === 'ready';

  const items = order
    ? Object.entries(order.cafeItems).filter(([, n]) => n > 0)
        .map(([name, n]) => n > 1 ? `${name} ×${n}` : name).join(' / ')
    : '';

  return (
    <div className={`rounded-2xl border-2 flex flex-col h-44 ${
      order
        ? isReady
          ? 'bg-blue-50 border-blue-300 shadow'
          : 'bg-white border-amber-300 shadow'
        : 'bg-gray-100 border-gray-200'
    }`}>
      <div className={`flex items-center justify-between px-3 pt-2 ${
        order ? (isReady ? 'text-blue-500' : 'text-amber-500') : 'text-gray-300'
      }`}>
        <span className="text-xs font-bold">준비대 {slot}</span>
        {order && <span className="text-xs text-gray-400">#{order.id}</span>}
      </div>

      {order ? (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-2">
            <span className={`text-5xl font-black leading-none ${isReady ? 'text-blue-500' : 'text-amber-600'}`}>{order.id}</span>
            <span className="text-xs text-gray-500 text-center mt-1 leading-tight line-clamp-2">{items}</span>
            {Object.entries(order.itemOptions ?? {}).map(([, opts]) => formatOptions(opts)).filter(Boolean).map((s, i) => (
              <span key={i} className="text-xs text-blue-500 text-center leading-tight">{s}</span>
            ))}
          </div>
          {isReady ? (
            <div className="mx-2 mb-2 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold text-center">
              수령 대기 중
            </div>
          ) : (
            <button onClick={ready} className="mx-2 mb-2 py-2 rounded-xl bg-green-500 text-white text-sm font-bold active:bg-green-600">
              준비완료
            </button>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-3xl font-light">—</div>
      )}
    </div>
  );
}

export default function CafePage() {
  const orders = useOrders();
  const active = orders.filter(o => o.cafeStatus === 'preparing' || o.cafeStatus === 'ready');
  const overflow = active.filter(o => !o.cafeSlot);
  const slots = Array.from({ length: 10 }, (_, i) => ({ slot: i + 1, order: active.find(o => o.cafeSlot === i + 1) }));
  const preparingCount = active.filter(o => o.cafeStatus === 'preparing').length;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-amber-50">
      <header className="bg-amber-500 text-white px-6 py-3 flex items-center gap-4 shrink-0">
        <h1 className="text-2xl font-bold">☕ 카페 주문</h1>
        <span className={`text-xl font-black px-4 py-1 rounded-full ${preparingCount >= 8 ? 'bg-red-500' : 'bg-amber-700'}`}>{preparingCount}건</span>
        {overflow.length > 0 && <span className="ml-auto text-sm bg-red-500 px-3 py-1 rounded-full font-bold">대기 {overflow.length}건</span>}
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-5 gap-3">
          {slots.map(({ slot, order }) => <SlotCard key={slot} slot={slot} order={order} />)}
        </div>
        {overflow.length > 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-3">
            <p className="text-sm font-bold text-red-600 mb-2">준비대 대기 중</p>
            <div className="flex flex-wrap gap-2">
              {overflow.map(o => <div key={o.id} className="bg-white border border-red-300 rounded-xl px-3 py-1 text-sm font-black text-red-600">#{o.id}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
