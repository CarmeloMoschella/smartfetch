// src/retry.ts

/**
 * Reintenta la ejecución de una petición hasta `retries` veces
 * cuando falla por error de servidor (5xx) o problemas de red.
 * 
 * @param executor Función que envuelve la llamada a la API (o a withTimeout)
 * @param retries Cantidad de reintentos adicionales permitidos. Por defecto 0.
 * @returns Promesa con la respuesta de tipo genérico T (normalmente Response)
 */
export async function withRetry<T>(
  executor: () => Promise<T>,
  retries: number = 0
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      // Ejecutamos la petición
      const response = await executor();

      // Chequeo de seguridad: Si Marco devuelve el Response en lugar de lanzar 
      // el error directamente, detectamos si es un 5xx aquí mismo.
      if (response && typeof (response as any).status === 'number' && !(response as any).ok) {
        const status = (response as any).status;
        
        if (status >= 500 && status < 600) {
          if (attempt >= retries) {
            return response; // Se acabaron los intentos
          }
          // Forzamos la caída al catch para iniciar el flujo de reintento
          throw new Error(`Fallo temporal del servidor: ${status}`);
        }
      }

      // Si es exitoso o es un error 4xx sin excepciones, retornamos directamente
      return response;

    } catch (error: any) {
      // Obtenemos el status (por si Marco ya lanzó su SmartFetchError con el código)
      const status = error.status; 
      
      // Regla clave: Si es un error 4xx o ya agotamos los intentos, lanzamos el error final
      if ((status >= 400 && status < 500) || attempt >= retries) {
        throw error;
      }

      attempt++;
      
      // Espera progresiva antes de intentar de nuevo (1s, 2s, 3s...)
      const waitTime = 1000 * attempt;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}