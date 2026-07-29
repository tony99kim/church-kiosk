'use client';
import { useState, useEffect } from 'react';
import type { MenuItem } from '@/lib/store';

function won(amount: number) {
  return amount.toLocaleString('ko-KR') + '원';
}

export default function KioskPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [cafe, setCafe] = useState<Record<string, number>>({});
  const [food, setFood] = useState<Record<string, number>>({});
  const [orderNum, setOrderNum] = useState<number | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/menu').then((r) => r.json()).then(setMenus);
  }, []);

  const cafeMenu = menus.filter((m) => m.type === 'cafe');
  const foodMenu = menus.filter((m) => m.type === 'food');

  const adjust = (
    setter: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    name: string,
    delta: number
  ) => setter((prev) => ({ ...prev, [name]: Math.max(0, (prev[name] ?? 0) + delta) }));

  const total = [...Object.values(cafe), ...Object.values(food)].reduce((s, n) => s + n, 0);

  const calcTotal = () => {
    let sum = 0;
    for (const item of menus) {
      const qty = (item.type === 'cafe' ? cafe : food)[item.name] ?? 0;
      sum += item.price * qty;
    }
    return sum;
  };

  const handleOrder = async () => {
    if (total === 0 || loading) return;
    setLoading(true);
    const amount = calcTotal();
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cafeItems: cafe, foodItems: food }),
    });
    const data = await res.json();
    setTotalAmount(amount);
    setOrderNum(data.id);
    setLoading(false);
  };

  const reset = () => {
    setOrderNum(null);
    setCafe({});
    setFood({});
    setTotalAmount(0);
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
        {totalAmount > 0 && (
          <div className="mt-6 bg-blue-700 rounded-2xl px-8 py-4">
            <p className="text-blue-200 text-lg text-center">결제 금액</p>
            <p className="text-white text-4xl font-black text-center">{won(totalAmount)}</p>
          </div>
        )}
        <p className="text-blue-200 text-xl mt-8">화면을 터치하면 처음으로 돌아갑니다</p>
      </div>
    );
  }

  const MenuSection = ({
    title, items, state: itemState, setter,
  }: {
    title: string;
    items: MenuItem[];
    state: Record<string, number>;
    setter: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  }) => (
    <div className="flex-1 p-6 border-r border-gray-200 last:border-r-0">
      <h2 className={`text-2xl font-bold text-center mb-6 ${items[0]?.type === 'cafe' ? 'text-amber-700' : 'text-green-700'}`}>
        {title}
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100">
            <div>
              <p className="text-xl font-medium">{item.name}</p>
              <p className="text-base text-gray-400 font-medium">{won(item.price)}</p>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => adjust(setter, item.name, -1)}
                className="w-11 h-11 rounded-full bg-gray-100 text-2xl font-bold flex items-center justify-center active:bg-gray-200">−</button>
              <span className="text-2xl font-bold w-7 text-center">{itemState[item.name] ?? 0}</span>
              <button onClick={() => adjust(setter, item.name, 1)}
                className={`w-11 h-11 rounded-full text-white text-2xl font-bold flex items-center justify-center ${item.type === 'cafe' ? 'bg-amber-500 active:bg-amber-600' : 'bg-green-500 active:bg-green-600'}`}>+</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-gray-400 py-8">메뉴 없음</p>}
      </div>
    </div>
  );

  const totalWon = calcTotal();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white text-center py-6">
        <h1 className="text-4xl font-bold">주문하기</h1>
      </header>
      <div className="flex flex-1">
        <MenuSection title="☕ 음료" items={cafeMenu} state={cafe} setter={setCafe} />
        <MenuSection title="🍱 음식" items={foodMenu} state={food} setter={setFood} />
      </div>
      <div className="p-6 bg-white border-t border-gray-200">
        {total > 0 && (
          <div className="flex justify-between items-center mb-3 px-2">
            <span className="text-xl text-gray-500">{total}개 선택</span>
            <span className="text-2xl font-black text-blue-600">합계 {won(totalWon)}</span>
          </div>
        )}
        <button onClick={handleOrder} disabled={total === 0 || loading}
          className="w-full py-5 rounded-2xl text-2xl font-bold text-white bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed active:bg-blue-700 transition-colors">
          {loading ? '주문 중...' : total === 0 ? '메뉴를 선택해주세요' : `주문하기 — ${won(totalWon)}`}
        </button>
      </div>
    </div>
  );
}
