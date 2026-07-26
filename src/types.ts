export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Configuración global del cliente SmartFetch.
 */
export interface SmartFetchConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  dedupe?: boolean;
  cacheTime?: number;
  staleWhileRevalidate?: boolean;
}

/**
 * Configuración específica de una petición individual.
 * Sobreescribe la configuración global del cliente.
 */
export interface RequestConfig {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  body?: unknown;
  dedupe?: boolean;
  cacheTime?: number;
  staleWhileRevalidate?: boolean;
}

/**
 * Estructura de un interceptor.
 */
export interface Interceptor<T> {
  fulfilled?: (value: T) => T | Promise<T>;
  rejected?: (error: any) => any;
}

/**
 * Configuración interna de la petición pasada a los interceptores y dispatchRequest.
 */
export interface InternalRequestConfig extends RequestConfig {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
}

/**
 * Respuesta normalizada devuelta por el cliente.
 */
export interface SmartFetchResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

/**
 * Error controlado lanzado por el cliente ante timeouts,
 * fallos de red o respuestas de error del servidor.
 */
export class SmartFetchError extends Error {
  public readonly status?: number;
  public readonly isTimeout: boolean;

  constructor(message: string, status?: number, isTimeout = false) {
    super(message);
    this.name = 'SmartFetchError';
    this.status = status;
    this.isTimeout = isTimeout;
  }
}
