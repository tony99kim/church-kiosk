'use client';
import { useOrders, formatItems } from '@/lib/useOrders';

export default function CafePage() {
  const orders = useOrders();
  const preparing = orders.filter((o) => o.cafeStatus === 'preparing');

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-500 text-white text-center py-5">
        <h1 className="text-3xl font-bold">☕ 카페 주문</h1>
        <p className="text-amber-100 mt-1 text-lg">대기 {preparing.length}건</p>
      </header>
      <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
        {preparing.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-2xl p-5 shadow border-2 border-amber-200 flex flex-col gap-3"
          >
            <div className="text-7xl font-black text-center text-amber-600">{order.id}</div>
            <div className="text-base text-gray-600 text-center min-h-12 leading-relaxed">
              {formatItems(order.cafeItems)}
            </div>
            <button
              onClick={() =>
                fetch(`/api/orders/${order.id}/cafe-ready`, { method: 'POST' })
              }
              className="w-full py-4 rounded-xl bg-green-500 text-white text-xl font-bold active:bg-green-600"
            >
              준비완료
            </button>
          </div>
        ))}
        {preparing.length === 0 && (
          <div className="col-span-full text-center text-gray-400 text-2xl py-24">
            대기 중인 주문이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
