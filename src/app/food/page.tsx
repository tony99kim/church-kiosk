'use client';
import { useOrders, formatItems } from '@/lib/useOrders';

export default function FoodPage() {
  const orders = useOrders();
  const preparing = orders.filter((o) => o.foodStatus === 'preparing');

  return (
    <div className="min-h-screen bg-green-50 flex flex-col">
      <header className="bg-green-600 text-white text-center py-4 flex items-center justify-center gap-4 shrink-0">
        <h1 className="text-3xl font-bold">🍱 음식 주문</h1>
        <span className={`text-2xl font-black px-4 py-1 rounded-full ${preparing.length >= 8 ? 'bg-red-500' : 'bg-green-800'}`}>
          {preparing.length}건
        </span>
      </header>

      <div className="p-3 grid grid-cols-5 gap-3 content-start">
        {preparing.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-2xl p-3 shadow border-2 border-green-200 flex flex-col gap-2 h-40"
          >
            <div className="text-5xl font-black text-center text-green-600 leading-none pt-1">
              {order.id}
            </div>
            <div className="text-xs text-gray-500 text-center leading-tight flex-1 flex items-center justify-center px-1">
              {formatItems(order.foodItems)}
            </div>
            <button
              onClick={() => fetch(`/api/orders/${order.id}/food-ready`, { method: 'POST' })}
              className="w-full py-2 rounded-xl bg-green-500 text-white text-sm font-bold active:bg-green-600"
            >
              준비완료
            </button>
          </div>
        ))}

        {preparing.length === 0 && (
          <div className="col-span-5 text-center text-gray-400 text-2xl py-24">
            대기 중인 주문이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
