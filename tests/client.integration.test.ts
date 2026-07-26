import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { SmartFetchClient } from '../src';

function startServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

describe('SmartFetchClient (integración con servidor HTTP real)', () => {
  it('hace un GET real y parsea la respuesta JSON', async () => {
    const server = await startServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: req.url }));
    });

    try {
      const client = new SmartFetchClient({ baseURL: server.url });
      const response = await client.get<{ path: string }>('/status');

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ path: '/status' });
    } finally {
      await server.close();
    }
  });

  it('envía el body en un POST real y el servidor lo recibe', async () => {
    const received: unknown[] = [];
    const server = await startServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        received.push(JSON.parse(raw));
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ created: true }));
      });
    });

    try {
      const client = new SmartFetchClient({ baseURL: server.url });
      const response = await client.post('/users', { body: { name: 'Ada' } });

      expect(response.status).toBe(201);
      expect(received).toEqual([{ name: 'Ada' }]);
    } finally {
      await server.close();
    }
  });

  it('cancela la petición por timeout si el servidor no responde a tiempo', async () => {
    const server = await startServer((_req, res) => {
      setTimeout(() => res.end('tarde'), 500);
    });

    try {
      const client = new SmartFetchClient({ baseURL: server.url, timeout: 50 });
      await expect(client.get('/lento')).rejects.toMatchObject({ isTimeout: true });
    } finally {
      await server.close();
    }
  });

  it('reintenta ante 500 y termina devolviendo la respuesta exitosa del servidor', async () => {
    let requestCount = 0;
    const server = await startServer((_req, res) => {
      requestCount += 1;
      if (requestCount < 2) {
        res.writeHead(500);
        res.end('fallo temporal');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });

    try {
      const client = new SmartFetchClient({ baseURL: server.url, retries: 1 });
      const response = await client.get<{ ok: boolean }>('/inestable');

      expect(response.data).toEqual({ ok: true });
      expect(requestCount).toBe(2);
    } finally {
      await server.close();
    }
  });

  it('propaga un SmartFetchError con status 404 sin reintentar', async () => {
    let requestCount = 0;
    const server = await startServer((_req, res) => {
      requestCount += 1;
      res.writeHead(404);
      res.end('no encontrado');
    });

    try {
      const client = new SmartFetchClient({ baseURL: server.url, retries: 3 });
      await expect(client.get('/no-existe')).rejects.toMatchObject({ status: 404 });
      expect(requestCount).toBe(1);
    } finally {
      await server.close();
    }
  });
});
