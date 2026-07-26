import {
  HttpMethod,
  RequestConfig,
  SmartFetchConfig,
  SmartFetchError,
  SmartFetchResponse,
  InternalRequestConfig,
} from './types';
import { withTimeout } from './timeout';
import { withRetry } from './retry';
import { InterceptorManager } from './interceptors';
import { RequestDeduplicator } from './dedupe';
import { ResponseCache } from './cache';

/**
 * Cliente HTTP de alto nivel construido sobre fetch.
 */
export class SmartFetchClient {
  private readonly config: SmartFetchConfig;
  private readonly deduplicator = new RequestDeduplicator();
  public readonly cache = new ResponseCache();

  public readonly interceptors = {
    request: new InterceptorManager<InternalRequestConfig>(),
    response: new InterceptorManager<SmartFetchResponse<any>>(),
  };

  constructor(config: SmartFetchConfig = {}) {
    this.config = {
      timeout: 0,
      retries: 0,
      ...config,
    };
  }

  /**
   * Realiza una petición GET.
   *
   * @param url Ruta o URL completa del recurso.
   * @param config Configuración específica de la petición.
   * @returns Promesa con la respuesta normalizada.
   * @throws {SmartFetchError} Ante timeout, error de red o respuesta no exitosa.
   */
  public get<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<SmartFetchResponse<T>> {
    return this.request<T>('GET', url, config);
  }

  /**
   * Realiza una petición POST.
   *
   * @param url Ruta o URL completa del recurso.
   * @param config Configuración específica de la petición (usar `body` para el payload).
   * @returns Promesa con la respuesta normalizada.
   * @throws {SmartFetchError} Ante timeout, error de red o respuesta no exitosa.
   */
  public post<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<SmartFetchResponse<T>> {
    return this.request<T>('POST', url, config);
  }

  /**
   * Realiza una petición PUT.
   *
   * @param url Ruta o URL completa del recurso.
   * @param config Configuración específica de la petición (usar `body` para el payload).
   * @returns Promesa con la respuesta normalizada.
   * @throws {SmartFetchError} Ante timeout, error de red o respuesta no exitosa.
   */
  public put<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<SmartFetchResponse<T>> {
    return this.request<T>('PUT', url, config);
  }

  /**
   * Realiza una petición PATCH.
   *
   * @param url Ruta o URL completa del recurso.
   * @param config Configuración específica de la petición (usar `body` para el payload).
   * @returns Promesa con la respuesta normalizada.
   * @throws {SmartFetchError} Ante timeout, error de red o respuesta no exitosa.
   */
  public patch<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<SmartFetchResponse<T>> {
    return this.request<T>('PATCH', url, config);
  }

  /**
   * Realiza una petición DELETE.
   *
   * @param url Ruta o URL completa del recurso.
   * @param config Configuración específica de la petición.
   * @returns Promesa con la respuesta normalizada.
   * @throws {SmartFetchError} Ante timeout, error de red o respuesta no exitosa.
   */
  public delete<T = unknown>(
    url: string,
    config?: RequestConfig
  ): Promise<SmartFetchResponse<T>> {
    return this.request<T>('DELETE', url, config);
  }

  /**
   * Ejecuta la petición HTTP combinando timeout y reintentos automáticos.
   *
   * @param method Método HTTP a utilizar.
   * @param url Ruta o URL completa del recurso.
   * @param config Configuración específica de la petición.
   * @returns Promesa con la respuesta normalizada.
   * @throws {SmartFetchError} Ante timeout, error de red o respuesta no exitosa.
   */
  private async request<T>(
    method: HttpMethod,
    url: string,
    config: RequestConfig = {}
  ): Promise<SmartFetchResponse<T>> {
    const initialConfig: InternalRequestConfig = {
      ...config,
      url,
      method,
      headers: {
        ...this.config.headers,
        ...config.headers,
      },
      params: config.params ?? {},
      timeout: config.timeout ?? this.config.timeout ?? 0,
      retries: config.retries ?? this.config.retries ?? 0,
      dedupe: config.dedupe ?? this.config.dedupe ?? (method === 'GET'),
      cacheTime: config.cacheTime ?? this.config.cacheTime ?? 0,
      staleWhileRevalidate: config.staleWhileRevalidate ?? this.config.staleWhileRevalidate ?? false,
    };

    // Armar cadena de interceptores
    const requestChain: any[] = [];
    this.interceptors.request.forEach((interceptor) => {
      requestChain.unshift(interceptor.fulfilled, interceptor.rejected);
    });

    const responseChain: any[] = [];
    this.interceptors.response.forEach((interceptor) => {
      responseChain.push(interceptor.fulfilled, interceptor.rejected);
    });

    let promise = Promise.resolve(initialConfig);

    while (requestChain.length > 0) {
      const fulfilled = requestChain.shift();
      const rejected = requestChain.shift();
      promise = promise.then(fulfilled, rejected);
    }

    let responsePromise = promise.then((finalConfig) => {
      const fullUrl = this.buildUrl(finalConfig.url, finalConfig.params);

      // Invalidador de mutaciones relacionado antes de despachar
      if (finalConfig.method !== 'GET') {
        this.cache.invalidateRelated(fullUrl);
      }

      const cacheTime = finalConfig.cacheTime ?? 0;
      const useCache = finalConfig.method === 'GET' && cacheTime > 0;

      if (useCache) {
        const cacheKey = `${finalConfig.method}:${fullUrl}`;
        const entry = this.cache.getEntry<T>(cacheKey);

        if (entry) {
          const now = Date.now();
          const isFresh = now < entry.expiresAt;

          if (isFresh) {
            const cachedRes = {
              ...entry.response,
              headers: new Headers(entry.response.headers),
            };
            cachedRes.headers.set('X-Cache', 'HIT');
            return cachedRes;
          }

          if (finalConfig.staleWhileRevalidate) {
            this.triggerBackgroundRevalidate<T>(finalConfig, fullUrl, cacheKey, cacheTime);
            const cachedRes = {
              ...entry.response,
              headers: new Headers(entry.response.headers),
            };
            cachedRes.headers.set('X-Cache', 'SWR-HIT');
            return cachedRes;
          }
        }
      }

      const dispatch = () => {
        if (finalConfig.dedupe) {
          const key = `${finalConfig.method}:${fullUrl}`;
          return this.deduplicator.execute(key, () => this.dispatchRequest<T>(finalConfig, fullUrl));
        }
        return this.dispatchRequest<T>(finalConfig, fullUrl);
      };

      if (useCache) {
        const cacheKey = `${finalConfig.method}:${fullUrl}`;
        return dispatch().then((res) => {
          this.cache.set(cacheKey, res, cacheTime);
          const cacheRes = {
            ...res,
            headers: new Headers(res.headers),
          };
          cacheRes.headers.set('X-Cache', 'MISS');
          return cacheRes;
        });
      }

      return dispatch();
    });

    while (responseChain.length > 0) {
      const fulfilled = responseChain.shift();
      const rejected = responseChain.shift();
      responsePromise = responsePromise.then(fulfilled, rejected);
    }

    return responsePromise;
  }

  /**
   * Ejecuta la petición en segundo plano para revalidar la caché.
   * Silencia cualquier error para evitar interrumpir al cliente.
   */
  private triggerBackgroundRevalidate<T>(
    config: InternalRequestConfig,
    fullUrl: string,
    cacheKey: string,
    cacheTime: number
  ): void {
    const dispatch = () => {
      if (config.dedupe) {
        const key = `${config.method}:${fullUrl}`;
        return this.deduplicator.execute(key, () => this.dispatchRequest<T>(config, fullUrl));
      }
      return this.dispatchRequest<T>(config, fullUrl);
    };

    dispatch()
      .then((res) => {
        this.cache.set(cacheKey, res, cacheTime);
      })
      .catch((err) => {
        console.warn(`[SmartFetch Cache] Background revalidation failed for ${fullUrl}`, err);
      });
  }

  /**
   * Ejecuta la petición HTTP real combinando timeout y reintentos automáticos.
   */
  private async dispatchRequest<T>(
    config: InternalRequestConfig,
    fullUrl: string
  ): Promise<SmartFetchResponse<T>> {
    const headers = { ...config.headers };
    const hasBody = config.body !== undefined && config.method !== 'GET' && config.method !== 'DELETE';
    if (hasBody && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const executor = (signal: AbortSignal): Promise<Response> =>
      fetch(fullUrl, {
        method: config.method,
        headers,
        body: hasBody ? JSON.stringify(config.body) : undefined,
        signal,
      });

    let response: Response;
    try {
      response = await withRetry(
        () => withTimeout(executor, config.timeout ?? 0),
        config.retries ?? 0
      );
    } catch (error) {
      throw this.toSmartFetchError(error);
    }

    return this.parseResponse<T>(response);
  }

  private buildUrl(url: string, params?: RequestConfig['params']): string {
    const base = this.config.baseURL ? `${this.config.baseURL}${url}` : url;
    if (!params || Object.keys(params).length === 0) {
      return base;
    }

    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)])
    ).toString();

    return `${base}${base.includes('?') ? '&' : '?'}${query}`;
  }

  private async parseResponse<T>(response: Response): Promise<SmartFetchResponse<T>> {
    const data = await this.parseBody<T>(response);

    if (!response.ok) {
      throw new SmartFetchError(
        `La petición respondió con estado ${response.status}`,
        response.status
      );
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    };
  }

  private async parseBody<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  }

  private toSmartFetchError(error: unknown): SmartFetchError {
    if (error instanceof SmartFetchError) {
      return error;
    }
    const err = error as { message?: string; status?: number };
    return new SmartFetchError(err.message ?? 'Error de red desconocido', err.status);
  }
}
