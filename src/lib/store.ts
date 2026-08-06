import Database from 'better-sqlite3';
import path from 'path';

export type Status = 'none' | 'preparing' | 'ready' | 'picked';

export interface OptionItem {
  id: number;
  name: string;
  price: number;
  linkedMenuItemId?: number | null;
}

export interface OptionGroup {
  id: number;
  name: string;
  required: boolean;
  maxQty: number;
  options: OptionItem[];
}

export interface MenuItem {
  id: number;
  name: string;
  type: 'cafe' | 'food';
  price: number;
  sortOrder: number;
  stock: number | null; // null = 무제한, 0 = 품절
  optionGroups: OptionGroup[];
}

export interface Order {
  id: number;
  cafeItems: Record<string, number>;
  foodItems: Record<string, number>;
  cafeStatus: Status;
  foodStatus: Status;
  createdAt: number;
  cafeSlot?: number;        // 카페 준비대 (1-10)
  foodSlot?: number;        // 음식 준비대 (1-10)
  cafePickupSlot?: number;  // 카페 수령대 (1-10)
  foodPickupSlot?: number;  // 음식 수령대 (1-10)
  // itemName → groupName → { optionName: qty }
  itemOptions: Record<string, Record<string, Record<string, number>>>;
  paymentMethod: 'cash' | 'transfer';
}

type SendFn = (data: string) => void;

interface KioskState {
  orders: Map<number, Order>;
  nextId: number;
  clients: Set<SendFn>;
  cafeSlots: (number | null)[];
  foodSlots: (number | null)[];
  cafePickupSlots: (number | null)[];
  foodPickupSlots: (number | null)[];
}

declare global {
  // eslint-disable-next-line no-var
  var _kioskState: KioskState | undefined;
}

const db = new Database(
  process.env.DB_PATH ?? path.join(process.cwd(), 'kiosk.db')
);
// WAL: 동시 읽기 허용, busy_timeout: 잠금 충돌 시 최대 5초 대기 (빌드 타임 SQLITE_BUSY 방지)
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY,
    cafe_items   TEXT    NOT NULL,
    food_items   TEXT    NOT NULL,
    cafe_status  TEXT    NOT NULL,
    food_status  TEXT    NOT NULL,
    created_at   INTEGER NOT NULL,
    item_options TEXT    NOT NULL DEFAULT '{}',
    cancelled    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL CHECK(type IN ('cafe','food')),
    price      INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_set     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS option_groups (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    name         TEXT    NOT NULL,
    required     INTEGER NOT NULL DEFAULT 1,
    sort_order   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS option_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    price      INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`);

try { db.exec("ALTER TABLE orders ADD COLUMN item_options TEXT NOT NULL DEFAULT '{}'"); } catch {}
try { db.exec('ALTER TABLE orders ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE menu_items ADD COLUMN price INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE menu_items ADD COLUMN is_set INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE option_groups ADD COLUMN max_qty INTEGER NOT NULL DEFAULT 1'); } catch {}
try { db.exec('ALTER TABLE menu_items ADD COLUMN stock INTEGER DEFAULT NULL'); } catch {}
try { db.exec('ALTER TABLE option_items ADD COLUMN linked_menu_item_id INTEGER DEFAULT NULL'); } catch {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'"); } catch {}

// ── 메뉴 옵션 그룹 저장 (replace all) ────────────────────────
export function saveMenuOptions(
  menuItemId: number,
  groups: Array<{ name: string; required: boolean; maxQty?: number; options: Array<{ name: string; price: number; linkedMenuItemId?: number | null }> }>
): void {
  db.transaction(() => {
    const gids = (db.prepare('SELECT id FROM option_groups WHERE menu_item_id = ?').all(menuItemId) as { id: number }[]).map(r => r.id);
    for (const gid of gids) db.prepare('DELETE FROM option_items WHERE group_id = ?').run(gid);
    db.prepare('DELETE FROM option_groups WHERE menu_item_id = ?').run(menuItemId);

    const insGroup = db.prepare('INSERT INTO option_groups (menu_item_id, name, required, max_qty, sort_order) VALUES (?, ?, ?, ?, ?)');
    const insItem  = db.prepare('INSERT INTO option_items  (group_id, name, price, sort_order, linked_menu_item_id) VALUES (?, ?, ?, ?, ?)');

    groups.forEach((g, gi) => {
      const { lastInsertRowid: gid } = insGroup.run(menuItemId, g.name, g.required ? 1 : 0, g.maxQty ?? 1, gi);
      g.options.forEach((o, oi) => insItem.run(gid, o.name, o.price, oi, o.linkedMenuItemId ?? null));
    });
  })();
}

// ── 시드 ────────────────────────────────────────────────────
const SEED_ITEMS = [
  ['아이스티', 'cafe', 2000, 1, 0], ['아이스커피', 'cafe', 2000, 2, 0],
  ['매실차', 'cafe', 2000, 3, 0],   ['생과일바나나주스', 'cafe', 3000, 4, 0],
  ['멸치주먹밥', 'food', 2000, 1, 0],     ['참치마요주먹밥', 'food', 2000, 2, 0],
  ['짜장범벅', 'food', 2000, 3, 0],       ['육개장', 'food', 2000, 4, 0],
  ['세트메뉴(주먹밥2+컵라면1)', 'food', 5000, 5, 1],
] as const;

const menuCount = (db.prepare('SELECT COUNT(*) as c FROM menu_items').get() as { c: number }).c;
if (menuCount === 0) {
  const seed = db.prepare('INSERT INTO menu_items (name, type, price, sort_order, is_set) VALUES (?, ?, ?, ?, ?)');
  db.transaction(() => { SEED_ITEMS.forEach(([n, t, p, o, s]) => seed.run(n, t, p, o, s)); })();
} else {
  const upPrice = db.prepare('UPDATE menu_items SET price = ? WHERE name = ? AND price = 0');
  const upSet   = db.prepare('UPDATE menu_items SET is_set = 1 WHERE name = ? AND is_set = 0');
  db.transaction(() => {
    SEED_ITEMS.forEach(([n, , p]) => upPrice.run(p, n));
    upSet.run('세트메뉴(주먹밥2+컵라면1)');
  })();
}

// 세트메뉴 옵션 그룹 시딩 (주먹밥 ①②를 maxQty=2 그룹으로 통합)
const setMenuItem = db.prepare("SELECT id FROM menu_items WHERE name = '세트메뉴(주먹밥2+컵라면1)'").get() as { id: number } | undefined;
if (setMenuItem) {
  const oldGroup = db.prepare("SELECT id FROM option_groups WHERE name = '주먹밥 ①' AND menu_item_id = ?").get(setMenuItem.id);
  const gc = (db.prepare('SELECT COUNT(*) as c FROM option_groups WHERE menu_item_id = ?').get(setMenuItem.id) as { c: number }).c;
  if (gc === 0 || oldGroup) {
    saveMenuOptions(setMenuItem.id, [
      { name: '주먹밥 선택', required: true, maxQty: 2, options: [{ name: '멸치주먹밥', price: 0 }, { name: '참치마요주먹밥', price: 0 }] },
      { name: '컵라면 선택', required: true, maxQty: 1, options: [{ name: '짜장컵라면', price: 0 }, { name: '육개장컵라면', price: 0 }] },
    ]);
  }
}

// ── DB 로드 ─────────────────────────────────────────────────
type DbRow = {
  id: number; cafe_items: string; food_items: string;
  cafe_status: Status; food_status: Status; created_at: number; item_options: string; cancelled: number;
  payment_method: 'cash' | 'transfer';
};

function loadFromDb(): Map<number, Order> {
  const rows = db.prepare('SELECT * FROM orders WHERE cancelled = 0').all() as DbRow[];
  const map = new Map<number, Order>();
  for (const r of rows) {
    let itemOptions: Record<string, Record<string, Record<string, number>>> = {};
    try {
      const raw = JSON.parse(r.item_options || '{}');
      for (const [k, v] of Object.entries(raw)) {
        if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
        const converted: Record<string, Record<string, number>> = {};
        for (const [gk, gv] of Object.entries(v as Record<string, unknown>)) {
          if (typeof gv === 'string') {
            converted[gk] = { [gv]: 1 }; // 구 포맷 변환
          } else if (gv && typeof gv === 'object' && !Array.isArray(gv)) {
            converted[gk] = gv as Record<string, number>;
          }
        }
        itemOptions[k] = converted;
      }
    } catch { /* ignore */ }

    let cafeItems: Record<string, number> = {};
    let foodItems: Record<string, number> = {};
    try { cafeItems = JSON.parse(r.cafe_items); } catch {}
    try { foodItems = JSON.parse(r.food_items); } catch {}

    map.set(r.id, {
      id: r.id,
      cafeItems,
      foodItems,
      cafeStatus: r.cafe_status,
      foodStatus: r.food_status,
      createdAt: r.created_at,
      itemOptions,
      paymentMethod: r.payment_method ?? 'cash',
    });
  }
  return map;
}

function getNextId(): number {
  const row = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM orders').get() as { next_id: number };
  return row.next_id;
}

function initSlots(orders: Map<number, Order>) {
  const cafe:   (number | null)[] = Array(10).fill(null);
  const food:   (number | null)[] = Array(10).fill(null);
  const cafePU: (number | null)[] = Array(10).fill(null);
  const foodPU: (number | null)[] = Array(10).fill(null);
  Array.from(orders.values()).filter(o => o.cafeStatus === 'preparing' || o.cafeStatus === 'ready').sort((a, b) => a.createdAt - b.createdAt).slice(0, 10).forEach((o, i) => { cafe[i]   = o.id; o.cafeSlot        = i + 1; });
  Array.from(orders.values()).filter(o => o.foodStatus === 'preparing' || o.foodStatus === 'ready').sort((a, b) => a.createdAt - b.createdAt).slice(0, 10).forEach((o, i) => { food[i]   = o.id; o.foodSlot        = i + 1; });
  Array.from(orders.values()).filter(o => o.cafeStatus === 'preparing' || o.cafeStatus === 'ready').sort((a, b) => a.createdAt - b.createdAt).slice(0, 10).forEach((o, i) => { cafePU[i] = o.id; o.cafePickupSlot  = i + 1; });
  Array.from(orders.values()).filter(o => o.foodStatus === 'preparing' || o.foodStatus === 'ready').sort((a, b) => a.createdAt - b.createdAt).slice(0, 10).forEach((o, i) => { foodPU[i] = o.id; o.foodPickupSlot  = i + 1; });
  return { cafe, food, cafePU, foodPU };
}

let state: KioskState;
if (globalThis._kioskState) {
  state = globalThis._kioskState;
  if (!state.cafeSlots) {
    const { cafe, food, cafePU, foodPU } = initSlots(state.orders);
    state.cafeSlots        = cafe;
    state.foodSlots        = food;
    state.cafePickupSlots  = cafePU;
    state.foodPickupSlots  = foodPU;
  }
  if (!state.cafePickupSlots) {
    const { cafePU, foodPU } = initSlots(state.orders);
    state.cafePickupSlots = cafePU;
    state.foodPickupSlots = foodPU;
  }
} else {
  const orders = loadFromDb();
  const { cafe, food, cafePU, foodPU } = initSlots(orders);
  state = { orders, nextId: getNextId(), clients: new Set(), cafeSlots: cafe, foodSlots: food, cafePickupSlots: cafePU, foodPickupSlots: foodPU };
  globalThis._kioskState = state;
}

export function getOrders(): Order[] {
  return Array.from(state.orders.values()).filter(o =>
    !(  (o.cafeStatus === 'picked' || o.cafeStatus === 'none') &&
        (o.foodStatus === 'picked' || o.foodStatus === 'none')  )
  );
}

function broadcast() {
  const data = JSON.stringify(getOrders());
  state.clients.forEach(fn => { try { fn(data); } catch {} });
}

export function addClient(fn: SendFn) { state.clients.add(fn); }
export function removeClient(fn: SendFn) { state.clients.delete(fn); }

type SlotKey = 'cafeSlot' | 'foodSlot' | 'cafePickupSlot' | 'foodPickupSlot';
type StatusKey = 'cafeStatus' | 'foodStatus';

function assignSlot(slots: (number | null)[], order: Order, key: SlotKey) {
  const i = slots.findIndex(s => s === null);
  if (i >= 0) { slots[i] = order.id; order[key] = i + 1; }
}

function freeAndReassign(slots: (number | null)[], order: Order, slotKey: SlotKey, statusKey: StatusKey) {
  if (!order[slotKey]) return;
  slots[order[slotKey]! - 1] = null;
  order[slotKey] = undefined;
  const next = Array.from(state.orders.values())
    .filter(o => o[statusKey] === 'preparing' && !o[slotKey])
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (next) assignSlot(slots, next, slotKey);
}

function freePickupAndReassign(slots: (number | null)[], order: Order, slotKey: 'cafePickupSlot' | 'foodPickupSlot', statusKey: StatusKey) {
  if (!order[slotKey]) return;
  slots[order[slotKey]! - 1] = null;
  order[slotKey] = undefined;
  const next = Array.from(state.orders.values())
    .filter(o => (o[statusKey] === 'preparing' || o[statusKey] === 'ready') && !o[slotKey])
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (next) assignSlot(slots, next, slotKey);
}

const stmtInsert = db.prepare(
  'INSERT INTO orders (id, cafe_items, food_items, cafe_status, food_status, created_at, item_options, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
const stmtUpdate = db.prepare('UPDATE orders SET cafe_status = ?, food_status = ? WHERE id = ?');

const stmtGetStock      = db.prepare('SELECT stock FROM menu_items WHERE name = ? AND stock IS NOT NULL');
const stmtGetLinkedItem = db.prepare('SELECT mi.name FROM option_items oi JOIN menu_items mi ON oi.linked_menu_item_id = mi.id WHERE oi.name = ?');

export function createOrder(
  cafeItems: Record<string, number>,
  foodItems: Record<string, number>,
  itemOptions: Record<string, Record<string, Record<string, number>>> = {},
  paymentMethod: 'cash' | 'transfer' = 'cash'
): Order {
  // "(2)", "(3)" 접미사를 제거해 base name 기준으로 수량 합산 후 재고 체크
  const qtyByBase: Record<string, number> = {};
  for (const [name, qty] of Object.entries({ ...cafeItems, ...foodItems })) {
    if (qty <= 0) continue;
    const base = baseName(name);
    qtyByBase[base] = (qtyByBase[base] ?? 0) + qty;
  }
  // 옵션에 연동된 메뉴 아이템 재고도 합산
  for (const [itemName, groupMap] of Object.entries(itemOptions)) {
    const parentQty = (cafeItems[itemName] ?? 0) + (foodItems[itemName] ?? 0);
    if (parentQty <= 0 || !groupMap) continue;
    for (const optMap of Object.values(groupMap as Record<string, Record<string, number>>)) {
      if (!optMap) continue;
      for (const [optName, optQty] of Object.entries(optMap)) {
        if (optQty <= 0) continue;
        const linked = stmtGetLinkedItem.get(optName) as { name: string } | undefined;
        if (linked) qtyByBase[linked.name] = (qtyByBase[linked.name] ?? 0) + parentQty * optQty;
      }
    }
  }

  for (const [base, total] of Object.entries(qtyByBase)) {
    const row = stmtGetStock.get(base) as { stock: number } | undefined;
    if (row && row.stock < total) throw new Error(`sold_out:${base}`);
  }

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
    paymentMethod,
  };
  if (hasCafe) { assignSlot(state.cafeSlots, order, 'cafeSlot'); assignSlot(state.cafePickupSlots, order, 'cafePickupSlot'); }
  if (hasFood) { assignSlot(state.foodSlots, order, 'foodSlot'); assignSlot(state.foodPickupSlots, order, 'foodPickupSlot'); }
  const stmtDecrStock = db.prepare('UPDATE menu_items SET stock = MAX(0, stock - ?) WHERE name = ? AND stock IS NOT NULL AND stock > 0');
  db.transaction(() => {
    stmtInsert.run(order.id, JSON.stringify(order.cafeItems), JSON.stringify(order.foodItems),
      order.cafeStatus, order.foodStatus, order.createdAt, JSON.stringify(itemOptions), paymentMethod);
    for (const [base, total] of Object.entries(qtyByBase)) stmtDecrStock.run(total, base);
  })();
  state.orders.set(order.id, order);
  broadcast();
  return order;
}

export function updateOrder(id: number, action: string): boolean {
  const order = state.orders.get(id);
  if (!order) return false;

  const prevCafe = order.cafeStatus;
  const prevFood = order.foodStatus;

  ({
    'cafe-ready': () => {
      if (order.cafeStatus === 'preparing') {
        order.cafeStatus = 'ready';
        if (!order.cafePickupSlot) assignSlot(state.cafePickupSlots, order, 'cafePickupSlot');
      }
    },
    'food-ready': () => {
      if (order.foodStatus === 'preparing') {
        order.foodStatus = 'ready';
        if (!order.foodPickupSlot) assignSlot(state.foodPickupSlots, order, 'foodPickupSlot');
      }
    },
    'cafe-pickup': () => {
      if (order.cafeStatus === 'ready') {
        order.cafeStatus = 'picked';
        freeAndReassign(state.cafeSlots, order, 'cafeSlot', 'cafeStatus');
        freePickupAndReassign(state.cafePickupSlots, order, 'cafePickupSlot', 'cafeStatus');
      }
    },
    'food-pickup': () => {
      if (order.foodStatus === 'ready') {
        order.foodStatus = 'picked';
        freeAndReassign(state.foodSlots, order, 'foodSlot', 'foodStatus');
        freePickupAndReassign(state.foodPickupSlots, order, 'foodPickupSlot', 'foodStatus');
      }
    },
  } as Record<string, () => void>)[action]?.();

  try {
    stmtUpdate.run(order.cafeStatus, order.foodStatus, order.id);
  } catch (e) {
    // DB 실패 시 메모리 상태 롤백
    order.cafeStatus = prevCafe;
    order.foodStatus = prevFood;
    console.error('updateOrder DB error:', e);
    return false;
  }

  broadcast();
  return true;
}

// ── 메뉴 CRUD ────────────────────────────────────────────────
type DbMenuRow   = { id: number; name: string; type: 'cafe' | 'food'; price: number; sort_order: number; stock: number | null };
type DbGroupRow  = { id: number; menu_item_id: number; name: string; required: number; max_qty: number };
type DbOptionRow = { id: number; group_id: number; name: string; price: number; linked_menu_item_id: number | null };

export function getMenuItems(): MenuItem[] {
  const items      = db.prepare('SELECT * FROM menu_items ORDER BY type, sort_order, id').all() as DbMenuRow[];
  const allGroups  = db.prepare('SELECT * FROM option_groups ORDER BY sort_order, id').all() as DbGroupRow[];
  const allOptions = db.prepare('SELECT * FROM option_items ORDER BY sort_order, id').all() as DbOptionRow[];

  const optsByGroup = new Map<number, OptionItem[]>();
  for (const o of allOptions) {
    if (!optsByGroup.has(o.group_id)) optsByGroup.set(o.group_id, []);
    optsByGroup.get(o.group_id)!.push({ id: o.id, name: o.name, price: o.price, linkedMenuItemId: o.linked_menu_item_id ?? null });
  }
  const groupsByItem = new Map<number, OptionGroup[]>();
  for (const g of allGroups) {
    if (!groupsByItem.has(g.menu_item_id)) groupsByItem.set(g.menu_item_id, []);
    groupsByItem.get(g.menu_item_id)!.push({ id: g.id, name: g.name, required: g.required === 1, maxQty: g.max_qty ?? 1, options: optsByGroup.get(g.id) ?? [] });
  }

  return items.map(r => ({ id: r.id, name: r.name, type: r.type, price: r.price, sortOrder: r.sort_order, stock: r.stock ?? null, optionGroups: groupsByItem.get(r.id) ?? [] }));
}

export function addMenuItem(name: string, type: 'cafe' | 'food', price: number, stock?: number | null): MenuItem {
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM menu_items WHERE type = ?').get(type) as { next: number }).next;
  const s = stock ?? null;
  const { lastInsertRowid: id } = db.prepare('INSERT INTO menu_items (name, type, price, sort_order, stock) VALUES (?, ?, ?, ?, ?)').run(name, type, price, maxOrder, s);
  return { id: Number(id), name, type, price, sortOrder: maxOrder, stock: s, optionGroups: [] };
}

export function setMenuStock(id: number, stock: number | null): void {
  db.prepare('UPDATE menu_items SET stock = ? WHERE id = ?').run(stock, id);
}

export function updateMenuItem(id: number, data: { name?: string; price?: number }): void {
  if (data.name !== undefined) db.prepare('UPDATE menu_items SET name = ? WHERE id = ?').run(data.name, id);
  if (data.price !== undefined) db.prepare('UPDATE menu_items SET price = ? WHERE id = ?').run(data.price, id);
}

export function editOrder(
  id: number,
  newCafeItems: Record<string, number>,
  newFoodItems: Record<string, number>,
  newItemOptions: Record<string, Record<string, Record<string, number>>>
): boolean {
  const order = state.orders.get(id);
  if (!order) return false;

  // cancelOrder/createOrder와 동일한 패턴: cafe+food 합산
  const linkedQtys = (
    cafeItems: Record<string, number>,
    foodItems: Record<string, number>,
    opts: Record<string, Record<string, Record<string, number>>>
  ): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const [itemName, groupMap] of Object.entries(opts)) {
      const parentQty = (cafeItems[itemName] ?? 0) + (foodItems[itemName] ?? 0);
      if (parentQty <= 0) continue;
      for (const optMap of Object.values(groupMap)) {
        for (const [optName, optQty] of Object.entries(optMap)) {
          if (optQty <= 0) continue;
          const linked = stmtGetLinkedItem.get(optName) as { name: string } | undefined;
          if (linked) result[linked.name] = (result[linked.name] ?? 0) + parentQty * optQty;
        }
      }
    }
    return result;
  };

  const oldLinked = linkedQtys(order.cafeItems, order.foodItems, order.itemOptions ?? {});
  const newLinked = linkedQtys(newCafeItems, newFoodItems, newItemOptions);

  const stmtRestore = db.prepare('UPDATE menu_items SET stock = stock + ? WHERE name = ? AND stock IS NOT NULL');
  const stmtDeduct  = db.prepare('UPDATE menu_items SET stock = MAX(0, stock - ?) WHERE name = ? AND stock IS NOT NULL');

  db.transaction(() => {
    // 직접 항목 재고 diff — baseName으로 집계해서 "(2)" suffix 붙은 항목도 올바르게 처리
    const oldAll = { ...order.cafeItems, ...order.foodItems };
    const newAll = { ...newCafeItems, ...newFoodItems };
    const diffByBase: Record<string, number> = {};
    for (const name of new Set([...Object.keys(oldAll), ...Object.keys(newAll)])) {
      const base = baseName(name);
      diffByBase[base] = (diffByBase[base] ?? 0) + (oldAll[name] ?? 0) - (newAll[name] ?? 0);
    }
    for (const [base, diff] of Object.entries(diffByBase)) {
      if (diff > 0) stmtRestore.run(diff, base);
      else if (diff < 0) stmtDeduct.run(-diff, base);
    }
    // 옵션 연동 재고 diff (linked.name은 이미 DB의 base name)
    for (const name of new Set([...Object.keys(oldLinked), ...Object.keys(newLinked)])) {
      const diff = (oldLinked[name] ?? 0) - (newLinked[name] ?? 0);
      if (diff > 0) stmtRestore.run(diff, name);
      else if (diff < 0) stmtDeduct.run(-diff, name);
    }
    db.prepare('UPDATE orders SET cafe_items = ?, food_items = ?, item_options = ? WHERE id = ?')
      .run(JSON.stringify(newCafeItems), JSON.stringify(newFoodItems), JSON.stringify(newItemOptions), id);
  })();

  order.cafeItems = newCafeItems;
  order.foodItems = newFoodItems;
  order.itemOptions = newItemOptions;
  broadcast();
  return true;
}

export function moveMenuItem(id: number, direction: 'up' | 'down'): void {
  const item = db.prepare('SELECT id, type, sort_order FROM menu_items WHERE id = ?').get(id) as { id: number; type: string; sort_order: number } | undefined;
  if (!item) return;
  const neighbor = db.prepare(
    direction === 'up'
      ? 'SELECT id, sort_order FROM menu_items WHERE type = ? AND sort_order < ? ORDER BY sort_order DESC LIMIT 1'
      : 'SELECT id, sort_order FROM menu_items WHERE type = ? AND sort_order > ? ORDER BY sort_order ASC LIMIT 1'
  ).get(item.type, item.sort_order) as { id: number; sort_order: number } | undefined;
  if (!neighbor) return;
  db.transaction(() => {
    db.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?').run(neighbor.sort_order, item.id);
    db.prepare('UPDATE menu_items SET sort_order = ? WHERE id = ?').run(item.sort_order, neighbor.id);
  })();
}

export function deleteMenuItem(id: number): boolean {
  const gids = (db.prepare('SELECT id FROM option_groups WHERE menu_item_id = ?').all(id) as { id: number }[]).map(r => r.id);
  db.transaction(() => {
    for (const gid of gids) db.prepare('DELETE FROM option_items WHERE group_id = ?').run(gid);
    db.prepare('DELETE FROM option_groups WHERE menu_item_id = ?').run(id);
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
  })();
  return true;
}

// ── 통계 / 내보내기 ──────────────────────────────────────────

// "세트메뉴 (2)" → "세트메뉴" (같은 주문에 여러 조합 담을 때 붙는 접미사 제거)
function baseName(name: string): string {
  return name.replace(/ \(\d+\)$/, '');
}

export function getStats() {
  const rows = db.prepare('SELECT cafe_items, food_items, item_options FROM orders WHERE cancelled = 0').all() as Array<{
    cafe_items: string; food_items: string; item_options: string;
  }>;
  const priceMap = new Map(
    (db.prepare('SELECT name, price FROM menu_items').all() as { name: string; price: number }[]).map(m => [m.name, m.price])
  );
  const cafeItems: Record<string, number> = {};
  const foodItems: Record<string, number> = {};
  const optionItems: Record<string, number> = {};
  let totalRevenue = 0;

  for (const row of rows) {
    try {
      for (const [n, q] of Object.entries(JSON.parse(row.cafe_items) as Record<string, number>))
        if (q > 0) { const k = baseName(n); cafeItems[k] = (cafeItems[k] ?? 0) + q; totalRevenue += (priceMap.get(k) ?? 0) * q; }
    } catch {}
    try {
      for (const [n, q] of Object.entries(JSON.parse(row.food_items) as Record<string, number>))
        if (q > 0) { const k = baseName(n); foodItems[k] = (foodItems[k] ?? 0) + q; totalRevenue += (priceMap.get(k) ?? 0) * q; }
    } catch {}
    let perRowCafe: Record<string, number> = {};
    let perRowFood: Record<string, number> = {};
    try { perRowCafe = JSON.parse(row.cafe_items); } catch {}
    try { perRowFood = JSON.parse(row.food_items); } catch {}
    try {
      const opts = JSON.parse(row.item_options || '{}') as Record<string, unknown>;
      for (const [itemName, groupMap] of Object.entries(opts)) {
        if (!groupMap || typeof groupMap !== 'object' || Array.isArray(groupMap)) continue;
        const parentQty = Math.max(1, (perRowCafe[itemName] ?? 0) + (perRowFood[itemName] ?? 0));
        for (const [, optMap] of Object.entries(groupMap as Record<string, unknown>)) {
          if (typeof optMap === 'string') {
            optionItems[optMap] = (optionItems[optMap] ?? 0) + parentQty;
          } else if (optMap && typeof optMap === 'object' && !Array.isArray(optMap)) {
            for (const [optName, qty] of Object.entries(optMap as Record<string, number>))
              if (qty > 0) optionItems[optName] = (optionItems[optName] ?? 0) + qty * parentQty;
          }
        }
      }
    } catch {}
  }
  return { totalOrders: rows.length, cafeItems, foodItems, optionItems, totalRevenue };
}

export function getItemSummary(): { name: string; qty: number; isOption: boolean }[] {
  const rows = db.prepare('SELECT cafe_items, food_items, item_options FROM orders WHERE cancelled = 0').all() as Array<{
    cafe_items: string; food_items: string; item_options: string;
  }>;
  const direct: Record<string, number> = {};
  const options: Record<string, number> = {};

  for (const row of rows) {
    let cafe: Record<string, number> = {};
    let food: Record<string, number> = {};
    let opts: Record<string, unknown> = {};
    try { cafe = JSON.parse(row.cafe_items); } catch {}
    try { food = JSON.parse(row.food_items); } catch {}
    try { opts = JSON.parse(row.item_options || '{}'); } catch {}

    for (const [n, q] of Object.entries(cafe)) if (q > 0) { const k = baseName(n); direct[k] = (direct[k] ?? 0) + q; }
    for (const [n, q] of Object.entries(food)) if (q > 0) { const k = baseName(n); direct[k] = (direct[k] ?? 0) + q; }

    for (const [itemName, groupMap] of Object.entries(opts)) {
      if (!groupMap || typeof groupMap !== 'object' || Array.isArray(groupMap)) continue;
      const parentQty = Math.max(1, (cafe[itemName] ?? 0) + (food[itemName] ?? 0));
      for (const [, optMap] of Object.entries(groupMap as Record<string, unknown>)) {
        if (typeof optMap === 'string') {
          options[optMap] = (options[optMap] ?? 0) + parentQty;
        } else if (optMap && typeof optMap === 'object' && !Array.isArray(optMap)) {
          for (const [optName, qty] of Object.entries(optMap as Record<string, number>))
            if (qty > 0) options[optName] = (options[optName] ?? 0) + qty * parentQty;
        }
      }
    }
  }

  return [
    ...Object.entries(direct).map(([name, qty]) => ({ name, qty, isOption: false })),
    ...Object.entries(options).map(([name, qty]) => ({ name, qty, isOption: true })),
  ];
}

export function getOrdersForExport() {
  const priceMap = new Map(
    (db.prepare('SELECT name, price FROM menu_items').all() as { name: string; price: number }[]).map(m => [m.name, m.price])
  );
  const rows = db.prepare('SELECT * FROM orders ORDER BY id').all() as DbRow[];

  return rows.map(r => {
    const d = new Date(r.created_at);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    const payment = r.payment_method === 'transfer' ? '계좌이체' : '현금';
    if (r.cancelled) return { id: r.id, date: dateStr, items: '취소', options: '', total: 0, payment };

    let cafeItems: Record<string, number> = {};
    let foodItems: Record<string, number> = {};
    try { cafeItems = JSON.parse(r.cafe_items); } catch {}
    try { foodItems = JSON.parse(r.food_items); } catch {}
    let rawOpts: Record<string, unknown> = {};
    try { rawOpts = JSON.parse(r.item_options || '{}'); } catch { /* empty */ }

    let total = 0;
    for (const [n, q] of Object.entries(cafeItems)) if (q > 0) total += (priceMap.get(n) ?? 0) * q;
    for (const [n, q] of Object.entries(foodItems)) if (q > 0) total += (priceMap.get(n) ?? 0) * q;

    const itemsList = [
      ...Object.entries(cafeItems).filter(([, q]) => q > 0).map(([n, q]) => q > 1 ? `${n}×${q}` : n),
      ...Object.entries(foodItems).filter(([, q]) => q > 0).map(([n, q]) => q > 1 ? `${n}×${q}` : n),
    ].join(', ');

    const optionsStr = Object.entries(rawOpts)
      .filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))
      .map(([, v]) => Object.entries(v as Record<string, unknown>).map(([gk, gv]) => {
        if (typeof gv === 'string') return `${gk}:${gv}`;
        if (gv && typeof gv === 'object' && !Array.isArray(gv)) {
          const parts = Object.entries(gv as Record<string, number>).filter(([, q]) => q > 0).map(([n, q]) => q > 1 ? `${n}×${q}` : n).join('+');
          return parts ? `${gk}:${parts}` : null;
        }
        return null;
      }).filter(Boolean).join(', '))
      .join('; ');

    return { id: r.id, date: dateStr, items: itemsList, options: optionsStr, total, payment };
  });
}

export function cancelOrder(id: number): boolean {
  const order = state.orders.get(id);
  if (!order) return false;

  const { cafeSlot, foodSlot, cafePickupSlot, foodPickupSlot } = order;
  if (cafeSlot)        state.cafeSlots[cafeSlot - 1]               = null;
  if (foodSlot)        state.foodSlots[foodSlot - 1]               = null;
  if (cafePickupSlot)  state.cafePickupSlots[cafePickupSlot - 1]   = null;
  if (foodPickupSlot)  state.foodPickupSlots[foodPickupSlot - 1]   = null;

  state.orders.delete(id);
  const stmtRestoreStock = db.prepare('UPDATE menu_items SET stock = stock + ? WHERE name = ? AND stock IS NOT NULL');
  db.transaction(() => {
    db.prepare('UPDATE orders SET cancelled = 1 WHERE id = ?').run(id);
    for (const [name, qty] of Object.entries(order.cafeItems)) if (qty > 0) stmtRestoreStock.run(qty, name);
    for (const [name, qty] of Object.entries(order.foodItems)) if (qty > 0) stmtRestoreStock.run(qty, name);
    // 옵션에 연동된 메뉴 아이템 재고 복원
    for (const [itemName, groupMap] of Object.entries(order.itemOptions ?? {})) {
      const parentQty = (order.cafeItems[itemName] ?? 0) + (order.foodItems[itemName] ?? 0);
      if (parentQty <= 0 || !groupMap) continue;
      for (const optMap of Object.values(groupMap as Record<string, Record<string, number>>)) {
        if (!optMap) continue;
        for (const [optName, optQty] of Object.entries(optMap)) {
          if (optQty <= 0) continue;
          const linked = stmtGetLinkedItem.get(optName) as { name: string } | undefined;
          if (linked) stmtRestoreStock.run(parentQty * optQty, linked.name);
        }
      }
    }
  })();

  // 빈 슬롯에 오버플로우 주문 배정
  if (cafeSlot) {
    const next = Array.from(state.orders.values()).filter(o => o.cafeStatus === 'preparing' && !o.cafeSlot).sort((a, b) => a.createdAt - b.createdAt)[0];
    if (next) assignSlot(state.cafeSlots, next, 'cafeSlot');
  }
  if (foodSlot) {
    const next = Array.from(state.orders.values()).filter(o => o.foodStatus === 'preparing' && !o.foodSlot).sort((a, b) => a.createdAt - b.createdAt)[0];
    if (next) assignSlot(state.foodSlots, next, 'foodSlot');
  }
  if (cafePickupSlot) {
    const next = Array.from(state.orders.values()).filter(o => (o.cafeStatus === 'preparing' || o.cafeStatus === 'ready') && !o.cafePickupSlot).sort((a, b) => a.createdAt - b.createdAt)[0];
    if (next) assignSlot(state.cafePickupSlots, next, 'cafePickupSlot');
  }
  if (foodPickupSlot) {
    const next = Array.from(state.orders.values()).filter(o => (o.foodStatus === 'preparing' || o.foodStatus === 'ready') && !o.foodPickupSlot).sort((a, b) => a.createdAt - b.createdAt)[0];
    if (next) assignSlot(state.foodPickupSlots, next, 'foodPickupSlot');
  }

  broadcast();
  return true;
}

export function resetOrders(): void {
  db.prepare('DELETE FROM orders').run(); // 취소 포함 전체 삭제 (행사 초기화용)
  state.orders.clear();
  state.nextId = 1;
  state.cafeSlots        = Array(10).fill(null);
  state.foodSlots        = Array(10).fill(null);
  state.cafePickupSlots  = Array(10).fill(null);
  state.foodPickupSlots  = Array(10).fill(null);
  broadcast();
}
