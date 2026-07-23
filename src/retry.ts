// TODO(timeout+retries): implementar reintentos automáticos ante 5xx o errores de red.
// Por defecto 1 solo intento (retries=0 reintentos adicionales).

/**
 * Reintenta la ejecución de una petición hasta `retries` veces
 * cuando falla por error de servidor (5xx) o problemas de red.
 */
export async function withRetry<T>(
  _executor: () => Promise<T>,
  _retries: number
): Promise<T> {
  throw new Error('withRetry: not implemented');
}
