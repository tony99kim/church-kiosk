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

// DB is module-level — SQLite handles concurrent access fine
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
  )
`);

const stmtInsert = db.prepare(
  'INSERT INTO orders (id, cafe_items, food_items, cafe_status, food_status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const stmtUpdate = db.prepare(
  'UPDATE orders SET cafe_status = ?, food_status = ? WHERE id = ?'
);

type DbRow = {
  id: number;
  cafe_items: string;
  food_items: string;
  cafe_status: Status;
  food_status: Status;
  created_at: number;
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
  const row = db
    .prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM orders')
    .get() as { next_id: number };
  return row.next_id;
}

// Keep in-memory state across hot reloads in dev
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
  state.clients.forEach((fn) => {
    try { fn(data); } catch {}
  });
}

export function addClient(fn: SendFn) {
  state.clients.add(fn);
}

export function removeClient(fn: SendFn) {
  state.clients.delete(fn);
}

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
    order.id,
    JSON.stringify(order.cafeItems),
    JSON.stringify(order.foodItems),
    order.cafeStatus,
    order.foodStatus,
    order.createdAt
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
