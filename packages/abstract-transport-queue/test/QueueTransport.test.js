import _ from 'lodash';
import _fp from 'lodash/fp';
import Promise from 'bluebird';
import QueueTransport from '../src/QueueTransport';
import StellarError from '@stellarjs/stellar-error';

function expectSubscriberRegistry(subscriberRegistry, ...expectedSubscribers) {
  const subscriberIds = _.map(expectedSubscribers, ({ channel, numSubscribers }) =>
    _.keys(_.get(subscriberRegistry, channel)));

  const expectedObj = _.reduce(
    expectedSubscribers,
    (acc, { channel }, i) => {
      const subscribers = _(subscriberIds[i]).map(subscriberId => [subscriberId, expect.any(Function)]).fromPairs()
        .value();

      if (_.isEmpty(subscribers)) {
        return acc;
      }
      return _.set(acc, channel, subscribers);
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
  const fnNames = _.functions(instance.queueSystem);
  for (let i = 0; i < fnNames.length; i++) {
    const fnName = fnNames[i];
    const expectedFn = _.find(expectedFns, (expectedFn) => expectedFn.name === fnName);
    if (expectedFn) {
      expect(instance.queueSystem[fnName]).toHaveBeenCalled(); //`Expected queueSystem.${fnName} to have been called`
      if (expectedFn.numCalls) {
          expect(instance.queueSystem[fnName].mock.calls).toHaveLength(expectedFn.numCalls); // `Expected queueSystem.${fnName} to have been called ${expectedFn.args[i]} times, not ${instance.queueSystem[fnName].mock.calls} times`
      }
      if (expectedFn.args) {
          for(let i = 0; i < expectedFn.args.length; ++i) {
              expect(instance.queueSystem[fnName].mock.calls[i]).toEqual(expectedFn.args[i]); // , `Expected queueSystem.${fnName} call ${i} to have been called with ${expectedFn.args[i]}, not ${instance.queueSystem[fnName].mock.calls[i]}`
          }
      }

      continue;
    }

    expect(instance.queueSystem[fnName]).not.toHaveBeenCalled(); // `Expected queueSystem.${fnName} not to have been called with ${instance.queueSystem[fnName].mock.calls[i]}`
  }
}

function clearTransportMocks(instance) {
    const fnNames = _.functions(instance.queueSystem);
    _.forEach(fnNames, (fnName) => {
        instance.queueSystem[fnName].mockClear();
    });
}

describe('QueueTransport tests', () => {
  let instance;
  
  beforeEach(() => {
      const queueSystem = {
          enqueue: jest.fn(),
          process: jest.fn(),
          processGroup: jest.fn(),
          getSubscribers: jest.fn(),
          registerSubscriber: jest.fn(),
         stopProcessing: jest.fn()
      };

      queueSystem.enqueue.mockName('queueSystem.enqueue');
      queueSystem.process.mockName('queueSystem.process');
      queueSystem.processGroup.mockName('queueSystem.processGroup');
      queueSystem.getSubscribers.mockName('queueSystem.getSubscribers');
      queueSystem.registerSubscriber.mockName('queueSystem.registerSubscriber');

      const log = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn()
      };

      instance = new QueueTransport(queueSystem, 'source', log);
  });

  describe('subscribe', () => {

      it('Subscribe on one channel', async () => {
          const channel = 'channelName';
          const mockHandler = jest.fn();
          const data = { headers: { channel }, body: { message: "Hello World"} };
          instance.queueSystem.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
          instance.queueSystem.process.mockReturnValue(Promise.resolve(_.noop), _.noop);

          await expect(instance.subscribe(channel, mockHandler)).resolves.toBeInstanceOf(Function);

          expect(mockHandler).not.toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});
          expectSubscriberRegistry(instance.registries.subscribers, { channel, numSubscribers: 1 });
          expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 1 });
          
          const subscriptionHandler = _.last(instance.queueSystem.process.mock.calls[0]);
          clearTransportMocks(instance);
          
          subscriptionHandler({ data }, _.noop);

          expect(mockHandler).toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});
          expectSubscriberRegistry(instance.registries.subscribers, { channel, numSubscribers: 1 });
          expectTransportMocksToHaveBeeenCalled(instance);
      });

      it('Subscribe on the same channel multiple times', async () => {
          const channel = 'channelName';
          const mockHandler1 = jest.fn();
          const mockHandler2 = jest.fn();
          const data = { headers: { channel }, body: { message: "Hello World"} };
          instance.queueSystem.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
          instance.queueSystem.process.mockReturnValue(Promise.resolve(_.noop));

          await expect(instance.subscribe(channel, mockHandler1)).resolves.toBeInstanceOf(Function);
          await expect(instance.subscribe(channel, mockHandler2)).resolves.toBeInstanceOf(Function);


          expect(mockHandler1).not.toHaveBeenCalled();
          expect(mockHandler2).not.toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});

          expectSubscriberRegistry(instance.registries.subscribers, { channel, numSubscribers: 2 });

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 2 });
          const subscriptionHandler = _.last(instance.queueSystem.process.mock.calls[0])

          clearTransportMocks(instance);

          subscriptionHandler({ data }, _.noop);

          expect(mockHandler1).toHaveBeenCalled();
          expect(mockHandler2).toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});
          expectSubscriberRegistry(instance.registries.subscribers, { channel, numSubscribers: 2 });
          expectTransportMocksToHaveBeeenCalled(instance);
      });


      it('Subscribe on the multiple different channels', async () => {
          const channel = 'channelName';
          const channel1 = `${channel}1`;
          const channel2 = `${channel}2`;
          const channel3 = `${channel}3`;
          const channel4 = `${channel}4`;
          const mockHandler = jest.fn();
          instance.queueSystem.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
          instance.queueSystem.process.mockReturnValue(Promise.resolve(_.noop));

          await expect(instance.subscribe(channel1, mockHandler)).resolves.toBeInstanceOf(Function);
          await expect(instance.subscribe(channel2, mockHandler)).resolves.toBeInstanceOf(Function);
          await expect(instance.subscribe(channel3, mockHandler)).resolves.toBeInstanceOf(Function);
          await expect(instance.subscribe(channel4, mockHandler)).resolves.toBeInstanceOf(Function);

          expect(mockHandler).not.toHaveBeenCalled();
          expect(mockHandler).not.toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});

          expectSubscriberRegistry(instance.registries.subscribers,
                                   { channel: channel1, numSubscribers: 1 },
                                   { channel: channel2, numSubscribers: 1 },
                                   { channel: channel3, numSubscribers: 1 },
                                   { channel: channel4, numSubscribers: 1 },);

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 4 });
      });

      it('unsubscribe should update the registry', async () => {
          const channel = 'channelName';
          const mockHandler = jest.fn();
          const unsubscribeMock = jest.fn();

          instance.queueSystem.registerSubscriber.mockReturnValue(Promise.resolve(unsubscribeMock));
          instance.queueSystem.process.mockReturnValue(Promise.resolve(_.noop));

          const unsubscriber = await instance.subscribe(channel, mockHandler);

          expect(mockHandler).not.toHaveBeenCalled();
          expect(unsubscribeMock).not.toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});
          expectSubscriberRegistry(instance.registries.subscribers, { channel, numSubscribers: 1 });
          expectTransportMocksToHaveBeeenCalled(instance, { name: 'process', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 1 });
          clearTransportMocks(instance);

          unsubscriber();
          expect(mockHandler).not.toHaveBeenCalled();
          expect(unsubscribeMock).toHaveBeenCalled();
          expect(instance.inboxes).toEqual({[`stlr:n:source:subscriptionInbox`]: true});
          expectSubscriberRegistry(instance.registries.subscribers, { channel, numSubscribers: 0 });
      });
  });

  describe('subscribeGroup', () => {
      it('Subscribe on one channel with one group', async () => {
        const channel = 'channelName';
        const groupId = 'groupId';
        const mockHandler = jest.fn();
        const data = { headers: { channel }, body: { message: "Hello World"} };
        
        instance.queueSystem.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
        instance.queueSystem.process.mockReturnValue(Promise.resolve(_.noop));

        await expect(instance.subscribeGroup(groupId, channel, mockHandler)).resolves.toBeInstanceOf(Function);

        expect(mockHandler).not.toHaveBeenCalled();
        expect(instance.inboxes).toEqual({ [`stlr:s:${groupId}:subscriptionInbox`]: true });

        expectSubscriberRegistry(instance.registries.subscribers, { channel, numSubscribers: 1 });

        expectTransportMocksToHaveBeeenCalled(instance, { name: 'processGroup', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 1 });
        const subscriptionHandler = _.last(instance.queueSystem.processGroup.mock.calls[0]);
        clearTransportMocks(instance);

        subscriptionHandler({ data });

        expect(mockHandler.mock.calls).toHaveLength(1);
        expect(instance.inboxes).toEqual({[`stlr:s:${groupId}:subscriptionInbox`]: true});
        expectSubscriberRegistry(instance.registries.subscribers, { channel, numSubscribers: 1 });
        expectTransportMocksToHaveBeeenCalled(instance);
      });

      it('Subscribe on multiple channels with one group', async () => {
        const channelPrefix = 'sub-multiple-channels-one-group-';
        const groupId = 'sub-group-id-1';
        const mockHandler = jest.fn();
        const data = { headers: { channel: `${channelPrefix}1` }, body: { message: "Hello World"} };

        instance.queueSystem.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
        instance.queueSystem.process.mockReturnValue(Promise.resolve(_.noop));

        await expect(instance.subscribeGroup(groupId, `${channelPrefix}1`, mockHandler)).resolves
          .toBeInstanceOf(Function);
        await expect(instance.subscribeGroup(groupId, `${channelPrefix}2`, mockHandler)).resolves
          .toBeInstanceOf(Function);
        await expect(instance.subscribeGroup(groupId, `${channelPrefix}3`, mockHandler)).resolves
          .toBeInstanceOf(Function);

        expect(mockHandler).not.toHaveBeenCalled();
        expect(instance.inboxes).toEqual({ [`stlr:s:${groupId}:subscriptionInbox`]: true });

        expectSubscriberRegistry(instance.registries.subscribers,
                                 {
                                     channel: `${channelPrefix}1`,
                                     numSubscribers: 1
                                 },
                                 {
                                     channel: `${channelPrefix}2`,
                                     numSubscribers: 1
                                 },
                                 {
                                     channel: `${channelPrefix}3`,
                                     numSubscribers: 1
                                 });

        expectTransportMocksToHaveBeeenCalled(instance, { name: 'processGroup', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 3 });
        const subscriptionHandler = _.last(instance.queueSystem.processGroup.mock.calls[0]);

        clearTransportMocks(instance);

        subscriptionHandler({ data }, groupId);

        expect(mockHandler.mock.calls).toHaveLength(1);
        expect(instance.inboxes).toEqual({[`stlr:s:${groupId}:subscriptionInbox`]: true});
        expectSubscriberRegistry(instance.registries.subscribers,
                                 {
                                   channel: `${channelPrefix}1`,
                                   numSubscribers: 1
                                 },
                                 {
                                   channel: `${channelPrefix}2`,
                                   numSubscribers: 1
                                 },
                                 {
                                   channel: `${channelPrefix}3`,
                                   numSubscribers: 1
                                 });
        expectTransportMocksToHaveBeeenCalled(instance);
      });
      
    it('Subscribe on different channels with multiple groups', async () => {
      const channel = 'sub-multiple-channels-one-group-';
      const groupId = 'sub-group-id-';
      const mockHandler = jest.fn();
      const data = { headers: { channel }, body: { message: "Hello World"} };

      instance.queueSystem.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
      instance.queueSystem.process.mockReturnValue(Promise.resolve(_.noop));

      await expect(instance.subscribeGroup(`${groupId}1`, channel, mockHandler)).resolves
        .toBeInstanceOf(Function);
      await expect(instance.subscribeGroup(`${groupId}2`, channel, mockHandler)).resolves
        .toBeInstanceOf(Function);
      await expect(instance.subscribeGroup(`${groupId}3`, channel, mockHandler)).resolves
        .toBeInstanceOf(Function);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(instance.inboxes).toEqual({ [`stlr:s:${groupId}1:subscriptionInbox`]: true,
                                         [`stlr:s:${groupId}2:subscriptionInbox`]: true,
                                         [`stlr:s:${groupId}3:subscriptionInbox`]: true });

      expectSubscriberRegistry(instance.registries.subscribers, { channel, numSubscribers: 3 });

      expectTransportMocksToHaveBeeenCalled(instance, { name: 'processGroup', numCalls: 3 }, { name: 'registerSubscriber', numCalls: 3 });
      const subscriptionHandler1 = _.last(instance.queueSystem.processGroup.mock.calls[0]);
      const subscriptionHandler2 = _.last(instance.queueSystem.processGroup.mock.calls[1]);
      const subscriptionHandler3 = _.last(instance.queueSystem.processGroup.mock.calls[2]);

      clearTransportMocks(instance);

      subscriptionHandler1({ data });
      subscriptionHandler2({ data });
      subscriptionHandler3({ data });

      expect(mockHandler.mock.calls).toHaveLength(3);
      expect(instance.inboxes).toEqual({ [`stlr:s:${groupId}1:subscriptionInbox`]: true,
                                         [`stlr:s:${groupId}2:subscriptionInbox`]: true,
                                         [`stlr:s:${groupId}3:subscriptionInbox`]: true });
      expectSubscriberRegistry(instance.registries.subscribers, { channel, numSubscribers: 3 });
      expectTransportMocksToHaveBeeenCalled(instance);
    });
      
    it('Subscribe on the same channel multiple times causes an error', async () => {
      const channel = 'channelName';
      const groupId = 'sub-group-id-1';
      const inbox = `stlr:s:${groupId}:subscriptionInbox`;

      const mockHandler1 = jest.fn();
      const mockHandler2 = jest.fn();
      const data = { headers: { channel }, body: { message: "Hello World"} };
      instance.queueSystem.registerSubscriber.mockReturnValue(Promise.resolve(_.noop));
      instance.queueSystem.process.mockReturnValue(Promise.resolve(_.noop));

      await expect(instance.subscribeGroup(groupId, channel, mockHandler1)).resolves.toBeInstanceOf(Function);
      try {
        instance.subscribeGroup(groupId, channel, mockHandler2)
      } catch (error) {
        expect(error).toEqual(new Error(`Cannot have more that once per url in registries.subscribers. "channelName.sub-group-id-1" has already added`))
      }

      expect(mockHandler1).not.toHaveBeenCalled();
      expect(mockHandler2).not.toHaveBeenCalled();
      expect(instance.inboxes).toEqual({[inbox]: true});

      expectSubscriberRegistry(instance.registries.subscribers, { inbox, channel, numSubscribers: 1 });

      expectTransportMocksToHaveBeeenCalled(instance, { name: 'processGroup', numCalls: 1 }, { name: 'registerSubscriber', numCalls: 1 });
      const subscriptionHandler = _.last(instance.queueSystem.processGroup.mock.calls[0]);

      clearTransportMocks(instance);

      subscriptionHandler({ data }, groupId);

      expect(mockHandler1).toHaveBeenCalled();
      expect(mockHandler2).not.toHaveBeenCalled();
      expect(instance.inboxes).toEqual({[inbox]: true});
      expectSubscriberRegistry(instance.registries.subscribers, { inbox, channel, numSubscribers: 1 });
      expectTransportMocksToHaveBeeenCalled(instance);
    });

  });

  describe('publish', () => {

      it('Publish no subscribers', async () => {
          const channel = 'channelName';
          const payload = { headers: {}, body: { foo: 'bar' }};

          instance.queueSystem.getSubscribers.mockReturnValue(Promise.resolve([]));
          instance.queueSystem.enqueue.mockReturnValue(Promise.resolve(true));

          await expect(instance.publish(channel, payload)).resolves.toEqual([]);

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'getSubscribers', numCalls: 1 });
      });

      it('Publish to single subscriber', async () => {
          const channel = 'channelName';
          const payload = { headers: {}, body: { foo: 'bar' }};

          instance.queueSystem.getSubscribers.mockReturnValue(Promise.resolve(['queueName']));
          instance.queueSystem.enqueue.mockReturnValue(Promise.resolve(true));

          await expect(instance.publish(channel, payload)).resolves.toEqual([true]);

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'getSubscribers', numCalls: 1}, {name: 'enqueue', numCalls: 1 });
      });

      it('Publish to multiple subscribers', async () => {
          const channel = 'channelName';
          const payload = { headers: {}, body: { foo: 'bar' }};

          instance.queueSystem.getSubscribers.mockReturnValue(Promise.resolve(['queueName1', 'queueName2', 'queueName3']));
          instance.queueSystem.enqueue.mockReturnValue(Promise.resolve(true));

          await expect(instance.publish(channel, payload)).resolves.toEqual([true, true, true]);

          expectTransportMocksToHaveBeeenCalled(instance, { name: 'getSubscribers', numCalls: 1}, {name: 'enqueue', numCalls: 3 });
      });
  });

  describe('fireAndForget', () => {
      it('Should call enqueue but not await a response', async () => {
          const serviceName = 'serviceName';
          const queueName = `${serviceName}:queueName`;
          const req = { headers: { queueName }, body: { foo: 'bar' }};

          instance.queueSystem.enqueue.mockReturnValue(Promise.resolve(true));

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

          instance.queueSystem.enqueue.mockReturnValue(Promise.resolve(true));

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

            instance.queueSystem.enqueue.mockReturnValue(Promise.resolve(true));

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

            instance.queueSystem.enqueue.mockReturnValue(Promise.resolve(true));

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

        instance.queueSystem.enqueue.mockReturnValue(Promise.resolve(true));

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
            instance.queueSystem.process.mockReturnValue(Promise.resolve(true));

            await expect(instance.addRequestHandler(url, mockHandler)).resolves.toEqual(true);

            expectTransportMocksToHaveBeeenCalled(
              instance,
              { name: 'processGroup', numCalls: 1, args: [[100, requestInbox, expect.any(Function)]] }
            );
            expect(instance.registries.requestHandlers).toEqual({ [url]: mockHandler } );
            expect(mockHandler).not.toHaveBeenCalled();

            instance.queueSystem.processGroup.mock.calls[0][2]({ data: req });
            await Promise.delay(50);
            
            expect(mockHandler).toHaveBeenCalled();
            expectTransportMocksToHaveBeeenCalled(
              instance,
              { name: 'processGroup', numCalls: 1, args: [[100, requestInbox, expect.any(Function)]] },
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
        instance.queueSystem.process.mockReturnValue(Promise.resolve(true));

        await expect(instance.addRequestHandler(url, mockHandler)).resolves.toEqual(true);

        expectTransportMocksToHaveBeeenCalled(
          instance,
          { name: 'processGroup', numCalls: 1, args: [[100, requestInbox, expect.any(Function)]] }
        );
        expect(instance.registries.requestHandlers).toEqual({ [url]: mockHandler });
        expect(mockHandler).not.toHaveBeenCalled();

        instance.queueSystem.processGroup.mock.calls[0][2]({ data: req });
        await Promise.delay(50);

        expect(mockHandler).toHaveBeenCalled();
        expectTransportMocksToHaveBeeenCalled(
          instance,
          { name: 'processGroup', numCalls: 1, args: [[100, requestInbox, expect.any(Function)]] },
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
        instance.queueSystem.process.mockReturnValue(Promise.resolve(true));

        await expect(instance.addRequestHandler(url, mockHandler)).resolves.toEqual(true);

        expectTransportMocksToHaveBeeenCalled(
          instance,
          { name: 'processGroup', numCalls: 1, args: [[100, requestInbox, expect.any(Function)]] }
        );
        expect(instance.registries.requestHandlers).toEqual({ [url]: mockHandler });
        expect(mockHandler).not.toHaveBeenCalled();

        instance.queueSystem.processGroup.mock.calls[0][2]({ data: req });
        await Promise.delay(50);

        expect(mockHandler).toHaveBeenCalled();
        expectTransportMocksToHaveBeeenCalled(
          instance,
          { name: 'processGroup', numCalls: 1, args: [[100, requestInbox, expect.any(Function)]] }
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
      instance.queueSystem.stopProcessing.mockReturnValue(Promise.resolve(true));

      instance.inboxes = { inbox1: true, inbox2: true };
      instance.registries.subscribers = { subscriber1: _.noop };
      instance.inflightRequests = { inflight: _.noop };
      instance.registries.requestHandlers = { request1: _.noop, request2: _.noop };

      await instance.reset();

      expectTransportMocksToHaveBeeenCalled(
        instance,
        { name: 'stopProcessing', numCalls: 2, args: [['inbox1'], ['inbox2']] }
      );

      expect(instance.inboxes).toEqual({});
      expect(instance.registries.subscribers).toEqual({});
      expect(instance.inflightRequests).toEqual({});
      expect(instance.registries.requestHandlers).toEqual({});
    });
  });
});