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
  cafeSlot?: number;
  foodSlot?: number;
  itemOptions: Record<string, string[]>;
}

export interface MenuItem {
  id: number;
  name: string;
  type: 'cafe' | 'food';
  price: number;
  sortOrder: number;
  isSet: boolean;
}

type SendFn = (data: string) => void;

interface KioskState {
  orders: Map<number, Order>;
  nextId: number;
  clients: Set<SendFn>;
  cafeSlots: (number | null)[];
  foodSlots: (number | null)[];
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
    id           INTEGER PRIMARY KEY,
    cafe_items   TEXT    NOT NULL,
    food_items   TEXT    NOT NULL,
    cafe_status  TEXT    NOT NULL,
    food_status  TEXT    NOT NULL,
    created_at   INTEGER NOT NULL,
    item_options TEXT    NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL CHECK(type IN ('cafe','food')),
    price      INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`);

try { db.exec("ALTER TABLE orders ADD COLUMN item_options TEXT NOT NULL DEFAULT '{}'"); } catch {}
try { db.exec('ALTER TABLE menu_items ADD COLUMN price INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE menu_items ADD COLUMN is_set INTEGER NOT NULL DEFAULT 0'); } catch {}

// [name, type, price, sort_order, is_set]
const SEED_ITEMS = [
  ['아이스티', 'cafe', 2000, 1, 0], ['아이스커피', 'cafe', 2000, 2, 0],
  ['매실차', 'cafe', 2000, 3, 0], ['생과일바나나주스', 'cafe', 3000, 4, 0],
  ['멸치주먹밥', 'food', 2000, 1, 0], ['참치마요주먹밥', 'food', 2000, 2, 0],
  ['짜장범벅', 'food', 2000, 3, 0], ['육개장', 'food', 2000, 4, 0],
  ['세트메뉴(주먹밥2+컵라면1)', 'food', 5000, 5, 1],
] as const;

const menuCount = (db.prepare('SELECT COUNT(*) as c FROM menu_items').get() as { c: number }).c;
if (menuCount === 0) {
  const seed = db.prepare('INSERT INTO menu_items (name, type, price, sort_order, is_set) VALUES (?, ?, ?, ?, ?)');
  db.transaction(() => { SEED_ITEMS.forEach(([n, t, p, o, s]) => seed.run(n, t, p, o, s)); })();
} else {
  // 기존 항목 가격 0이면 업데이트, 세트메뉴 is_set 마이그레이션
  const upPrice = db.prepare('UPDATE menu_items SET price = ? WHERE name = ? AND price = 0');
  const upSet = db.prepare('UPDATE menu_items SET is_set = 1 WHERE name = ? AND is_set = 0');
  db.transaction(() => {
    SEED_ITEMS.forEach(([n, , p]) => upPrice.run(p, n));
    upSet.run('세트메뉴(주먹밥2+컵라면1)');
  })();
}

type DbRow = {
  id: number; cafe_items: string; food_items: string;
  cafe_status: Status; food_status: Status; created_at: number; item_options: string;
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
      itemOptions: JSON.parse(r.item_options || '{}'),
    });
  }
  return map;
}

function getNextId(): number {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM orders').get() as { next_id: number };
  return row.next_id;
}

function initSlots(orders: Map<number, Order>): { cafe: (number | null)[]; food: (number | null)[] } {
  const cafe: (number | null)[] = Array(10).fill(null);
  const food: (number | null)[] = Array(10).fill(null);

  Array.from(orders.values())
    .filter(o => o.cafeStatus === 'preparing')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 10)
    .forEach((o, i) => { cafe[i] = o.id; o.cafeSlot = i + 1; });

  Array.from(orders.values())
    .filter(o => o.foodStatus === 'preparing')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 10)
    .forEach((o, i) => { food[i] = o.id; o.foodSlot = i + 1; });

  return { cafe, food };
}

let state: KioskState;
if (globalThis._kioskState) {
  state = globalThis._kioskState;
  if (!state.cafeSlots) {
    const { cafe, food } = initSlots(state.orders);
    (state as KioskState).cafeSlots = cafe;
    (state as KioskState).foodSlots = food;
  }
} else {
  const orders = loadFromDb();
  const { cafe, food } = initSlots(orders);
  state = { orders, nextId: getNextId(), clients: new Set(), cafeSlots: cafe, foodSlots: food };
  globalThis._kioskState = state;
}

export function getOrders(): Order[] {
  return Array.from(state.orders.values());
}

function broadcast() {
  const data = JSON.stringify(getOrders());
  state.clients.forEach((fn) => { try { fn(data); } catch {} });
}

export function addClient(fn: SendFn) { state.clients.add(fn); }
export function removeClient(fn: SendFn) { state.clients.delete(fn); }

function assignSlot(slots: (number | null)[], order: Order, slotKey: 'cafeSlot' | 'foodSlot') {
  const idx = slots.findIndex(s => s === null);
  if (idx >= 0) { slots[idx] = order.id; order[slotKey] = idx + 1; }
}

function freeAndReassign(
  slots: (number | null)[],
  order: Order,
  slotKey: 'cafeSlot' | 'foodSlot',
  statusKey: 'cafeStatus' | 'foodStatus'
) {
  if (!order[slotKey]) return;
  slots[order[slotKey]! - 1] = null;
  order[slotKey] = undefined;

  const next = Array.from(state.orders.values())
    .filter(o => o[statusKey] === 'preparing' && !o[slotKey])
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (next) assignSlot(slots, next, slotKey);
}

const stmtInsert = db.prepare(
  'INSERT INTO orders (id, cafe_items, food_items, cafe_status, food_status, created_at, item_options) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const stmtUpdate = db.prepare(
  'UPDATE orders SET cafe_status = ?, food_status = ? WHERE id = ?'
);

export function createOrder(
  cafeItems: Record<string, number>,
  foodItems: Record<string, number>,
  itemOptions: Record<string, string[]> = {}
): Order {
  const hasCafe = Object.values(cafeItems).some(v => v > 0);
  const hasFood = Object.values(foodItems).some(v => v > 0);
  const order: Order = {
    id: state.nextId++,
    cafeItems: hasCafe ? cafeItems : {},
    foodItems: hasFood ? foodItems : {},
    cafeStatus: hasCafe ? 'preparing' : 'none',
    foodStatus: hasFood ? 'preparing' : 'none',
    createdAt: Date.now(),
    itemOptions,
  };

  if (hasCafe) assignSlot(state.cafeSlots, order, 'cafeSlot');
  if (hasFood) assignSlot(state.foodSlots, order, 'foodSlot');

  stmtInsert.run(
    order.id, JSON.stringify(order.cafeItems), JSON.stringify(order.foodItems),
    order.cafeStatus, order.foodStatus, order.createdAt, JSON.stringify(itemOptions)
  );
  state.orders.set(order.id, order);
  broadcast();
  return order;
}

export function updateOrder(id: number, action: string): boolean {
  const order = state.orders.get(id);
  if (!order) return false;
  ({
    'cafe-ready':  () => { if (order.cafeStatus === 'preparing') { order.cafeStatus = 'ready'; freeAndReassign(state.cafeSlots, order, 'cafeSlot', 'cafeStatus'); } },
    'food-ready':  () => { if (order.foodStatus === 'preparing') { order.foodStatus = 'ready'; freeAndReassign(state.foodSlots, order, 'foodSlot', 'foodStatus'); } },
    'cafe-pickup': () => { if (order.cafeStatus === 'ready') order.cafeStatus = 'picked'; },
    'food-pickup': () => { if (order.foodStatus === 'ready') order.foodStatus = 'picked'; },
  } as Record<string, () => void>)[action]?.();
  stmtUpdate.run(order.cafeStatus, order.foodStatus, order.id);
  broadcast();
  return true;
}

export function getMenuItems(): MenuItem[] {
  return (db.prepare('SELECT * FROM menu_items ORDER BY type, sort_order, id').all() as Array<{
    id: number; name: string; type: 'cafe' | 'food'; price: number; sort_order: number; is_set: number;
  }>).map(r => ({ id: r.id, name: r.name, type: r.type, price: r.price, sortOrder: r.sort_order, isSet: r.is_set === 1 }));
}

export function addMenuItem(name: string, type: 'cafe' | 'food', price: number, isSet = false): MenuItem {
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM menu_items WHERE type = ?').get(type) as { next: number }).next;
  const result = db.prepare('INSERT INTO menu_items (name, type, price, sort_order, is_set) VALUES (?, ?, ?, ?, ?)').run(name, type, price, maxOrder, isSet ? 1 : 0);
  return { id: Number(result.lastInsertRowid), name, type, price, sortOrder: maxOrder, isSet };
}

export function deleteMenuItem(id: number): boolean {
  return (db.prepare('DELETE FROM menu_items WHERE id = ?').run(id)).changes > 0;
}

export function getStats() {
  const rows = db.prepare('SELECT cafe_items, food_items FROM orders').all() as Array<{
    cafe_items: string; food_items: string;
  }>;
  const cafeItems: Record<string, number> = {};
  const foodItems: Record<string, number> = {};
  for (const row of rows) {
    for (const [n, q] of Object.entries(JSON.parse(row.cafe_items) as Record<string, number>))
      if (q > 0) cafeItems[n] = (cafeItems[n] ?? 0) + q;
    for (const [n, q] of Object.entries(JSON.parse(row.food_items) as Record<string, number>))
      if (q > 0) foodItems[n] = (foodItems[n] ?? 0) + q;
  }
  return { totalOrders: rows.length, cafeItems, foodItems };
}

export function resetOrders(): void {
  db.prepare('DELETE FROM orders').run();
  state.orders.clear();
  state.nextId = 1;
  state.cafeSlots = Array(10).fill(null);
  state.foodSlots = Array(10).fill(null);
  broadcast();
}
