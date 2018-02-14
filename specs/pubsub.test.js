/* eslint-disable */

import Promise from 'bluebird';

import { StellarPubSub } from '@stellarjs/core';
import { log, getChannelName } from './helpers';

const source = 'test';
let transport;
let stellarSub;
let stellarPub;

export function doBeforeAll(transportGenerator) {
  transport = transportGenerator(source, log);
  stellarPub = new StellarPubSub(transport.a, source, log);
  stellarSub = new StellarPubSub(transport.b, source, log);
  return {stellarSub, stellarPub, source};
}

export async function doAfterAll(closeTransport) {
  await closeTransport();
  await Promise.delay(5000);
}

export function testPubSubWith1Subscriber(done) {
  const channel = getChannelName();
  Promise.try(() =>
                stellarSub.subscribe(channel,
                                  (message) => {
                                    log.log('message received');
                                    expect(message).toEqual({ text: 'hello world' });
                                    done();
  })).then((stopper) => {
    expect(stopper).toBeInstanceOf(Function);
    stellarPub.publish(channel, { text: 'hello world' })
  });
}

export function testUnsubscribe(done) {
  const channel = getChannelName();
  let stopper;
  Promise.try(() => stellarSub.subscribe(channel, (msg) => {
    log.log(`message received ${msg}`);
    fail('should not receive a message');
  })).then((_stopper) => {
    stopper = _stopper;
  }).delay(500)
    .then(() => stopper())
    .delay(100)
    .then(() => stellarPub.publish(channel, { text: 'hello world' }))
    .delay(100)
    .then(() => done())
}

export function testResubscribe(done) {
  const channel = getChannelName();
  Promise.try(() => stellarSub.subscribe(channel, () => {
      log.log('1. message received');
      fail('should not receive a message');
    }))
    .then((stopper) => Promise.delay(50).then(() => stopper()))
    .then(() => stellarSub.subscribe(channel, () => {
      log.log('2. message received');
      setTimeout(done, 1000);
    }))
    .then(() => stellarPub.publish(channel, { text: 'hello world' }));
}

export function testPubSubWith3Subscribers(done) {
  const channel = getChannelName();
  const stellarSubs = [
    new StellarPubSub(transport.b, 'test1', log),
    new StellarPubSub(transport.b, 'test2', log),
    new StellarPubSub(transport.b, 'test3', log),
    new StellarPubSub(transport.b, 'test4', log),
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
    .then(() => stellarPub.publish(channel, { text: 'hello world' }));
}


export function testChannelMultiplexing(done) {
  const channel1 = getChannelName();
  const channel2 = getChannelName();
  const channel3 = getChannelName();
  const sub = new StellarPubSub(transport.b, 'test6', log);
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
      stellarPub.publish(channel1, { text: 'hello world 1' });
      stellarPub.publish(channel2, { text: 'hello world 2' });
      stellarPub.publish(channel3, { text: 'hello world 3' });
    })
    .delay(500)
    .then(() => {
      expect(doneBy).toHaveLength(4);
      done();
    });
}
