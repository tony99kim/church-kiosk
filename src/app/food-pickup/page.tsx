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
  const pickup = () => fetch(`/api/orders/${order!.id}/food-pickup`, { method: 'POST' });
  const isReady = order?.foodStatus === 'ready';

  const items = order
    ? Object.entries(order.foodItems).filter(([, n]) => n > 0)
        .map(([name, n]) => n > 1 ? `${name} ×${n}` : name).join(' / ')
    : '';

  return (
    <div className={`rounded-2xl border-2 flex flex-col h-44 ${
      order
        ? isReady
          ? 'bg-white border-green-400 shadow-md'
          : 'bg-green-50 border-green-200'
        : 'bg-gray-100 border-gray-200'
    }`}>
      <div className={`flex items-center justify-between px-3 pt-2 ${order ? 'text-green-600' : 'text-gray-300'}`}>
        <span className="text-xs font-bold">수령대 {slot}</span>
        {order && <span className="text-xs text-gray-400">#{order.id}</span>}
      </div>

      {order ? (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-2">
            <span className={`text-5xl font-black leading-none ${isReady ? 'text-green-600' : 'text-green-300'}`}>{order.id}</span>
            <span className="text-xs text-gray-500 text-center mt-1 leading-tight line-clamp-2">{items}</span>
            {Object.entries(order.itemOptions ?? {}).map(([, opts]) => formatOptions(opts)).filter(Boolean).map((s, i) => (
              <span key={i} className="text-xs text-blue-500 text-center leading-tight">{s}</span>
            ))}
            {!isReady && <span className="text-xs text-green-400 font-bold mt-1">준비 중</span>}
          </div>
          {isReady ? (
            <button onClick={pickup} className="mx-2 mb-2 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold active:bg-blue-600">
              수령완료
            </button>
          ) : (
            <div className="mx-2 mb-2 py-2 rounded-xl bg-green-100 text-green-400 text-sm font-bold text-center">
              준비 중...
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-3xl font-light">—</div>
      )}
    </div>
  );
}

export default function FoodPickupPage() {
  const orders = useOrders();
  const active = orders.filter(o => o.foodStatus === 'preparing' || o.foodStatus === 'ready');
  const overflow = active.filter(o => !o.foodPickupSlot);
  const slots = Array.from({ length: 10 }, (_, i) => ({ slot: i + 1, order: active.find(o => o.foodPickupSlot === i + 1) }));

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-green-50">
      <header className="bg-green-600 text-white px-6 py-3 flex items-center gap-4 shrink-0">
        <h1 className="text-2xl font-bold">🍱 음식 수령</h1>
        <span className={`text-xl font-black px-4 py-1 rounded-full ${active.length >= 8 ? 'bg-red-500' : 'bg-green-800'}`}>{active.length}건</span>
        {overflow.length > 0 && <span className="ml-auto text-sm bg-red-500 px-3 py-1 rounded-full font-bold">대기 {overflow.length}건</span>}
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-5 gap-3">
          {slots.map(({ slot, order }) => <SlotCard key={slot} slot={slot} order={order} />)}
        </div>
        {overflow.length > 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-3">
            <p className="text-sm font-bold text-red-600 mb-2">수령대 대기 중</p>
            <div className="flex flex-wrap gap-2">
              {overflow.map(o => <div key={o.id} className="bg-white border border-red-300 rounded-xl px-3 py-1 text-sm font-black text-red-600">#{o.id}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
