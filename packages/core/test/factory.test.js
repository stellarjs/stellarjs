/**
 * Created by arolave on 29/05/2017.
 */
import Promise from 'bluebird';
import preconfigure from '../src/factory';
import { transportMockFactory } from './mocks';
import nanoid from '../src/source-generators/nanoid';
import browser from '../src/source-generators/browser';
import env from '../src/source-generators/env';
import StellarPubSub from '../src/StellarPubSub';
import StellarHandler from '../src/StellarHandler';

const NANO_ID_REGEX = /^[0-9a-zA-Z_~]+$/;

describe('factory generation', () => {
  let configureStellar;
  beforeEach(() => {
    configureStellar = preconfigure({ defaultSourceGenerator: 'nanoid', sourceGenerators: { browser, env, nanoid } });
  });

  it('set default stellar request with local dispatch (nanoid generation))', () => {
    const { stellarRequest, source } = configureStellar(
      { log: console, transportFactory: transportMockFactory, optimizeLocalHandlers: true, stringifyDates: true });
    const requestObj = stellarRequest();
    expect(source).toMatch(NANO_ID_REGEX);
    expect(requestObj.requestMiddlewares).toHaveLength(2);
    expect(requestObj.fireAndForgetMiddlewares).toHaveLength(2);
  });

  it('set standard stellar request (nanoid generation , no local dispatch)', () => {
    const { stellarRequest, source } = configureStellar(
      { log: console, transportFactory: transportMockFactory, sourceGenerator: 'nanoid' });
    const requestObj = stellarRequest();
    expect(source).toMatch(NANO_ID_REGEX);
    expect(requestObj.requestMiddlewares).toHaveLength(1);
    expect(requestObj.fireAndForgetMiddlewares).toHaveLength(1);
  });

  it('set externalSource generation', () => {
    const { source } = configureStellar(
      { log: console, transportFactory: transportMockFactory, source: 'external123' });
    expect(source).toBe('external123');
  });

  it('a sourcePrefix should be added if requested', () => {
    const { stellarRequest } = configureStellar({ log: console, transportFactory: transportMockFactory, sourceGenerator: 'nanoid', sourcePrefix: 'testies-' });
    const requestObj = stellarRequest();
    requestObj.transport.request.mockReturnValue(Promise.resolve({ text: 'ooo' }));

    expect(requestObj.source).toMatch(/^testies-[0-9a-zA-Z_~]+$/);
  });

  it('set browser generation', () => {
    global.window = { localStorage: {} };
    const { source } = configureStellar({ log: console, transportFactory: transportMockFactory, sourceGenerator: 'browser' });
    expect(source).toMatch(/^browser:[0-9A-Za-z\/\+]+$/);
    global.window = null;
  });

  it('set env generation', () => {
    process.env.STELLAR_SOURCE = '12345ABCDE';
    const { source } = configureStellar({ log: console, transportFactory: transportMockFactory, sourceGenerator: 'env' });
    expect(source).toBe('12345ABCDE');
  });

  it('should build a handler', () => {
    const { stellarHandler } = configureStellar(
      { log: console, transportFactory: transportMockFactory, source: 'external123' });
    const handler = stellarHandler();
    expect(handler.constructor).toEqual(StellarHandler);
    expect(handler.source).toBe('external123');
  });

  it('should build a group pubsub', () => {
    const { stellarAppPubSub } = configureStellar(
      { log: console, transportFactory: transportMockFactory, source: 'external123' });
    const pubsub = stellarAppPubSub();
    expect(pubsub.constructor).toEqual(StellarPubSub);
    expect(pubsub.source).toBe('external123');
    expect(pubsub.service).not.toBeNull();
  });

  it('should build a node pubsub', () => {
    const { stellarNodePubSub } = configureStellar(
      { log: console, transportFactory: transportMockFactory, source: 'external123' });
    const pubsub = stellarNodePubSub();
    expect(pubsub.constructor).toEqual(StellarPubSub);
    expect(pubsub.source).toBe('external123');
    expect(pubsub.service).toBeUndefined();
  });
});
