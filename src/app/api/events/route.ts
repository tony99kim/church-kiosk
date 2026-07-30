import { addClient, removeClient, getOrders } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let send: ((data: string) => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {}
      };
      addClient(send);
      send(JSON.stringify(getOrders()));

      // nginx/ALB 기본 60초 idle timeout 방지 — 25초마다 ping
      heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch {}
      }, 25_000);
    },
    cancel() {
      clearInterval(heartbeat);
      if (send) removeClient(send);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
