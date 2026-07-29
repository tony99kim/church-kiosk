'use client';
import { useState } from 'react';
import { CAFE_MENU, FOOD_MENU } from '@/lib/menu';

export default function KioskPage() {
  const [cafe, setCafe] = useState<Record<string, number>>({});
  const [food, setFood] = useState<Record<string, number>>({});
  const [orderNum, setOrderNum] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const adjust = (
    setter: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    name: string,
    delta: number
  ) => setter((prev) => ({ ...prev, [name]: Math.max(0, (prev[name] ?? 0) + delta) }));

  const total = [...Object.values(cafe), ...Object.values(food)].reduce((s, n) => s + n, 0);

  const handleOrder = async () => {
    if (total === 0 || loading) return;
    setLoading(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cafeItems: cafe, foodItems: food }),
    });
    const data = await res.json();
    setOrderNum(data.id);
    setLoading(false);
  };

  const reset = () => {
    setOrderNum(null);
    setCafe({});
    setFood({});
  };

  if (orderNum !== null) {
    return (
      <div
        className="min-h-screen bg-blue-600 flex flex-col items-center justify-center cursor-pointer select-none"
        onClick={reset}
      >
        <p className="text-white text-3xl mb-8 font-medium">주문이 완료되었습니다</p>
        <div className="bg-white rounded-3xl w-72 h-72 flex items-center justify-center shadow-2xl">
          <span className="text-9xl font-black text-blue-600">{orderNum}</span>
        </div>
        <p className="text-white text-3xl mt-8 font-bold">번 입니다</p>
        <p className="text-blue-200 text-xl mt-12">화면을 터치하면 처음으로 돌아갑니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white text-center py-6">
        <h1 className="text-4xl font-bold">주문하기</h1>
      </header>

      <div className="flex flex-1">
        {/* 카페 */}
        <div className="flex-1 p-6 border-r border-gray-200">
          <h2 className="text-2xl font-bold text-center mb-6 text-amber-700">☕ 카페</h2>
          <div className="space-y-3">
            {CAFE_MENU.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100"
              >
                <span className="text-xl font-medium">{name}</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => adjust(setCafe, name, -1)}
                    className="w-11 h-11 rounded-full bg-gray-100 text-2xl font-bold flex items-center justify-center active:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="text-2xl font-bold w-7 text-center">{cafe[name] ?? 0}</span>
                  <button
                    onClick={() => adjust(setCafe, name, 1)}
                    className="w-11 h-11 rounded-full bg-amber-500 text-white text-2xl font-bold flex items-center justify-center active:bg-amber-600"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 음식 */}
        <div className="flex-1 p-6">
          <h2 className="text-2xl font-bold text-center mb-6 text-green-700">🍱 음식</h2>
          <div className="space-y-3">
            {FOOD_MENU.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100"
              >
                <span className="text-xl font-medium">{name}</span>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => adjust(setFood, name, -1)}
                    className="w-11 h-11 rounded-full bg-gray-100 text-2xl font-bold flex items-center justify-center active:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="text-2xl font-bold w-7 text-center">{food[name] ?? 0}</span>
                  <button
                    onClick={() => adjust(setFood, name, 1)}
                    className="w-11 h-11 rounded-full bg-green-500 text-white text-2xl font-bold flex items-center justify-center active:bg-green-600"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 bg-white border-t border-gray-200">
        <button
          onClick={handleOrder}
          disabled={total === 0 || loading}
          className="w-full py-5 rounded-2xl text-2xl font-bold text-white bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed active:bg-blue-700 transition-colors"
        >
          {loading ? '주문 중...' : `주문하기 (${total}개)`}
        </button>
      </div>
    </div>
  );
}
