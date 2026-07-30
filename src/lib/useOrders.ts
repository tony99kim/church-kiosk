'use client';
import { useState, useEffect } from 'react';
import type { Order } from './store';

export function useOrders(): Order[] {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    if (typeof SharedWorker === 'undefined') {
      // fallback: older browsers (e.g. iOS Safari < 16)
      const es = new EventSource('/api/events');
      es.onmessage = (e) => setOrders(JSON.parse(e.data));
      return () => es.close();
    }
    const worker = new SharedWorker('/sse-worker.js');
    worker.port.onmessage = (e) => setOrders(JSON.parse(e.data));
    worker.port.start();
    return () => worker.port.close();
  }, []);
  return orders;
}

export function formatItems(items: Record<string, number>): string {
  return Object.entries(items)
    .filter(([, n]) => n > 0)
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(' / ');
}
