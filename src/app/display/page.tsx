'use client';
import { useOrders } from '@/lib/useOrders';
import type { Order } from '@/lib/store';

function NumberChip({ id, pulse }: { id: number; pulse?: boolean }) {
  return (
    <div className={`w-32 h-32 rounded-3xl flex items-center justify-center text-5xl font-black select-none shadow-lg ${
      pulse
        ? 'bg-green-400 text-white shadow-green-500/40'
        : 'bg-amber-400 text-amber-900 shadow-amber-500/20'
    }`}>
      {id}
    </div>
  );
}

function Column({
  orders, statusKey, isReady,
}: {
  orders: Order[];
  statusKey: 'cafeStatus' | 'foodStatus';
  isReady: boolean;
}) {
  const filtered = orders.filter(o => o[statusKey] === (isReady ? 'ready' : 'preparing'));

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className={`py-4 text-center border-b border-gray-700 ${isReady ? 'bg-green-900/40' : 'bg-gray-800/60'}`}>
        <p className={`text-2xl font-bold ${isReady ? 'text-green-300' : 'text-amber-300'}`}>
          {isReady ? '✅ 가져가세요' : '⏳ 준비 중'}
        </p>
        <p className="text-gray-400 text-base mt-1">{filtered.length}건</p>
      </div>
      <div className="flex-1 p-5 flex flex-wrap gap-4 content-start overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="w-full flex items-center justify-center text-gray-600 text-2xl py-12">—</div>
        ) : (
          filtered.map(o => <NumberChip key={o.id} id={o.id} pulse={isReady} />)
        )}
      </div>
    </div>
  );
}

export default function DisplayPage() {
  const orders = useOrders();

  return (
    <div className="h-screen bg-gray-950 text-white flex overflow-hidden">
      {/* 카페 */}
      <div className="flex-1 flex flex-col min-w-0 border-r-4 border-gray-700">
        <div className="bg-amber-600 py-5 text-center shrink-0">
          <h2 className="text-5xl font-black tracking-tight">☕ 음료</h2>
        </div>
        <div className="flex-1 flex min-h-0">
          <Column orders={orders} statusKey="cafeStatus" isReady={false} />
          <div className="w-px bg-gray-700" />
          <Column orders={orders} statusKey="cafeStatus" isReady={true} />
        </div>
      </div>

      <div className="w-2 bg-gray-700 shrink-0" />

      {/* 음식 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-green-700 py-5 text-center shrink-0">
          <h2 className="text-5xl font-black tracking-tight">🍱 음식</h2>
        </div>
        <div className="flex-1 flex min-h-0">
          <Column orders={orders} statusKey="foodStatus" isReady={false} />
          <div className="w-px bg-gray-700" />
          <Column orders={orders} statusKey="foodStatus" isReady={true} />
        </div>
      </div>
    </div>
  );
}
