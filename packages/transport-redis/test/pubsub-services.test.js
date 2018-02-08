import _ from 'lodash';
import Promise from 'bluebird';

import { StellarPubSub } from '@stellarjs/core';
import { QueueMessagingAdaptor } from '@stellarjs/messaging-queue';

import RedisTransport from '../src/RedisTransport';

import { closeRedis, log } from './helpers';

const source = 'test';
let redisTransports;
let stellar;
let messaging;

describe('full integration pub/sub app', () => {

  beforeEach(async () => {
    redisTransports = [new RedisTransport(log)];
    messaging = new QueueMessagingAdaptor(_.head(redisTransports), source, log, 1000);
    stellar = new StellarPubSub(messaging, source, log, 'P1');
  });

  afterEach(async () => {
    await messaging.reset();
    await closeRedis(redisTransports);
  });
  
    it('test pub sub 1 subscriber', (done) => {
        stellar.subscribe('test:channel', (message) => {
            log.info('message received');
            expect(message).toEqual({ text: 'hello world' });
            done();
        }).then(() => stellar.publish('test:channel', { text: 'hello world' }));
    });
    
    it('test pub sub 3 subscribers', (done) => {
        const stellarSubs = [
            new StellarPubSub(messaging, 'test1', log, 'S1'),
            new StellarPubSub(messaging, 'test2', log, 'S2'),
            new StellarPubSub(messaging, 'test3', log, 'S3'),
        ];

        const doneBy = [];
        Promise
          .all(stellarSubs)
          .map(ss => ss.subscribe('test:channel', (message) => {
              doneBy.push(ss.service);
              log.info(`message received by ${ss.service}`);
              expect(message).toEqual({ text: 'hello world' });
          }))
          .then(() => stellar.publish('test:channel', { text: 'hello world' }))
          .delay(500)
          .then(() => {
              expect(doneBy.sort()).toEqual(['S1', 'S2', "S3"]);
              done();
          });
    });


    it('test pub sub one repeat subscribers, same transport', (done) => {
        const stellarSubs = [
            new StellarPubSub(messaging, 'test4', log, 'S3'),
            new StellarPubSub(messaging, 'test5', log, 'S3'),
        ];

        const doneBy = [];
        Promise
          .all(stellarSubs)
          .map(ss => ss.subscribe('test:channel', (message) => {
              doneBy.push(ss.service);
              log.info(`message received by ${ss.service}`);
              expect(message).toEqual({ text: 'hello world' });
          }))
          .then(() => fail())
          .catch((e) => {
              expect(e.message).toEqual('Cannot subscribe more that once per url. "stlr:s:S3:subscriptionInbox.test:channel" is already subscribed to');
              done();
          })
    });

    it('test pub sub one repeat subscribers, different transport', (done) => {
        redisTransports.push(new RedisTransport(log));
        const otherMessaging = new QueueMessagingAdaptor(_.last(redisTransports), source, log, 1000);

        const stellarSubs = [
            new StellarPubSub(messaging, 'test4', log, 'S3'),
            new StellarPubSub(otherMessaging, 'test5', log, 'S3'),
        ];

        const doneBy = [];
        Promise
          .all(stellarSubs)
          .map(ss => ss.subscribe('test:channel', (message) => {
              doneBy.push(ss.service);
              log.info(`message received by ${ss.service}`);
              expect(message).toEqual({ text: 'hello world' });
          }))
          .then(() => stellar.publish('test:channel', { text: 'hello world' }))
          .delay(500)
          .then(() => {
            expect(doneBy.sort()).toEqual(["S3"]);
            done();
          });
    });
});