'use client';
import { useState, useEffect } from 'react';
import type { Order } from './store';

export function useOrders(): Order[] {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => setOrders(JSON.parse(e.data));
    return () => es.close();
  }, []);
  return orders;
}

export function formatItems(items: Record<string, number>): string {
  return Object.entries(items)
    .filter(([, n]) => n > 0)
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(' / ');
}
