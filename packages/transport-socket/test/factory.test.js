import factory from '../src/factory';

describe('factory', () => {
  const log = console;
  const socket = 'fakeSocket';

  beforeEach(() => {
  });

  it('should build using a undefined socket', () => {
    const transport = factory({log, requestTimeout: 1000, optimizeLocalHandlers: false});
    expect(transport.constructor.name).toEqual('WebsocketTransport');
    expect(transport.socket).resolves.toEqual(undefined);
    expect(transport.defaultRequestTimeout).toEqual(1000);
  });

  it('should build using a socket', () => {
    const transport = factory({log, socket, requestTimeout: 500, optimizeLocalHandlers: false});
    expect(transport.constructor.name).toEqual('WebsocketTransport');
    expect(transport.socket).resolves.toEqual('fakeSocket');
    expect(transport.defaultRequestTimeout).toEqual(500);
  });

  it('should build using the wrap with local optimisation if specified', () => {
    const transport = factory({log, requestTimeout: 500, optimizeLocalHandlers: true});
    expect(transport.constructor.name).toEqual('WebsocketTransport');
    expect(transport.socket).resolves.toEqual('fakeSocket');
    expect(transport.defaultRequestTimeout).toEqual(500);

  });
});