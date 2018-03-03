import Promise from 'bluebird';
import StellarPubSub from '../src/StellarPubSub';
import { transportMockFactory } from './mocks';

describe('mock pubsub', () => {
  const channel = 'testpubsub:channel';
  let headers;
  let defaultPubSub;
  let appPubSub;
  let transportMock;
  
  beforeEach(() => {
    transportMock = transportMockFactory();
    defaultPubSub = new StellarPubSub(transportMock, undefined);
    appPubSub = new StellarPubSub(transportMock, 'APP');
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

    expect(transportMock.subscribe).toHaveBeenCalled();
    expect(transportMock.subscribe.mock.calls).toHaveLength(1);
    expect(transportMock.subscribe.mock.calls[0]).toEqual([channel, expect.any(Function)]);

    transportMock.subscribe.mock.calls[0][1]({ headers, body: {text: 'hello'} });
    await Promise.delay(50);
    expect(subscriberMock.mock.calls).toHaveLength(1);
    expect(subscriberMock.mock.calls[0]).toEqual([{text: 'hello'}]);
  });


  it('fake subscribe Group handler', async () => {
    const subscriberMock = jest.fn();
    appPubSub.subscribe(channel, subscriberMock);

    expect(transportMock.subscribeGroup).toHaveBeenCalled();
    expect(transportMock.subscribeGroup.mock.calls).toHaveLength(1);
    expect(transportMock.subscribeGroup.mock.calls[0]).toEqual(['APP', channel, expect.any(Function)]);

    transportMock.subscribeGroup.mock.calls[0][2]({ headers, body: {text: 'hello'} });
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

    expect(transportMock.subscribe).toHaveBeenCalled();
    expect(transportMock.subscribe.mock.calls).toHaveLength(1);
    expect(transportMock.subscribe.mock.calls[0]).toEqual([channel, expect.any(Function)]);

    transportMock.subscribe.mock.calls[0][1](message);
    await Promise.delay(50);
    expect(subscriberMock.mock.calls).toHaveLength(1);
    expect(subscriberMock.mock.calls[0]).toEqual([{text: 'hello'}]);

    expect(mwMock.mock.calls).toHaveLength(1);
    expect(mwMock.mock.calls[0]).toEqual([message, expect.any(Function), {}, console]);

    expect(mwMock.mock.callsOnResult).toHaveLength(1);
    expect(mwMock.mock.callsOnResult[0]).toEqual([undefined]);
  });

  describe('publish', () => {
    it('should call trasport.publish', async () => {
      const message = { headers, body: { text: 'hi' }};
      await defaultPubSub.publish(channel, message.body);

      expect(transportMock.publish).toHaveBeenCalled();
      expect(transportMock.publish.mock.calls).toHaveLength(1);
      expect(transportMock.publish.mock.calls[0]).toEqual([channel, message]);
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

      expect(transportMock.publish).toHaveBeenCalled();
      expect(transportMock.publish.mock.calls).toHaveLength(1);
      expect(transportMock.publish.mock.calls[0]).toEqual([channel, message]);

      await Promise.delay(50);

      expect(mwMock.mock.calls).toHaveLength(1);
      expect(mwMock.mock.calls[0]).toEqual([message, expect.any(Function), {}, console]);

      expect(mwMock.mock.callsOnResult).toHaveLength(1);
      expect(mwMock.mock.callsOnResult[0]).toEqual([undefined]);
    });

  });
});
