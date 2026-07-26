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
  timeout: 5000,              // ms. 0 o ausente = sin límite
  retries: 2,                 // reintentos adicionales ante 5xx o errores de red
  headers: { Authorization: 'Bearer token' },
  dedupe: true,                // unificar GETs idénticos en vuelo (default: true en GET)
  cacheTime: 0,                // ms de vida de la caché en memoria para GETs (default: sin caché)
  staleWhileRevalidate: false, // servir caché vencida mientras se revalida en segundo plano
});
```

`baseURL`, `timeout`, `retries`, `headers`, `dedupe`, `cacheTime` y
`staleWhileRevalidate` son opcionales y se pueden sobreescribir por
petición pasando un segundo argumento de configuración a cualquiera de los
métodos.

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

### Interceptores

Permiten inspeccionar o transformar cada petición antes de enviarse, y cada
respuesta antes de llegar al llamador:

```ts
client.interceptors.request.use((config) => {
  config.headers['Authorization'] = 'Bearer token';
  return config;
});

const id = client.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

client.interceptors.response.eject(id); // elimina el interceptor
```

`use()` devuelve un id numérico que se puede pasar a `eject()` para quitar
ese interceptor puntual.

### Deduplicación de peticiones (`dedupe`)

Si se disparan varias peticiones `GET` idénticas (mismo método + URL) al
mismo tiempo, SmartFetch une todas en una sola llamada real a `fetch` y
reparte la misma respuesta entre quienes la pidieron:

```ts
const client = new SmartFetchClient({ dedupe: true }); // true por defecto en GET

await Promise.all([
  client.get('/posts/1'),
  client.get('/posts/1'),
  client.get('/posts/1'),
]); // solo se dispara un fetch real
```

Se puede desactivar por cliente o por petición pasando `dedupe: false`.

### Caché en memoria (`cacheTime`, `staleWhileRevalidate`)

Las respuestas `GET` se pueden cachear en memoria por un tiempo determinado
(TTL en milisegundos):

```ts
const client = new SmartFetchClient({ cacheTime: 5000 });

await client.get('/posts/1'); // MISS: pega a la red
await client.get('/posts/1'); // HIT: responde desde caché
```

Cada respuesta incluye el header `X-Cache` (`MISS`, `HIT` o `SWR-HIT`) para
saber su origen.

Con `staleWhileRevalidate: true`, al expirar el TTL se devuelve la versión
obsoleta al instante mientras se revalida en segundo plano:

```ts
const client = new SmartFetchClient({ cacheTime: 5000, staleWhileRevalidate: true });
```

Cualquier petición de mutación (`POST`/`PUT`/`PATCH`/`DELETE`) invalida
automáticamente la caché de esa ruta y de las rutas relacionadas (por
ejemplo, mutar `/posts/1` invalida también `/posts`). También se puede
limpiar manualmente con `client.cache.clear()`.

## Desarrollo

```bash
npm install
npm run build
npm test
```
