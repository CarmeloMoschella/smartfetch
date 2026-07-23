import { RequestConfig, SmartFetchConfig, SmartFetchResponse } from './types';

// TODO(core): implementar el método privado request() y los métodos
// públicos GET/POST/PUT/PATCH/DELETE usando fetch internamente.
// Debe soportar async/await y encadenamiento de promesas (.then).

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

  public get<T = unknown>(
    _url: string,
    _config?: RequestConfig
  ): Promise<SmartFetchResponse<T>> {
    throw new Error('get: not implemented');
  }

  public post<T = unknown>(
    _url: string,
    _config?: RequestConfig
  ): Promise<SmartFetchResponse<T>> {
    throw new Error('post: not implemented');
  }

  public put<T = unknown>(
    _url: string,
    _config?: RequestConfig
  ): Promise<SmartFetchResponse<T>> {
    throw new Error('put: not implemented');
  }

  public patch<T = unknown>(
    _url: string,
    _config?: RequestConfig
  ): Promise<SmartFetchResponse<T>> {
    throw new Error('patch: not implemented');
  }

  public delete<T = unknown>(
    _url: string,
    _config?: RequestConfig
  ): Promise<SmartFetchResponse<T>> {
    throw new Error('delete: not implemented');
  }
}
