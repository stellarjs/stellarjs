/**
 * Created by arolave on 07/06/2017.
 */
import Promise from 'bluebird';
import child_process from 'child_process';
import RedisClient from '@stellarjs/transport-redis/lib-es6/config-redisclient';
import { StellarError } from '@stellarjs/core';

let redisClient;
const clearRedis = () => {
  redisClient = new RedisClient(console);
  if (redisClient.defaultConnection.options.db === 7) {
    console.info('Flush redis');
    return redisClient.defaultConnection.flushdb()
  } else {
    throw new Error("Redis not in test mode");
  }
};

let proc;
beforeAll((done) => {
  clearRedis()
    .then(() => proc = child_process.fork(`${__dirname}/examples/index`))
    .delay(3500)
    .then(() => {
      console.info('beforeAll done');
      done()
    });
});

afterAll(() => {
  proc.kill('SIGINT');
  redisClient.defaultConnection.quit();
});

describe('call server', () => {
  it('on auth error dont reconnect', () => {
    let stellarSocket = require('@stellarjs/engine.io-client').default;
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
      .catch((e) => {
        expect(e).toBeInstanceOf(StellarError);
        done();
      });
  });

  it('on other error reconnect automatically', (done) => {
    let stellarSocket = require('@stellarjs/engine.io-client').default;
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
      .catch((e) => {
        expect(e).toBeInstanceOf(Error);
        done();
      });
  });

  it('request response should work', (done) => {
    let stellarSocket = require('@stellarjs/engine.io-client').default;
    stellarSocket.connect('localhost:8091', {
      secure: false,
      userId: '123',
      token: '123',
      tokenType: 'API',
      eioConfig: { upgrade: false },
    });
    return stellarSocket.stellar
      .get('sampleService:ping')
      .then((result) => {
        console.info(JSON.stringify(result));
        expect(result.text).toBe('pong');
        stellarSocket.close();
      })
      .then(() => {
        console.info('blah');
        done();
      })
      .catch((e) => {console.error(e)});
  });

  it('should getReactive calls', (done) => {
    let reactiveResolve;
    let stopper;
    const reactivePromise = new Promise((resolve) => {reactiveResolve = resolve});
    const stellarSocket = require('@stellarjs/engine.io-client').default;
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
        reactiveResolve(reactiveMessage)
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
        expect(reactiveMessage).toEqual({text: 'kong'});
        return stopper;
      })
      .then((doStop) => {
        doStop();
        stellarSocket.close()
      })
      .then(() => done());
  });
  
  it('request response should work when errors are thrown', (done) => {
    let stellarSocket = require('@stellarjs/engine.io-client').default;
    stellarSocket.connect('localhost:8091', {
      secure: false,
      userId: '123',
      token: '123',
      tokenType: 'API',
      eioConfig: { upgrade: false },
    });
    return stellarSocket.stellar
      .get('sampleService:pingError')
      .catch((e) => {
        expect(e.message).toBe('pongError');
        stellarSocket.close();
        done()
      });
  });
});
