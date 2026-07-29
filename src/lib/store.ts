import Database from 'better-sqlite3';
import path from 'path';

export type Status = 'none' | 'preparing' | 'ready' | 'picked';

export interface Order {
  id: number;
  cafeItems: Record<string, number>;
  foodItems: Record<string, number>;
  cafeStatus: Status;
  foodStatus: Status;
  createdAt: number;
}

export interface MenuItem {
  id: number;
  name: string;
  type: 'cafe' | 'food';
  price: number;
  sortOrder: number;
}

type SendFn = (data: string) => void;

interface KioskState {
  orders: Map<number, Order>;
  nextId: number;
  clients: Set<SendFn>;
}

declare global {
  // eslint-disable-next-line no-var
  var _kioskState: KioskState | undefined;
}

const db = new Database(
  process.env.DB_PATH ?? path.join(process.cwd(), 'kiosk.db')
);

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id          INTEGER PRIMARY KEY,
    cafe_items  TEXT    NOT NULL,
    food_items  TEXT    NOT NULL,
    cafe_status TEXT    NOT NULL,
    food_status TEXT    NOT NULL,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL CHECK(type IN ('cafe','food')),
    price      INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`);

// 기존 EC2 DB에 price 컬럼 없으면 추가 (마이그레이션)
try { db.exec('ALTER TABLE menu_items ADD COLUMN price INTEGER NOT NULL DEFAULT 0'); } catch {}

// 최초 실행 시 기본 메뉴 시딩
const menuCount = (db.prepare('SELECT COUNT(*) as c FROM menu_items').get() as { c: number }).c;
if (menuCount === 0) {
  const seed = db.prepare('INSERT INTO menu_items (name, type, price, sort_order) VALUES (?, ?, ?, ?)');
  const seedAll = db.transaction(() => {
    [['아이스티', 'cafe', 2000, 1], ['아이스커피', 'cafe', 2000, 2],
     ['매실차', 'cafe', 2000, 3], ['생과일바나나주스', 'cafe', 3000, 4]].forEach(([n, t, p, o]) => seed.run(n, t, p, o));
    [['멸치주먹밥', 'food', 2000, 1], ['참치마요주먹밥', 'food', 2000, 2],
     ['짜장범벅', 'food', 2000, 3], ['육개장', 'food', 2000, 4],
     ['세트메뉴(주먹밥2+컵라면1)', 'food', 5000, 5]].forEach(([n, t, p, o]) => seed.run(n, t, p, o));
  });
  seedAll();
}

const stmtInsert = db.prepare(
  'INSERT INTO orders (id, cafe_items, food_items, cafe_status, food_status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const stmtUpdate = db.prepare(
  'UPDATE orders SET cafe_status = ?, food_status = ? WHERE id = ?'
);

type DbRow = {
  id: number; cafe_items: string; food_items: string;
  cafe_status: Status; food_status: Status; created_at: number;
};

function loadFromDb(): Map<number, Order> {
  const rows = db.prepare('SELECT * FROM orders').all() as DbRow[];
  const map = new Map<number, Order>();
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      cafeItems: JSON.parse(r.cafe_items),
      foodItems: JSON.parse(r.food_items),
      cafeStatus: r.cafe_status,
      foodStatus: r.food_status,
      createdAt: r.created_at,
    });
  }
  return map;
}

function getNextId(): number {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM orders').get() as { next_id: number };
  return row.next_id;
}

const state: KioskState =
  globalThis._kioskState ??
  (globalThis._kioskState = {
    orders: loadFromDb(),
    nextId: getNextId(),
    clients: new Set(),
  });

export function getOrders(): Order[] {
  return Array.from(state.orders.values());
}

function broadcast() {
  const data = JSON.stringify(getOrders());
  state.clients.forEach((fn) => { try { fn(data); } catch {} });
}

export function addClient(fn: SendFn) { state.clients.add(fn); }
export function removeClient(fn: SendFn) { state.clients.delete(fn); }

export function createOrder(
  cafeItems: Record<string, number>,
  foodItems: Record<string, number>
): Order {
  const hasCafe = Object.values(cafeItems).some((v) => v > 0);
  const hasFood = Object.values(foodItems).some((v) => v > 0);
  const order: Order = {
    id: state.nextId++,
    cafeItems: hasCafe ? cafeItems : {},
    foodItems: hasFood ? foodItems : {},
    cafeStatus: hasCafe ? 'preparing' : 'none',
    foodStatus: hasFood ? 'preparing' : 'none',
    createdAt: Date.now(),
  };
  stmtInsert.run(
    order.id, JSON.stringify(order.cafeItems), JSON.stringify(order.foodItems),
    order.cafeStatus, order.foodStatus, order.createdAt
  );
  state.orders.set(order.id, order);
  broadcast();
  return order;
}

export function updateOrder(id: number, action: string): boolean {
  const order = state.orders.get(id);
  if (!order) return false;
  ({
    'cafe-ready':  () => { if (order.cafeStatus === 'preparing') order.cafeStatus = 'ready'; },
    'food-ready':  () => { if (order.foodStatus === 'preparing') order.foodStatus = 'ready'; },
    'cafe-pickup': () => { if (order.cafeStatus === 'ready') order.cafeStatus = 'picked'; },
    'food-pickup': () => { if (order.foodStatus === 'ready') order.foodStatus = 'picked'; },
  } as Record<string, () => void>)[action]?.();
  stmtUpdate.run(order.cafeStatus, order.foodStatus, order.id);
  broadcast();
  return true;
}

// ── 메뉴 관리 ──────────────────────────────────────────────

export function getMenuItems(): MenuItem[] {
  return (db.prepare('SELECT * FROM menu_items ORDER BY type, sort_order, id').all() as Array<{
    id: number; name: string; type: 'cafe' | 'food'; price: number; sort_order: number;
  }>).map((r) => ({ id: r.id, name: r.name, type: r.type, price: r.price, sortOrder: r.sort_order }));
}

export function addMenuItem(name: string, type: 'cafe' | 'food', price: number): MenuItem {
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM menu_items WHERE type = ?').get(type) as { next: number }).next;
  const result = db.prepare('INSERT INTO menu_items (name, type, price, sort_order) VALUES (?, ?, ?, ?)').run(name, type, price, maxOrder);
  return { id: Number(result.lastInsertRowid), name, type, price, sortOrder: maxOrder };
}

export function deleteMenuItem(id: number): boolean {
  const result = db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── 판매 통계 ──────────────────────────────────────────────

export function getStats() {
  const rows = db.prepare('SELECT cafe_items, food_items, created_at FROM orders').all() as Array<{
    cafe_items: string; food_items: string; created_at: number;
  }>;
  const cafeItems: Record<string, number> = {};
  const foodItems: Record<string, number> = {};

  for (const row of rows) {
    for (const [name, qty] of Object.entries(JSON.parse(row.cafe_items) as Record<string, number>)) {
      if (qty > 0) cafeItems[name] = (cafeItems[name] ?? 0) + qty;
    }
    for (const [name, qty] of Object.entries(JSON.parse(row.food_items) as Record<string, number>)) {
      if (qty > 0) foodItems[name] = (foodItems[name] ?? 0) + qty;
    }
  }

  return { totalOrders: rows.length, cafeItems, foodItems };
}

// ── 주문 초기화 ────────────────────────────────────────────

export function resetOrders(): void {
  db.prepare('DELETE FROM orders').run();
  state.orders.clear();
  state.nextId = 1;
  broadcast();
}
