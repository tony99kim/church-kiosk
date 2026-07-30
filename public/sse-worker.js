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
  es.onerror = () => {
    es.close();
    es = null;
    // 포트가 없어도 일정 시간 후 재연결 유지 (탭이 늦게 붙는 경우 대비)
    setTimeout(connect, 2000);
  };
}

self.onconnect = (e) => {
  const port = e.ports[0];
  ports.add(port);
  port.start();
  if (lastData) port.postMessage(lastData);
  if (!es) connect();
  port.onmessageerror = () => ports.delete(port);
};

// 워커가 처음 로드될 때 바로 연결 시작
connect();
