'use client';
import { useOrders } from '@/lib/useOrders';
import type { Order } from '@/lib/store';

function NumberBox({ id, isReady }: { id: number; isReady: boolean }) {
  return (
    <div
      className={`rounded-2xl flex items-center justify-center w-32 h-32 text-5xl font-black select-none ${
        isReady
          ? 'bg-green-400 text-white shadow-lg animate-pulse'
          : 'bg-amber-300 text-amber-900'
      }`}
    >
      {id}
    </div>
  );
}

function Side({
  label,
  orders,
  statusKey,
  headerClass,
}: {
  label: string;
  orders: Order[];
  statusKey: 'cafeStatus' | 'foodStatus';
  headerClass: string;
}) {
  const visible = orders.filter(
    (o) => o[statusKey] === 'preparing' || o[statusKey] === 'ready'
  );
  const ready = visible.filter((o) => o[statusKey] === 'ready');
  const preparing = visible.filter((o) => o[statusKey] === 'preparing');

  return (
    <div className="flex-1 flex flex-col">
      <div className={`${headerClass} py-7 text-center`}>
        <h2 className="text-5xl font-bold text-white">{label}</h2>
      </div>

      {ready.length > 0 && (
        <div className="p-6 bg-green-900/20 border-b border-gray-700">
          <p className="text-green-400 text-2xl font-bold text-center mb-5">✅ 가져가세요</p>
          <div className="flex flex-wrap gap-4 justify-center">
            {ready.map((o) => (
              <NumberBox key={o.id} id={o.id} isReady={true} />
            ))}
          </div>
        </div>
      )}

      {preparing.length > 0 && (
        <div className="p-6">
          <p className="text-amber-400 text-2xl font-bold text-center mb-5">⏳ 준비중</p>
          <div className="flex flex-wrap gap-4 justify-center">
            {preparing.map((o) => (
              <NumberBox key={o.id} id={o.id} isReady={false} />
            ))}
          </div>
        </div>
      )}

      {visible.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-3xl">
          대기 없음
        </div>
      )}
    </div>
  );
}

export default function DisplayPage() {
  const orders = useOrders();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      <Side
        label="☕ 카페"
        orders={orders}
        statusKey="cafeStatus"
        headerClass="bg-amber-600"
      />
      <div className="w-px bg-gray-700" />
      <Side
        label="🍱 음식점"
        orders={orders}
        statusKey="foodStatus"
        headerClass="bg-green-700"
      />
    </div>
  );
}
