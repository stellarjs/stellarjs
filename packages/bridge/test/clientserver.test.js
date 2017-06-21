/**
 * Created by arolave on 07/06/2017.
 */
import Promise from 'bluebird';
import child_process from 'child_process';
import RedisClient from '@stellarjs/transport-redis/lib-es6/config-redisclient';

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
    .then(() => done());
});

afterAll(() => {
  proc.kill('SIGINT');
  redisClient.defaultConnection.quit();
});

// jest.setTimeout(10000); // for jest 21

describe('call server', () => {
  it('request response should work', (done) => {
    let stellarSocket;
    Promise
      .delay(3000)
      .then(() => {
        stellarSocket = require('@stellarjs/engine.io-client').default;
        stellarSocket.connect('localhost:8091', {
          tryToReconnect: false,
          secure: false,
          userId: '123',
          token: '123',
          tokenType: 'API',
          eioConfig: { upgrade: false },
        });
        return stellarSocket.stellar.get('sampleService:ping')
      })
      .then((result) => {
        console.info(JSON.stringify(result));
        expect(result.text).toBe('pong');
        stellarSocket.close();
      })
      .then(() => done());
  });

  it('should getReactive calls', (done) => {
    let stellarSocket;
    let reactiveResolve;
    let stopper;
    const reactivePromise = new Promise((resolve) => {reactiveResolve = resolve});
    Promise
      .delay(3000)
      .then(() => {
        stellarSocket = require('@stellarjs/engine.io-client').default;
        stellarSocket.connect('localhost:8091', {
          tryToReconnect: false,
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
        return retval.results;
      })
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
});
