import QueueSystem from '../src/QueueSystem';

describe('QueueSystem tests', () => {
  let instance;
  beforeEach(() => {
    instance = new QueueSystem(undefined);
  });

  it('"enqueue" throws exception', () => {
    expect(instance.enqueue).toThrow();
  });

  it('"process" throws exception', () => {
    expect(instance.process).toThrow();
  });

  it('"processGroup" throws exception', () => {
    expect(instance.processGroup).toThrow();
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
