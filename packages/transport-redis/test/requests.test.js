/* eslint-disable */

import Promise from 'bluebird';
import {StellarRequest, StellarHandler, StellarError} from '@stellarjs/core';
import { QueueMessagingAdaptor } from '@stellarjs/messaging-queue';

import RedisTransport from '../src/RedisTransport';

import { closeRedis, log } from './helpers';

const source = 'test';
let redisTransport;
let stellarRequest;
let stellarHandler;
let messaging;

afterEach(async () => {
    await messaging.reset();
    await closeRedis(redisTransport);
});

beforeEach(async () => {
    redisTransport = new RedisTransport(log); //[new RedisTransport(log), new RedisTransport(log)];
    await Promise.delay(1000)
    messaging = new QueueMessagingAdaptor(redisTransport, source, log, 1000);
    stellarRequest = new StellarRequest(messaging, source, log);
    stellarHandler = new StellarHandler(messaging, source, log);
});

describe('full integration req/response', () => {
  it('test request response', (done) => {
    stellarHandler.handleRequest('testservice:resource:get', ({ body }) => ({ text: `${body.text} worlds` }));

    stellarRequest
      .get('testservice:resource', { text: 'hello' })
      .then(result => {
        expect(result).toEqual({ text: 'hello worlds' });
        done();
      });
  });

  it('test request and raw response', (done) => {
      stellarHandler.handleRequest('testservice:resource:get', ({ body }) => ({ text: `${body.text} worlds` }));

      stellarRequest
        .get('testservice:resource', { text: 'hello' }, { responseType: 'raw' })
        .then(result => {
          expect(result.body).toEqual({ text: 'hello worlds' });
          expect(result.headers).toEqual({
              id: expect.any(String),
              requestId: expect.any(String),
              traceId: result.headers.requestId,
              queueName: 'stlr:n:test:responseInbox',
              source: 'test',
              timestamp: expect.any(Number),
              type: 'response',

          });
          done();
        });
  });

  it('test request response across two queues', (done) => {
    stellarHandler.handleRequest('testservice:resource:get', ({ body }) =>
      Promise
        .delay(50)
        .then(() => ({ text: `${body.text} worlds` }))
    );
    stellarHandler.handleRequest('testservice2:resource:get', ({ body }) => ({ text: `${body.text} worlds 2` }));

    Promise
      .all([
        stellarRequest.get('testservice:resource', { text: 'hello' }),
        stellarRequest.get('testservice2:resource', { text: 'bye' })
       ])
      .then(([result1, result2]) => {
        expect(result1).toEqual({ text: 'hello worlds' });
        expect(result2).toEqual({ text: 'bye worlds 2' });
      })
      .then(() => done());
  });

  it('test request response with middlewares', (done) => {
    let handlerMw = 0;
    let requestMw = 0;

    stellarHandler.use('.*', (req, next) => {
      handlerMw += 1;
      return next();
    });

    stellarRequest.use('.*', (req, next) => {
      requestMw += 1;
      return next();
    });

    stellarHandler.get('testservice:resource', ({ body }) => ({ text: `${body.text} worlds` }));

    stellarRequest
      .get('testservice:resource', { text: 'hello' })
      .then(result => expect(result).toEqual({ text: 'hello worlds' }))
      .then(() => {
        expect(handlerMw).toBe(1);
        expect(requestMw).toBe(1);
        done();
      });
  });
    
  it('test request response stellar error', (done) => {
    stellarHandler.get('testservice:resource2', ({ body }) => {
      const errors = new StellarError();
      errors.addPropertyError('x', 'poop');
      errors.addPropertyError('x', 'pee');
      throw errors;
    });

    stellarRequest
      .get('testservice:resource2', { text: 'hello' })
      .catch(StellarError, (e) => {
        log.info('StellarError caught');
        expect(e.errors).toEqual({ x: ['poop', 'pee'] });
        done();
      });
  });

    it('test request timeout', (done) => {
        const q = redisTransport._getQueue('stlr:n:test:inbox');

        stellarHandler.handleRequest('testservice:resource:get', ({ body }) => {
            return Promise
              .delay(1000)
              .then(() => ({ text: `${body.text} worlds` }));
        });

        stellarRequest
          .get('testservice:resource', { text: 'hello' }, { requestTimeout: 500 })
          .then(() => fail())
          .catch(e => {
            expect(e.constructor.name).toEqual('StellarError');
            expect(e.message).toMatch(/Timeout error\: No response to job [a-f0-9\-]* in 1000ms/);
            return q.getFailedCount()
          })
          .then((qCount) => {
              expect(qCount).toBe(0);
          })
          .delay(1000)
          .then(() => {
            return q.getFailedCount();
          })
          .then((jobCounts) => {
              expect(jobCounts).toBe(0);
          })
          .then(done)
    });
});
