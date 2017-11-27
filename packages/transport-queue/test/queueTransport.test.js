import QueueTransport from '../src/queueTransport';

describe('ITransport tests', () => {
  it('Has correct supported features', () => {
    const transport = new QueueTransport(undefined);
    const value = transport.supportedFeatures();
    const expectedResult = {
      publish: true,
      subscribe: false,
      subscribeGroup: true,
      request: true,
      fireAndForget: true,
      addHandler: true,
    };
    expect(value).toEqual(expectedResult);
  });

  it('"publish" throws exception', () => {
    const transport = new QueueTransport(undefined);
    expect(() => {
      transport.publish();
    }).toThrow();
  });

  it('"subscribe" throws exception', () => {
    const transport = new QueueTransport(undefined);
    expect(() => {
      transport.subscribe();
    }).toThrow();
  });

  it('"subscribeGroup" throws exception', () => {
    const transport = new QueueTransport(undefined);
    expect(() => {
      transport.subscribeGroup();
    }).toThrow();
  });

  it('"request" throws exception', () => {
    const transport = new QueueTransport(undefined);
    expect(() => {
      transport.request();
    }).toThrow();
  });

  it('"fireAndForget" throws exception', () => {
    const transport = new QueueTransport(undefined);
    expect(() => {
      transport.fireAndForget();
    }).toThrow();
  });

  it('"addHandler" throws exception', () => {
    const transport = new QueueTransport(undefined);
    expect(() => {
      transport.addHandler();
    }).toThrow();
  })
});