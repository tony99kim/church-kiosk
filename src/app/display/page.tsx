'use client';
import { useOrders } from '@/lib/useOrders';
import type { Order } from '@/lib/store';

function NumberChip({ id, pulse }: { id: number; pulse?: boolean }) {
  return (
    <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black select-none ${
      pulse ? 'bg-green-400 text-white animate-pulse shadow-lg shadow-green-500/50' : 'bg-amber-400 text-amber-900'
    }`}>
      {id}
    </div>
  );
}

function Column({
  label, orders, statusKey, isReady, accent,
}: {
  label: string;
  orders: Order[];
  statusKey: 'cafeStatus' | 'foodStatus';
  isReady: boolean;
  accent: string;
}) {
  const filtered = orders.filter(o => o[statusKey] === (isReady ? 'ready' : 'preparing'));

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className={`py-3 text-center ${accent} border-b border-gray-700`}>
        <p className={`text-lg font-bold ${isReady ? 'text-green-400' : 'text-amber-400'}`}>
          {isReady ? '✅ 가져가세요' : '⏳ 준비중'}
        </p>
        <p className="text-gray-400 text-sm">{filtered.length}건</p>
      </div>
      <div className="flex-1 p-4 flex flex-wrap gap-3 content-start overflow-hidden">
        {filtered.length === 0 ? (
          <div className="w-full flex items-center justify-center text-gray-700 text-xl py-8">
            없음
          </div>
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
    <div className="h-screen bg-gray-900 text-white flex overflow-hidden">
      {/* 카페 반쪽 */}
      <div className="flex-1 flex flex-col min-w-0 border-r-4 border-gray-600">
        <div className="bg-amber-600 py-4 text-center shrink-0">
          <h2 className="text-4xl font-bold">☕ 카페</h2>
        </div>
        <div className="flex-1 flex min-h-0">
          <Column label="준비중" orders={orders} statusKey="cafeStatus" isReady={false} accent="bg-gray-800" />
          <div className="w-px bg-gray-700" />
          <Column label="가져가세요" orders={orders} statusKey="cafeStatus" isReady={true} accent="bg-gray-800" />
        </div>
      </div>

      {/* 구분선 */}
      <div className="w-2 bg-gray-600 shrink-0" />

      {/* 음식 반쪽 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-green-700 py-4 text-center shrink-0">
          <h2 className="text-4xl font-bold">🍱 음식점</h2>
        </div>
        <div className="flex-1 flex min-h-0">
          <Column label="준비중" orders={orders} statusKey="foodStatus" isReady={false} accent="bg-gray-800" />
          <div className="w-px bg-gray-700" />
          <Column label="가져가세요" orders={orders} statusKey="foodStatus" isReady={true} accent="bg-gray-800" />
        </div>
      </div>
    </div>
  );
}
