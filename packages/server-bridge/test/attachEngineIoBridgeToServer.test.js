import Promise from 'bluebird';
import _ from 'lodash';
import url from 'url';
import StellarError from '@stellarjs/stellar-error';
import RedisClient from '@stellarjs/transport-bull/lib-es6/config-redisclient';
import engine from 'engine.io';
import defaultStellarFactory from '../src/factories/defaultStellarFactory';

import attachEngineIoBridgeToServer from '../src/attachEngineIoBridgeToServer';
import instrumentationMockFactory from '../src/factories/instrumentationMockFactory';
import handleMessageFactory from './utils/handleMessageFactory';

const clearRedis = (redisClient) => {
  redisClient = new RedisClient(console);
  if (redisClient.defaultConnection.options.db === 7) {
    console.info('Flush redis');
    return redisClient.defaultConnection.flushdb();
  }
  throw new Error('Redis not in test mode');
};

describe('attachEngineIoBridgeToServer', () => {
  let redisClient;
  let instrumentation = null;
  let keepAlive;
  const errorHandler = jest.fn();
  const offlineFn = jest.fn();
  const mw = jest.fn((req, next) => next());
  let server;

  beforeAll(async () => {
    jest.unmock('@stellarjs/transport-bull');
    await clearRedis(redisClient);
    await Promise.delay(100);
    instrumentation = instrumentationMockFactory({ log: console });
    instrumentation.numOfConnectedClients = jest.fn();
    server = engine.listen(8091, { transports: ['websocket', 'polling'] }, () => {
      console.info('@Bridge: Server is running');
    });

    attachEngineIoBridgeToServer({
      server,
      log: console,
      instrumentation,
      errorHandlers: [errorHandler],
      handleMessageFactory,
      middlewares: [{ match: /.*/, mw }],
      newSessionHandlers: [
        ({ log, request, session }) => {
          const parsedUrl = url.parse(request.url, true);
          const userId = parsedUrl.query['x-auth-user'];
          const queryParams =
                                         parsedUrl.query;

          if (userId === '3') {
            throw new StellarError('Authentication Error');
          } else if (userId === '4') {
            throw new Error('Other Error');
          }

          console.info(`QueryParams: ${JSON.stringify(queryParams)}`);
          return {
            offlineFn,
            authenticatedUserId: userId,
            ..._.omit(queryParams, ['x-auth-user', 'x-auth-token', 'x-auth-token-type']),
          };
        },
      ],
    });

    const stellarFactory = defaultStellarFactory({ log: console });

    const PUBLISH_ACTIONS = {
      CREATED: 'CREATED',
      UPDATED: 'UPDATED',
      REMOVED: 'REMOVED',
    };

    const publisher = stellarFactory.stellarAppPubSub();

    function kongEveryHalfSecond() {
      publisher.publish('stellarBridge:kong:stream', { text: `kong` }, { action: PUBLISH_ACTIONS.UPDATED });
      setTimeout(kongEveryHalfSecond, 500);
    }

    keepAlive = jest.fn();
    const handler = stellarFactory.stellarHandler();
    handler.get('sampleService:ping', () => ({ text: `pong` }));
    handler.get('sampleService:keepAlive', () => {
      console.log('keepAlive');
      keepAlive();
    });

    handler.update('sampleService:timeout', () => Promise.delay(31 * 1000).then(() => ({ text: `pong` })));
    handler.get('sampleService:pingError', () => {
      throw new Error('pongError');
    });
    handler.handleRequest('sampleService:king:subscribe', () => ({ text: `kong` }));

    setTimeout(kongEveryHalfSecond, 500);
  });

  afterAll(async () => {
    server.close();
    redisClient.defaultConnection.quit();
    return redisClient.closeAll();
  });

  afterEach(async () => {
    await Promise.delay(100);
    instrumentation.numOfConnectedClients.mockClear();
    errorHandler.mockClear();
    offlineFn.mockClear();
    mw.mockClear();
    keepAlive.mockClear();
  });

  describe('call server', () => {
    it('on auth error dont reconnect', async () => {
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      try {
        await stellarSocket.connect('localhost:8091', {
          secure: false,
          userId: '3',
          token: '123',
          tokenType: 'API',
          eioConfig: { upgrade: false },
        });
        fail('error');
      } catch (e) {
        expect(mw).not.toHaveBeenCalled();
        expect(errorHandler).toHaveBeenCalled();
      }
    });

    it('on other error reconnect automatically', async () => {
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      try {
        await stellarSocket.connect('localhost:8091', {
          secure: false,
          userId: '4',
          token: '123',
          tokenType: 'API',
          eioConfig: { upgrade: false },
        });
        fail('error');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e.message).toEqual('Authentication Error');
        expect(errorHandler).toHaveBeenCalled();
      }
    });

    it('instrumentation numOfConnectedClients should work on connection error', async () => {
      expect(instrumentation.numOfConnectedClients.mock.calls).toEqual([]);
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      try {
        await stellarSocket.connect('localhost:8091', {
          secure: false,
          userId: '4',
          token: '123',
          tokenType: 'API',
          eioConfig: { upgrade: false },
        });
      } catch (e) {
        await Promise.delay(1000);
        expect(mw).not.toHaveBeenCalled();
        expect(errorHandler).toHaveBeenCalled();
        expect(instrumentation.numOfConnectedClients.mock.calls)
          .toEqual([[expect.any(Number), 1], [expect.any(Number), 0]]);
      }
    });

    it('instrumentation numOfConnectedClients should work', async () => {
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      await stellarSocket.connect('localhost:8091', {
        secure: false,
        userId: '123',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
        params: {
          extraParam: 1,
        },
      });

      await stellarSocket.close();
      await Promise.delay(1000);
      expect(errorHandler).not.toHaveBeenCalled();

      expect(instrumentation.numOfConnectedClients.mock.calls)
        .toEqual([[expect.any(Number), 1], [expect.any(Number), 0]]);
    });

    it('request response should work', async () => {
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      try {
        await stellarSocket.connect('localhost:8091', {
          secure: false,
          userId: '123',
          token: '123',
          tokenType: 'API',
          eioConfig: { upgrade: false },
          params: {
            extraParam: 1,
          },
        });
      } catch (e) {
        console.error(e);
      }
      const result = await stellarSocket.stellar.get('sampleService:ping');
      expect(result.text).toBe('pong');
      expect(errorHandler).not.toHaveBeenCalled();
      expect(mw).toHaveBeenCalled();

      await stellarSocket.close();
    });

    it('fireForget should work', async () => {
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      try {
        await stellarSocket.connect('localhost:8091', {
          secure: false,
          userId: '123',
          token: '123',
          tokenType: 'API',
          eioConfig: { upgrade: false },
          params: {
            extraParam: 1,
          },
        });
      } catch (e) {
        console.error(e);
      }

      stellarSocket.stellar.get('sampleService:keepAlive', {}, { requestOnly: true });
      await Promise.delay(1000);
      expect(errorHandler).not.toHaveBeenCalled();
      expect(mw).toHaveBeenCalled();
      expect(keepAlive).toHaveBeenCalled();

      await stellarSocket.close();
    });

    it('sessionId set - sessionId should equal sessionId header', async () => {
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      await stellarSocket.connect('localhost:8091', {
        secure: false,
        userId: '123',
        sessionId: '456',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
        params: {
          extraParam: 1,
        },
      });

      expect(stellarSocket.sessionId).toEqual('456');
      expect(stellarSocket.userId).toEqual('123');
      expect(errorHandler).not.toHaveBeenCalled();
      expect(mw).not.toHaveBeenCalled();

      await stellarSocket.close();
    });

    it('no sessionId set - sessionId should equal to socketId ', async () => {
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      await stellarSocket.connect('localhost:8091', {
        secure: false,
        userId: '123',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
        params: {
          extraParam: 1,
        },
      });

      expect(stellarSocket.sessionId).toBeTruthy();
      expect(stellarSocket.sessionId).toEqual(stellarSocket.socket.id);
      expect(stellarSocket.userId).toEqual('123');
      expect(errorHandler).not.toHaveBeenCalled();

      await stellarSocket.close();
    });

    // it('custom timeout should extend normal timeout', (done) => {
    //   const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
    //   stellarSocket.connect('localhost:8091', {
    //     secure: false,
    //     userId: '123',
    //     token: '123',
    //     tokenType: 'API',
    //     eioConfig: { upgrade: false },
    //     params: {
    //       extraParam: 1,
    //     },
    //   })
    //     .then(
    //       () => stellarSocket.stellar.update('sampleService:timeout', {}, { headers: { requestTimeout: 32 * 1000 } }))
    //     .then(() => {
    //       done();
    //     });
    // }, 40 * 1000);
    //
    // it('custom timeout should expire', (done) => {
    //   const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
    //   stellarSocket.connect('localhost:8091', {
    //     secure: false,
    //     userId: '123',
    //     token: '123',
    //     tokenType: 'API',
    //     eioConfig: { upgrade: false },
    //     params: {
    //       extraParam: 1,
    //     },
    //   })
    //     .then(() => stellarSocket.stellar.update('sampleService:timeout', {}, { headers: { requestTimeout: 200 } }))
    //     .then(() => {
    //       fail(`Timeout should have expired.`);
    //     })
    //     .catch(() => {
    //       done();
    //     });
    // }, 10000);


    it('should subscribe', (done) => {
      let reactiveResolve;
      const reactivePromise = new Promise((resolve) => { reactiveResolve = resolve; });
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      stellarSocket.connect('localhost:8091', {
        secure: false,
        userId: '123',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
      });
      const stopper = stellarSocket.stellar.pubsub.subscribe(
        'stellarBridge:kong:stream',
        (reactiveMessage) => {
          console.info(`@StellarEngineIO.getReactive2: received stream: ${JSON.stringify(reactiveMessage)}`);
          reactiveResolve(reactiveMessage);
        }
      );
      reactivePromise.then((reactiveMessage) => {
        console.info('reactiveMessage received');
        expect(reactiveMessage).toEqual({ text: 'kong' });
        return stopper;
      })
      .then((doStop) => {
        doStop();
        stellarSocket.close();
      })
      .then(() => {
        // expect(errorHandler).toHaveBeenCalled();
        done();
      });
    });

    it('should getReactive calls', (done) => {
      let reactiveResolve;
      let stopper;
      const reactivePromise = new Promise((resolve) => { reactiveResolve = resolve; });
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      stellarSocket.connect('localhost:8091', {
        secure: false,
        userId: '123',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
      });
      const retval = stellarSocket.stellar.getReactive(
        'sampleService:king',
        'stellarBridge:kong:stream',
        { text: 'king' },
        (reactiveMessage) => {
          console.info(`@StellarEngineIO.getReactive2: received stream: ${JSON.stringify(reactiveMessage)}`);
          reactiveResolve(reactiveMessage);
        });
      stopper = retval.onStop;
      retval
        .results
        .then((result) => {
          console.info('result received');
          console.info(JSON.stringify(result));
          expect(result.text).toBe('kong');
          return reactivePromise;
        })
        .then((reactiveMessage) => {
          console.info('reactiveMessage received');
          expect(reactiveMessage).toEqual({ text: 'kong' });
          return stopper;
        })
        .then((doStop) => {
          doStop();
          stellarSocket.close();
        })
        .then(() => {
          // expect(errorHandler).toHaveBeenCalled();
          done();
        });
    });

    it('should disallow multiple getReactive calls', (done) => {
      let reactiveResolve;
      const reactivePromise = new Promise((resolve) => { reactiveResolve = resolve; });

      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      stellarSocket.connect('localhost:8091', {
        secure: false,
        userId: '123',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
      });
      const retval1 = stellarSocket.stellar.getReactive(
        'sampleService:king',
        'stellarBridge:kong:stream',
        { text: 'king' },
        (reactiveMessage) => {
          console.info(`@StellarEngineIO.getReactive2: received stream: ${JSON.stringify(reactiveMessage)}`);
          reactiveResolve(reactiveMessage);
        });

      const retval2 = stellarSocket.stellar.getReactive(
        'sampleService:king',
        'stellarBridge:kong:stream',
        { text: 'king' },
        (reactiveMessage) => {
          console.info(`@StellarEngineIO.getReactive2: received stream: ${JSON.stringify(reactiveMessage)}`);
          reactiveResolve(reactiveMessage);
        });

      retval1
        .results
        .then((result) => {
          console.info('result 1 received');
          console.info(JSON.stringify(result));
          expect(result.text).toEqual('kong');
          return retval2.results;
        })
        .then((result) => {
          fail(`retval2.result ${JSON.stringify(result)} should NOT be returned`);
        })
        .catch((errorResult) => {
          console.info('result 2 received');
          console.info(JSON.stringify(errorResult));
          expect(_.first(errorResult.message.split(':')))
            .toMatch('Multiple subscriptions to same channel (stellarBridge');
          console.info(`Calling stop 1 ${JSON.stringify(retval1)}`);
          return retval1.onStop;
        })
        .then((doStop1) => {
          console.info(`Calling stop 1 ${JSON.stringify(doStop1)} ${typeof doStop1}`);
          doStop1();
          return retval2.onStop;
        })
        .then(() => {
          expect(errorHandler).not.toHaveBeenCalled();
          done();
        });
    });

    it('request response should bridge application errors', async () => {
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      await stellarSocket.connect('localhost:8091', {
        secure: false,
        userId: '123',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
      });

      try {
        await stellarSocket.stellar.get('sampleService:pingError');
        fail();
      } catch (e) {
        expect(e.message).toBe('pongError');
        expect(errorHandler).not.toHaveBeenCalled();
      }
    });

    it('should report bridge messageHandling errors', async () => {
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      await stellarSocket.connect('localhost:8091', {
        secure: false,
        userId: '123',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
      });

      try {
        await stellarSocket.stellar.get('sampleService:ping', {}, { headers: { fakeHandleMessageError: true } });
        fail();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(errorHandler).toHaveBeenCalled();
      }
    });

    it('should call offlineFn when the socket closes', async () => {
      const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
      await stellarSocket.connect('localhost:8091', {
        secure: false,
        userId: '123',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
      });

      await stellarSocket.close();
      await Promise.delay(50);

      expect(offlineFn).toHaveBeenCalled();
    });
  });
});
