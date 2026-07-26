import { SmartFetchClient, SmartFetchError } from './src';

const client = new SmartFetchClient({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 5000,
  retries: 2,
});

interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

async function conAsyncAwait() {
  try {
    const { data } = await client.get<Post>('/posts/1');
    console.log('GET /posts/1 →', data.title);

    const created = await client.post<Post>('/posts', {
      body: { userId: 1, title: 'Hola SmartFetch', body: 'contenido' },
    });
    console.log('POST /posts →', created.data);
  } catch (error) {
    if (error instanceof SmartFetchError) {
      console.error('Falló la petición:', error.message, 'status:', error.status);
    } else {
      throw error;
    }
  }
}

function conPromesas() {
  client
    .get<Post>('/posts/1')
    .then((response) => console.log('GET (then) →', response.data.title))
    .catch((error: SmartFetchError) => console.error('Error (catch):', error.message));
}

async function demostrarInterceptores() {
  console.log('\n--- DEMOSTRACIÓN DE INTERCEPTORES ---');
  const customClient = new SmartFetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
  });

  // Interceptor de Request: agrega token de autorización y un request-id
  customClient.interceptors.request.use((config) => {
    config.headers['Authorization'] = 'Bearer MI_TOKEN_SECRETO_123';
    config.headers['X-Request-Id'] = Math.random().toString(36).substring(7);
    console.log(`[Interceptor Request] Enviando petición a: ${config.url} con X-Request-Id: ${config.headers['X-Request-Id']}`);
    return config;
  });

  // Interceptor de Response: mide tiempos o muta la respuesta
  customClient.interceptors.response.use(
    (response) => {
      console.log(`[Interceptor Response] Recibida respuesta de ${response.status} ${response.statusText}`);
      // Agregar meta-información a los datos devueltos
      response.data = {
        ...response.data,
        _processedByInterceptor: true,
      };
      return response;
    },
    (error) => {
      console.error('[Interceptor Response Error]', error.message);
      return Promise.reject(error);
    }
  );

  const { data } = await customClient.get<Post>('/posts/2');
  console.log('Datos finales procesados por interceptores:', data);
}

async function demostrarDeduplicacion() {
  console.log('\n--- DEMOSTRACIÓN DE DEDUPLICACIÓN ---');
  const dedupeClient = new SmartFetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    dedupe: true, // Habilitar a nivel de cliente para GETs por defecto
  });

  // Interceptor para contar cuántas peticiones realmente salen
  let requestCounter = 0;
  dedupeClient.interceptors.request.use((config) => {
    requestCounter++;
    console.log(`[Dedupe Demo] Petición registrada por interceptor #${requestCounter}`);
    return config;
  });

  console.log('Disparando 3 peticiones GET idénticas simultáneamente a /posts/3...');
  
  const [p1, p2, p3] = await Promise.all([
    dedupeClient.get<Post>('/posts/3'),
    dedupeClient.get<Post>('/posts/3'),
    dedupeClient.get<Post>('/posts/3'),
  ]);

  console.log('¿Son iguales las respuestas?', p1.data.id === p2.data.id && p2.data.id === p3.data.id);
  console.log('Resultados resueltos con éxito. ID recibido:', p1.data.id);
  
  // Esperar un momento y disparar otra petición posterior para demostrar que no se queda en caché permanentemente
  console.log('Esperando a que la cola en vuelo se limpie...');
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('Disparando una petición posterior a /posts/3...');
  const p4 = await dedupeClient.get<Post>('/posts/3');
  console.log('Petición posterior recibida, ID:', p4.data.id);
}

async function demostrarCache() {
  console.log('\n--- DEMOSTRACIÓN DE CACHÉ ---');
  const cacheClient = new SmartFetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    cacheTime: 2000, // Caché de 2 segundos global
  });

  let requestCounter = 0;
  cacheClient.interceptors.request.use((config) => {
    requestCounter++;
    console.log(`[Caché Demo] Solicitud interceptada #${requestCounter} para: ${config.url}`);
    return config;
  });

  console.log('1. Pidiendo /posts/4 (esperado: MISS)...');
  const r1 = await cacheClient.get<Post>('/posts/4');
  console.log(`Respuesta 1 recibida: "${r1.data.title.substring(0, 30)}..." | X-Cache: ${r1.headers.get('X-Cache')}`);

  console.log('2. Pidiendo /posts/4 inmediatamente después (esperado: HIT)...');
  const r2 = await cacheClient.get<Post>('/posts/4');
  console.log(`Respuesta 2 recibida: "${r2.data.title.substring(0, 30)}..." | X-Cache: ${r2.headers.get('X-Cache')}`);

  console.log('3. Esperando 2.5 segundos para que expire el TTL...');
  await new Promise(resolve => setTimeout(resolve, 2500));

  console.log('4. Pidiendo /posts/4 tras expiración (esperado: MISS)...');
  const r3 = await cacheClient.get<Post>('/posts/4');
  console.log(`Respuesta 3 recibida: "${r3.data.title.substring(0, 30)}..." | X-Cache: ${r3.headers.get('X-Cache')}`);

  console.log('\n5. Demostrando Stale-While-Revalidate (SWR)...');
  const swrClient = new SmartFetchClient({
    baseURL: 'https://jsonplaceholder.typicode.com',
    cacheTime: 1000,
    staleWhileRevalidate: true,
  });

  let swrCounter = 0;
  swrClient.interceptors.request.use((config) => {
    swrCounter++;
    console.log(`[SWR Demo] Solicitud interceptada #${swrCounter} para: ${config.url}`);
    return config;
  });

  console.log('Petición inicial a /posts/5 (esperado: MISS)...');
  const s1 = await swrClient.get<Post>('/posts/5');
  console.log(`Respuesta inicial: "${s1.data.title.substring(0, 30)}..." | X-Cache: ${s1.headers.get('X-Cache')}`);

  console.log('Esperando 1.2 segundos para que expire el TTL...');
  await new Promise(resolve => setTimeout(resolve, 1200));

  console.log('Petición con caché expirada (esperado: SWR-HIT y revalidación asíncrona)...');
  const s2 = await swrClient.get<Post>('/posts/5');
  console.log(`Respuesta instantánea (obsoleta): "${s2.data.title.substring(0, 30)}..." | X-Cache: ${s2.headers.get('X-Cache')}`);

  console.log('Esperando 800ms para asegurar que la revalidación finalizó...');
  await new Promise(resolve => setTimeout(resolve, 800));

  console.log('Pidiendo /posts/5 de nuevo (esperado: HIT de la caché revalidada)...');
  const s3 = await swrClient.get<Post>('/posts/5');
  console.log(`Respuesta fresca leída de caché: "${s3.data.title.substring(0, 30)}..." | X-Cache: ${s3.headers.get('X-Cache')}`);

  console.log('\n6. Demostrando invalidación agresiva por mutación...');
  console.log('Consultando /posts/6 para guardarla en caché...');
  const rc1 = await cacheClient.get<Post>('/posts/6');
  console.log(`Respuesta inicial: "${rc1.data.title.substring(0, 30)}..." | X-Cache: ${rc1.headers.get('X-Cache')}`);

  console.log('Realizando una mutación PUT a /posts/6 (esto debe invalidar /posts/6 y su padre /posts)...');
  await cacheClient.put('/posts/6', { body: { title: 'Nuevo Título' } });

  console.log('Consultando /posts/6 de nuevo (esperado: MISS debido a invalidación)...');
  const rc2 = await cacheClient.get<Post>('/posts/6');
  console.log(`Respuesta posterior: "${rc2.data.title.substring(0, 30)}..." | X-Cache: ${rc2.headers.get('X-Cache')}`);
}

async function ejecutarTodo() {
  await conAsyncAwait();
  conPromesas();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await demostrarInterceptores();
  await demostrarDeduplicacion();
  await demostrarCache();
}

ejecutarTodo();
