import { Interceptor } from './types';

/**
 * Gestor de interceptores que permite registrar y eliminar callbacks
 * para el ciclo de vida de las peticiones y respuestas.
 */
export class InterceptorManager<T> {
  private handlers: Array<Interceptor<T> | null> = [];

  /**
   * Registra un nuevo interceptor.
   * 
   * @param fulfilled Callback para el caso exitoso.
   * @param rejected Callback para el caso de error.
   * @returns Identificador numérico del interceptor para poder eliminarlo.
   */
  public use(
    fulfilled?: (value: T) => T | Promise<T>,
    rejected?: (error: any) => any
  ): number {
    this.handlers.push({ fulfilled, rejected });
    return this.handlers.length - 1;
  }

  /**
   * Elimina un interceptor registrado por su ID.
   * 
   * @param id Identificador devuelto por `use`.
   */
  public eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null;
    }
  }

  /**
   * Recorre los interceptores activos y ejecuta el callback provisto.
   */
  public forEach(fn: (interceptor: Interceptor<T>) => void): void {
    this.handlers.forEach((h) => {
      if (h !== null) {
        fn(h);
      }
    });
  }
}
