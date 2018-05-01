import factory from '../src/factory';

describe('factory', () => {
  const log = console;
  const axios = 'fake';

  beforeEach(() => {
  });

  it('should build using a undefined axios client', () => {
    const transport = factory({log, requestTimeout: 1000, optimizeLocalHandlers: false});
    expect(transport.constructor.name).toEqual('AxiosTransport');
    expect(transport.defaultRequestTimeout).toEqual(1000);
      expect(transport.axios).toEqual(undefined);
  });

  it('should build using a axios http client', () => {
    const transport = factory({log, axios, requestTimeout: 500, optimizeLocalHandlers: false});
    expect(transport.constructor.name).toEqual('AxiosTransport');
    expect(transport.axios).toEqual('fake');
  });
});