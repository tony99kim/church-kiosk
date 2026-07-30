'use client';
import { useState, useEffect } from 'react';
import type { MenuItem } from '@/lib/store';

function won(n: number) { return n.toLocaleString('ko-KR') + '원'; }

interface CartEntry { qty: number; options: Record<string, string>; }

function defaultOptions(item: MenuItem): Record<string, string> {
  const opts: Record<string, string> = {};
  for (const g of item.optionGroups) {
    if (g.required && g.options.length > 0) opts[g.name] = g.options[0].name;
  }
  return opts;
}

export default function KioskPage() {
  const [menus, setMenus]   = useState<MenuItem[]>([]);
  const [cart, setCart]     = useState<Record<number, CartEntry>>({});
  const [modal, setModal]   = useState<MenuItem | null>(null);
  const [tempQty, setTempQty]       = useState(1);
  const [tempOpts, setTempOpts]     = useState<Record<string, string>>({});
  const [orderNum, setOrderNum]     = useState<number | null>(null);
  const [totalPaid, setTotalPaid]   = useState(0);
  const [loading, setLoading]       = useState(false);

  useEffect(() => { fetch('/api/menu').then(r => r.json()).then(setMenus); }, []);

  const cafeMenu = menus.filter(m => m.type === 'cafe');
  const foodMenu = menus.filter(m => m.type === 'food');

  const totalQty = Object.values(cart).reduce((s, e) => s + e.qty, 0);
  const totalAmount = menus.reduce((sum, item) => {
    const e = cart[item.id];
    return sum + (e ? item.price * e.qty : 0);
  }, 0);

  const openModal = (item: MenuItem) => {
    const existing = cart[item.id];
    setModal(item);
    setTempQty(existing?.qty ?? 1);
    setTempOpts(existing?.options ?? defaultOptions(item));
  };

  const addToCart = () => {
    if (!modal) return;
    for (const g of modal.optionGroups) {
      if (g.required && !tempOpts[g.name]) {
        alert(`"${g.name}"을(를) 선택해주세요.`);
        return;
      }
    }
    if (tempQty === 0) {
      const { [modal.id]: _, ...rest } = cart;
      setCart(rest);
    } else {
      setCart(p => ({ ...p, [modal.id]: { qty: tempQty, options: tempOpts } }));
    }
    setModal(null);
  };

  const handleOrder = async () => {
    if (totalQty === 0 || loading) return;
    setLoading(true);
    const cafeItems: Record<string, number> = {};
    const foodItems: Record<string, number> = {};
    const itemOptions: Record<string, Record<string, string>> = {};
    for (const [idStr, { qty, options }] of Object.entries(cart)) {
      const item = menus.find(m => m.id === Number(idStr));
      if (!item || qty <= 0) continue;
      if (item.type === 'cafe') cafeItems[item.name] = qty;
      else foodItems[item.name] = qty;
      if (Object.keys(options).length > 0) itemOptions[item.name] = options;
    }
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cafeItems, foodItems, itemOptions }),
    });
    const data = await res.json();
    setTotalPaid(totalAmount);
    setOrderNum(data.id);
    setLoading(false);
  };

  const resetAll = () => { setOrderNum(null); setCart({}); setTotalPaid(0); };

  // ── 주문 완료 화면 ──
  if (orderNum !== null) {
    return (
      <div className="h-screen bg-blue-600 flex flex-col items-center justify-center cursor-pointer select-none" onClick={resetAll}>
        <p className="text-white text-2xl mb-6 font-medium">주문이 완료되었습니다</p>
        <div className="bg-white rounded-3xl w-60 h-60 flex items-center justify-center shadow-2xl">
          <span className="text-9xl font-black text-blue-600">{orderNum}</span>
        </div>
        <p className="text-white text-3xl mt-6 font-bold">번 입니다</p>
        {totalPaid > 0 && (
          <div className="mt-5 bg-blue-700 rounded-2xl px-8 py-4 text-center">
            <p className="text-blue-200 text-base">결제 금액</p>
            <p className="text-white text-4xl font-black">{won(totalPaid)}</p>
          </div>
        )}
        <p className="text-blue-300 text-lg mt-8">화면을 터치하면 처음으로 돌아갑니다</p>
      </div>
    );
  }

  // ── 메뉴 카드 ──
  const MenuCard = ({ item }: { item: MenuItem }) => {
    const entry = cart[item.id];
    const inCart = entry && entry.qty > 0;
    return (
      <button onClick={() => openModal(item)}
        className={`relative text-left rounded-2xl p-4 border-2 transition-all active:scale-95 ${
          inCart ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
        }`}>
        {inCart && (
          <span className="absolute top-2 right-2 w-6 h-6 bg-blue-600 text-white text-xs font-black rounded-full flex items-center justify-center">
            {entry.qty}
          </span>
        )}
        <p className={`text-base font-semibold leading-snug pr-6 ${inCart ? 'text-blue-700' : 'text-slate-800'}`}>{item.name}</p>
        {item.optionGroups.length > 0 && (
          <p className="text-xs text-blue-400 mt-0.5">옵션 선택</p>
        )}
        <p className={`text-sm font-bold mt-1 ${inCart ? 'text-blue-600' : 'text-slate-500'}`}>{won(item.price)}</p>
      </button>
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between">
        <h1 className="text-2xl font-black text-blue-600">주문하기</h1>
        {totalQty > 0 && (
          <span className="text-sm text-slate-500">{totalQty}개 선택 · <span className="font-bold text-blue-600">{won(totalAmount)}</span></span>
        )}
      </header>

      {/* 메뉴 영역 */}
      <div className="flex flex-1 min-h-0">
        {/* 카페 */}
        <div className="flex-1 flex flex-col border-r border-slate-200">
          <div className="bg-amber-500 text-white text-center py-2 text-base font-bold shrink-0">☕ 음료</div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {cafeMenu.map(item => <MenuCard key={item.id} item={item} />)}
              {cafeMenu.length === 0 && <p className="col-span-2 text-center text-slate-400 py-8">메뉴 없음</p>}
            </div>
          </div>
        </div>

        {/* 음식 */}
        <div className="flex-1 flex flex-col">
          <div className="bg-green-600 text-white text-center py-2 text-base font-bold shrink-0">🍱 음식</div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {foodMenu.map(item => <MenuCard key={item.id} item={item} />)}
              {foodMenu.length === 0 && <p className="col-span-2 text-center text-slate-400 py-8">메뉴 없음</p>}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 주문 바 */}
      <div className="shrink-0 p-4 bg-white border-t border-slate-200">
        <button onClick={handleOrder} disabled={totalQty === 0 || loading}
          className="w-full py-4 rounded-2xl text-xl font-bold text-white bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed active:bg-blue-700 transition-colors">
          {loading ? '주문 중...' : totalQty === 0 ? '메뉴를 선택해주세요' : `주문하기 — ${won(totalAmount)}`}
        </button>
      </div>

      {/* ── 메뉴 옵션 모달 ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl flex flex-col max-h-[85vh]">
            {/* 모달 헤더 */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{modal.name}</h3>
                <p className="text-base font-bold text-blue-600 mt-0.5">{won(modal.price)}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            {/* 옵션 그룹 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {modal.optionGroups.map(group => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-base font-bold text-slate-700">{group.name}</p>
                    {group.required
                      ? <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">필수</span>
                      : <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">선택</span>
                    }
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map(opt => {
                      const selected = tempOpts[group.name] === opt.name;
                      return (
                        <button key={opt.id} onClick={() => setTempOpts(p => ({ ...p, [group.name]: opt.name }))}
                          className={`py-3 px-4 rounded-xl text-sm font-medium border-2 text-left transition-colors ${
                            selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}>
                          <span className="block">{opt.name}</span>
                          {opt.price > 0 && <span className="text-xs text-blue-400">+{won(opt.price)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {modal.optionGroups.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-2">옵션 없음</p>
              )}
            </div>

            {/* 수량 + 담기 */}
            <div className="px-6 py-4 border-t border-slate-100 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <span className="text-base font-medium text-slate-600">수량</span>
                <div className="flex items-center gap-4">
                  <button onClick={() => setTempQty(q => Math.max(0, q - 1))}
                    className="w-10 h-10 rounded-full bg-slate-100 text-2xl font-bold flex items-center justify-center active:bg-slate-200">−</button>
                  <span className="text-2xl font-black w-8 text-center">{tempQty}</span>
                  <button onClick={() => setTempQty(q => q + 1)}
                    className="w-10 h-10 rounded-full bg-blue-600 text-white text-2xl font-bold flex items-center justify-center active:bg-blue-700">+</button>
                </div>
              </div>
              <button onClick={addToCart}
                className="w-full py-4 rounded-2xl text-lg font-bold text-white bg-blue-600 active:bg-blue-700">
                {tempQty === 0 ? '삭제' : `담기 — ${won(modal.price * tempQty)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
