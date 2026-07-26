import { SmartFetchResponse } from './types';

export interface CacheEntry<T> {
  response: SmartFetchResponse<T>;
  expiresAt: number;
  fetchedAt: number;
}

/**
 * Clase encargada de gestionar la caché en memoria de peticiones HTTP,
 * con soporte para expiración por tiempo de vida (TTL) e invalidación de rutas.
 */
export class ResponseCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Obtiene la entrada completa de caché para una clave dada.
   */
  public getEntry<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    return entry as CacheEntry<T>;
  }

  /**
   * Obtiene una respuesta de la caché si no ha expirado.
   * Si está expirada, la elimina y devuelve null.
   */
  public get<T>(key: string): SmartFetchResponse<T> | null {
    const entry = this.getEntry<T>(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return this.cloneResponse(entry.response);
  }

  /**
   * Guarda una respuesta en la caché con un TTL en milisegundos.
   */
  public set<T>(key: string, response: SmartFetchResponse<T>, ttlMs: number): void {
    if (ttlMs <= 0) {
      return;
    }

    const now = Date.now();
    this.cache.set(key, {
      response: this.cloneResponse(response),
      expiresAt: now + ttlMs,
      fetchedAt: now,
    });
  }

  /**
   * Invalida agresivamente las entradas de caché relacionadas con una ruta mutada.
   * Si se muta "/posts/1", invalida "/posts/1", "/posts/1/comments" y "/posts".
   */
  public invalidateRelated(mutatedUrl: string): void {
    const mutatedPath = this.extractPath(mutatedUrl);

    for (const key of this.cache.keys()) {
      // Las claves se guardan en formato "METHOD:URL"
      const cachedUrl = key.replace(/^[A-Z]+:/, '');
      const cachedPath = this.extractPath(cachedUrl);

      if (this.arePathsRelated(cachedPath, mutatedPath)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpia toda la caché.
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Extrae la ruta (path) de una URL eliminando protocolo, host y query params.
   */
  private extractPath(urlStr: string): string {
    try {
      const url = new URL(urlStr);
      return this.normalizePath(url.pathname);
    } catch {
      const pathWithoutParams = urlStr.split('?')[0];
      return this.normalizePath(pathWithoutParams);
    }
  }

  /**
   * Normaliza la estructura del path agregando y eliminando barras según corresponda.
   */
  private normalizePath(path: string): string {
    let normalized = path.replace(/\/+/g, '/');
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized || '/';
  }

  /**
   * Compara si dos rutas están relacionadas. Estar relacionado significa:
   * - Las rutas son idénticas.
   * - Una ruta es subruta directa o indirecta de la otra (ej. /posts/1/comments empieza con /posts/1).
   * - Una es la ruta raíz contenedora de la otra (ej. /posts es raíz de /posts/1).
   */
  private arePathsRelated(pathA: string, pathB: string): boolean {
    if (pathA === pathB) {
      return true;
    }

    const pathAWithSlash = pathA.endsWith('/') ? pathA : pathA + '/';
    const pathBWithSlash = pathB.endsWith('/') ? pathB : pathB + '/';

    return pathAWithSlash.startsWith(pathBWithSlash) || pathBWithSlash.startsWith(pathAWithSlash);
  }

  /**
   * Clona una respuesta de SmartFetch para evitar que los llamadores interfieran
   * entre sí si modifican los objetos.
   */
  private cloneResponse<T>(res: SmartFetchResponse<T>): SmartFetchResponse<T> {
    return {
      ...res,
      headers: new Headers(res.headers),
    };
  }
}
