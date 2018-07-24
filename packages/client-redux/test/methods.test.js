import { METHODS } from '../src';

describe('methods', () => {
  it('should export all methods', () => {
    expect(METHODS).toEqual({
      CREATE: 'create',
      GET: 'get',
      REMOVE: 'remove',
      SUBSCRIBE: 'subscribe',
      UNSUBSCRIBE: 'unsubscribe',
      UPDATE: 'update',
    });
  });
});
