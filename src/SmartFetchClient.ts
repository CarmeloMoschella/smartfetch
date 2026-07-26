import {
  HttpMethod,
  RequestConfig,
  SmartFetchConfig,
  SmartFetchError,
  SmartFetchResponse,
} from './types';
import { withTimeout } from './timeout';
import { withRetry } from './retry';

/**
 * Cliente HTTP de alto nivel construido sobre fetch.
 */
export class SmartFetchClient {
  private readonly config: SmartFetchConfig;

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
    const timeout = config.timeout ?? this.config.timeout ?? 0;
    const retries = config.retries ?? this.config.retries ?? 0;
    const fullUrl = this.buildUrl(url, config.params);
    const headers: Record<string, string> = {
      ...this.config.headers,
      ...config.headers,
    };

    const hasBody = config.body !== undefined && method !== 'GET' && method !== 'DELETE';
    if (hasBody && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const executor = (signal: AbortSignal): Promise<Response> =>
      fetch(fullUrl, {
        method,
        headers,
        body: hasBody ? JSON.stringify(config.body) : undefined,
        signal,
      });

    let response: Response;
    try {
      response = await withRetry(() => withTimeout(executor, timeout), retries);
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
