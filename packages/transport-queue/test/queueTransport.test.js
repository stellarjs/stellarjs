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

  it('"subscribe" throws exception', () => {
    const transport = new QueueTransport(undefined);
    expect(() => {
      transport.subscribe();
    }).toThrow();
  });
});