import { SmartFetchClient, SmartFetchError } from '../src';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('SmartFetchClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('se instancia con configuración por defecto', () => {
    const client = new SmartFetchClient();
    expect(client).toBeInstanceOf(SmartFetchClient);
  });

  it('hace un GET exitoso y normaliza la respuesta', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ id: 1 }));

    const client = new SmartFetchClient({ baseURL: 'https://api.test' });
    const response = await client.get<{ id: number }>('/users/1');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test/users/1',
      expect.objectContaining({ method: 'GET' })
    );
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ id: 1 });
  });

  it('agrega los query params a la URL', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}));

    const client = new SmartFetchClient({ baseURL: 'https://api.test' });
    await client.get('/search', { params: { q: 'smartfetch', page: 2 } });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test/search?q=smartfetch&page=2',
      expect.anything()
    );
  });

  it('serializa el body como JSON y agrega Content-Type en POST', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ ok: true }, { status: 201 }));

    const client = new SmartFetchClient({ baseURL: 'https://api.test' });
    const response = await client.post('/users', { body: { name: 'Ada' } });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Ada' }),
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
    expect(response.status).toBe(201);
  });

  it.each(['put', 'patch', 'delete'] as const)(
    'expone el método %s',
    async (method) => {
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = new SmartFetchClient({ baseURL: 'https://api.test' });

      await client[method]('/users/1', { body: { name: 'Ada' } });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test/users/1',
        expect.objectContaining({ method: method.toUpperCase() })
      );
    }
  );

  it('lanza SmartFetchError con el status ante una respuesta 4xx, sin reintentar', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('not found', { status: 404, statusText: 'Not Found' })
    );

    const client = new SmartFetchClient({ baseURL: 'https://api.test', retries: 3 });

    await expect(client.get('/missing')).rejects.toMatchObject({
      name: 'SmartFetchError',
      status: 404,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reintenta ante 5xx hasta agotar los intentos y luego lanza SmartFetchError', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('boom', { status: 503, statusText: 'Service Unavailable' })
    );

    const client = new SmartFetchClient({ baseURL: 'https://api.test', retries: 2 });

    await expect(client.get('/flaky')).rejects.toMatchObject({
      name: 'SmartFetchError',
      status: 503,
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('reintenta ante 5xx y termina devolviendo la respuesta exitosa', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ recovered: true }));

    const client = new SmartFetchClient({ baseURL: 'https://api.test', retries: 1 });
    const response = await client.get<{ recovered: boolean }>('/flaky');

    expect(response.data).toEqual({ recovered: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('lanza SmartFetchError con isTimeout cuando la petición excede el timeout', async () => {
    global.fetch = jest.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        })
    );

    const client = new SmartFetchClient({ baseURL: 'https://api.test', timeout: 10 });

    await expect(client.get('/slow')).rejects.toMatchObject({
      name: 'SmartFetchError',
      isTimeout: true,
    });
  });

  it('envuelve errores de red inesperados en SmartFetchError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('network error'));

    const client = new SmartFetchClient({ baseURL: 'https://api.test' });

    await expect(client.get('/down')).rejects.toBeInstanceOf(SmartFetchError);
  });
});
