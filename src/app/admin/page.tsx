'use client';
import { useState, useEffect, useCallback } from 'react';
import type { MenuItem } from '@/lib/store';

interface Stats {
  totalOrders: number;
  cafeItems: Record<string, number>;
  foodItems: Record<string, number>;
}

export default function AdminPage() {
  const [tab, setTab] = useState<'menu' | 'stats'>('menu');
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'cafe' | 'food'>('cafe');
  const [newPrice, setNewPrice] = useState('');

  const loadMenus = useCallback(() =>
    fetch('/api/menu').then((r) => r.json()).then(setMenus), []);

  const loadStats = useCallback(() =>
    fetch('/api/stats').then((r) => r.json()).then(setStats), []);

  useEffect(() => { loadMenus(); }, [loadMenus]);
  useEffect(() => { if (tab === 'stats') loadStats(); }, [tab, loadStats]);

  const addMenu = async () => {
    if (!newName.trim()) return;
    await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), type: newType, price: Number(newPrice) || 0 }),
    });
    setNewName('');
    setNewPrice('');
    loadMenus();
  };

  const deleteMenu = async (id: number) => {
    await fetch(`/api/menu/${id}`, { method: 'DELETE' });
    loadMenus();
  };

  const resetOrders = async () => {
    if (!confirm('모든 주문을 초기화하시겠습니까?\n(통계 데이터도 함께 삭제됩니다)')) return;
    await fetch('/api/admin/reset', { method: 'POST' });
    alert('초기화 완료');
    loadStats();
  };

  const cafeMenus = menus.filter((m) => m.type === 'cafe');
  const foodMenus = menus.filter((m) => m.type === 'food');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-800 text-white text-center py-5">
        <h1 className="text-3xl font-bold">관리자</h1>
      </header>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 bg-white">
        {(['menu', 'stats'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-4 text-xl font-bold transition-colors ${tab === t ? 'border-b-4 border-blue-500 text-blue-600' : 'text-gray-500'}`}>
            {t === 'menu' ? '🍽️ 메뉴 관리' : '📊 판매 통계'}
          </button>
        ))}
      </div>

      {/* 메뉴 관리 */}
      {tab === 'menu' && (
        <div className="p-6 max-w-2xl mx-auto">
          {/* 추가 */}
          <div className="bg-white rounded-2xl p-5 shadow mb-6">
            <h2 className="text-xl font-bold mb-4">메뉴 추가</h2>
            <div className="flex gap-3 flex-wrap">
              <select value={newType} onChange={(e) => setNewType(e.target.value as 'cafe' | 'food')}
                className="border rounded-xl px-4 py-3 text-lg">
                <option value="cafe">☕ 카페</option>
                <option value="food">🍱 음식</option>
              </select>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMenu()}
                placeholder="메뉴 이름" className="flex-1 border rounded-xl px-4 py-3 text-lg min-w-32" />
              <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMenu()}
                placeholder="가격 (원)" type="number" min="0" step="100"
                className="w-36 border rounded-xl px-4 py-3 text-lg" />
              <button onClick={addMenu}
                className="bg-blue-500 text-white px-6 py-3 rounded-xl text-lg font-bold active:bg-blue-600">
                추가
              </button>
            </div>
          </div>

          {/* 목록 */}
          <div className="grid grid-cols-2 gap-4">
            {[{ label: '☕ 카페', items: cafeMenus }, { label: '🍱 음식', items: foodMenus }].map(({ label, items }) => (
              <div key={label} className="bg-white rounded-2xl p-5 shadow">
                <h3 className="text-lg font-bold mb-3">{label}</h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-base">{item.name}</p>
                        <p className="text-sm text-gray-400">{item.price.toLocaleString('ko-KR')}원</p>
                      </div>
                      <button onClick={() => deleteMenu(item.id)}
                        className="text-red-400 hover:text-red-600 text-xl font-bold px-2">×</button>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-gray-400 text-sm">메뉴 없음</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 판매 통계 */}
      {tab === 'stats' && stats && (
        <div className="p-6 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl p-5 shadow mb-4 text-center">
            <p className="text-gray-500 text-lg">총 주문</p>
            <p className="text-6xl font-black text-blue-600">{stats.totalOrders}</p>
            <p className="text-gray-500">건</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { label: '☕ 카페', items: stats.cafeItems },
              { label: '🍱 음식', items: stats.foodItems },
            ].map(({ label, items }) => (
              <div key={label} className="bg-white rounded-2xl p-5 shadow">
                <h3 className="text-lg font-bold mb-3">{label}</h3>
                {Object.entries(items).length === 0
                  ? <p className="text-gray-400 text-sm">판매 없음</p>
                  : Object.entries(items)
                      .sort(([, a], [, b]) => b - a)
                      .map(([name, qty]) => (
                        <div key={name} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                          <span>{name}</span>
                          <span className="font-bold text-blue-600">{qty}개</span>
                        </div>
                      ))}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={loadStats}
              className="flex-1 py-4 rounded-2xl bg-gray-200 text-gray-700 text-lg font-bold active:bg-gray-300">
              새로고침
            </button>
            <button onClick={resetOrders}
              className="flex-1 py-4 rounded-2xl bg-red-500 text-white text-lg font-bold active:bg-red-600">
              주문 초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
