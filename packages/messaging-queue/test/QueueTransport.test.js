import QueueTransport from '../src/QueueTransport';

describe('MessagingAdaptor tests', () => {
  let instance;
  beforeEach(() => {
    instance = new QueueTransport(undefined);
  });

  it('"enqueue" throws exception', () => {
    expect(instance.enqueue).toThrow();
  });

  it('"process" throws exception', () => {
    expect(instance.process).toThrow();
  });

  it('"stopProcessing" throws exception', () => {
    expect(instance.stopProcessing).toThrow();
  });

  it('"getSubscribers" throws exception', () => {
    expect(instance.getSubscribers).toThrow();
  });

  it('"registerSubscriber" throws exception', () => {
    expect(instance.registerSubscriber).toThrow();
  });
});
