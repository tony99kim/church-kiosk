'use client';
import { useState, useEffect, useRef } from 'react';
import type { MenuItem } from '@/lib/store';
import { useOrders } from '@/lib/useOrders';

function won(n: number) { return n.toLocaleString('ko-KR') + '원'; }

// groupId(string) → { optionName: qty }
type GroupSel = Record<string, Record<string, number>>;

interface CartItem {
  key: string;    // 카트 내 고유 키
  itemId: number;
  qty: number;
  options: GroupSel;
}

function defaultOptions(item: MenuItem): GroupSel {
  const opts: GroupSel = {};
  for (const g of item.optionGroups) {
    opts[String(g.id)] = (g.maxQty === 1 && g.required && g.options.length > 0)
      ? { [g.options[0].name]: 1 }
      : {};
  }
  return opts;
}

function mergeWithDefaults(existing: GroupSel, item: MenuItem): GroupSel {
  const merged = { ...existing };
  for (const g of item.optionGroups) {
    if (!(String(g.id) in merged)) merged[String(g.id)] = {};
  }
  return merged;
}

type MenuCardProps = { item: MenuItem; totalQty: number; onOpen: () => void };
function MenuCard({ item, totalQty, onOpen }: MenuCardProps) {
  const soldOut = item.stock === 0;
  const inCart = totalQty > 0;
  return (
    <button type="button" onClick={soldOut ? undefined : onOpen} disabled={soldOut}
      className={`relative text-left rounded-2xl p-4 border-2 transition-all ${
        soldOut
          ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
          : inCart
            ? 'border-blue-400 bg-blue-50 shadow-md active:scale-95'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm active:scale-95'
      }`}>
      {soldOut && (
        <span className="absolute top-2 right-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">품절</span>
      )}
      {inCart && !soldOut && (
        <span className="absolute top-2 right-2 w-6 h-6 bg-blue-600 text-white text-xs font-black rounded-full flex items-center justify-center">
          {totalQty}
        </span>
      )}
      <p className={`text-base font-semibold leading-snug pr-8 ${soldOut ? 'text-slate-400 line-through' : inCart ? 'text-blue-700' : 'text-slate-800'}`}>{item.name}</p>
      {item.optionGroups.length > 0 && !soldOut && (
        <p className="text-xs text-blue-400 mt-0.5">옵션 선택</p>
      )}
      <p className={`text-sm font-bold mt-1 ${soldOut ? 'text-slate-300' : inCart ? 'text-blue-600' : 'text-slate-500'}`}>{won(item.price)}</p>
    </button>
  );
}

export default function KioskPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [cart, setCart]   = useState<CartItem[]>([]);
  const [modal, setModal] = useState<MenuItem | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempQty, setTempQty]   = useState(1);
  const [tempOpts, setTempOpts] = useState<GroupSel>({});
  const [orderNum, setOrderNum] = useState<number | null>(null);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading]   = useState(false);
  const cartKeyRef = useRef(0);
  const orders = useOrders();

  useEffect(() => {
    const load = () => fetch('/api/menu').then(r => r.ok ? r.json() : Promise.reject(r.status)).then(setMenus).catch(() => setTimeout(load, 3000));
    load();
  }, []);

  // 주문이 들어올 때마다 재고 갱신 (품절 반영)
  useEffect(() => {
    if (orders.length === 0) return;
    fetch('/api/menu').then(r => r.json()).then(setMenus).catch(() => {});
  }, [orders]);

  const cafeMenu = menus.filter(m => m.type === 'cafe');
  const foodMenu = menus.filter(m => m.type === 'food');

  const itemQty = (itemId: number) => cart.filter(e => e.itemId === itemId).reduce((s, e) => s + e.qty, 0);
  const totalQty    = cart.reduce((s, e) => s + e.qty, 0);
  const totalAmount = cart.reduce((s, e) => {
    const item = menus.find(m => m.id === e.itemId);
    return s + (item ? item.price * e.qty : 0);
  }, 0);

  const openModal = (item: MenuItem, cartKey?: string) => {
    if (cartKey) {
      // 기존 항목 편집 (옵션 없는 메뉴)
      const entry = cart.find(e => e.key === cartKey);
      setModal(item); setEditingKey(cartKey);
      setTempQty(entry?.qty ?? 1);
      setTempOpts(mergeWithDefaults(entry?.options ?? {}, item));
    } else if (item.optionGroups.length === 0) {
      // 옵션 없는 메뉴: 기존 항목 편집 or 새 항목
      const existing = cart.find(e => e.itemId === item.id);
      setModal(item); setEditingKey(existing?.key ?? null);
      setTempQty(existing?.qty ?? 1);
      setTempOpts({});
    } else {
      // 옵션 있는 메뉴: 항상 새 항목 추가
      setModal(item); setEditingKey(null);
      setTempQty(1);
      setTempOpts(defaultOptions(item));
    }
  };

  const addToCart = () => {
    if (!modal) return;
    for (const g of modal.optionGroups) {
      if (!g.required) continue;
      const sel = tempOpts[String(g.id)] ?? {};
      const total = Object.values(sel).reduce((s, q) => s + q, 0);
      if (total !== g.maxQty) {
        alert(`"${g.name || '옵션'}" ${g.maxQty}개를 선택해주세요. (현재 ${total}개)`);
        return;
      }
    }
    if (editingKey) {
      if (tempQty === 0) setCart(p => p.filter(e => e.key !== editingKey));
      else setCart(p => p.map(e => e.key === editingKey ? { ...e, qty: tempQty, options: tempOpts } : e));
    } else if (tempQty > 0) {
      const key = String(++cartKeyRef.current);
      setCart(p => [...p, { key, itemId: modal.id, qty: tempQty, options: tempOpts }]);
    }
    setModal(null); setEditingKey(null);
  };

  const removeCartItem = (key: string) => setCart(p => p.filter(e => e.key !== key));

  const handleOrder = async () => {
    if (totalQty === 0 || loading) return;
    setLoading(true);
    try {
      const cafeItems: Record<string, number> = {};
      const foodItems: Record<string, number> = {};
      const itemOptions: Record<string, Record<string, Record<string, number>>> = {};

      // 같은 메뉴가 여러 항목일 때 "(2)", "(3)" 접미사
      const nameCount: Record<string, number> = {};
      for (const entry of cart) {
        const item = menus.find(m => m.id === entry.itemId);
        if (!item || entry.qty <= 0) continue;
        const base = item.name;
        nameCount[base] = (nameCount[base] ?? 0) + 1;
        const name = nameCount[base] > 1 ? `${base} (${nameCount[base]})` : base;
        if (item.type === 'cafe') cafeItems[name] = entry.qty;
        else foodItems[name] = entry.qty;
        const namedOpts: Record<string, Record<string, number>> = {};
        for (const g of item.optionGroups) {
          const sel = entry.options[String(g.id)] ?? {};
          if (Object.values(sel).some(q => q > 0)) namedOpts[g.name || String(g.id)] = sel;
        }
        if (Object.keys(namedOpts).length > 0) itemOptions[name] = namedOpts;
      }

      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cafeItems, foodItems, itemOptions }),
      });
      if (res.status === 409) {
        const data = await res.json();
        const freshMenus = await fetch('/api/menu').then(r => r.json()).catch(() => null);
        if (freshMenus) setMenus(freshMenus);
        setCart(p => p.filter(e => {
          const item = menus.find(m => m.id === e.itemId);
          return item?.name !== data.name;
        }));
        alert(`"${data.name}"이(가) 방금 품절되었습니다. 장바구니에서 제거했습니다.`);
        return;
      }
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      const data = await res.json();
      setTotalPaid(totalAmount);
      setOrderNum(data.id);
    } catch (e) {
      alert(`주문 실패: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => { setOrderNum(null); setCart([]); setTotalPaid(0); };

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

  // ── 옵션 그룹 렌더 ──
  const renderGroup = (group: MenuItem['optionGroups'][0]) => {
    const gk = String(group.id);
    const sel = tempOpts[gk] ?? {};
    const totalSel = Object.values(sel).reduce((s, q) => s + q, 0);

    if (group.maxQty === 1) {
      const selected = Object.keys(sel).find(k => sel[k] > 0);
      return (
        <div className="grid grid-cols-2 gap-2">
          {group.options.map(opt => (
            <button key={opt.id} type="button"
              onClick={(e) => { e.preventDefault(); setTempOpts(p => ({ ...p, [gk]: { [opt.name]: 1 } })); }}
              className={`py-3 px-4 rounded-xl text-sm font-medium border-2 text-left transition-colors ${
                selected === opt.name ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}>
              <span className="block">{opt.name}</span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 mb-1">
          <span>총 {group.maxQty}개 선택</span>
          <span className={totalSel === group.maxQty ? 'text-blue-600 font-bold' : 'text-amber-500 font-bold'}>
            {totalSel}/{group.maxQty}개 선택됨
          </span>
        </div>
        {group.options.map(opt => {
          const optQty = sel[opt.name] ?? 0;
          return (
            <div key={opt.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${optQty > 0 ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}>
              <span className={`flex-1 text-sm font-medium ${optQty > 0 ? 'text-blue-700' : 'text-slate-600'}`}>{opt.name}</span>
              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={(e) => { e.preventDefault(); setTempOpts(p => { const g = { ...p[gk] }; g[opt.name] = Math.max(0, (g[opt.name] ?? 0) - 1); return { ...p, [gk]: g }; }); }}
                  disabled={optQty === 0}
                  className="w-8 h-8 rounded-full bg-slate-200 text-xl font-bold flex items-center justify-center disabled:opacity-30">−</button>
                <span className="text-lg font-black w-5 text-center">{optQty}</span>
                <button type="button"
                  onClick={(e) => { e.preventDefault(); setTempOpts(p => { const g = { ...p[gk] }; const total = Object.values(g).reduce((s, q) => s + q, 0); if (total >= group.maxQty) return p; g[opt.name] = (g[opt.name] ?? 0) + 1; return { ...p, [gk]: g }; }); }}
                  disabled={totalSel >= group.maxQty}
                  className="w-8 h-8 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center disabled:opacity-30 active:bg-blue-700">+</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between">
        <h1 className="text-2xl font-black text-blue-600">주문하기</h1>
        {totalQty > 0 && (
          <span className="text-sm text-slate-500">{totalQty}개 · <span className="font-bold text-blue-600">{won(totalAmount)}</span></span>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col border-r border-slate-200">
          <div className="bg-amber-500 text-white text-center py-2 text-base font-bold shrink-0">☕ 음료</div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {cafeMenu.map(item => <MenuCard key={item.id} item={item} totalQty={itemQty(item.id)} onOpen={() => openModal(item)} />)}
              {cafeMenu.length === 0 && <p className="col-span-2 text-center text-slate-400 py-8">메뉴 없음</p>}
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="bg-green-600 text-white text-center py-2 text-base font-bold shrink-0">🍱 음식</div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {foodMenu.map(item => <MenuCard key={item.id} item={item} totalQty={itemQty(item.id)} onOpen={() => openModal(item)} />)}
              {foodMenu.length === 0 && <p className="col-span-2 text-center text-slate-400 py-8">메뉴 없음</p>}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 주문 바 */}
      <div className="shrink-0 bg-white border-t border-slate-200">
        {/* 카트 목록 */}
        {cart.length > 0 && (
          <div className="max-h-32 overflow-y-auto px-4 pt-3 space-y-1">
            {cart.map(entry => {
              const item = menus.find(m => m.id === entry.itemId);
              if (!item) return null;
              const optParts = item.optionGroups.map(g => {
                const sel = entry.options[String(g.id)] ?? {};
                return Object.entries(sel).filter(([, q]) => q > 0).map(([n, q]) => q > 1 ? `${n}×${q}` : n).join('+');
              }).filter(Boolean);
              const hasOpts = item.optionGroups.length > 0;
              return (
                <div key={entry.key} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-1.5">
                  <span className="flex-1 text-sm text-slate-700 truncate">
                    {item.name} ×{entry.qty}{optParts.length > 0 ? ` (${optParts.join(' / ')})` : ''}
                  </span>
                  <span className="text-sm font-bold text-blue-600 shrink-0">{won(item.price * entry.qty)}</span>
                  {hasOpts && (
                    <button type="button" onClick={() => openModal(item, entry.key)}
                      className="text-slate-400 hover:text-blue-500 text-xs px-1.5 py-0.5 border border-slate-200 rounded shrink-0">수정</button>
                  )}
                  <button type="button" onClick={() => removeCartItem(entry.key)}
                    className="text-slate-300 hover:text-red-400 text-xl font-bold shrink-0 leading-none">×</button>
                </div>
              );
            })}
          </div>
        )}
        <div className="p-4">
          <button onClick={handleOrder} disabled={totalQty === 0 || loading}
            className="w-full py-4 rounded-2xl text-xl font-bold text-white bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed active:bg-blue-700 transition-colors">
            {loading ? '주문 중...' : totalQty === 0 ? '메뉴를 선택해주세요' : `주문하기 — ${won(totalAmount)}`}
          </button>
        </div>
      </div>

      {/* 옵션 모달 */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{modal.name}</h3>
                <p className="text-base font-bold text-blue-600 mt-0.5">{won(modal.price)}</p>
              </div>
              <button type="button" onClick={() => { setModal(null); setEditingKey(null); }} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {modal.optionGroups.map(group => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-base font-bold text-slate-700">{group.name}</p>
                    {group.required
                      ? <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">필수</span>
                      : <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">선택</span>}
                  </div>
                  {renderGroup(group)}
                </div>
              ))}
              {modal.optionGroups.length === 0 && <p className="text-slate-400 text-sm text-center py-2">옵션 없음</p>}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <span className="text-base font-medium text-slate-600">수량</span>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setTempQty(q => Math.max(0, q - 1))}
                    className="w-10 h-10 rounded-full bg-slate-100 text-2xl font-bold flex items-center justify-center active:bg-slate-200">−</button>
                  <span className="text-2xl font-black w-8 text-center">{tempQty}</span>
                  <button type="button" onClick={() => setTempQty(q => q + 1)}
                    className="w-10 h-10 rounded-full bg-blue-600 text-white text-2xl font-bold flex items-center justify-center active:bg-blue-700">+</button>
                </div>
              </div>
              <button type="button" onClick={addToCart}
                className="w-full py-4 rounded-2xl text-lg font-bold text-white bg-blue-600 active:bg-blue-700">
                {tempQty === 0 ? '삭제' : editingKey ? `수정 완료 — ${won(modal.price * tempQty)}` : `담기 — ${won(modal.price * tempQty)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
