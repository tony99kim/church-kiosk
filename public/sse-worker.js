const ports = new Set();
let es = null;
let lastData = null;

function connect() {
  es = new EventSource('/api/events');
  es.onmessage = (e) => {
    lastData = e.data;
    const dead = [];
    for (const port of ports) {
      try { port.postMessage(e.data); } catch { dead.push(port); }
    }
    dead.forEach(p => ports.delete(p));
  };
  es.onerror = () => { es.close(); es = null; setTimeout(connect, 2000); };
}

self.onconnect = (e) => {
  const port = e.ports[0];
  ports.add(port);
  port.start();
  if (lastData) port.postMessage(lastData);
  if (!es) connect();
};
