// TODO(timeout+retries): implementar cancelación automática con AbortController.
// Debe lanzar SmartFetchError con isTimeout=true cuando se agote el tiempo.

/**
 * Ejecuta una petición fetch con un límite de tiempo. Si se excede,
 * la petición se cancela y se lanza un SmartFetchError controlado.
 */
export function withTimeout(
  _executor: (signal: AbortSignal) => Promise<Response>,
  _timeoutMs: number
): Promise<Response> {
  throw new Error('withTimeout: not implemented');
}
