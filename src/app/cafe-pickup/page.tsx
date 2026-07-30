'use client';
import { useOrders } from '@/lib/useOrders';
import type { Order } from '@/lib/store';

function SlotCard({ slot, order }: { slot: number; order?: Order }) {
  const pickup = () => fetch(`/api/orders/${order!.id}/cafe-pickup`, { method: 'POST' });

  return (
    <div className={`rounded-2xl border-2 flex flex-col h-44 ${
      order ? 'bg-white border-amber-400 shadow-md' : 'bg-gray-100 border-gray-200'
    }`}>
      <div className={`flex items-center justify-between px-3 pt-2 ${order ? 'text-amber-500' : 'text-gray-300'}`}>
        <span className="text-xs font-bold">수령대 {slot}</span>
        {order && <span className="text-xs text-gray-400">#{order.id}</span>}
      </div>

      {order ? (
        <>
          <div className="flex-1 flex items-center justify-center">
            <span className="text-6xl font-black text-amber-500">{order.id}</span>
          </div>
          <button onClick={pickup}
            className="mx-2 mb-2 py-2 rounded-xl bg-blue-500 text-white text-sm font-bold active:bg-blue-600">
            수령완료
          </button>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-3xl font-light">—</div>
      )}
    </div>
  );
}

export default function CafePickupPage() {
  const orders = useOrders();
  const ready = orders.filter(o => o.cafeStatus === 'ready');
  const overflow = ready.filter(o => !o.cafePickupSlot);

  const slots = Array.from({ length: 10 }, (_, i) => ({
    slot: i + 1,
    order: ready.find(o => o.cafePickupSlot === i + 1),
  }));

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-amber-50">
      <header className="bg-amber-500 text-white px-6 py-3 flex items-center gap-4 shrink-0">
        <h1 className="text-2xl font-bold">☕ 카페 수령</h1>
        <span className={`text-xl font-black px-4 py-1 rounded-full ${ready.length >= 8 ? 'bg-red-500' : 'bg-amber-700'}`}>
          {ready.length}건
        </span>
        {overflow.length > 0 && (
          <span className="ml-auto text-sm bg-red-500 px-3 py-1 rounded-full font-bold">대기 {overflow.length}건</span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-5 gap-3">
          {slots.map(({ slot, order }) => <SlotCard key={slot} slot={slot} order={order} />)}
        </div>

        {overflow.length > 0 && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-3">
            <p className="text-sm font-bold text-red-600 mb-2">수령대 대기 중</p>
            <div className="flex flex-wrap gap-2">
              {overflow.map(o => (
                <div key={o.id} className="bg-white border border-red-300 rounded-xl px-4 py-2 text-sm font-black text-red-600">
                  #{o.id}
                </div>
              ))}
            </div>
          </div>
        )}

        {ready.length === 0 && (
          <p className="text-center text-gray-400 text-xl py-16">수령 대기 없음</p>
        )}
      </div>
    </div>
  );
}
