import child_process from 'child_process';
import EventEmitter from 'events';

import { StellarPubSub } from '@stellarjs/core';
import Promise from 'bluebird';
import _ from 'lodash';

import {
  doAfterAll, doBeforeAll,
  testPubSubWith1Subscriber,
  testPubSubWith3Subscribers,
  testPubSubWithOneRepeatSubscribersOnSameTransport,
  testPubSubWithOneRepeatSubscribersOnDifferentTransport
} from '../../../specs/grouppubsub.test';

import { factory, onClose, subscriber } from './helpers';
import { getChannelName } from '../../../specs/helpers';

let cp;

describe('full integration pub/sub app', () => {
  beforeAll(() => {
    doBeforeAll(factory);
  });

  afterAll(async () => {
    if (cp) {
      cp.kill();
    }

    return doAfterAll(onClose);
  });

  function forkSubscriber(source, channel, app) {
    return new Promise((resolve, reject) => {
      const filepath = `${__dirname}/forkableSubscriber`;
      cp = child_process.fork(filepath, [source, channel, app]);
      cp.on('message', (m) => {
        const ev = _.isString(m) ? m : _.head(_.keys(m));
        switch (ev) {
          case 'ready': {
            console.info(`subprocess Ready`);
            return resolve(cp);
          }
        }
      });
      cp.on('error', (err) => console.error(err, 'error'));
      cp.on('exit', (code, signal) => console.info(`subprocess exited: ${code}, ${signal}`));
    });
  }

  function publisher(source) {
    const transport = factory({ log: console, source, app: 'app1', requestTimeout: 1000 });
    return new StellarPubSub(transport, 'app1');
  }

  it('test pub sub 1 subscriber', testPubSubWith1Subscriber);
  it('test pub sub 3 subscriber', testPubSubWith3Subscribers);
  it('test pub sub one repeat subscribers, same transport', testPubSubWithOneRepeatSubscribersOnSameTransport);
  it('test pub sub one repeat subscribers, different transport', async () => {
    // to make this work - perhaps we should be so aggressive about clsoing things down?
    const channel = getChannelName();
    const stellarPub = publisher('pub1');
    const stellarSub1 = subscriber('sub1', channel, 'app5');

    const sub1 = new Promise((resolve) => stellarSub1.subscribe(channel, resolve));
    const forkedSubscriber = await forkSubscriber('sub2', channel, 'app5');
    const sub2 = new Promise((resolve) => {
      console.info('fork sub2 registration');
      forkedSubscriber.on('message', (m) => {
        const ev = _.isString(m) ? m : _.head(_.keys(m));
        console.log(`forked result ${ev} ${m.result}`);
        resolve(m.result);
      })
    });
    
    await Promise.delay(1000);
    console.log('forked publishing 1');
    stellarPub.publish(channel, { text: 'hello world 1' });
    console.log('forked publishing 2');
    stellarPub.publish(channel, { text: 'hello world 2' });
    await expect(sub1).resolves.toEqual({ text: 'hello world 1' });
    await expect(sub2).resolves.toEqual({ text: 'hello world 2' });
    // cp.kill();
    // stellarSub1.transport.reset();
    // await Promise.delay(2000);
  });
});
