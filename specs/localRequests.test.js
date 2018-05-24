import _ from 'lodash';
import Promise from 'bluebird';
import { StellarRequest, StellarHandler } from '@stellarjs/core';

import { log, getResourceName, closeTransport, transportGenerator, getChannelName } from './helpers';
import StellarError from '../packages/stellar-error/lib-es6';
import { StellarPubSub } from '../packages/core/lib-es6';

const apps = {
  'app1': ['source1a']
};

let stellarRequest;
let stellarHandler;
let stellarPub;
let stellarSub;

export async function doAfterAll(onClose) {
  return closeTransport(onClose);
  await Promise.delay(2000);
}

export function doBeforeAll(transportFactory) {
  const transports = _.mapValues(transportGenerator(apps, transportFactory, true));

  stellarRequest = new StellarRequest(transports.app1.source1a, { optimizeLocalHandlers: true, stringifyDates: true });
  stellarHandler = new StellarHandler(transports.app1.source1a);
  stellarPub = new StellarPubSub(transports.app1.source1a);
  stellarSub = new StellarPubSub(transports.app1.source1a);

  return { stellarRequest, stellarHandler, stellarPub, stellarSub };
}

export async function testRequestResponse() {
  const resourceName = getResourceName('app1');
  stellarHandler.get(resourceName, ({ body }) => ({ text: `${body.text} worlds` }));
  const result = await stellarRequest.get(resourceName, { text: 'hello' });
  expect(result).toEqual({ text: 'hello worlds' });
}

export async function testMiddlewares() {
  const resourceName = getResourceName('app1');
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
  const resourceName = getResourceName('app1');
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


export function testPubSubWith1Subscriber(done) {
  const channel = getChannelName();
  Promise.try(() =>
                stellarSub.subscribe(channel,
                                     (message) => {
                                       log.log('message received');
                                       expect(message).toEqual({ text: 'hello world' });
                                       done();
                                     })).then((stopper) => {
    expect(stopper).toBeInstanceOf(Function);
    stellarPub.publish(channel, { text: 'hello world' })
  });
}
