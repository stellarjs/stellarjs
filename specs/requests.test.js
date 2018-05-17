/* eslint-disable */

import _ from 'lodash';
import Promise from 'bluebird';
import StellarError from '@stellarjs/stellar-error';
import { StellarRequest, StellarHandler } from '@stellarjs/core';

import { log, getResourceName, closeTransport, transportGenerator } from './helpers';

const apps = {
  'app1': ['source1a'],
  'app2': ['source2c']
};

let stellarRequest;
let stellarHandler;

export async function doAfterAll(onClose) {
  return closeTransport(onClose);
  await Promise.delay(2000);
}

export function doBeforeAll(transportFactory) {
  const transports = transportGenerator(apps, transportFactory);

  stellarRequest = new StellarRequest(transports.app1.source1a);
  stellarHandler = new StellarHandler(transports.app2.source2c);
  return { stellarRequest, stellarHandler };
}

export async function testRequestResponse() {
  const resourceName = getResourceName('app2');
  stellarHandler.get(resourceName, ({ body }) => ({ text: `${body.text} worlds` }));
  const result = await stellarRequest.get(resourceName, { text: 'hello' });
  expect(result).toEqual({ text: 'hello worlds' });
}

export function testRawRequestResponse(remote = false) {
  return async function test() {
    const resourceName = getResourceName('app2');
    stellarHandler.get(resourceName, ({ body }) => ({ text: `${body.text} worlds` }));

    const result = await stellarRequest.get(resourceName, { text: 'hello' }, { responseType: 'raw' });
    expect(result.body).toEqual({ text: 'hello worlds' });
    expect(result.headers).toMatchObject({
                                           id: expect.any(String),
                                           requestId: expect.any(String),
                                           traceId: result.headers.requestId,
                                           source: remote ? _.head(apps.app2) : _.head(apps.app1),
                                           timestamp: expect.any(Number),
                                           type: 'response',
                                         });
  };
}

export async function testRequestResponseOverTwoQueues() {
  const resourceName1 = getResourceName('app2');
  const resourceName2 = getResourceName('app2');
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
  const resourceName = getResourceName('app2');
  let handlerMw = 0;
  let requestMw = 0;

  stellarHandler.use(/.*/, (req, next) => {
    handlerMw += 1;
    return next();
  });

  stellarRequest.use(/.*/, (req, next) => {
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
  const resourceName = getResourceName('app2');
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
  const resourceName = getResourceName('app2');

  stellarHandler.get(resourceName, ({ body }) => {
    return Promise
      .delay(800)
      .then(() => ({ text: `${body.text} worlds` }));
  });

  stellarRequest
    .get(resourceName, { text: 'hello' }, { headers: { requestTimeout: 500 } })
    .then(() => fail())
    .catch(e => {
      expect(e.constructor.name).toEqual('StellarError');
      expect(e.message).toMatch(/@RemoteTransport\: TIMEOUT after 500ms. requestId=[a-f0-9\-]*/);
    }).then(done)
}
