import { SmartFetchClient } from '../src';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('SmartFetch Deduplication', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Configurar fetch con delay para simular peticiones concurrentes en vuelo
    global.fetch = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(jsonResponse({ data: 'ok' }));
        }, 50);
      });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('debe deduplicar peticiones GET simultáneas idénticas y hacer una sola llamada de red', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });

    const [res1, res2, res3] = await Promise.all([
      client.get('/resource'),
      client.get('/resource'),
      client.get('/resource'),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res1.data).toEqual({ data: 'ok' });
    expect(res2.data).toEqual({ data: 'ok' });
    expect(res3.data).toEqual({ data: 'ok' });
  });

  it('debe limpiar los registros en vuelo al terminar, permitiendo que peticiones posteriores hagan nuevas llamadas', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });

    // Primera ronda simultánea
    await Promise.all([
      client.get('/resource'),
      client.get('/resource'),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Segunda ronda después de que terminaron las primeras
    await client.get('/resource');

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('no debe deduplicar si dedupe es explicitamente false', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });

    await Promise.all([
      client.get('/resource', { dedupe: false }),
      client.get('/resource', { dedupe: false }),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('no debe deduplicar llamadas GET con diferentes query params o URLs', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });

    await Promise.all([
      client.get('/resource', { params: { id: 1 } }),
      client.get('/resource', { params: { id: 2 } }),
      client.get('/other-resource'),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('no debe deduplicar peticiones POST por defecto', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });

    await Promise.all([
      client.post('/resource', { body: { val: 1 } }),
      client.post('/resource', { body: { val: 1 } }),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('debe deduplicar peticiones POST si se habilita dedupe explícitamente', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });

    await Promise.all([
      client.post('/resource', { body: { val: 1 }, dedupe: true }),
      client.post('/resource', { body: { val: 1 }, dedupe: true }),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
