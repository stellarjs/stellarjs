/* eslint-disable */

import Promise from 'bluebird';
import {StellarRequest, StellarHandler, StellarError} from '@stellarjs/core';
import { QueueMessagingAdaptor } from '@stellarjs/messaging-queue';

import RedisTransport from '../src/RedisTransport';

import { closeRedis, log, getResourceName } from './helpers';

const source = 'test';
let redisTransport;
let stellarRequest;
let stellarHandler;
let messaging;

afterAll(async () => {
    await messaging.reset();
    await closeRedis(redisTransport);
});

beforeAll(async () => {
  redisTransport = new RedisTransport(log);
  messaging = new QueueMessagingAdaptor(redisTransport, source, log, 1000);
  stellarRequest = new StellarRequest(messaging, source, log);
  stellarHandler = new StellarHandler(messaging, source, log);
});

describe('full integration req/response', () => {
  it('test request response', async () => {
    const resourceName = getResourceName();
    stellarHandler.get(resourceName, ({ body }) => ({ text: `${body.text} worlds` }));
    const result = await stellarRequest.get(resourceName, { text: 'hello' });
    expect(result).toEqual({ text: 'hello worlds' });
  });

  it('test request and raw response', async () => {
    const resourceName = getResourceName();
    stellarHandler.get(resourceName, ({ body }) => ({ text: `${body.text} worlds` }));

    const result = await stellarRequest.get(resourceName, { text: 'hello' }, { responseType: 'raw' });
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
  });

  it('test request response across two queues', async () => {
    const resourceName1 = getResourceName();
    const resourceName2 = getResourceName();
    stellarHandler.handleRequest(`${resourceName1}:get`, async ({ body }) => {
      await Promise.delay(50);
      return { text: `${body.text} worlds` };
    });
    
    stellarHandler.handleRequest(`${resourceName2}:get`, ({ body }) => ({ text: `${body.text} worlds 2` }));

    const [result1, result2] = await Promise.all([
      stellarRequest.get(resourceName1, { text: 'hello' }),
      stellarRequest.get(resourceName2, { text: 'bye' })
     ]);

    expect(result1).toEqual({ text: 'hello worlds' });
    expect(result2).toEqual({ text: 'bye worlds 2' });
  });

  it('test request response with middlewares', async () => {
    const resourceName = getResourceName();
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

    stellarHandler.get(resourceName, ({ body }) => ({ text: `${body.text} worlds` }));

    const result = await stellarRequest.get(resourceName, { text: 'hello' });

    expect(result).toEqual({ text: 'hello worlds' });
    expect(handlerMw).toBe(1);
    expect(requestMw).toBe(1);
  });
    
  it('test request response stellar error', (done) => {
    const resourceName = getResourceName();
    stellarHandler.get(resourceName, ({ body }) => {
      const errors = new StellarError();
      errors.addPropertyError('x', 'poop');
      errors.addPropertyError('x', 'pee');
      throw errors;
    });

    stellarRequest
      .get(resourceName, { text: 'hello' })
      .catch(StellarError, (e) => {
        log.info('StellarError caught');
        expect(e.errors).toEqual({ x: ['poop', 'pee'] });
        done();
      });
  });

    it('test request timeout', (done) => {
      const q = redisTransport._getQueue('stlr:n:test:inbox');
      const resourceName = getResourceName();

      stellarHandler.get(resourceName, ({ body }) => {
          return Promise
            .delay(1000)
            .then(() => ({ text: `${body.text} worlds` }));
      });

      stellarRequest
        .get(resourceName, { text: 'hello' }, { requestTimeout: 500 })
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
