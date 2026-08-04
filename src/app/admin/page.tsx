'use client';
import { useState, useEffect, useCallback } from 'react';
import { useOrders } from '@/lib/useOrders';
import type { MenuItem, Order } from '@/lib/store';

interface Stats { totalOrders: number; totalRevenue: number; cafeItems: Record<string, number>; foodItems: Record<string, number>; optionItems: Record<string, number>; }

type EditGroup = { id?: number; name: string; required: boolean; maxQty: number; options: { id?: number; name: string; price: number; linkedMenuItemId?: number | null }[] };

function formatOpts(opts: unknown): string {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return '';
  const parts: string[] = [];
  for (const [, v] of Object.entries(opts as Record<string, unknown>)) {
    if (typeof v === 'string') { parts.push(v); continue; }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const s = Object.entries(v as Record<string, number>).filter(([, q]) => q > 0).map(([n, q]) => q > 1 ? `${n}×${q}` : n).join('+');
      if (s) parts.push(s);
    }
  }
  return parts.join(' / ');
}

export default function AdminPage() {
  const [tab, setTab] = useState<'menu' | 'orders' | 'stats'>('menu');
  const [menus, setMenus]   = useState<MenuItem[]>([]);
  const [stats, setStats]   = useState<Stats | null>(null);
  const [newName, setNewName]   = useState('');
  const [newType, setNewType]   = useState<'cafe' | 'food'>('cafe');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('');
  const [editingStockId, setEditingStockId] = useState<number | null>(null);
  const [editingStockVal, setEditingStockVal] = useState('');
  const [editingField, setEditingField] = useState<{ id: number; field: 'name' | 'price'; val: string } | null>(null);

  const saveField = async () => {
    if (!editingField) return;
    const body = editingField.field === 'name'
      ? { name: editingField.val.trim() }
      : { price: Number(editingField.val) || 0 };
    await fetch(`/api/menu/${editingField.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setEditingField(null);
    loadMenus();
  };

  const allOrders = useOrders();
  const activeOrders = allOrders.filter(o =>
    o.cafeStatus === 'preparing' || o.cafeStatus === 'ready' ||
    o.foodStatus === 'preparing' || o.foodStatus === 'ready'
  );

  const [optItem, setOptItem]     = useState<MenuItem | null>(null);
  const [editGroups, setEditGroups] = useState<EditGroup[]>([]);

  type EditOrderState = {
    orderId: number;
    cafeItems: Record<string, number>;
    foodItems: Record<string, number>;
    itemOptions: Record<string, Record<string, Record<string, number>>>;
  };
  const [editOrderState, setEditOrderState] = useState<EditOrderState | null>(null);

  const findMenuByOrderName = (name: string) => {
    const base = name.replace(/ \(\d+\)$/, '');
    return menus.find(m => m.name === base);
  };

  const openOrderEdit = (order: Order) => {
    const fullOpts: EditOrderState['itemOptions'] = {};
    for (const [itemName, groupMap] of Object.entries(order.itemOptions ?? {})) {
      const menuItem = findMenuByOrderName(itemName);
      if (!menuItem) { fullOpts[itemName] = groupMap; continue; }
      const fullGroup: Record<string, Record<string, number>> = {};
      for (const group of menuItem.optionGroups) {
        const cur = groupMap[group.name] ?? {};
        fullGroup[group.name] = Object.fromEntries(group.options.map(o => [o.name, cur[o.name] ?? 0]));
      }
      fullOpts[itemName] = fullGroup;
    }
    setEditOrderState({ orderId: order.id, cafeItems: { ...order.cafeItems }, foodItems: { ...order.foodItems }, itemOptions: fullOpts });
  };

  const saveOrderEdit = async () => {
    if (!editOrderState) return;
    for (const [itemName, groupMap] of Object.entries(editOrderState.itemOptions)) {
      const menuItem = findMenuByOrderName(itemName);
      if (!menuItem) continue;
      for (const group of menuItem.optionGroups) {
        if (!group.required) continue;
        const total = Object.values(groupMap[group.name] ?? {}).reduce((s, q) => s + q, 0);
        if (total !== group.maxQty) {
          alert(`"${itemName}"의 "${group.name}" 옵션을 ${group.maxQty}개 선택해주세요. (현재 ${total}개)`);
          return;
        }
      }
    }
    const cleanOpts: EditOrderState['itemOptions'] = {};
    for (const [itemName, groupMap] of Object.entries(editOrderState.itemOptions)) {
      const cleaned: Record<string, Record<string, number>> = {};
      for (const [groupName, opts] of Object.entries(groupMap)) {
        const filtered = Object.fromEntries(Object.entries(opts).filter(([, q]) => q > 0));
        if (Object.keys(filtered).length > 0) cleaned[groupName] = filtered;
      }
      if (Object.keys(cleaned).length > 0) cleanOpts[itemName] = cleaned;
    }
    try {
      const res = await fetch(`/api/admin/orders/${editOrderState.orderId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cafeItems: editOrderState.cafeItems, foodItems: editOrderState.foodItems, itemOptions: cleanOpts }),
      });
      if (!res.ok) { alert(`저장 실패 (${res.status})`); return; }
      setEditOrderState(null);
    } catch (e) {
      alert(`저장 오류: ${String(e)}`);
    }
  };

  const loadMenus = useCallback(() => fetch('/api/menu').then(r => r.json()).then(setMenus), []);
  const loadStats = useCallback(() => fetch('/api/stats').then(r => r.json()).then(setStats), []);

  useEffect(() => { loadMenus(); }, [loadMenus]);
  useEffect(() => { if (tab === 'stats') loadStats(); }, [tab, loadStats]);

  const addMenu = async () => {
    if (!newName.trim()) return;
    const stockVal = newStock.trim() === '' ? null : Number(newStock);
    await fetch('/api/menu', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), type: newType, price: Number(newPrice) || 0, stock: stockVal }),
    });
    setNewName(''); setNewPrice(''); setNewStock(''); loadMenus();
  };

  const saveStock = async (id: number) => {
    const val = editingStockVal.trim();
    const stock = val === '' || val === '무제한' ? null : Number(val);
    await fetch(`/api/menu/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock }),
    });
    setEditingStockId(null);
    loadMenus();
  };

  const deleteMenu = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    loadMenus();
  };

  const moveMenu = async (id: number, direction: 'up' | 'down') => {
    await fetch(`/api/menu/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move: direction }),
    });
    loadMenus();
  };

  const cancelOrder = async (id: number) => {
    if (!confirm(`${id}번 주문을 취소하시겠습니까?`)) return;
    await fetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
  };

  const openOptions = (item: MenuItem) => {
    setOptItem(item);
    setEditGroups(item.optionGroups.map(g => ({
      id: g.id, name: g.name, required: g.required, maxQty: g.maxQty,
      options: g.options.map(o => ({ id: o.id, name: o.name, price: o.price, linkedMenuItemId: o.linkedMenuItemId ?? null })),
    })));
  };

  const saveOptions = async () => {
    if (!optItem) return;
    try {
      const res = await fetch(`/api/menu/${optItem.id}/options`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: editGroups }),
      });
      if (!res.ok) {
        const text = await res.text();
        alert(`저장 실패 (${res.status}): ${text}`);
        return;
      }
    } catch (e) {
      alert(`저장 오류: ${String(e)}`);
      return;
    }
    setOptItem(null); loadMenus();
  };

  const addGroup = () => setEditGroups(p => [...p, { name: '', required: true, maxQty: 1, options: [] }]);
  const removeGroup = (gi: number) => setEditGroups(p => p.filter((_, i) => i !== gi));
  const updateGroup = (gi: number, key: keyof EditGroup, val: unknown) =>
    setEditGroups(p => p.map((g, i) => i === gi ? { ...g, [key]: val } : g));

  const addOption = (gi: number) =>
    setEditGroups(p => p.map((g, i) => i === gi ? { ...g, options: [...g.options, { name: '', price: 0 }] } : g));
  const removeOption = (gi: number, oi: number) =>
    setEditGroups(p => p.map((g, i) => i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g));
  const updateOption = (gi: number, oi: number, key: 'name' | 'price' | 'linkedMenuItemId', val: string | number | null) =>
    setEditGroups(p => p.map((g, i) => i === gi
      ? { ...g, options: g.options.map((o, j) => j === oi ? { ...o, [key]: val } : o) }
      : g));

  const resetOrders = async () => {
    if (!confirm('모든 주문을 초기화하시겠습니까?\n(통계 데이터도 함께 삭제됩니다)')) return;
    await fetch('/api/admin/reset', { method: 'POST' });
    alert('초기화 완료'); loadStats();
  };

  const cafeMenus = menus.filter(m => m.type === 'cafe');
  const foodMenus = menus.filter(m => m.type === 'food');

  const statusBadge = (status: string) => {
    if (status === 'preparing') return <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold">준비 중</span>;
    if (status === 'ready')     return <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-bold">준비완료</span>;
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white text-center py-5 shadow-lg">
        <h1 className="text-3xl font-bold tracking-tight">관리자</h1>
      </header>

      <div className="flex border-b border-slate-200 bg-white shadow-sm">
        {(['menu', 'orders', 'stats'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-4 text-base font-bold transition-colors relative ${tab === t ? 'border-b-4 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'menu' ? '🍽️ 메뉴 관리' : t === 'orders' ? '📋 주문 현황' : '📊 판매 통계'}
            {t === 'orders' && activeOrders.length > 0 && (
              <span className="absolute top-3 right-4 w-5 h-5 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center">{activeOrders.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── 메뉴 관리 ── */}
      {tab === 'menu' && (
        <div className="p-6 max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
            <h2 className="text-lg font-bold mb-4 text-slate-700">메뉴 추가</h2>
            <div className="flex gap-3 flex-wrap">
              <select value={newType} onChange={e => setNewType(e.target.value as 'cafe' | 'food')}
                className="border border-slate-200 rounded-xl px-4 py-3 text-base bg-white">
                <option value="cafe">☕ 카페</option>
                <option value="food">🍱 음식</option>
              </select>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMenu()}
                placeholder="메뉴 이름" className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-base min-w-32" />
              <input value={newPrice} onChange={e => setNewPrice(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMenu()}
                placeholder="가격 (원)" type="number" min="0" step="100"
                className="w-28 border border-slate-200 rounded-xl px-4 py-3 text-base" />
              <input value={newStock} onChange={e => setNewStock(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMenu()}
                placeholder="수량 (빈칸=무제한)" type="number" min="0"
                className="w-36 border border-slate-200 rounded-xl px-4 py-3 text-base" />
              <button onClick={addMenu}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl text-base font-bold hover:bg-blue-700 active:bg-blue-800">
                추가
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[{ label: '☕ 카페', items: cafeMenus }, { label: '🍱 음식', items: foodMenus }].map(({ label, items }) => (
              <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="text-base font-bold mb-3 text-slate-600">{label}</h3>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={item.id} className="py-2 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button onClick={() => moveMenu(item.id, 'up')} disabled={idx === 0}
                            className="text-slate-300 hover:text-slate-600 disabled:opacity-20 text-xs leading-none px-1">▲</button>
                          <button onClick={() => moveMenu(item.id, 'down')} disabled={idx === items.length - 1}
                            className="text-slate-300 hover:text-slate-600 disabled:opacity-20 text-xs leading-none px-1">▼</button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {editingField?.id === item.id && editingField.field === 'name' ? (
                              <input autoFocus value={editingField.val}
                                onChange={e => setEditingField(f => f && { ...f, val: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') saveField(); if (e.key === 'Escape') setEditingField(null); }}
                                onBlur={saveField}
                                className="border border-blue-300 rounded-lg px-2 py-0.5 text-base font-medium w-36" />
                            ) : (
                              <p className="text-base font-medium truncate cursor-pointer hover:text-blue-500"
                                onClick={() => setEditingField({ id: item.id, field: 'name', val: item.name })}>{item.name}</p>
                            )}
                            {item.optionGroups.length > 0 && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full shrink-0">옵션 {item.optionGroups.length}개</span>
                            )}
                            {item.stock === 0 && (
                              <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full shrink-0 font-bold">품절</span>
                            )}
                          </div>
                          {editingField?.id === item.id && editingField.field === 'price' ? (
                            <input autoFocus type="number" min="0" step="100" value={editingField.val}
                              onChange={e => setEditingField(f => f && { ...f, val: e.target.value })}
                              onKeyDown={e => { if (e.key === 'Enter') saveField(); if (e.key === 'Escape') setEditingField(null); }}
                              onBlur={saveField}
                              className="border border-blue-300 rounded-lg px-2 py-0.5 text-sm w-28 mt-0.5" />
                          ) : (
                            <p className="text-sm text-slate-400 cursor-pointer hover:text-blue-500"
                              onClick={() => setEditingField({ id: item.id, field: 'price', val: String(item.price) })}>
                              {item.price.toLocaleString('ko-KR')}원
                            </p>
                          )}
                        </div>
                        <button onClick={() => openOptions(item)} className="text-slate-400 hover:text-blue-500 text-lg px-1.5" title="옵션 편집">⚙</button>
                        <button onClick={() => deleteMenu(item.id)} className="text-slate-300 hover:text-red-500 text-xl font-bold px-1">×</button>
                      </div>
                      {/* 재고 행 */}
                      <div className="flex items-center gap-2 mt-1">
                        {editingStockId === item.id ? (
                          <>
                            <input
                              type="number" min="0" value={editingStockVal}
                              onChange={e => setEditingStockVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveStock(item.id); if (e.key === 'Escape') setEditingStockId(null); }}
                              placeholder="수량 (빈칸=무제한)"
                              autoFocus
                              className="w-36 border border-blue-300 rounded-lg px-2 py-1 text-sm" />
                            <button onClick={() => saveStock(item.id)} className="text-xs bg-blue-500 text-white px-2 py-1 rounded-lg font-bold">저장</button>
                            <button onClick={() => setEditingStockId(null)} className="text-xs text-slate-400 px-1">취소</button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditingStockId(item.id); setEditingStockVal(item.stock === null ? '' : String(item.stock)); }}
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              item.stock === null
                                ? 'border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500'
                                : item.stock === 0
                                  ? 'border-red-300 text-red-500 hover:bg-red-50'
                                  : 'border-green-300 text-green-600 hover:bg-green-50'
                            }`}>
                            재고 {item.stock === null ? '무제한' : `${item.stock}개`}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-slate-400 text-sm py-2">메뉴 없음</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 주문 현황 ── */}
      {tab === 'orders' && (
        <div className="p-6 max-w-4xl mx-auto">
          {activeOrders.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xl">진행 중인 주문 없음</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {activeOrders.sort((a, b) => a.id - b.id).map(order => {
                const cafeList = Object.entries(order.cafeItems).filter(([, n]) => n > 0).map(([n, q]) => q > 1 ? `${n}×${q}` : n).join(', ');
                const foodList = Object.entries(order.foodItems).filter(([, n]) => n > 0).map(([n, q]) => q > 1 ? `${n}×${q}` : n).join(', ');
                const optStr = Object.entries(order.itemOptions ?? {}).map(([, opts]) => formatOpts(opts)).filter(Boolean).join(' / ');
                return (
                  <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-black text-slate-700">#{order.id}</span>
                      <div className="flex gap-2">
                        <button onClick={() => openOrderEdit(order)}
                          className="text-xs bg-blue-50 text-blue-500 border border-blue-200 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100">
                          수정
                        </button>
                        <button onClick={() => cancelOrder(order.id)}
                          className="text-xs bg-red-50 text-red-500 border border-red-200 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100">
                          주문 취소
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {cafeList && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-amber-500 font-bold shrink-0 mt-0.5">☕</span>
                          <div>
                            <p className="text-sm text-slate-700">{cafeList}</p>
                            <div className="mt-0.5">{statusBadge(order.cafeStatus)}</div>
                          </div>
                        </div>
                      )}
                      {foodList && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-green-600 font-bold shrink-0 mt-0.5">🍱</span>
                          <div>
                            <p className="text-sm text-slate-700">{foodList}</p>
                            <div className="mt-0.5">{statusBadge(order.foodStatus)}</div>
                          </div>
                        </div>
                      )}
                      {optStr && <p className="text-xs text-blue-500 mt-1">{optStr}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 판매 통계 ── */}
      {tab === 'stats' && (
        <div className="p-6 max-w-3xl mx-auto">
          {stats ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
                  <p className="text-slate-500 text-base">총 주문</p>
                  <p className="text-7xl font-black text-blue-600 my-2">{stats.totalOrders}</p>
                  <p className="text-slate-500">건</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
                  <p className="text-slate-500 text-base">총 매출</p>
                  <p className="text-4xl font-black text-green-600 my-2">{(stats.totalRevenue ?? 0).toLocaleString('ko-KR')}</p>
                  <p className="text-slate-500">원</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[{ label: '☕ 카페', items: stats.cafeItems }, { label: '🍱 음식', items: stats.foodItems }].map(({ label, items }) => (
                  <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <h3 className="text-base font-bold mb-3 text-slate-600">{label}</h3>
                    {Object.entries(items).length === 0
                      ? <p className="text-slate-400 text-sm">판매 없음</p>
                      : Object.entries(items).sort(([, a], [, b]) => b - a).map(([name, qty]) => (
                        <div key={name} className="flex justify-between py-2 border-b border-slate-50 last:border-0">
                          <span className="text-sm text-slate-700 truncate mr-2">{name}</span>
                          <span className="text-sm font-bold text-blue-600 shrink-0">{qty}개</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
              {Object.keys(stats.optionItems ?? {}).length > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-6">
                  <h3 className="text-base font-bold mb-3 text-slate-600">🔢 세트 옵션 집계</h3>
                  <div className="grid grid-cols-2 gap-x-6">
                    {Object.entries(stats.optionItems).sort(([, a], [, b]) => b - a).map(([name, qty]) => (
                      <div key={name} className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-700 truncate mr-2">{name}</span>
                        <span className="text-sm font-bold text-blue-600 shrink-0">{qty}개</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={loadStats} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-700 text-base font-bold hover:bg-slate-200">새로고침</button>
                <a href="/api/admin/export" download="orders.csv" className="flex-1 py-4 rounded-2xl bg-green-600 text-white text-base font-bold text-center hover:bg-green-700">📥 CSV 다운로드</a>
                <button onClick={resetOrders} className="flex-1 py-4 rounded-2xl bg-red-500 text-white text-base font-bold hover:bg-red-600">주문 초기화</button>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-slate-400">불러오는 중...</div>
          )}
        </div>
      )}

      {/* ── 주문 수정 모달 ── */}
      {editOrderState && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold">주문 #{editOrderState.orderId} 수정</h2>
              <button onClick={() => setEditOrderState(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* 음료 */}
              {Object.entries(editOrderState.cafeItems).filter(([, q]) => q > 0).length > 0 && (
                <div>
                  <p className="text-sm font-bold text-amber-600 mb-2">☕ 음료</p>
                  <div className="space-y-2">
                    {Object.entries(editOrderState.cafeItems).filter(([, q]) => q > 0).map(([name, qty]) => (
                      <div key={name} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl">
                        <span className="flex-1 text-sm font-medium">{name}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditOrderState(s => s && { ...s, cafeItems: { ...s.cafeItems, [name]: Math.max(1, (s.cafeItems[name] ?? qty) - 1) } })}
                            disabled={qty <= 1} className="w-7 h-7 rounded-full bg-slate-200 text-lg font-bold flex items-center justify-center disabled:opacity-30">−</button>
                          <span className="w-6 text-center font-black">{qty}</span>
                          <button onClick={() => setEditOrderState(s => s && { ...s, cafeItems: { ...s.cafeItems, [name]: (s.cafeItems[name] ?? qty) + 1 } })}
                            className="w-7 h-7 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 음식 */}
              {Object.entries(editOrderState.foodItems).filter(([, q]) => q > 0).length > 0 && (
                <div>
                  <p className="text-sm font-bold text-green-600 mb-2">🍱 음식</p>
                  <div className="space-y-3">
                    {Object.entries(editOrderState.foodItems).filter(([, q]) => q > 0).map(([name, qty]) => {
                      const menuItem = findMenuByOrderName(name);
                      const hasOpts = !!editOrderState.itemOptions[name];
                      return (
                        <div key={name} className="border border-slate-200 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-3 px-3 py-2 bg-slate-50">
                            <span className="flex-1 text-sm font-medium">{name}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setEditOrderState(s => s && { ...s, foodItems: { ...s.foodItems, [name]: Math.max(1, (s.foodItems[name] ?? qty) - 1) } })}
                                disabled={qty <= 1} className="w-7 h-7 rounded-full bg-slate-200 text-lg font-bold flex items-center justify-center disabled:opacity-30">−</button>
                              <span className="w-6 text-center font-black">{qty}</span>
                              <button onClick={() => setEditOrderState(s => s && { ...s, foodItems: { ...s.foodItems, [name]: (s.foodItems[name] ?? qty) + 1 } })}
                                className="w-7 h-7 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center">+</button>
                            </div>
                          </div>
                          {hasOpts && menuItem && (
                            <div className="p-3 space-y-3 border-t border-slate-100">
                              {menuItem.optionGroups.map(group => {
                                const opts = editOrderState.itemOptions[name]?.[group.name] ?? {};
                                const total = Object.values(opts).reduce((s, q) => s + q, 0);
                                return (
                                  <div key={group.id}>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-xs font-bold text-slate-600">{group.name}</span>
                                      <span className={`text-xs font-bold ${total === group.maxQty ? 'text-blue-600' : 'text-amber-500'}`}>{total}/{group.maxQty}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {group.options.map(opt => {
                                        const optQty = opts[opt.name] ?? 0;
                                        return (
                                          <div key={opt.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${optQty > 0 ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                                            <span className="flex-1 text-sm">{opt.name}</span>
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={() => setEditOrderState(s => {
                                                  if (!s) return s;
                                                  const cur = s.itemOptions[name]?.[group.name] ?? {};
                                                  const curQty = cur[opt.name] ?? 0;
                                                  return { ...s, itemOptions: { ...s.itemOptions, [name]: { ...s.itemOptions[name], [group.name]: { ...cur, [opt.name]: Math.max(0, curQty - 1) } } } };
                                                })}
                                                disabled={optQty === 0}
                                                className="w-7 h-7 rounded-full bg-slate-200 text-lg font-bold flex items-center justify-center disabled:opacity-30">−</button>
                                              <span className="w-5 text-center font-black text-sm">{optQty}</span>
                                              <button
                                                onClick={() => setEditOrderState(s => {
                                                  if (!s) return s;
                                                  const cur = s.itemOptions[name]?.[group.name] ?? {};
                                                  const curTotal = Object.values(cur).reduce((a, b) => a + b, 0);
                                                  if (curTotal >= group.maxQty) return s;
                                                  const curQty = cur[opt.name] ?? 0;
                                                  return { ...s, itemOptions: { ...s.itemOptions, [name]: { ...s.itemOptions[name], [group.name]: { ...cur, [opt.name]: curQty + 1 } } } };
                                                })}
                                                disabled={total >= group.maxQty}
                                                className="w-7 h-7 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center disabled:opacity-30">+</button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button onClick={() => setEditOrderState(null)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">취소</button>
              <button onClick={saveOrderEdit} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 옵션 편집 모달 ── */}
      {optItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold">{optItem.name}</h2>
                <p className="text-sm text-slate-400">옵션 그룹 편집</p>
              </div>
              <button onClick={() => setOptItem(null)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {editGroups.map((group, gi) => (
                <div key={gi} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 flex items-center gap-3">
                    <input value={group.name} onChange={e => updateGroup(gi, 'name', e.target.value)}
                      placeholder="그룹 이름 (예: 주먹밥 선택)"
                      className="flex-1 text-sm font-medium bg-transparent border-none outline-none" />
                    <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                      선택 수량
                      <input type="number" min="1" max="10" value={group.maxQty}
                        onChange={e => updateGroup(gi, 'maxQty', Math.max(1, Number(e.target.value) || 1))}
                        className="w-12 border border-slate-300 rounded px-1 py-0.5 text-center text-xs ml-1" />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                      <input type="checkbox" checked={group.required}
                        onChange={e => updateGroup(gi, 'required', e.target.checked)}
                        className="accent-blue-500" />
                      필수
                    </label>
                    <button onClick={() => removeGroup(gi)} className="text-red-400 hover:text-red-600 text-base px-1">✕</button>
                  </div>

                  <div className="p-3 space-y-2">
                    {group.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input value={opt.name} onChange={e => updateOption(gi, oi, 'name', e.target.value)}
                          placeholder="옵션 이름" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                        <select
                          value={opt.linkedMenuItemId ?? ''}
                          onChange={e => updateOption(gi, oi, 'linkedMenuItemId', e.target.value ? Number(e.target.value) : null)}
                          className="border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-500 max-w-32">
                          <option value="">연동 없음</option>
                          {menus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <button onClick={() => removeOption(gi, oi)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      </div>
                    ))}
                    <button onClick={() => addOption(gi)}
                      className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-400 hover:text-blue-500 hover:border-blue-300">
                      + 옵션 추가
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addGroup}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-blue-500 hover:border-blue-300 font-medium">
                + 옵션 그룹 추가
              </button>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button onClick={() => setOptItem(null)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">취소</button>
              <button onClick={saveOptions} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
