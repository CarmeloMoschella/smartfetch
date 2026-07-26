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
    console.log('GET /posts/1 →', data);

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
    .then((response) => console.log('GET (then) →', response.data))
    .catch((error: SmartFetchError) => console.error('Error (catch):', error.message));
}

conAsyncAwait();
conPromesas();
