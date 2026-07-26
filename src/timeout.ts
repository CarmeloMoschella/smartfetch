import { SmartFetchError } from './types'; 

/**
 * Ejecuta una petición fetch con un límite de tiempo. Si se excede,
 * la petición se cancela y se lanza un SmartFetchError controlado.
 * 
 * @param executor Función que ejecuta el fetch interno y recibe el AbortSignal
 * @param timeoutMs Tiempo máximo en milisegundos. Si es <= 0, no hay límite.
 * @returns Promesa que resuelve con el Response HTTP
 * @throws {SmartFetchError} Si el tiempo se agota antes de recibir respuesta.
 */
export async function withTimeout(
  executor: (signal: AbortSignal) => Promise<Response>,
  timeoutMs: number
): Promise<Response> {
  if (timeoutMs <= 0) {
    const dummyController = new AbortController();
    return executor(dummyController.signal);
  }

  const controller = new AbortController();
  
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await executor(controller.signal);
    
    clearTimeout(timeoutId);
    return response;

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new SmartFetchError('La petición ha excedido el tiempo de espera', undefined, true);
    }
    
    throw error;
  }
}