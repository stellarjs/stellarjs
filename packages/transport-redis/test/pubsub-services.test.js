
import Promise from 'bluebird';

import {StellarPubSub} from '@stellarjs/core';
import RedisTransport from '../src/RedisTransport';

import { closeRedis, log } from './helpers';

let redisTransport;
let altRedisTransport;
let stellar;

beforeAll((done) => {
    redisTransport = new RedisTransport(log); //[new RedisTransport(log), new RedisTransport(log)];
    altRedisTransport = new RedisTransport(log);
    Promise
      .delay(500)
      .then(() => {
          stellar = new StellarPubSub(redisTransport, 'test', log, 'P1');
          done();
      });
});

afterAll((done) => {
    closeRedis(redisTransport)
      .then(() => closeRedis(altRedisTransport))
      .then(() => done());
});

afterEach((done) => {
    stellar.reset().then(() => done());
});

describe('full integration pub/sub app', () => {
    it('test pub sub 1 subscriber', (done) => {
        stellar.subscribe('test:channel', (message) => {
            log.info('message received');
            expect(message).toEqual({ text: 'hello world' });
            done();
        }).then(() => stellar.publish('test:channel', { text: 'hello world' }));
    });
    
    it('test pub sub 3 subscribers', (done) => {
        const stellarSubs = [
            new StellarPubSub(redisTransport, 'test1', log, 'S1'),
            new StellarPubSub(redisTransport, 'test2', log, 'S2'),
            new StellarPubSub(redisTransport, 'test3', log, 'S3'),
            // new StellarPubSub(redisTransport, 'test5', log, 'S3'),
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


    it('test pub sub one repeat subscribers', (done) => {
        const stellarSubs = [
            new StellarPubSub(redisTransport, 'test4', log, 'S3'),
            new StellarPubSub(altRedisTransport, 'test5', log, 'S3'),
        ];

        const doneBy = [];
        Promise
          .all(stellarSubs)
          .map(ss => ss.subscribe('test:channel', (message) => {
              doneBy.push(ss.service);
              log.info(`message received by ${ss.service}`);
              expect(message).toEqual({ text: 'hello world' });
          }))
          .catch((e) => expect(e.message).toEqual("stlr:s:S3:subscriptionInbox already has a handler on this node"))
          .then(() => done());
          // .(() => stellar.publish('test:channel', { text: 'hello world' }))
          // .delay(500)
          // .then(() => {
          //     expect(doneBy.sort()).toEqual(["S3"]);
          //     done();
          // });
    });

    // it('test pub sub 3 subscribers', (done) => {
    //     const stellarSubs = [
    //         new StellarPubSub(redisTransport, 'test1', log, 'S1'),
    //         new StellarPubSub(redisTransport, 'test2', log, 'S2'),
    //         new StellarPubSub(redisTransport, 'test3', log, 'S3'),
    //     ];
    //
    //     const doneBy = [];
    //     Promise
    //       .all(stellarSubs)
    //       .map(ss => ss.subscribe('test:channel', (message) => {
    //           doneBy.push(ss.service);
    //           log.info(`message received by ${ss.service}`);
    //           expect(message).toEqual({ text: 'hello world' });
    //       }))
    //       .map(() => stellar.publish('test:channel', { text: 'hello world' }))
    //       .delay(500)
    //       .then(() => {
    //           expect(doneBy.sort()).toEqual(['S1', 'S2', 'S3']);
    //           done();
    //       });
    // });
});