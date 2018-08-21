import factoryConfigurer from '../src/factory';
import QueueTransport from '../src/QueueTransport';

describe('factory', () => {
  const source = 'source';
  const log = console;
  let queueSystemFactory = jest.fn();

  beforeEach(() => {
    queueSystemFactory.mockReset();
    queueSystemFactory.mockReturnValue('fakeQueueSystem');
  });

  it('should build using the queueSystemFactory', () => {
    const factory = factoryConfigurer({queueSystemFactory});
    const transport = factory({source, log, requestTimeout: 1000, optimizeLocalHandlers: false});
    expect(transport.constructor.name).toEqual('QueueTransport');
    expect(transport.nodeSubscriptionInbox).toEqual(`stlr:n:${source}:sub`);
    expect(transport.queueSystem).toEqual('fakeQueueSystem');
    expect(transport.defaultRequestTimeout).toEqual(1000);
  });

  it('should build using the queueSystem', () => {
    const factory = factoryConfigurer({queueSystem: 'foobar'});
    const transport = factory({source, log, requestTimeout: 500, optimizeLocalHandlers: false});
    expect(transport.constructor.name).toEqual('QueueTransport');
    expect(transport.nodeSubscriptionInbox).toEqual(`stlr:n:${source}:sub`);
    expect(transport.queueSystem).toEqual('foobar');
    expect(transport.defaultRequestTimeout).toEqual(500);
  });

  it('should build using the wrap with local optimisation if specified', () => {
    const factory = factoryConfigurer({queueSystem: 'foobar'});
    const transport = factory({source, log, requestTimeout: 500, optimizeLocalHandlers: true});
    expect(transport.constructor.name).toEqual('QueueTransport');
    expect(transport.nodeSubscriptionInbox).toEqual(`stlr:n:${source}:sub`);
    expect(transport.queueSystem).toEqual('foobar');
    expect(transport.defaultRequestTimeout).toEqual(500);

  });
});