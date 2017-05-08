/* eslint-disable */
const { expect } = require('chai'); // eslint-disable-line
const chai = require('chai');  // eslint-disable-line
const chaiAsPromised = require('chai-as-promised'); // eslint-disable-line
const Promise = require('bluebird');
const log = console;

const {StellarPubSub, StellarRequest, StellarHandler, StellarError} = require('@stellarjs/core');
const RedisClient = require('../src/config-redisclient');

const redisTransport = require('../src/redisTransportFactory').default(log);

const stellarRequest = new StellarRequest(redisTransport, 'test', console, 1000);
const stellarHandler = new StellarHandler(redisTransport, 'test', console, 'testservice');

chai.use(chaiAsPromised);
chai.should();

const redisClient = new RedisClient(log).newConnection();
const clearRedis = (done) => {
  if (redisClient.options.db === 7) {
    log.info('Flush redis!!!');
    redisClient.flushdb(() => {
      redisClient.keys(() => {
        done();
      });
    });
  } else {
    done();
  }
};

const clearStellar = (done) => {
  clearRedis(() => {
    redisTransport.flush();
    done();
  });
};

describe('full integration req/response', () => {
  beforeEach(clearRedis);

  it('test request response', (done) => {
    stellarHandler.handleRequest('testservice:resource:get', ({ body }) => ({ text: `${body.text} worlds` }));

    stellarRequest
      .get('testservice:resource', { text: 'hello' })
      .then(result => result.should.deep.equal({ text: 'hello worlds' }))
      .then(() => done());
  });

  it('test request response with middlewares', (done) => {
    let handlerMw = 0;
    let requestMw = 0;

    stellarHandler.use('.*', (req, next) => {
      handlerMw += 1;
      return next();
    });

    stellarRequest.use('.*', (req, next) => {
      requestMw += 1;
      return next();
    });

    stellarHandler.get('testservice:resource', ({ body }) => ({ text: `${body.text} worlds` }));

    stellarRequest
      .get('testservice:resource', { text: 'hello' })
      .then(result => result.should.deep.equal({ text: 'hello worlds' }))
      .then(() => {
        handlerMw.should.equal(1);
        requestMw.should.equal(1);
        done();
      });
  });


  it('test request response error', (done) => {
    stellarHandler.get('testservice:resource2', ({ body }) => {
      const errors = new StellarError();
      errors.addPropertyError('x', 'poop');
      errors.addPropertyError('x', 'pee');
      throw errors;
    });

    stellarRequest
      .get('testservice:resource2', { text: 'hello' })
      .then(() => done(new Error('fail')))
      .catch(StellarError, (e) => {
        e.errors.should.deep.equal({ x: ['poop', 'pee'] });
        done();
      });
  });
});

describe('full integration pub/sub per inbox', () => {
  beforeEach(clearStellar);

  it('test pub sub 1 subscriber', (done) => {
    const stellar = new StellarPubSub(redisTransport, 'test', console);
    stellar.subscribe('test:channel', (message) => {
      console.log('message received');
      message.should.deep.equal({ text: 'hello world' });
      done();
    }).then(() => stellar.publish('test:channel', { text: 'hello world' }));
  });


  it('test unsubscribe', (done) => {
    const stellar = new StellarPubSub(redisTransport, 'test0', console);
    stellar.subscribe('test:channel', () => {
      console.log('message received');
      done(new Error('should not receive a message'));
    }).then((stopper) => {
      setTimeout(() => stopper().then(() => stellar.publish('test:channel', { text: 'hello world' })), 500);
      setTimeout(done, 1000);
    });
  });

  it('test resubscribe', (done) => {
    const stellar = new StellarPubSub(redisTransport, 'test0', console);
    stellar
      .subscribe('test:channel', () => {
        console.log('1. message received');
        done(new Error('should not receive a message'));
      })
      .then(stopper => setTimeout(() => stopper()))
      .then(() => stellar.subscribe('test:channel', () => {
        console.log('2. message received');
        setTimeout(done, 1000);
      }))
      .then(() => stellar.publish('test:channel', { text: 'hello world' }));
  });

  it('test pub sub 3 subscribers', (done) => {
    const stellar = new StellarPubSub(redisTransport, 'test', console);

    const stellarSubs = [
      new StellarPubSub(redisTransport, 'test1', console),
      new StellarPubSub(redisTransport, 'test2', console),
      new StellarPubSub(redisTransport, 'test3', console),
      new StellarPubSub(redisTransport, 'test4', console),
    ];

    const doneBy = [];
    Promise
      .all(stellarSubs)
      .map(ss => ss.subscribe('ms:channel', (message) => {
        doneBy.push(ss.app);
        console.log(`message received by ${ss.app}`);
        message.should.deep.equal({ text: 'hello world' });
        if (doneBy.length === 4) {
          done();
        }
      }))
      .then(() => stellar.publish('ms:channel', { text: 'hello world' }));
  });


  it('test channel multiplexing', (done) => {
    const stellar = new StellarPubSub(redisTransport, 'test', console);

    const sub = new StellarPubSub(redisTransport, 'test6', console);
    const doneBy = [];
    const handler = i => (message) => {
      message.should.deep.equal({ text: `hello world ${i}` });
      doneBy.push(1);
      if (doneBy.length === 4) {
        done();
      }
    };

    Promise.all([
                  sub.subscribe(`test:channel1`, handler(1)),
                  sub.subscribe(`test:channel1`, handler(1)),
                  sub.subscribe(`test:channel2`, handler(2)),
                  sub.subscribe(`test:channel3`, handler(3)),
                ])
      .then(() => {
        stellar.publish('test:channel1', { text: 'hello world 1' });
        stellar.publish('test:channel2', { text: 'hello world 2' });
        stellar.publish('test:channel3', { text: 'hello world 3' });
      });
  });
});

describe('full integration pub/sub app', () => {
  beforeEach(clearStellar);

  it('test pub sub 1 subscriber', (done) => {
    const stellar = new StellarPubSub(redisTransport, 'test', console, 'P1');
    stellar.subscribe('test:channel', (message) => {
      console.log('message received');
      message.should.deep.equal({ text: 'hello world' });
      done();
    }).then(() => stellar.publish('test:channel', { text: 'hello world' }));
  });


  it('test pub sub 3 subscribers', (done) => {
    const stellar = new StellarPubSub(redisTransport, 'test', console);

    const stellarSubs = [
      new StellarPubSub(redisTransport, 'test1', console, 'S1'),
      new StellarPubSub(redisTransport, 'test2', console, 'S2'),
      new StellarPubSub(redisTransport, 'test3', console, 'S3'),
      //TODO somehow fork subscribers
      // new StellarPubSub(redisTransport, 'test4', console, 'S3'),
    ];

    const doneBy = [];
    Promise
      .all(stellarSubs)
      .map(ss => ss.subscribe('test:channel', (message) => {
        doneBy.push(ss.app);
        console.log(`message received by ${ss.service}`);
        message.should.deep.equal({ text: 'hello world' });
        if (doneBy.length === 3) {
          done();
        }
      }))
      .then(() => stellar.publish('test:channel', { text: 'hello world' }));
  });
});
