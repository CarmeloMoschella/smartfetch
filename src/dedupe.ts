import { SmartFetchResponse } from './types';

/**
 * Clase encargada de deduplicar peticiones en vuelo (simultáneas)
 * basadas en una clave de hash única.
 */
export class RequestDeduplicator {
  private activeRequests = new Map<string, Promise<any>>();

  /**
   * Ejecuta la petición provista. Si ya existe una petición idéntica en vuelo,
   * se une a su promesa. De lo contrario, inicia la petición y la registra.
   * 
   * @param key Clave única que identifica la petición.
   * @param executor Función que ejecuta la petición HTTP real.
   */
  public async execute<T>(
    key: string,
    executor: () => Promise<SmartFetchResponse<T>>
  ): Promise<SmartFetchResponse<T>> {
    const active = this.activeRequests.get(key);
    if (active) {
      // Retornamos la promesa activa clonando el contenedor de la respuesta
      // para evitar efectos colaterales si algún llamador muta el objeto.
      return active.then((res) => ({
        ...res,
        headers: new Headers(res.headers),
      }));
    }

    const promise = executor();
    this.activeRequests.set(key, promise);

    try {
      const response = await promise;
      return response;
    } finally {
      this.activeRequests.delete(key);
    }
  }
}
