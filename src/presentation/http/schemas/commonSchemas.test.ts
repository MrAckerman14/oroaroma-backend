import { describe, expect, it } from 'vitest';
import { paginationQuerySchema } from './commonSchemas.js';

describe('paginationQuerySchema', () => {
  it('usa 100 registros por pagina por defecto', () => {
    const query = paginationQuerySchema.parse({});

    expect(query).toEqual({
      page: 1,
      pageSize: 100
    });
  });

  it('permite pedir mas de 100 registros cuando se requiere', () => {
    const query = paginationQuerySchema.parse({
      page: '1',
      pageSize: '1000'
    });

    expect(query).toEqual({
      page: 1,
      pageSize: 1000
    });
  });
});
