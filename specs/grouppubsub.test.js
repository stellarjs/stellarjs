import Promise from 'bluebird';

import { StellarPubSub } from '@stellarjs/core';

import { log, getChannelName } from './helpers';

const source = 'test';
let stellarPub;
let stellarSub;
let messaging;

export function doBeforeAll(messagingGenerator) {
  messaging = messagingGenerator(source, log);
  stellarPub = new StellarPubSub(messaging.a, source, log, 'P1');
  stellarSub = new StellarPubSub(messaging.b, source, log, 'S1');
}

export async function doAfterAll(closeMessaging) {
  await closeMessaging();
  await Promise.delay(5000);
}

export function testPubSubWith1Subscriber(done) {
  const channel = getChannelName();
  Promise.try(() => stellarSub.subscribe(channel, (message) => {
    log.info('message received');
    expect(message).toEqual({ text: 'hello world' });
    done();
  })).then((stopper) => {
    expect(stopper).toBeInstanceOf(Function);
    stellarPub.publish(channel, { text: 'hello world' })
  });
}

export function testPubSubWith3Subscribers(done) {
  const channel = getChannelName();
  const stellarSubs = [
    new StellarPubSub(messaging.b, 'test1', log, 'S1'),
    new StellarPubSub(messaging.b, 'test2', log, 'S2'),
    new StellarPubSub(messaging.b, 'test3', log, 'S3'),
  ];

  const doneBy = [];
  Promise
    .all(stellarSubs)
    .map(ss => ss.subscribe(channel, (message) => {
      doneBy.push(ss.service);
      log.info(`message received by ${ss.service}`);
      expect(message).toEqual({ text: 'hello world' });
    }))
    .then(() => stellarPub.publish(channel, { text: 'hello world' }))
    .delay(500)
    .then(() => {
      expect(doneBy.sort()).toEqual(['S1', 'S2', "S3"]);
      done();
    });
}

export function testPubSubWithOneRepeatSubscribersOnSameTransport(done) {
  const channel = getChannelName();
  const stellarSubs = [
    new StellarPubSub(messaging.b, 'test4', log, 'S4'),
    new StellarPubSub(messaging.b, 'test5', log, 'S4'),
  ];

  const doneBy = [];
  Promise
    .all(stellarSubs)
    .map(ss => ss.subscribe(channel, (message) => {
      doneBy.push(ss.service);
      log.info(`message received by ${ss.service}`);
      expect(message).toEqual({ text: 'hello world' });
    }))
    .then(() => fail())
    .catch((e) => {
      expect(e.message)
        .toEqual(`Cannot have more that once per url in registries.subscribers. "${channel}.S4" has already added`);
      done();
    })
}

export function testPubSubWithOneRepeatSubscribersOnDifferentTransport(messagingGenerator) {
  return function (done) {
    const channel = getChannelName();
    const otherMessaging = messagingGenerator(source, log);

    const stellarSubs = [
      new StellarPubSub(messaging.b, 'test6', log, 'S5'),
      new StellarPubSub(otherMessaging.b, 'test7', log, 'S5'),
    ];

    const doneBy = [];
    Promise
      .all(stellarSubs)
      .map(ss => ss.subscribe(channel, (message) => {
        doneBy.push(ss.service);
        log.info(`message received by ${ss.service}`);
        expect(message).toEqual({ text: 'hello world' });
      }))
      .then(() => stellarPub.publish(channel, { text: 'hello world' }))
      .delay(500)
      .then(() => {
        expect(doneBy.sort()).toEqual(["S5"]);
        done();
      });
  };
}