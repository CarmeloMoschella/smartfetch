import { SmartFetchClient } from '../src';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('SmartFetch Caching', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(jsonResponse({ val: 'initial' })));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('debe almacenar en caché peticiones GET y respetar el TTL (cacheTime)', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test', cacheTime: 100 });

    // Primera llamada - va a la red
    const res1 = await client.get('/resource');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res1.data).toEqual({ val: 'initial' });

    // Cambiamos el valor de la red
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(jsonResponse({ val: 'updated' })));

    // Segunda llamada - debe venir de la caché
    const res2 = await client.get('/resource');
    expect(global.fetch).toHaveBeenCalledTimes(0);
    expect(res2.data).toEqual({ val: 'initial' });

    // Esperamos a que pase el TTL (100ms)
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Tercera llamada - expiró, debe ir a la red
    const res3 = await client.get('/resource');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res3.data).toEqual({ val: 'updated' });
  });

  it('debe servir datos obsoletos y revalidar en segundo plano con SWR', async () => {
    const client = new SmartFetchClient({
      baseURL: 'https://api.test',
      cacheTime: 50,
      staleWhileRevalidate: true,
    });

    // Primera llamada - va a la red
    await client.get('/resource');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Cambiamos el valor de red para la revalidación
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(jsonResponse({ val: 'fresh-swr' })));

    // Esperamos que expire el TTL
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Segunda llamada - debe resolver inmediatamente con el dato obsoleto
    // y disparar la revalidación en segundo plano.
    const res2 = await client.get('/resource');
    expect(res2.data).toEqual({ val: 'initial' });
    
    // Verificamos que se llamó a la red
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Damos un tiempo mínimo para que la promesa en segundo plano termine e incremente la caché
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Tercera llamada (dentro del nuevo TTL) - debe servir el dato fresco revalidado
    global.fetch = jest.fn(); // Asegurar que no se llame a red esta vez
    const res3 = await client.get('/resource');
    expect(res3.data).toEqual({ val: 'fresh-swr' });
    expect(global.fetch).toHaveBeenCalledTimes(0);
  });

  it('debe invalidar la caché relacionada de manera agresiva ante mutaciones', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test', cacheTime: 5000 });

    // Llenar caché para /posts, /posts/1 y /users
    await client.get('/posts');
    await client.get('/posts/1');
    await client.get('/users');

    expect(global.fetch).toHaveBeenCalledTimes(3);

    // Cambiar respuestas de red
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(jsonResponse({ mutated: true })));

    // Hacer una mutación (PUT) en /posts/1
    await client.put('/posts/1', { body: {} });

    // Limpiar el historial para contar únicamente las llamadas de la siguiente petición
    (global.fetch as any).mockClear();

    // Intentar leer /posts/1 -> debe ir a la red porque fue invalidada
    await client.get('/posts/1');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Limpiar el historial antes de la siguiente comprobación
    (global.fetch as any).mockClear();

    // Intentar leer /posts -> debe ir a la red porque su subruta fue invalidada
    await client.get('/posts');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Limpiar el historial antes de la siguiente comprobación
    (global.fetch as any).mockClear();

    // Intentar leer /users -> debe venir de la caché (no ha cambiado, por lo tanto 0 llamadas a red)
    const resUsers = await client.get('/users');
    expect(global.fetch).toHaveBeenCalledTimes(0);
    expect(resUsers.data).toEqual({ val: 'initial' });
  });

  it('debe poder limpiar la caché manualmente con cache.clear()', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test', cacheTime: 1000 });

    await client.get('/resource');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    client.cache.clear();

    await client.get('/resource');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
