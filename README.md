# SmartFetch

Wrapper avanzado sobre `fetch`, con timeouts, reintentos automáticos y una
interfaz limpia y configurable — sin depender de librerías de terceros.

## Instalación

```bash
npm install smartfetch
```

## Integración en un proyecto

```ts
import { SmartFetchClient } from 'smartfetch';

const client = new SmartFetchClient({
  baseURL: 'https://api.miapp.com',
  timeout: 5000, // ms. 0 o ausente = sin límite
  retries: 2,    // reintentos adicionales ante 5xx o errores de red
  headers: { Authorization: 'Bearer token' },
});
```

`baseURL`, `timeout`, `retries` y `headers` son opcionales y se pueden
sobreescribir por petición pasando un segundo argumento de configuración a
cualquiera de los métodos.

## Uso

### GET

```ts
const { data, status } = await client.get<{ id: number; title: string }>('/posts/1');
```

Con query params:

```ts
await client.get('/posts', { params: { userId: 1 } });
// GET /posts?userId=1
```

### POST / PUT / PATCH

```ts
await client.post('/posts', { body: { title: 'Hola', userId: 1 } });
await client.put('/posts/1', { body: { title: 'Editado' } });
await client.patch('/posts/1', { body: { title: 'Parcial' } });
```

El `body` se serializa como JSON automáticamente y se agrega el header
`Content-Type: application/json` si no se especifica uno.

### DELETE

```ts
await client.delete('/posts/1');
```

### async/await y promesas

Todos los métodos devuelven una `Promise`, por lo que se pueden usar tanto
con `async/await` como encadenando `.then()/.catch()`:

```ts
client.get('/posts/1')
  .then((response) => console.log(response.data))
  .catch((error) => console.error(error));
```

### Timeout y reintentos por petición

```ts
await client.get('/lento', { timeout: 2000 });
await client.get('/inestable', { retries: 3 });
```

### Manejo de errores

Ante un timeout, un error de red o una respuesta no exitosa, las promesas se
rechazan con un `SmartFetchError`:

```ts
import { SmartFetchError } from 'smartfetch';

try {
  await client.get('/no-existe');
} catch (error) {
  if (error instanceof SmartFetchError) {
    console.error(error.status, error.isTimeout, error.message);
  }
}
```

Solo se reintenta ante errores 5xx o de red; los errores 4xx se propagan de
inmediato sin reintentos.

## Desarrollo

```bash
npm install
npm run build
npm test
```
