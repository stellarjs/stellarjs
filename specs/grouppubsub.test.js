import Promise from 'bluebird';

import { StellarPubSub } from '@stellarjs/core';

import { log, getChannelName, closeTransport, transportGenerator } from './helpers';

const apps = {
  'app1': ['source1a'],
  'app2': ['source2c'],
  'app3': ['source3d'],
  'app4': ['source4e']

};

let stellarPub;
let stellarSub;
let stellarSubApp3;
let stellarSubApp4;
let transports;

export function doBeforeAll(transportFactory) {
  transports = transportGenerator(apps, transportFactory);
  stellarPub = new StellarPubSub(transports.app1.source1a);
  stellarSub = new StellarPubSub(transports.app2.source2c, 'app2');
  stellarSubApp3 = new StellarPubSub(transports.app3.source3d, 'app3');
  stellarSubApp4 = new StellarPubSub(transports.app4.source4e, 'app4');
  return {stellarSub, stellarPub};
}

export async function doAfterAll(onClose) {
  await closeTransport(onClose);
  await Promise.delay(2000);
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
  const stellarSubs = [ stellarSub, stellarSubApp3, stellarSubApp4 ];

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
      expect(doneBy.sort()).toEqual(['app2', 'app3', "app4"]);
      done();
    });
}

export function testPubSubWithOneRepeatSubscribersOnSameTransport(done) {
  const channel = getChannelName();
  const stellarSubs = [ stellarSub, stellarSub ];

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
        .toEqual(`Cannot have more that once per url in registries.subscribers. "${channel}.app2" has already added`);
      done();
    })
}

export function testPubSubWithOneRepeatSubscribersOnDifferentTransport(transportBuilder) {
  return function (done) {
    const channel = getChannelName();
    const otherTransport = transportBuilder({ log: console, source: 'otherSource', app: 'app2', requestTimeout: 1000 });

    const stellarSubs = [
      new StellarPubSub(transports.app2.source2c, 'app2'),
      new StellarPubSub(otherTransport, 'app2'),
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
        expect(doneBy.sort()).toEqual(["app2"]);
        done();
      });
  };
}