import { SmartFetchClient } from '../src';

// TODO(testing): agregar pruebas unitarias de cada método (GET/POST/PUT/PATCH/DELETE),
// timeout, reintentos y pruebas de integración una vez implementados.

describe('SmartFetchClient', () => {
  it('se instancia con configuración por defecto', () => {
    const client = new SmartFetchClient();
    expect(client).toBeInstanceOf(SmartFetchClient);
  });
});
