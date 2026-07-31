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
  const pickup = () => order && fetch(`/api/orders/${order.id}/cafe-pickup`, { method: 'POST' });
  const isReady = order?.cafeStatus === 'ready';

  const items = order
    ? Object.entries(order.cafeItems).filter(([, n]) => n > 0)
        .map(([name, n]) => n > 1 ? `${name} ×${n}` : name).join(' / ')
    : '';

  return (
    <div className={`rounded-2xl border-2 flex flex-col min-h-48 ${
      order
        ? isReady
          ? 'bg-white border-amber-500 shadow-md'
          : 'bg-amber-50 border-amber-300'
        : 'bg-gray-100 border-gray-200'
    }`}>
      <div className={`flex items-center justify-between px-3 pt-2.5 ${order ? 'text-amber-500' : 'text-gray-300'}`}>
        <span className="text-sm font-bold">수령대 {slot}</span>
        {order && <span className="text-sm text-gray-400 font-bold">#{order.id}</span>}
      </div>

      {order ? (
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-2">
            <span className={`text-6xl font-black leading-none ${isReady ? 'text-amber-600' : 'text-amber-300'}`}>{order.id}</span>
            <span className="text-sm text-gray-600 text-center mt-1.5 leading-tight line-clamp-2 font-medium">{items}</span>
            {Object.entries(order.itemOptions ?? {}).map(([, opts]) => formatOptions(opts)).filter(Boolean).map((s, i) => (
              <span key={i} className="text-xs text-blue-500 text-center leading-tight mt-0.5">{s}</span>
            ))}
          </div>
          {isReady ? (
            <button onClick={pickup} className="mx-2 mb-2.5 py-2.5 rounded-xl bg-blue-500 text-white text-base font-bold active:bg-blue-600">
              수령완료
            </button>
          ) : (
            <div className="mx-2 mb-2.5 py-2.5 rounded-xl bg-amber-100 text-amber-400 text-base font-bold text-center">
              준비 중...
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-4xl font-light">—</div>
      )}
    </div>
  );
}

function OverflowCard({ order }: { order: Order }) {
  const isReady = order.cafeStatus === 'ready';
  const onPickup = () => fetch(`/api/orders/${order.id}/cafe-pickup`, { method: 'POST' });

  const items = Object.entries(order.cafeItems).filter(([, n]) => n > 0)
    .map(([name, n]) => n > 1 ? `${name} ×${n}` : name).join(' / ');
  const optLines = Object.entries(order.itemOptions ?? {}).map(([, opts]) => formatOptions(opts)).filter(Boolean);

  return (
    <div className={`rounded-2xl border-2 p-4 flex items-center gap-4 ${
      isReady ? 'bg-white border-amber-500' : 'bg-amber-50 border-amber-300'
    }`}>
      <span className={`text-4xl font-black shrink-0 ${isReady ? 'text-amber-600' : 'text-amber-300'}`}>{order.id}</span>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-slate-700 truncate">{items}</p>
        {optLines.map((s, i) => <p key={i} className="text-sm text-blue-500 truncate">{s}</p>)}
      </div>
      {isReady ? (
        <button onClick={onPickup} className="shrink-0 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-base font-bold active:bg-blue-600">
          수령완료
        </button>
      ) : (
        <span className="shrink-0 px-5 py-2.5 rounded-xl bg-amber-100 text-amber-400 text-base font-bold">
          준비 중...
        </span>
      )}
    </div>
  );
}

export default function CafePickupPage() {
  const orders = useOrders();
  const active = orders.filter(o => o.cafeStatus === 'preparing' || o.cafeStatus === 'ready');
  const overflow = active.filter(o => !o.cafePickupSlot);
  const slots = Array.from({ length: 10 }, (_, i) => ({ slot: i + 1, order: active.find(o => o.cafePickupSlot === i + 1) }));

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-amber-50">
      <header className="bg-amber-500 text-white px-6 py-4 flex items-center gap-4 shrink-0">
        <h1 className="text-3xl font-black">☕ 카페 수령대</h1>
        <span className={`text-2xl font-black px-4 py-1 rounded-full ${active.length >= 8 ? 'bg-red-500' : 'bg-amber-700'}`}>{active.length}건</span>
        {overflow.length > 0 && <span className="ml-auto text-base bg-red-500 px-3 py-1.5 rounded-full font-bold">대기 {overflow.length}건</span>}
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-5 gap-3">
          {slots.map(({ slot, order }) => <SlotCard key={slot} slot={slot} order={order} />)}
        </div>
        {overflow.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-base font-bold text-red-600 px-1">수령대 대기 중</p>
            {overflow.map(o => <OverflowCard key={o.id} order={o} />)}
          </div>
        )}
      </div>
    </div>
  );
}
