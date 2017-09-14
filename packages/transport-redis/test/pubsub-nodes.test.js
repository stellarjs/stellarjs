/* eslint-disable */

import Promise from 'bluebird';

import { StellarPubSub } from '@stellarjs/core';
import RedisTransport from '../src/RedisTransport';

import { closeRedis, log } from './helpers';

let redisTransport;
let stellar;

beforeAll((done) => {
  redisTransport = new RedisTransport(log);

  Promise
    .delay(1000)
    .then(() => {
      stellar = new StellarPubSub(redisTransport, 'test', log);
      done();
    });
});

afterAll((done) => {
  closeRedis(redisTransport).then(() => done())
});

afterEach((done) => {
  stellar.reset().then(() => done());
});

describe('full integration pub/sub per inbox', () => {
  it('test pub sub 1 subscriber', (done) => {
    stellar.subscribe('test:channel', (message) => {
      log.log('message received');
      expect(message).toEqual({ text: 'hello world' });
      done();
    }).then(() => stellar.publish('test:channel', { text: 'hello world' }));
  });

  it('test unsubscribe', (done) => {
    let stopper;
    stellar.subscribe('test:channel', () => {
      log.log('message received');
      fail('should not receive a message');
    }).then((_stopper) => {
      stopper = _stopper;
    }).delay(500)
      .then(() => stopper())
      .delay(100)
      .then(() => stellar.publish('test:channel', { text: 'hello world' }))
      .delay(100)
      .then(() => done())
  });

  it('test resubscribe', (done) => {
    stellar
      .subscribe('test:channel', () => {
        log.log('1. message received');
        fail('should not receive a message');
      })
      .then(stopper => setTimeout(() => stopper()))
      .then(() => stellar.subscribe('test:channel', () => {
        log.log('2. message received');
        setTimeout(done, 1000);
      }))
      .then(() => stellar.publish('test:channel', { text: 'hello world' }));
  });

  it('test pub sub 3 subscribers', (done) => {
    const stellarSubs = [
      new StellarPubSub(redisTransport, 'test1', log),
      new StellarPubSub(redisTransport, 'test2', log),
      new StellarPubSub(redisTransport, 'test3', log),
      new StellarPubSub(redisTransport, 'test4', log),
    ];

    const doneBy = [];
    Promise
      .all(stellarSubs)
      .map(ss => ss.subscribe('ms:channel', (message) => {
        doneBy.push(ss.app);
        log.log(`message received by ${ss.app}`);
        expect(message).toEqual({ text: 'hello world' });
        if (doneBy.length === 4) {
          done();
        }
      }))
      .then(() => stellar.publish('ms:channel', { text: 'hello world' }));
  });


  it('test channel multiplexing', (done) => {
    const sub = new StellarPubSub(redisTransport, 'test6', log);
    const doneBy = [];
    const handler = i => (message) => {
      expect(message).toEqual({ text: `hello world ${i}` });
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
