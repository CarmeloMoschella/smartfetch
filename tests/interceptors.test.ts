import { SmartFetchClient } from '../src';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('SmartFetch Interceptors', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockImplementation(() => Promise.resolve(jsonResponse({ success: true })));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('debe permitir añadir un interceptor de request y modificar la configuración', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });

    client.interceptors.request.use((config) => {
      config.headers = {
        ...config.headers,
        Authorization: 'Bearer token123',
      };
      return config;
    });

    await client.get('/test');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token123',
        }),
      })
    );
  });

  it('debe ejecutar los interceptores de request en orden inverso (Axios style)', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });
    const executionOrder: string[] = [];

    client.interceptors.request.use((config) => {
      executionOrder.push('primero');
      return config;
    });

    client.interceptors.request.use((config) => {
      executionOrder.push('segundo');
      return config;
    });

    await client.get('/test');

    expect(executionOrder).toEqual(['segundo', 'primero']);
  });

  it('debe permitir añadir un interceptor de response y modificar la respuesta', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });

    client.interceptors.response.use((response) => {
      response.data = { ...response.data, added: 'yes' };
      return response;
    });

    const res = await client.get('/test');

    expect(res.data).toEqual({ success: true, added: 'yes' });
  });

  it('debe ejecutar los interceptores de response en el orden de registro (Axios style)', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });
    const executionOrder: string[] = [];

    client.interceptors.response.use((response) => {
      executionOrder.push('primero');
      return response;
    });

    client.interceptors.response.use((response) => {
      executionOrder.push('segundo');
      return response;
    });

    await client.get('/test');

    expect(executionOrder).toEqual(['primero', 'segundo']);
  });

  it('debe permitir expulsar (eject) un interceptor registrado', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });
    const executionOrder: string[] = [];

    const id = client.interceptors.request.use((config) => {
      executionOrder.push('no-debe-ejecutarse');
      return config;
    });

    client.interceptors.request.use((config) => {
      executionOrder.push('debe-ejecutarse');
      return config;
    });

    client.interceptors.request.eject(id);

    await client.get('/test');

    expect(executionOrder).toEqual(['debe-ejecutarse']);
  });

  it('debe propagar errores si el interceptor de request falla y no invocar fetch', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });

    client.interceptors.request.use(() => {
      throw new Error('Error en interceptor');
    });

    await expect(client.get('/test')).rejects.toThrow('Error en interceptor');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('debe permitir que un interceptor de response maneje errores', async () => {
    const client = new SmartFetchClient({ baseURL: 'https://api.test' });
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

    client.interceptors.response.use(
      (res) => res,
      (error) => {
        return {
          data: { fallback: true },
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
        };
      }
    );

    const res = await client.get('/test');

    expect(res.data).toEqual({ fallback: true });
    expect(res.status).toBe(200);
  });
});
