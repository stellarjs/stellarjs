import _ from 'lodash';
import Promise from 'bluebird';

import { StellarPubSub } from '@stellarjs/core';
import { QueueMessagingAdaptor } from '@stellarjs/messaging-queue';

import RedisTransport from '../src/RedisTransport';

import { closeRedis, log, getChannelName } from './helpers';

const source = 'test';
let redisTransports;
let stellar;
let messaging;

describe('full integration pub/sub app', () => {

  beforeAll(async () => {
    redisTransports = [new RedisTransport(log)];
    messaging = new QueueMessagingAdaptor(_.head(redisTransports), source, log, 1000);
    stellar = new StellarPubSub(messaging, source, log, 'P1');
  });

  afterAll(async () => {
    await messaging.reset();
    await closeRedis(redisTransports);
    await Promise.delay(5000);
  });
  
    it('test pub sub 1 subscriber', (done) => {
      const channel = getChannelName();
        stellar.subscribe(channel, (message) => {
            log.info('message received');
            expect(message).toEqual({ text: 'hello world' });
            done();
        }).then(() => stellar.publish(channel, { text: 'hello world' }));
    });
    
    it('test pub sub 3 subscribers', (done) => {
      const channel = getChannelName();
        const stellarSubs = [
            new StellarPubSub(messaging, 'test1', log, 'S1'),
            new StellarPubSub(messaging, 'test2', log, 'S2'),
            new StellarPubSub(messaging, 'test3', log, 'S3'),
        ];

        const doneBy = [];
        Promise
          .all(stellarSubs)
          .map(ss => ss.subscribe(channel, (message) => {
              doneBy.push(ss.service);
              log.info(`message received by ${ss.service}`);
              expect(message).toEqual({ text: 'hello world' });
          }))
          .then(() => stellar.publish(channel, { text: 'hello world' }))
          .delay(500)
          .then(() => {
              expect(doneBy.sort()).toEqual(['S1', 'S2', "S3"]);
              done();
          });
    });


    it('test pub sub one repeat subscribers, same transport', (done) => {
      const channel = getChannelName();
        const stellarSubs = [
            new StellarPubSub(messaging, 'test4', log, 'S4'),
            new StellarPubSub(messaging, 'test5', log, 'S4'),
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
              expect(e.message).toEqual(`Cannot have more that once per url in registries.subscribers. "${channel}.S4" has already added`);
              done();
          })
    });

    it('test pub sub one repeat subscribers, different transport', (done) => {
      const channel = getChannelName();
        redisTransports.push(new RedisTransport(log));
        const otherMessaging = new QueueMessagingAdaptor(_.last(redisTransports), source, log, 1000);

        const stellarSubs = [
            new StellarPubSub(messaging, 'test6', log, 'S5'),
            new StellarPubSub(otherMessaging, 'test7', log, 'S5'),
        ];

        const doneBy = [];
        Promise
          .all(stellarSubs)
          .map(ss => ss.subscribe(channel, (message) => {
              doneBy.push(ss.service);
              log.info(`message received by ${ss.service}`);
              expect(message).toEqual({ text: 'hello world' });
          }))
          .then(() => stellar.publish(channel, { text: 'hello world' }))
          .delay(500)
          .then(() => {
            expect(doneBy.sort()).toEqual(["S5"]);
            done();
          });
    });
});