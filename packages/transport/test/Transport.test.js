import _ from 'lodash';
import Messaging from '../src/Transport';

describe('Transport tests', () => {
  let messagingInterface;
  beforeEach(() => {
    messagingInterface = new Messaging(undefined);
  });

  it('"publish" throws exception', () => {
    expect(() => {
      messagingInterface.publish({});
    }).toThrow();
  });

  it('"request" throws exception', () => {
    expect(() => {
      messagingInterface.request({}, 2000);
    }).toThrow();
  });

  it('"fireAndForget" throws exception', () => {
    expect(() => {
      messagingInterface.fireAndForget({});
    }).toThrow();
  });

  it('"addRequestHandler" throws exception', () => {
    expect(() => {
      messagingInterface.addRequestHandler('url', _.noop);
    }).toThrow();
  });
  
  it('"generateId" throws exception', () => {
    expect(() => {
      messagingInterface.fireAndForget();
    }).toThrow();
  });

  it('"reset" throws exception', () => {
    messagingInterface.registries.yada = { hi: 'bye' };
    messagingInterface.registries.requestHandlers = { foo: 'bar' };
    messagingInterface.reset();
    expect(messagingInterface.registries).toEqual({requestHandlers: {}, subscribers: {}, yada: {}});
  });

  it('"registerSubsriberHandler" adds a subscriber to the registry', () => {
    const result = messagingInterface.registerSubscriberHandler('channel', _.noop);
    expect(result).toBeInstanceOf(Function);
    expect(_.keys(messagingInterface.registries.subscribers)).toEqual(['channel']);
    const subscriberIds = _.keys(messagingInterface.registries.subscribers['channel']);
    expect(subscriberIds).toHaveLength(1);
    expect(subscriberIds[0]).toMatch(/[\w\-]+/);
    expect(messagingInterface.registries.subscribers.channel[subscriberIds[0]]).toEqual(_.noop)
  });


  it('"registerSubsriberHandler" should allow multiple subscribes', () => {
    messagingInterface.registerSubscriberHandler('channel', _.noop);
    messagingInterface.registerSubscriberHandler('channel', _.noop);
    expect(_.keys(messagingInterface.registries.subscribers)).toEqual(['channel']);
    const subscriberIds = _.keys(messagingInterface.registries.subscribers['channel']);
    expect(subscriberIds).toHaveLength(2);
    expect(subscriberIds[0]).toMatch(/[\w\-]+/);
    expect(subscriberIds[1]).toMatch(/[\w\-]+/);
    expect(messagingInterface.registries.subscribers.channel[subscriberIds[0]]).toEqual(_.noop);
    expect(messagingInterface.registries.subscribers.channel[subscriberIds[1]]).toEqual(_.noop);
  });

  it('"registerSubscribeGroupHandler" should add registry entries', () => {
    const result = messagingInterface.registerSubscriberGroupHandler('groupId', 'channel', _.noop);
    expect(result).toBeInstanceOf(Function);
    expect(messagingInterface.registries.subscribers).toEqual({ channel: { groupId: _.noop } })
  });

  it('"registerSubscribeGroupHandler" should disallow multiple registry entries', () => {
    messagingInterface.registerSubscriberGroupHandler('groupId1', 'channel', _.noop);
    messagingInterface.registerSubscriberGroupHandler('groupId2', 'channel', _.noop);
    expect(() => messagingInterface.registerSubscriberGroupHandler('groupId1', 'channel', _.noop))
      .toThrow();
  });

  it('"registerRequestHandler" should add a requestHandler registry entries', () => {
    messagingInterface.registerRequestHandler('url', _.noop);
    expect(messagingInterface.registries.requestHandlers).toEqual({ url: _.noop })
  });

  it('"registerRequestHandler" should disallow multiple registry entries', () => {
    messagingInterface.registerRequestHandler('url1', _.noop);
    messagingInterface.registerRequestHandler('url2', _.noop);
    expect(() => messagingInterface.registerRequestHandler('url1', _.noop))
      .toThrow();
  });

  describe('registerHandler', () => {
    it('registerHandler should add a handler', () => {
      messagingInterface._registerHandler('requestHandlers', 'gefen.subdomain.domain.com', 1);
      expect(messagingInterface.registries.requestHandlers).toEqual({ gefen: { subdomain: { domain: { com: 1 } } } });
    });

    it('registerHandler should gurantee unique handlers per URL', () => {
      messagingInterface._registerHandler('requestHandlers', 'gefen.subdomain.domain.com', 1);
      expect(() => messagingInterface.registerHandler('requestHandlers', 'gefen.subdomain.domain.com', 1))
        .toThrow();
    });

    it('registerHandler should allow multiple unique handlers as long as something is different URL', () => {
      messagingInterface._registerHandler('requestHandlers', 'gefen.subdomain.domain.com.A', 1);
      messagingInterface._registerHandler('requestHandlers', 'gefen.subdomain.domain.com.B', 2);
      expect(messagingInterface.registries.requestHandlers)
        .toEqual({ gefen: { subdomain: { domain: { com: { A: 1, B: 2 } } } } });
    });

    it('registerHandler doesnt support different depth urls', () => {
      messagingInterface._registerHandler('requestHandlers', 'gefen.subdomain.domain.com', 1);
      expect(() => messagingInterface.registerHandler('requestHandlers', 'gefen.subdomain.domain.com.A', 1))
        .toThrow();
    });

    it('registerHandler deregisters registries no longer in use (simple keys)', () => {
      const deregisterA = messagingInterface._registerHandler('requestHandlers', 'A', 1);
      const deregisterB = messagingInterface._registerHandler('requestHandlers', 'B', 1);
      deregisterA();
      expect(messagingInterface.registries.requestHandlers).toEqual({ B: 1 });
      deregisterB();
      expect(messagingInterface.registries.requestHandlers).toEqual({});
    });

    it('registerHandler deregisters registries no longer in use (url keys)', () => {
      const deregisterA = messagingInterface._registerHandler('requestHandlers', 'gefen.subdomain.domain.com.A', 1);
      const deregisterB = messagingInterface._registerHandler('requestHandlers', 'gefen.subdomain.domain.com.B', 2);
      deregisterA();
      expect(messagingInterface.registries.requestHandlers).toEqual({ gefen: { subdomain: { domain: { com: { B: 2 } } } } });

      deregisterB();
      expect(messagingInterface.registries.requestHandlers).toEqual({});
    });
  });
});
