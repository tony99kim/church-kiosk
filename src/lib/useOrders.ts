'use client';
import { useState, useEffect } from 'react';
import type { Order } from './store';

function safeParse(data: string): Order[] | null {
  try { return JSON.parse(data); } catch { return null; }
}

export function useOrders(): Order[] {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (typeof SharedWorker === 'undefined') {
      let es: EventSource;
      let dead = false;

      const connect = () => {
        if (dead) return;
        es = new EventSource('/api/events');
        es.onmessage = (e) => { const o = safeParse(e.data); if (o) setOrders(o); };
        es.onerror = () => { es.close(); if (!dead) setTimeout(connect, 2000); };
      };
      connect();
      return () => { dead = true; es?.close(); };
    }

    const worker = new SharedWorker('/sse-worker.js');
    worker.port.onmessage = (e) => { const o = safeParse(e.data); if (o) setOrders(o); };
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
