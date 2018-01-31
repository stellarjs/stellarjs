/* eslint-disable */

import Promise from 'bluebird';

import { StellarPubSub } from '@stellarjs/core';
import { QueueMessagingAdaptor } from '@stellarjs/messaging-queue';

import RedisTransport from '../src/RedisTransport';

import { closeRedis, log, getChannelName } from './helpers';

const source = 'test';
let redisTransport;
let stellar;
let messaging;

beforeAll(async () => {
  redisTransport = new RedisTransport(log);

  messaging = new QueueMessagingAdaptor(redisTransport, source, log);
  stellar = new StellarPubSub(messaging, source, log);
});

afterAll(async () => {
   await messaging.reset();
   await closeRedis(redisTransport);
   await Promise.delay(5000);
});

describe('full integration pub/sub per inbox', () => {
  it('test pub sub 1 subscriber', (done) => {
    const channel = getChannelName();
    stellar.subscribe(channel, (message) => {
      log.log('message received');
      expect(message).toEqual({ text: 'hello world' });
      done();
    }).then(() => stellar.publish(channel, { text: 'hello world' }));
  });

  it('test unsubscribe', (done) => {
    const channel = getChannelName();
    let stopper;
    stellar.subscribe(channel, (msg) => {
      log.log(`message received ${msg}`);
      fail('should not receive a message');
    }).then((_stopper) => {
      stopper = _stopper;
    }).delay(500)
      .then(() => stopper())
      .delay(100)
      .then(() => stellar.publish(channel, { text: 'hello world' }))
      .delay(100)
      .then(() => done())
  });

  it('test resubscribe', (done) => {
    const channel = getChannelName();
    stellar
      .subscribe(channel, () => {
        log.log('1. message received');
        fail('should not receive a message');
      })
      .then((stopper) => Promise.delay(50).then(() => stopper()))
      .then(() => stellar.subscribe(channel, () => {
        log.log('2. message received');
        setTimeout(done, 1000);
      }))
      .then(() => stellar.publish(channel, { text: 'hello world' }));
  });

  it('test pub sub 3 subscribers', (done) => {
    const channel = getChannelName();
    const stellarSubs = [
      new StellarPubSub(messaging, 'test1', log),
      new StellarPubSub(messaging, 'test2', log),
      new StellarPubSub(messaging, 'test3', log),
      new StellarPubSub(messaging, 'test4', log),
    ];

    const doneBy = [];
    Promise
      .all(stellarSubs)
      .map(ss => ss.subscribe(channel, (message) => {
        doneBy.push(ss.app);
        log.log(`message received by ${ss.app}`);
        expect(message).toEqual({ text: 'hello world' });
        if (doneBy.length === 4) {
          done();
        }
      }))
      .then(() => stellar.publish(channel, { text: 'hello world' }));
  });


  it('test channel multiplexing', (done) => {
    const channel1 = getChannelName();
    const channel2 = getChannelName();
    const channel3 = getChannelName();
    const sub = new StellarPubSub(messaging, 'test6', log);
    const doneBy = [];
    const handler = i => (message) => {
      expect(message).toEqual({ text: `hello world ${i}` });
      doneBy.push(i);
    };

    Promise
      .all([
        sub.subscribe(channel1, handler(1)),
        sub.subscribe(channel1, handler(1)),
        sub.subscribe(channel2, handler(2)),
        sub.subscribe(channel3, handler(3)),
      ])
      .then(() => {
        stellar.publish(channel1, { text: 'hello world 1' });
        stellar.publish(channel2, { text: 'hello world 2' });
        stellar.publish(channel3, { text: 'hello world 3' });
      })
      .delay(500)
      .then(() => {
        expect(doneBy).toHaveLength(4);
        done();
      });
  });
});
