
import Promise from 'bluebird';

import {StellarPubSub} from '@stellarjs/core';
import RedisTransport from '../src/RedisTransport';

import { closeRedis, log } from './helpers';

let redisTransport;
let stellar;

beforeAll((done) => {
    redisTransport = new RedisTransport(log); //[new RedisTransport(log), new RedisTransport(log)];
    Promise
      .delay(1000)
      .then(() => {
          stellar = new StellarPubSub(redisTransport, 'test', log, 'P1');
          done();
      });
});

afterAll((done) => {
    closeRedis(redisTransport).then(() => done())
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
            //TODO fork subscribers
            // new StellarPubSub(redisTransport, 'test4', log, 'S3'),
        ];

        const doneBy = [];
        Promise
          .all(stellarSubs)
          .map(ss => ss.subscribe('test:channel', (message) => {
              doneBy.push(ss.service);
              log.info(`message received by ${ss.service}`);
              expect(message).toEqual({ text: 'hello world' });
              if (doneBy.length === 3) {
                  expect(doneBy.sort()).toEqual(['S1', 'S2', 'S3']);
                  done();
              }
          }))
          .then(() => stellar.publish('test:channel', { text: 'hello world' }));
    });
});