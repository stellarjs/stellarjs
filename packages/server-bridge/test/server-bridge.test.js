/**
 * Created by arolave on 07/06/2017.
 */
import Promise from 'bluebird';
import RedisClient from '@stellarjs/transport-bull/lib-es6/config-redisclient';
import StellarError from '@stellarjs/stellar-error';
import _ from 'lodash';
import axios from 'axios';

jest.unmock('@stellarjs/transport-bull');

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
beforeAll(async () => {
  await clearRedis();

  const pinger = require('./examples');
  instrumentation = require('./examples').instrumentation;
  instrumentation.numOfConnectedClients = jest.fn();
  pinger.start();

  await Promise.delay(1000);
  console.info('beforeAll done');
});

afterEach(async () => {
  await Promise.delay(1000);
  instrumentation.numOfConnectedClients.mockReset();
  console.info('afterEach done');
});

afterAll(async () => {
  console.info('afterAll');
  redisClient.defaultConnection.quit();
  return redisClient.closeAll();
});

describe('call server', () => {
  it('on auth error dont reconnect', (done) => {
    const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
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
    const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
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
    expect(instrumentation.numOfConnectedClients.mock.calls).toEqual([]);
    const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
    stellarSocket
            .connect('localhost:8091', {
              secure: false,
              userId: '4',
              token: '123',
              tokenType: 'API',
              eioConfig: { upgrade: false },
            })
            .catch(Error, (e) => {})
            .delay(1000)
            .then(() => {
              expect(instrumentation.numOfConnectedClients.mock.calls).toEqual([[expect.any(Number), 1], [expect.any(Number), 0]]);
              done();
            });
  });

  it('instrumentation numOfConnectedClients should work', (done) => {
    const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
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
    const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
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

    it('sessionId set - sessionId should equal sessionId header', (done) => {
        const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
        stellarSocket.connect('localhost:8091', {
            secure: false,
            userId: '123',
            sessionId:'456',
            token: '123',
            tokenType: 'API',
            eioConfig: { upgrade: false },
            params: {
                extraParam: 1,
            },
        }).then(() => {
            expect(stellarSocket.sessionId).toEqual('456');
            expect(stellarSocket.userId).toEqual('123');
            stellarSocket.close();
        })
        .then(() => {
          done();
        });
    });

    it('no sessionId set - sessionId should equal to socketId ', (done) => {
        const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
        stellarSocket.connect('localhost:8091', {
            secure: false,
            userId: '123',
            token: '123',
            tokenType: 'API',
            eioConfig: { upgrade: false },
            params: {
                extraParam: 1,
            },
        }).then(() => {
            expect(stellarSocket.sessionId).toBeTruthy();
            expect(stellarSocket.sessionId).toEqual(stellarSocket.socket.id);
            expect(stellarSocket.userId).toEqual('123');
            stellarSocket.close();
        })
        .then(() => {
          done();
        });
    });

  it('custom timeout should extend normal timeout', (done) => {
    const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
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
    const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
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
      .catch(() => {
        done();
      });
  }, 10000);

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
        done()
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
        expect(_.first(errorResult.message.split(':'))).toMatch('Multiple subscriptions to same channel (stellarBridge');
        console.info(`Calling stop 1 ${JSON.stringify(retval1)}`);
        return retval1.onStop;
      })
      .then((doStop1) => {
        console.info(`Calling stop 1 ${JSON.stringify(doStop1)} ${typeof doStop1}`);
        doStop1();
        return retval2.onStop;
      })
      .then(() => {
        done()
      });
  });

  it('request response should work when errors are thrown', async (done) => {
    const stellarSocket = require('@stellarjs/client-engine.io').stellarSocket();
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

    it('request response using http bridge', async () => {
        const res = await axios.post('http://localhost:8091/stellarRequest/sampleService/ping/get');
        expect(res.text).toBe('pong');
    });
});
