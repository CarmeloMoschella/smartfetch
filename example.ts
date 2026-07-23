import { SmartFetchClient } from './src';

// TODO(docs): completar ejemplo de uso una vez implementados los métodos.
const client = new SmartFetchClient({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 5000,
  retries: 2,
});

async function main() {
  const response = await client.get('/posts/1');
  console.log(response.data);
}

main();
