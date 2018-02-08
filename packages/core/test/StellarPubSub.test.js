import _ from 'lodash';
import Promise from 'bluebird';
import StellarPubSub from '../src/StellarPubSub';
import { messagingMockFactory } from './mocks';

const getDefaultPubSub = (channel, body = { text: 'hi' }) => {
  return
};
const getAppPubSub = (channel, body = { text: 'hi' }) => {
  return new StellarPubSub(messagingMockFactory(), 'test', console, );
};

describe('mock pubsub', () => {
  const channel = 'testpubsub:channel';
  let headers;
  let defaultPubSub;
  let appPubSub;
  let messagingMock;
  
  beforeEach(() => {
    messagingMock = messagingMockFactory();
    defaultPubSub = new StellarPubSub(messagingMock, 'test', console);
    appPubSub = new StellarPubSub(messagingMock, 'test', console, 'APP');
    headers = {
      channel,
      id: '1',
      traceId: '1',
      source: 'test',
      timestamp: expect.any(Number),
      type: 'publish',
    };
  });

  it('should have a node level inbox', () => {
    expect(defaultPubSub.service).toBeFalsy();
  });

  it('should have a App level inbox', () => {
    expect(appPubSub.service).toEqual('APP');
  });

  it('fake subscribe handler', async () => {
    const subscriberMock = jest.fn();
    defaultPubSub.subscribe(channel, subscriberMock);

    expect(messagingMock.subscribe).toHaveBeenCalled();
    expect(messagingMock.subscribe.mock.calls).toHaveLength(1);
    expect(messagingMock.subscribe.mock.calls[0]).toEqual([channel, expect.any(Function)]);

    messagingMock.subscribe.mock.calls[0][1]({ headers, body: {text: 'hello'} });
    await Promise.delay(50);
    expect(subscriberMock.mock.calls).toHaveLength(1);
    expect(subscriberMock.mock.calls[0]).toEqual([{text: 'hello'}]);
  });


  it('fake subscribe Group handler', async () => {
    const subscriberMock = jest.fn();
    appPubSub.subscribe(channel, subscriberMock);

    expect(messagingMock.subscribeGroup).toHaveBeenCalled();
    expect(messagingMock.subscribeGroup.mock.calls).toHaveLength(1);
    expect(messagingMock.subscribeGroup.mock.calls[0]).toEqual(['APP', channel, expect.any(Function)]);

    messagingMock.subscribeGroup.mock.calls[0][2]({ headers, body: {text: 'hello'} });
    await Promise.delay(50);
    expect(subscriberMock.mock.calls).toHaveLength(1);
    expect(subscriberMock.mock.calls[0]).toEqual([{text: 'hello'}]);
  });

  it('fake should run subscriber middleware', async () => {
    const message = { headers, body: {text: 'hello'} };

    const subscriberMock = jest.fn();
    const mwMock = jest.fn();
    mwMock.mockImplementation((jobData, next, options, log) => {
      return next()
        .then((...args) => {
          if (!mwMock.mock.callsOnResult) {
            mwMock.mock.callsOnResult = [];
          }
          mwMock.mock.callsOnResult.push(args);
        })
    });

    defaultPubSub.use(/.*/, mwMock);

    defaultPubSub.subscribe(channel, subscriberMock);

    expect(messagingMock.subscribe).toHaveBeenCalled();
    expect(messagingMock.subscribe.mock.calls).toHaveLength(1);
    expect(messagingMock.subscribe.mock.calls[0]).toEqual([channel, expect.any(Function)]);

    messagingMock.subscribe.mock.calls[0][1](message);
    await Promise.delay(50);
    expect(subscriberMock.mock.calls).toHaveLength(1);
    expect(subscriberMock.mock.calls[0]).toEqual([{text: 'hello'}]);

    expect(mwMock.mock.calls).toHaveLength(1);
    expect(mwMock.mock.calls[0]).toEqual([message, expect.any(Function), {}, console]);

    expect(mwMock.mock.callsOnResult).toHaveLength(1);
    expect(mwMock.mock.callsOnResult[0]).toEqual([undefined]);
  });

  describe('publish', () => {
    it('should call messagingAdaptor.publish', async () => {
      const message = { headers, body: { text: 'hi' }};
      await defaultPubSub.publish(channel, message.body);

      expect(messagingMock.publish).toHaveBeenCalled();
      expect(messagingMock.publish.mock.calls).toHaveLength(1);
      expect(messagingMock.publish.mock.calls[0]).toEqual([channel, message]);
    });

    it('middleware should work', async () => {
      const message = { headers, body: { text: 'hi' }};
      const mwMock = jest.fn();
      mwMock.mockImplementation((jobData, next, options, log) => {
        return next()
          .then((...args) => {
            if (!mwMock.mock.callsOnResult) {
              mwMock.mock.callsOnResult = [];
            }
            mwMock.mock.callsOnResult.push(args);
          })
      });

      defaultPubSub.use(/.*/, mwMock);

      await defaultPubSub.publish(channel, message.body);

      expect(messagingMock.publish).toHaveBeenCalled();
      expect(messagingMock.publish.mock.calls).toHaveLength(1);
      expect(messagingMock.publish.mock.calls[0]).toEqual([channel, message]);

      await Promise.delay(50);

      expect(mwMock.mock.calls).toHaveLength(1);
      expect(mwMock.mock.calls[0]).toEqual([message, expect.any(Function), {}, console]);

      expect(mwMock.mock.callsOnResult).toHaveLength(1);
      expect(mwMock.mock.callsOnResult[0]).toEqual([undefined]);
    });

  });
});
