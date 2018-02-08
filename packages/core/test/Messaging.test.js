import Messaging from '../src/MessagingAdaptor';

describe('MessagingAdaptor tests', () => {
  let messagingInterface;
  beforeEach(() => {
    messagingInterface = new Messaging(undefined);
  });

  it('"publish" throws exception', () => {
    expect(() => {
      messagingInterface.publish();
    }).toThrow();
  });

  it('"subscribe" throws exception', () => {
    expect(() => {
      messagingInterface.subscribe();
    }).toThrow();
  });

  it('"subscribeGroup" throws exception', () => {
    expect(() => {
      messagingInterface.subscribeGroup();
    }).toThrow();
  });

  it('"request" throws exception', () => {
    expect(() => {
      messagingInterface.request();
    }).toThrow();
  });

  it('"fireAndForget" throws exception', () => {
    expect(() => {
      messagingInterface.fireAndForget();
    }).toThrow();
  });

  it('"generateId" throws exception', () => {
    expect(() => {
      messagingInterface.fireAndForget();
    }).toThrow();
  });

  it('"addRequestHandler" throws exception', () => {
    expect(() => {
      messagingInterface.addRequestHandler();
    }).toThrow();
  });

  it('"reset" throws exception', () => {
    expect(() => {
      messagingInterface.reset();
    }).toThrow();
  });
});
