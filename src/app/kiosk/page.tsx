'use client';
import { useState, useEffect } from 'react';
import type { MenuItem } from '@/lib/store';

const SET_MENU = '세트메뉴(주먹밥2+컵라면1)';
const RICEBALL_OPTS = ['멸치주먹밥', '참치마요주먹밥'];
const RAMEN_OPTS = ['짜장컵라면', '육개장컵라면'];

function won(n: number) { return n.toLocaleString('ko-KR') + '원'; }

export default function KioskPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [cafe, setCafe] = useState<Record<string, number>>({});
  const [food, setFood] = useState<Record<string, number>>({});
  const [itemOptions, setItemOptions] = useState<Record<string, string[]>>({});
  const [orderNum, setOrderNum] = useState<number | null>(null);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [setOpts, setSetOpts] = useState({ rb1: RICEBALL_OPTS[0], rb2: RICEBALL_OPTS[1], ramen: RAMEN_OPTS[0] });

  useEffect(() => { fetch('/api/menu').then(r => r.json()).then(setMenus); }, []);

  const cafeMenu = menus.filter(m => m.type === 'cafe');
  const foodMenu = menus.filter(m => m.type === 'food');

  const total = [...Object.values(cafe), ...Object.values(food)].reduce((s, n) => s + n, 0);

  const calcTotal = () => menus.reduce((sum, item) => {
    const qty = (item.type === 'cafe' ? cafe : food)[item.name] ?? 0;
    return sum + item.price * qty;
  }, 0);

  const adjustCafe = (name: string, delta: number) =>
    setCafe(p => ({ ...p, [name]: Math.max(0, (p[name] ?? 0) + delta) }));

  const adjustFood = (name: string, delta: number) => {
    if (name === SET_MENU && delta > 0 && (food[name] ?? 0) === 0) {
      setModal(true);
      return;
    }
    if (name === SET_MENU && delta < 0 && (food[name] ?? 0) <= 1) {
      setItemOptions(p => { const n = { ...p }; delete n[SET_MENU]; return n; });
    }
    setFood(p => ({ ...p, [name]: Math.max(0, (p[name] ?? 0) + delta) }));
  };

  const confirmSetMenu = () => {
    setFood(p => ({ ...p, [SET_MENU]: (p[SET_MENU] ?? 0) + 1 }));
    setItemOptions(p => ({ ...p, [SET_MENU]: [setOpts.rb1, setOpts.rb2, setOpts.ramen] }));
    setModal(false);
  };

  const handleOrder = async () => {
    if (total === 0 || loading) return;
    setLoading(true);
    const amount = calcTotal();
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cafeItems: cafe, foodItems: food, itemOptions }),
    });
    const data = await res.json();
    setTotalPaid(amount);
    setOrderNum(data.id);
    setLoading(false);
  };

  const resetOrder = () => {
    setOrderNum(null); setCafe({}); setFood({}); setItemOptions({}); setTotalPaid(0);
  };

  if (orderNum !== null) {
    return (
      <div className="h-screen bg-blue-600 flex flex-col items-center justify-center cursor-pointer select-none" onClick={resetOrder}>
        <p className="text-white text-3xl mb-6 font-medium">주문이 완료되었습니다</p>
        <div className="bg-white rounded-3xl w-64 h-64 flex items-center justify-center shadow-2xl">
          <span className="text-9xl font-black text-blue-600">{orderNum}</span>
        </div>
        <p className="text-white text-3xl mt-6 font-bold">번 입니다</p>
        {totalPaid > 0 && (
          <div className="mt-6 bg-blue-700 rounded-2xl px-8 py-4 text-center">
            <p className="text-blue-200 text-lg">결제 금액</p>
            <p className="text-white text-4xl font-black">{won(totalPaid)}</p>
          </div>
        )}
        <p className="text-blue-200 text-xl mt-8">화면을 터치하면 처음으로 돌아갑니다</p>
      </div>
    );
  }

  const MenuSection = ({
    title, items, state: st, onAdjust, color,
  }: {
    title: string;
    items: MenuItem[];
    state: Record<string, number>;
    onAdjust: (name: string, delta: number) => void;
    color: 'amber' | 'green';
  }) => (
    <div className={`flex-1 flex flex-col border-r border-gray-200 last:border-r-0`}>
      <div className={`py-3 text-center font-bold text-xl text-white ${color === 'amber' ? 'bg-amber-500' : 'bg-green-600'}`}>
        {title}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
        {items.map(item => {
          const qty = st[item.name] ?? 0;
          const isSet = item.name === SET_MENU;
          const opts = isSet && itemOptions[SET_MENU];
          return (
            <div key={item.id} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-medium leading-tight">{item.name}</p>
                  {opts && (
                    <p className="text-xs text-blue-500 mt-0.5">{opts.join(' + ')}</p>
                  )}
                  <p className="text-sm text-gray-400 font-medium">{won(item.price)}</p>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <button onClick={() => onAdjust(item.name, -1)}
                    className="w-10 h-10 rounded-full bg-gray-100 text-2xl font-bold flex items-center justify-center active:bg-gray-200">−</button>
                  <span className="text-2xl font-bold w-6 text-center">{qty}</span>
                  <button onClick={() => onAdjust(item.name, 1)}
                    className={`w-10 h-10 rounded-full text-white text-2xl font-bold flex items-center justify-center ${color === 'amber' ? 'bg-amber-500 active:bg-amber-600' : 'bg-green-500 active:bg-green-600'}`}>+</button>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-center text-gray-400 py-8">메뉴 없음</p>}
      </div>
    </div>
  );

  const totalWon = calcTotal();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="bg-blue-600 text-white text-center py-4 shrink-0">
        <h1 className="text-3xl font-bold">주문하기</h1>
      </header>

      <div className="flex flex-1 min-h-0">
        <MenuSection title="☕ 음료" items={cafeMenu} state={cafe} onAdjust={adjustCafe} color="amber" />
        <MenuSection title="🍱 음식" items={foodMenu} state={food} onAdjust={adjustFood} color="green" />
      </div>

      <div className="shrink-0 p-4 bg-white border-t border-gray-200">
        {total > 0 && (
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-lg text-gray-500">{total}개 선택</span>
            <span className="text-2xl font-black text-blue-600">합계 {won(totalWon)}</span>
          </div>
        )}
        <button onClick={handleOrder} disabled={total === 0 || loading}
          className="w-full py-4 rounded-2xl text-2xl font-bold text-white bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed active:bg-blue-700 transition-colors">
          {loading ? '주문 중...' : total === 0 ? '메뉴를 선택해주세요' : `주문하기 — ${won(totalWon)}`}
        </button>
      </div>

      {/* 세트메뉴 옵션 모달 */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-2xl font-bold text-center mb-6">세트메뉴 옵션 선택</h2>

            <div className="mb-5">
              <p className="text-base font-bold text-gray-600 mb-2">주먹밥 ①</p>
              <div className="grid grid-cols-2 gap-2">
                {RICEBALL_OPTS.map(opt => (
                  <button key={opt} onClick={() => setSetOpts(p => ({ ...p, rb1: opt }))}
                    className={`py-3 rounded-xl text-base font-medium border-2 transition-colors ${setOpts.rb1 === opt ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-base font-bold text-gray-600 mb-2">주먹밥 ②</p>
              <div className="grid grid-cols-2 gap-2">
                {RICEBALL_OPTS.map(opt => (
                  <button key={opt} onClick={() => setSetOpts(p => ({ ...p, rb2: opt }))}
                    className={`py-3 rounded-xl text-base font-medium border-2 transition-colors ${setOpts.rb2 === opt ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-base font-bold text-gray-600 mb-2">컵라면</p>
              <div className="grid grid-cols-2 gap-2">
                {RAMEN_OPTS.map(opt => (
                  <button key={opt} onClick={() => setSetOpts(p => ({ ...p, ramen: opt }))}
                    className={`py-3 rounded-xl text-base font-medium border-2 transition-colors ${setOpts.ramen === opt ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setModal(false)}
                className="py-3 rounded-xl bg-gray-100 text-gray-700 text-lg font-bold active:bg-gray-200">
                취소
              </button>
              <button onClick={confirmSetMenu}
                className="py-3 rounded-xl bg-blue-600 text-white text-lg font-bold active:bg-blue-700">
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
