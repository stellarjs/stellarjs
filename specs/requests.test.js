/* eslint-disable */

import Promise from 'bluebird';
import { StellarRequest, StellarHandler, StellarError } from '@stellarjs/core';

import { log, getResourceName } from './helpers';

const source = 'test';
let stellarRequest;
let stellarHandler;

export async function doAfterAll(closeMessaging) {
  await closeMessaging();
}

export function doBeforeAll(messagingGenerator) {
  const messagings = messagingGenerator(source, log);
  stellarRequest = new StellarRequest(messagings.a, source, log);
  stellarHandler = new StellarHandler(messagings.b, source, log);
  return { source, stellarRequest, stellarHandler };
}

export async function testRequestResponse() {
  const resourceName = getResourceName();
  stellarHandler.get(resourceName, ({ body }) => ({ text: `${body.text} worlds` }));
  const result = await stellarRequest.get(resourceName, { text: 'hello' });
  expect(result).toEqual({ text: 'hello worlds' });
}

export async function testRawRequestResponse() {
  const resourceName = getResourceName();
  stellarHandler.get(resourceName, ({ body }) => ({ text: `${body.text} worlds` }));

  const result = await stellarRequest.get(resourceName, { text: 'hello' }, { responseType: 'raw' });
  expect(result.body).toEqual({ text: 'hello worlds' });
  expect(result.headers).toMatchObject({
                                         id: expect.any(String),
                                         requestId: expect.any(String),
                                         traceId: result.headers.requestId,
                                         // queueName: 'stlr:n:test:responseInbox',
                                         source: 'test',
                                         timestamp: expect.any(Number),
                                         type: 'response',
                                       });
}

export async function testRequestResponseOverTwoQueues() {
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
}

export async function testMiddlewares() {
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
}

export function testRequestErrorResponse(done) {
  const resourceName = getResourceName();
  stellarHandler.get(resourceName, ({ body }) => {
    const errors = new StellarError();
    errors.addPropertyError('x', 'poop');
    errors.addPropertyError('x', 'pee');
    throw errors;
  });

  stellarRequest
    .get(resourceName, { text: 'hello' })
    .then((res) => {
      console.info('res', res);
      fail('should have thrown');
    })
    .catch(StellarError, (e) => {
      log.info('StellarError caught');
      expect(e.errors).toEqual({ x: ['poop', 'pee'] });
      done();
    });
}

export function testRequestTimeout(done) {
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
    }).then(done)
}
