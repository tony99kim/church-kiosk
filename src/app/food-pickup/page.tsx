'use client';
import { useOrders } from '@/lib/useOrders';

export default function FoodPickupPage() {
  const orders = useOrders();
  const ready = orders.filter((o) => o.foodStatus === 'ready');

  return (
    <div className="min-h-screen bg-green-50">
      <header className="bg-green-600 text-white text-center py-5">
        <h1 className="text-3xl font-bold">🍱 음식 수령</h1>
        <p className="text-green-100 mt-1 text-lg">준비완료 {ready.length}건</p>
      </header>
      <div className="p-5 grid grid-cols-3 md:grid-cols-4 gap-4">
        {ready.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-2xl p-5 shadow border-2 border-green-400 flex flex-col gap-3"
          >
            <div className="text-7xl font-black text-center text-green-600">{order.id}</div>
            <button
              onClick={() =>
                fetch(`/api/orders/${order.id}/food-pickup`, { method: 'POST' })
              }
              className="w-full py-4 rounded-xl bg-blue-500 text-white text-xl font-bold active:bg-blue-600"
            >
              수령완료
            </button>
          </div>
        ))}
        {ready.length === 0 && (
          <div className="col-span-full text-center text-gray-400 text-2xl py-24">
            준비된 주문이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
