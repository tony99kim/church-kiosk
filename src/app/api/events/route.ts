import { addClient, removeClient, getOrders } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let send: ((data: string) => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {}
      };
      addClient(send);
      send(JSON.stringify(getOrders()));
    },
    cancel() {
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
