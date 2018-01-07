import _ from 'lodash';
import _fp from 'lodash/fp';
import Promise from 'bluebird';
import QueueMessagingAdaptor from '../src/QueueMessagingAdaptor';
import { StellarError } from '../../core/src/StellarError';

function expectSubscriberRegistry(subscriberRegistry, ...expectedSubscribers) {
  const subscriberIds = _.map(expectedSubscribers, ({ inbox, channel, numSubscribers }) =>
    _.keys(_.get(subscriberRegistry, `${inbox}.${channel}`)));

  const expectedObj = _.reduce(
    expectedSubscribers,
    (acc, { inbox, channel }, i) => {
      const subscribers = _(subscriberIds[i]).map(subscriberId => [subscriberId, expect.any(Function)]).fromPairs()
        .value();
      return _.set(acc, `${inbox}.${channel}`, subscribers);
    },
    {}
  );

  for (let i = 0; i < subscriberIds.length; ++i) {
    expect(_.uniq(subscriberIds[i])).toHaveLength(expectedSubscribers[i].numSubscribers);
    for (let j = 0; j < subscriberIds[i]; ++j) {
        expect(subscriberIds[i][j]).toMatch(/[a-z0-9\-]+/);
    }
  }
  expect(subscriberRegistry).toEqual(expectedObj);
}

function expectTransportMocksToHaveBeeenCalled(instance, ...expectedFns) {
  const fnNames = _.functions(instance.transport);
  for (let i = 0; i < fnNames.length; i++) {
    const fnName = fnNames[i];
    const expectedFn = _.find(expectedFns, (expectedFn) => expectedFn.name === fnName);
    if (expectedFn) {
      expect(instance.transport[fnName]).toHaveBeenCalled(); //`Expected transport.${fnName} to have been called`
      if (expectedFn.numCalls) {
          expect(instance.transport[fnName].mock.calls).toHaveLength(expectedFn.numCalls); // `Expected transport.${fnName} to have been called ${expectedFn.args[i]} times, not ${instance.transport[fnName].mock.calls} times`
      }
      if (expectedFn.args) {
          for(let i = 0; i < expectedFn.args.length; ++i) {
              expect(instance.transport[fnName].mock.calls[i]).toEqual(expectedFn.args[i]); // , `Expected transport.${fnName} call ${i} to have been called with ${expectedFn.args[i]}, not ${instance.transport[fnName].mock.calls[i]}`
          }
      }

      continue;
    }

    expect(instance.transport[fnName]).not.toHaveBeenCalled(); // `Expected transport.${fnName} not to have been called with ${instance.transport[fnName].mock.calls[i]}`
  }
}

function clearTransportMocks(instance) {
    const fnNames = _.functions(instance.transport);
    _.forEach(fnNames, (fnName) => {
        instance.transport[fnName].mockClear();
    });
}

describe('QueueMessagingAdaptor tests', () => {
  let instance;
  
  beforeEach(() => {
      const transport = {
          enqueue: jest.fn(),
          process: jest.fn(),
          getSubscribers: jest.fn(),
          registerSubscriber: jest.fn(),
         stopProcessing: jest.fn()
      };

      transport.enqueue.mockName('transport.enqueue');
      transport.process.mockName('transport.process');
      transport.getSubscribers.mockName('transport.getSubscribers');
      transport.registerSubscriber.mockName('transport.registerSubscriber');

      const log = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn()
      };

      instance = new QueueMessagingAdaptor(transport, 'source', log);
  });

  describe('subscribe', () => {

      it('Subscribe on one channel', async () => {
          const channel = 'channelName';
          const mockHandler = jest.fn();
          const message = { headers: { channel }, body: { message: "Hello World"} };
          instance.transport.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
          instance.transport.process.mockReturnValue(Promise.resolve(_.noop));

          await expect(instance.subscribe(channel, mockHandler)).resolves.toBeInstanceOf(Function);

          expect(mockHandler).not.toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});
          expectSubscriberRegistry(instance.subscriberRegistry,
                                   { inbox: `stlr:n:source:subscriptionInbox`, channel, numSubscribers: 1 });
          expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 1 });
          clearTransportMocks(instance);
          
          instance._subscriptionHandler(`stlr:n:source:subscriptionInbox`, message);

          expect(mockHandler).toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});
          expectSubscriberRegistry(instance.subscriberRegistry,
                                   { inbox: `stlr:n:source:subscriptionInbox`, channel, numSubscribers: 1 });
          expectTransportMocksToHaveBeeenCalled(instance);
      });

      it('Subscribe on the same channel multiple times', async () => {
          const channel = 'channelName';
          const mockHandler1 = jest.fn();
          const mockHandler2 = jest.fn();
          const message = { headers: { channel }, body: { message: "Hello World"} };
          instance.transport.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
          instance.transport.process.mockReturnValue(Promise.resolve(_.noop));

          await expect(instance.subscribe(channel, mockHandler1)).resolves.toBeInstanceOf(Function);
          await expect(instance.subscribe(channel, mockHandler2)).resolves.toBeInstanceOf(Function);


          expect(mockHandler1).not.toHaveBeenCalled();
          expect(mockHandler2).not.toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});

          expectSubscriberRegistry(instance.subscriberRegistry,
                                   { inbox: `stlr:n:source:subscriptionInbox`, channel, numSubscribers: 2 });

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 2 });
          clearTransportMocks(instance);

          instance._subscriptionHandler(`stlr:n:source:subscriptionInbox`, message);

          expect(mockHandler1).toHaveBeenCalled();
          expect(mockHandler2).toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});
          expectSubscriberRegistry(instance.subscriberRegistry,
                                   { inbox: `stlr:n:source:subscriptionInbox`, channel, numSubscribers: 2 });
          expectTransportMocksToHaveBeeenCalled(instance);
      });


      it('Subscribe on the multiple different channels', async () => {
          const channel = 'channelName';
          const channel1 = `${channel}1`;
          const channel2 = `${channel}2`;
          const channel3 = `${channel}3`;
          const channel4 = `${channel}4`;
          const mockHandler = jest.fn();
          instance.transport.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
          instance.transport.process.mockReturnValue(Promise.resolve(_.noop));

          await expect(instance.subscribe(channel1, mockHandler)).resolves.toBeInstanceOf(Function);
          await expect(instance.subscribe(channel2, mockHandler)).resolves.toBeInstanceOf(Function);
          await expect(instance.subscribe(channel3, mockHandler)).resolves.toBeInstanceOf(Function);
          await expect(instance.subscribe(channel4, mockHandler)).resolves.toBeInstanceOf(Function);

          expect(mockHandler).not.toHaveBeenCalled();
          expect(mockHandler).not.toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});

          expectSubscriberRegistry(instance.subscriberRegistry,
                                   { inbox: `stlr:n:source:subscriptionInbox`, channel: channel1, numSubscribers: 1 },
                                   { inbox: `stlr:n:source:subscriptionInbox`, channel: channel2, numSubscribers: 1 },
                                   { inbox: `stlr:n:source:subscriptionInbox`, channel: channel3, numSubscribers: 1 },
                                   { inbox: `stlr:n:source:subscriptionInbox`, channel: channel4, numSubscribers: 1 },);

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 4 });
      });

      it('unsubscribe should update the registry', async () => {
          const channel = 'channelName';
          const mockHandler = jest.fn();
          const unsubscribeMock = jest.fn();

          instance.transport.registerSubscriber.mockReturnValue(Promise.resolve(unsubscribeMock));
          instance.transport.process.mockReturnValue(Promise.resolve(_.noop));

          const unsubscriber = await instance.subscribe(channel, mockHandler);

          expect(mockHandler).not.toHaveBeenCalled();
          expect(unsubscribeMock).not.toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});
          expectSubscriberRegistry(instance.subscriberRegistry,
                                   { inbox: `stlr:n:source:subscriptionInbox`, channel, numSubscribers: 1 });
          expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 1 });
          clearTransportMocks(instance);

          unsubscriber();
          expect(mockHandler).not.toHaveBeenCalled();
          expect(unsubscribeMock).toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});
          expectSubscriberRegistry(instance.subscriberRegistry,
                                   { inbox: `stlr:n:source:subscriptionInbox`, channel, numSubscribers: 0 });
      });
  });

  describe('subscribeGroup', () => {
      it('Subscribe on one channel with one group', async () => {
          const channel = 'channelName';
          const groupId = 'groupId';
          const mockHandler = jest.fn();
          instance.transport.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
          instance.transport.process.mockReturnValue(Promise.resolve(_.noop));

          await expect(instance.subscribeGroup(groupId, channel, mockHandler)).resolves.toBeInstanceOf(Function);

          expect(mockHandler).not.toHaveBeenCalled();
          expect(instance.inboxes).toEqual({ [`stlr:s:${groupId}:subscriptionInbox`]: true });

          expectSubscriberRegistry(instance.subscriberRegistry,
                                   { inbox: `stlr:s:${groupId}:subscriptionInbox`, channel, numSubscribers: 1 });

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 },
                                                { name: 'registerSubscriber', numCalls: 1 });
      });

      it('Subscribe on multiple channels with one group', async () => {
          const channelPrefix = 'sub-multiple-channels-one-group-';
          const groupId = 'sub-group-id-1';
          const mockHandler = jest.fn();

          instance.transport.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
          instance.transport.process.mockReturnValue(Promise.resolve(_.noop));

          await expect(instance.subscribeGroup(groupId, `${channelPrefix}1`, mockHandler)).resolves
            .toBeInstanceOf(Function);
          await expect(instance.subscribeGroup(groupId, `${channelPrefix}2`, mockHandler)).resolves
            .toBeInstanceOf(Function);
          await expect(instance.subscribeGroup(groupId, `${channelPrefix}3`, mockHandler)).resolves
            .toBeInstanceOf(Function);

          expect(mockHandler).not.toHaveBeenCalled();
          expect(instance.inboxes).toEqual({ [`stlr:s:${groupId}:subscriptionInbox`]: true });

          expectSubscriberRegistry(instance.subscriberRegistry,
                                   {
                                       inbox: `stlr:s:${groupId}:subscriptionInbox`,
                                       channel: `${channelPrefix}1`,
                                       numSubscribers: 1
                                   },
                                   {
                                       inbox: `stlr:s:${groupId}:subscriptionInbox`,
                                       channel: `${channelPrefix}2`,
                                       numSubscribers: 1
                                   },
                                   {
                                       inbox: `stlr:s:${groupId}:subscriptionInbox`,
                                       channel: `${channelPrefix}3`,
                                       numSubscribers: 1
                                   });

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 },
                                                { name: 'registerSubscriber', numCalls: 3 });

      });
      
    it('Subscribe on the same channel multiple times causes an error', async () => {
      const channel = 'channelName';
      const groupId = 'sub-group-id-1';
      const inbox = `stlr:s:${groupId}:subscriptionInbox`;

      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      const message = { headers: { channel }, body: { message: "Hello World"} };
      instance.transport.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
      instance.transport.process.mockReturnValue(Promise.resolve(_.noop));

      await expect(instance.subscribeGroup(groupId, channel, mockHandler1)).resolves.toBeInstanceOf(Function);
      try {
        instance.subscribeGroup(groupId, channel, mockHandler2)
      } catch (error) {
        expect(error).toEqual(new Error(`Cannot subscribe more that once per url. "${inbox}.${channel}" is already subscribed to`))
      }

      expect(mockHandler1).not.toHaveBeenCalled();
      expect(mockHandler2).not.toHaveBeenCalled();
      expect(instance.inboxes).toEqual({[inbox]: true});

      expectSubscriberRegistry(instance.subscriberRegistry, { inbox, channel, numSubscribers: 1 });

      expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 1 });
      clearTransportMocks(instance);

      instance._subscriptionHandler(inbox, message);

      expect(mockHandler1).toHaveBeenCalled();
      expect(mockHandler2).not.toHaveBeenCalled();
      expect(instance.inboxes).toEqual({[inbox]: true});
      expectSubscriberRegistry(instance.subscriberRegistry, { inbox, channel, numSubscribers: 1 });
      expectTransportMocksToHaveBeeenCalled(instance);
    });

  });

  describe('publish', () => {

      it('Publish no subscribers', async () => {
          const channel = 'channelName';
          const payload = { headers: {}, body: { foo: 'bar' }};

          instance.transport.getSubscribers.mockReturnValue(Promise.resolve([]));
          instance.transport.enqueue.mockReturnValue(Promise.resolve(true));

          await expect(instance.publish(channel, payload)).resolves.toEqual([]);

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'getSubscribers', numCalls: 1 });
      });

      it('Publish to single subscriber', async () => {
          const channel = 'channelName';
          const payload = { headers: {}, body: { foo: 'bar' }};

          instance.transport.getSubscribers.mockReturnValue(Promise.resolve(['queueName']));
          instance.transport.enqueue.mockReturnValue(Promise.resolve(true));

          await expect(instance.publish(channel, payload)).resolves.toEqual([true]);

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'getSubscribers', numCalls: 1}, {name: 'enqueue', numCalls: 1 });
      });

      it('Publish to multiple subscribers', async () => {
          const channel = 'channelName';
          const payload = { headers: {}, body: { foo: 'bar' }};

          instance.transport.getSubscribers.mockReturnValue(Promise.resolve(['queueName1', 'queueName2', 'queueName3']));
          instance.transport.enqueue.mockReturnValue(Promise.resolve(true));

          await expect(instance.publish(channel, payload)).resolves.toEqual([true, true, true]);

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'getSubscribers', numCalls: 1}, {name: 'enqueue', numCalls: 3 });
      });
  });

  describe('fireAndForget', () => {
      it('Should call enqueue but not await a response', async () => {
          const serviceName = 'serviceName';
          const queueName = `${serviceName}:queueName`;
          const req = { headers: { queueName }, body: { foo: 'bar' }};

          instance.transport.enqueue.mockReturnValue(Promise.resolve(true));

          await expect(instance.fireAndForget(req)).resolves.toBe(true);

          expect(instance.inboxes).toEqual({ [`stlr:n:source:responseInbox`]: true });

          expect(instance.inflightRequests).toEqual({});

          expectTransportMocksToHaveBeeenCalled(
            instance,
            { name: 'enqueue', numCalls: 1, args: [['stlr:s:serviceName:inbox', req]] },
            { name: 'process', numCalls: 1 }
          );
      });

      it('Multiple calls must not call process again', async () => {
          const serviceName = 'serviceName';
          const queueName = `${serviceName}:queueName`;
          const req = { headers: { queueName }, body: { foo: 'bar' }};

          instance.transport.enqueue.mockReturnValue(Promise.resolve(true));

          await expect(instance.fireAndForget(req)).resolves.toBe(true);
          await expect(instance.fireAndForget(req)).resolves.toBe(true);
          await expect(instance.fireAndForget(req)).resolves.toBe(true);

          expect(instance.inboxes).toEqual({ [`stlr:n:source:responseInbox`]: true });

          expect(instance.inflightRequests).toEqual({});

          expectTransportMocksToHaveBeeenCalled(
            instance,
            { name: 'enqueue', numCalls: 3, args: [['stlr:s:serviceName:inbox', req], ['stlr:s:serviceName:inbox', req], ['stlr:s:serviceName:inbox', req]] },
            { name: 'process', numCalls: 1 }
          );
      });
  });
    
    describe('request', () => {
        it('Should call enqueue, await a response, and then resolve once the response is received', async () => {
            const serviceName = 'serviceName';
            const queueName = `${serviceName}:queueName`;
            const requestInbox = 'stlr:s:serviceName:inbox';
            const responseInbox = `stlr:n:source:responseInbox`;
            const req = { headers: { id: 1, queueName }, body: { message: 'hello' }};
            const res = { headers: { id: 2, requestId: 1, queueName: responseInbox }, body: { message: 'world' }};

            instance.transport.enqueue.mockReturnValue(Promise.resolve(true));

            const response = instance.request(req, 100);
            await Promise.delay(50);

            expect(instance.inboxes).toEqual({ [responseInbox]: true });
            expect(instance.inflightRequests).toEqual({ '1': [expect.any(Function), expect.any(Function), expect.any(Number)] });

            instance._responseHandler(res);

            await expect(response).resolves.toEqual(res);
            expectTransportMocksToHaveBeeenCalled(
              instance,
              { name: 'enqueue', numCalls: 1, args: [[requestInbox, _fp.set('headers.respondTo', responseInbox, req)]] },
              { name: 'process', numCalls: 1 }
            );
            expect(instance.inflightRequests).toEqual({});
        });

        it('Should call enqueue, await a response, and then timeout', async () => {
            const serviceName = 'serviceName';
            const queueName = `${serviceName}:queueName`;
            const requestInbox = 'stlr:s:serviceName:inbox';
            const responseInbox = `stlr:n:source:responseInbox`;
            const req = { headers: { id: 1, queueName }, body: { message: 'hello' }};
            const timeoutError = new StellarError(`Timeout error: No response to job 1 in 500ms`);

            instance.transport.enqueue.mockReturnValue(Promise.resolve(true));

            const response = instance.request(req, 500);
            await Promise.delay(50);

            expect(instance.inboxes).toEqual({ [responseInbox]: true });
            expect(instance.inflightRequests).toEqual({ '1': [expect.any(Function), expect.any(Function), expect.any(Number)] });

            await expect(response).rejects.toEqual(timeoutError);
            expectTransportMocksToHaveBeeenCalled(
              instance,
              { name: 'enqueue', numCalls: 1, args: [[requestInbox, _fp.set('headers.respondTo', responseInbox, req)]] },
              { name: 'process', numCalls: 1 }
            );
            expect(instance.inflightRequests).toEqual({});
        });

      it('Should call enqueue, await a response, and never timeout', async () => {
        const serviceName = 'serviceName';
        const queueName = `${serviceName}:queueName`;
        const requestInbox = 'stlr:s:serviceName:inbox';
        const responseInbox = `stlr:n:source:responseInbox`;
        const req = { headers: { id: 1, queueName }, body: { message: 'hello' }};

        instance.transport.enqueue.mockReturnValue(Promise.resolve(true));

        instance.request(req);
        await Promise.delay(50);

        expect(instance.inboxes).toEqual({ [responseInbox]: true });
        expect(instance.inflightRequests).toEqual({ '1': [expect.any(Function), expect.any(Function), undefined] });

        expectTransportMocksToHaveBeeenCalled(
          instance,
          { name: 'enqueue', numCalls: 1, args: [[requestInbox, _fp.set('headers.respondTo', responseInbox, req)]] },
          { name: 'process', numCalls: 1 }
        );
        expect(instance.inflightRequests).toEqual({1: [expect.any(Function), expect.any(Function), undefined]});

        await Promise.delay(3000);

        expect(instance.inflightRequests).toEqual({1: [expect.any(Function), expect.any(Function), undefined]});
      });
    });

    describe('addRequestHandler', () => {
        it('should add a request handler successfully and send responses if respondTo set', async () => {
            const serviceName = 'serviceName';
            const requestInbox = 'stlr:s:serviceName:inbox';
            const responseInbox = `stlr:n:source:responseInbox`;
            const url = `${serviceName}:users:get`;
            const mockHandler = jest.fn();
            const req = { headers: { id: 1, queueName: url, respondTo: responseInbox }, body: { message: 'hello' }};
            const res = { headers: { id: 2, requestId: 1, queueName: responseInbox }, body: { message: 'world' }};

            mockHandler.mockReturnValue(Promise.resolve(res));
            instance.transport.process.mockReturnValue(Promise.resolve(true));

            await expect(instance.addRequestHandler(url, mockHandler)).resolves.toEqual(true);

            expectTransportMocksToHaveBeeenCalled(
              instance,
              { name: 'process', numCalls: 1, args: [[requestInbox, expect.any(Function)]] }
            );
            expect(instance.requestHandlerRegistry).toEqual({ [requestInbox]: { [url]: mockHandler } });
            expect(mockHandler).not.toHaveBeenCalled();

            instance.transport.process.mock.calls[0][1]({ data: req });
            await Promise.delay(50);
            
            expect(mockHandler).toHaveBeenCalled();
            expectTransportMocksToHaveBeeenCalled(
              instance,
              { name: 'process', numCalls: 1, args: [[requestInbox, expect.any(Function)]] },
              { name: 'enqueue', numCalls: 1, args: [[responseInbox, res]] }
            );
        });

      it('should add a request handler successfully and send responses if respondTo set', async () => {
        const serviceName = 'serviceName';
        const requestInbox = 'stlr:s:serviceName:inbox';
        const responseInbox = `stlr:n:source:responseInbox`;
        const url = `${serviceName}:users:get`;
        const mockHandler = jest.fn();
        const req = { headers: { id: 1, queueName: url, respondTo: responseInbox }, body: { message: 'hello' }};
        const res = { headers: { id: 2, requestId: 1, errorType: 'Error', errorSource: 'test', queueName: responseInbox }, body: { message: 'world' }};

        const error = new Error('world');
        error.__stellarResponse = res;
        mockHandler.mockReturnValue(Promise.reject(error));
        instance.transport.process.mockReturnValue(Promise.resolve(true));

        await expect(instance.addRequestHandler(url, mockHandler)).resolves.toEqual(true);

        expectTransportMocksToHaveBeeenCalled(
          instance,
          { name: 'process', numCalls: 1, args: [[requestInbox, expect.any(Function)]] }
        );
        expect(instance.requestHandlerRegistry).toEqual({ [requestInbox]: { [url]: mockHandler } });
        expect(mockHandler).not.toHaveBeenCalled();

        instance.transport.process.mock.calls[0][1]({ data: req });
        await Promise.delay(50);

        expect(mockHandler).toHaveBeenCalled();
        expectTransportMocksToHaveBeeenCalled(
          instance,
          { name: 'process', numCalls: 1, args: [[requestInbox, expect.any(Function)]] },
          { name: 'enqueue', numCalls: 1, args: [[responseInbox, res]] }
        );
      });

      it('should add a request handler successfully without respondTo set', async () => {
        const serviceName = 'serviceName';
        const requestInbox = 'stlr:s:serviceName:inbox';
        const responseInbox = `stlr:n:source:responseInbox`;
        const url = `${serviceName}:users:get`;
        const mockHandler = jest.fn();
        const req = { headers: { id: 1, queueName: url }, body: { message: 'hello' }};
        const res = { headers: { id: 2, requestId: 1, queueName: responseInbox }, body: { message: 'world' }};

        mockHandler.mockReturnValue(Promise.resolve(res));
        instance.transport.process.mockReturnValue(Promise.resolve(true));

        await expect(instance.addRequestHandler(url, mockHandler)).resolves.toEqual(true);

        expectTransportMocksToHaveBeeenCalled(
          instance,
          { name: 'process', numCalls: 1, args: [[requestInbox, expect.any(Function)]] }
        );
        expect(instance.requestHandlerRegistry).toEqual({ [requestInbox]: { [url]: mockHandler } });
        expect(mockHandler).not.toHaveBeenCalled();

        instance.transport.process.mock.calls[0][1]({ data: req });
        await Promise.delay(50);

        expect(mockHandler).toHaveBeenCalled();
        expectTransportMocksToHaveBeeenCalled(
          instance,
          { name: 'process', numCalls: 1, args: [[requestInbox, expect.any(Function)]] }
        );
      });
    });

  describe('generateId', () => {
    it('should generate uuids', () => {
     expect(instance.generateId()).toMatch(/[a-z0-9]+/)
    })
  });

  describe('reset', () => {
    it('should reset ok', async () => {
      instance.transport.stopProcessing.mockReturnValue(Promise.resolve(true));

      instance.inboxes = { inbox1: true, inbox2: true };
      instance.subscriberRegistry = { subscriber1: _.noop };
      instance.inflightRequests = { inflight: _.noop };
      instance.requestHandlerRegistry = { request1: _.noop, request2: _.noop };

      await instance.reset();

      expectTransportMocksToHaveBeeenCalled(
        instance,
        { name: 'stopProcessing', numCalls: 2, args: [['inbox1'], ['inbox2']] }
      );

      expect(instance.inboxes).toEqual({});
      expect(instance.subscriberRegistry).toEqual({});
      expect(instance.inflightRequests).toEqual({});
      expect(instance.requestHandlerRegistry).toEqual({});
    });
  });
});