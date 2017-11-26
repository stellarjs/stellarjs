import ITransport from '../src/ITransport';

describe('ITransport tests', () => {
  it('Has no supported features', () => {
    const transportInterface = new ITransport(undefined);
    const value = transportInterface.supportedFeatures();
    const expectedResult = {
      publish: false,
      subscribe: false,
      subscribeGroup: false,
      request: false,
      fireAndForget: false,
      addHandler: false,
    };
    expect(value).toEqual(expectedResult);
  });

  it('"publish" throws exception', () => {
    const transportInterface = new ITransport(undefined);
    expect(() => {
      transportInterface.publish();
    }).toThrow();
  });

  it('"subscribe" throws exception', () => {
    const transportInterface = new ITransport(undefined);
    expect(() => {
      transportInterface.subscribe();
    }).toThrow();
  });

  it('"subscribeGroup" throws exception', () => {
    const transportInterface = new ITransport(undefined);
    expect(() => {
      transportInterface.subscribeGroup();
    }).toThrow();
  });

  it('"request" throws exception', () => {
    const transportInterface = new ITransport(undefined);
    expect(() => {
      transportInterface.request();
    }).toThrow();
  });

  it('"fireAndForget" throws exception', () => {
    const transportInterface = new ITransport(undefined);
    expect(() => {
      transportInterface.fireAndForget();
    }).toThrow();
  });

  it('"addHandler" throws exception', () => {
    const transportInterface = new ITransport(undefined);
    expect(() => {
      transportInterface.addHandler();
    }).toThrow();
  })
});