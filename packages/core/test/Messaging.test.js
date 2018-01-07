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


  describe('getServiceName', () => {
    it('throws for nil values', () => {
      expect(() => Messaging.getServiceName(undefined)).toThrow();
      expect(() => Messaging.getServiceName(null)).toThrow();
    });

    it('works with simple strings', () => {
      expect(Messaging.getServiceName('test')).toEqual('test');
    });

    it('works with complex strings', () => {
      expect(Messaging.getServiceName('test.fred:blah:tag')).toEqual('test.fred');
    });
  });


  describe('getServiceInbox', () => {
    it('throws for nil values', () => {
      expect(() => Messaging.getServiceInbox(undefined)).toThrow();
      expect(() => Messaging.getServiceInbox(null)).toThrow();
    });

    it('works with simple strings', () => {
      expect(Messaging.getServiceInbox('test')).toEqual('stlr:s:test:inbox');
    });

    it('works with complex strings', () => {
      expect(Messaging.getServiceInbox('test.fred:blah:tag')).toEqual('stlr:s:test.fred:inbox');
    });
  });
});
