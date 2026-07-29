'use client';
import { useOrders } from '@/lib/useOrders';

export default function CafePickupPage() {
  const orders = useOrders();
  const ready = orders.filter((o) => o.cafeStatus === 'ready');

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      <header className="bg-amber-500 text-white text-center py-4 shrink-0">
        <h1 className="text-3xl font-bold">☕ 카페 수령</h1>
        <p className="text-amber-100 mt-1">준비완료 {ready.length}건</p>
      </header>
      <div className="p-4 grid grid-cols-4 gap-4 content-start">
        {ready.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-2xl p-5 shadow border-2 border-amber-400 flex flex-col gap-3 h-44 items-center justify-between"
          >
            <div className="text-7xl font-black text-amber-600">{order.id}</div>
            <button
              onClick={() => fetch(`/api/orders/${order.id}/cafe-pickup`, { method: 'POST' })}
              className="w-full py-3 rounded-xl bg-amber-500 text-white text-lg font-bold active:bg-amber-600"
            >
              수령완료
            </button>
          </div>
        ))}
        {ready.length === 0 && (
          <div className="col-span-4 text-center text-gray-400 text-2xl py-24">
            준비된 주문이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
