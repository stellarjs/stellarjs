/**
 * Created by arolave on 07/06/2017.
 */
import Promise from 'bluebird';
import RedisClient from '@stellarjs/transport-redis/lib-es6/config-redisclient';
import { StellarError } from '@stellarjs/core';
import _ from 'lodash';

let redisClient;
const clearRedis = () => {
  redisClient = new RedisClient(console);
  if (redisClient.defaultConnection.options.db === 7) {
    console.info('Flush redis');
    return redisClient.defaultConnection.flushdb();
  }
  throw new Error('Redis not in test mode');
};

let shutdown = null;
let instrumentation = null;
beforeAll((done) => {
  clearRedis()
    .then(() => {
      const pinger = require('./examples');
      instrumentation = require('./examples').instrumentation;
      instrumentation.numOfConnectedClients = jest.fn();
      pinger.start();
      shutdown = pinger.shutdown;
    })
    .delay(3500)
    .then(() => {
      console.info('beforeAll done');
      done();
    });
});

afterEach(() => {
  instrumentation.numOfConnectedClients.mockClear();
});

afterAll(() => {
  console.error('PROC.KILL');
  shutdown();
  redisClient.defaultConnection.quit();
  redisClient.closeAll();
});

describe('call server', () => {
  it('on auth error dont reconnect', () => {
    const stellarSocket = require('@stellarjs/engine.io-client').stellarSocket();
    stellarSocket
      .connect('localhost:8091', {
        secure: false,
        userId: '3',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
      })
      .then(() => {
        fail('error');
      })
      .catch(StellarError, (e) => {
        done();
      });
  });

  it('on other error reconnect automatically', (done) => {
    const stellarSocket = require('@stellarjs/engine.io-client').stellarSocket();
    stellarSocket
      .connect('localhost:8091', {
        secure: false,
        userId: '4',
        token: '123',
        tokenType: 'API',
        eioConfig: { upgrade: false },
      })
      .then(() => {
        fail('error');
      })
      .catch(Error, (e) => {
        expect(e).toBeInstanceOf(Error);
        expect(e.message).toEqual('Authentication Error');
        done();
      });
  });

  it('instrumentation numOfConnectedClients should work on connection error', (done) => {
    const stellarSocket = require('@stellarjs/engine.io-client').stellarSocket();
    stellarSocket
            .connect('localhost:8091', {
              secure: false,
              userId: '4',
              token: '123',
              tokenType: 'API',
              eioConfig: { upgrade: false },
            })
            .catch(Error, (e) => {
              done();
            }).delay(1000)
            .then(() => {
              expect(instrumentation.numOfConnectedClients.mock.calls).toEqual([[expect.any(Number), 1], [expect.any(Number), 0]]);
            });
  });


  it('instrumentation numOfConnectedClients should work', (done) => {
    const stellarSocket = require('@stellarjs/engine.io-client').stellarSocket();
    stellarSocket.connect('localhost:8091', {
      secure: false,
      userId: '123',
      token: '123',
      tokenType: 'API',
      eioConfig: { upgrade: false },
      params: {
        extraParam: 1,
      },
    })
        .then(() => {
          stellarSocket.close();
        })
        .delay(1000)
            .then(() => {
              expect(instrumentation.numOfConnectedClients.mock.calls).toEqual([[expect.any(Number), 1], [expect.any(Number), 0]]);
              done();
            });
  });

  it('request response should work', (done) => {
    const stellarSocket = require('@stellarjs/engine.io-client').stellarSocket();
    stellarSocket.connect('localhost:8091', {
      secure: false,
      userId: '123',
      token: '123',
      tokenType: 'API',
      eioConfig: { upgrade: false },
      params: {
        extraParam: 1,
      },
    }).then(() => stellarSocket.stellar.get('sampleService:ping'))
      .then((result) => {
        expect(result.text).toBe('pong');
        stellarSocket.close();
      })
      .then(() => {
        done();
      });
  });

  it('custom timeout should extend normal timeout', (done) => {
    const stellarSocket = require('@stellarjs/engine.io-client').stellarSocket();
    stellarSocket.connect('localhost:8091', {
      secure: false,
      userId: '123',
      token: '123',
      tokenType: 'API',
      eioConfig: { upgrade: false },
      params: {
        extraParam: 1,
      },
    })
      .then(() => stellarSocket.stellar.update('sampleService:timeout', {}, { headers: { requestTimeout: 32 * 1000 } }))
      .then(() => {
        done();
      });
  }, 40 * 1000);

  it('custom timeout should expire', (done) => {
    const stellarSocket = require('@stellarjs/engine.io-client').stellarSocket();
    stellarSocket.connect('localhost:8091', {
      secure: false,
      userId: '123',
      token: '123',
      tokenType: 'API',
      eioConfig: { upgrade: false },
      params: {
        extraParam: 1,
      },
    })
      .then(() => stellarSocket.stellar.update('sampleService:timeout', {}, { headers: { requestTimeout: 200 } }))
      .then(() => {
        fail(`Timeout should have expired.`);
      })
      .catch(done);
  }, 10000);

  it('should getReactive calls', (done) => {
    let reactiveResolve;
    let stopper;
    const reactivePromise = new Promise((resolve) => { reactiveResolve = resolve; });
    const stellarSocket = require('@stellarjs/engine.io-client').stellarSocket();
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
      .then(() => done());
  });

  it('should disallow multiple getReactive calls', (done) => {
    let reactiveResolve;
    const reactivePromise = new Promise((resolve) => { reactiveResolve = resolve; });

    const stellarSocket = require('@stellarjs/engine.io-client').stellarSocket();
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
        expect(_.first(errorResult.message.split(':'))).toMatch('Multiple subscriptions to same channel (stellarBridge');
        console.info(`Calling stop 1 ${JSON.stringify(retval1)}`);
        return retval1.onStop;
      })
      .then((doStop1) => {
        console.info(`Calling stop 1 ${JSON.stringify(doStop1)} ${typeof doStop1}`);
        doStop1();
        return retval2.onStop;
      })
      .then(() => done());
  });

  it('request response should work when errors are thrown', (done) => {
    const stellarSocket = require('@stellarjs/engine.io-client').stellarSocket();
    stellarSocket.connect('localhost:8091', {
      secure: false,
      userId: '123',
      token: '123',
      tokenType: 'API',
      eioConfig: { upgrade: false },
    });
    return stellarSocket.stellar
      .get('sampleService:pingError')
      .catch(Error, (e) => {
        expect(e.message).toBe('pongError');
        stellarSocket.close();
        done();
      });
  });
});
