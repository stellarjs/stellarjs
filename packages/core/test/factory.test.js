/**
 * Created by arolave on 29/05/2017.
 */
import Promise from 'bluebird';
import preconfigure from '../src/factory';
import { transportMockFactory } from './mocks';
import nanoid from '../src/source-generators/nanoid';
import uuid from '../src/source-generators/uuid';
import browser from '../src/source-generators/browser';
import env from '../src/source-generators/env';

describe('factory generation', () => {
  let configureStellar;
  beforeEach(() => {
    configureStellar = preconfigure({ defaultSourceGenerator: 'uuid', sourceGenerators: { uuid, browser, env, nanoid } });
  });

  it('set default stellar request with local dispatch (uuid generation))', () => {
    const { stellarRequest, source } = configureStellar(
      { log: console, transportFactory: transportMockFactory, optimizeLocalHandlers: true, stringifyDates: true });
    const requestObj = stellarRequest();
    expect(source).toMatch(/^[0-9a-f\-]+$/);
    expect(requestObj.requestMiddlewares).toHaveLength(2);
    expect(requestObj.fireAndForgetMiddlewares).toHaveLength(2);
  });

  it('set standard stellar request (uuid generation , no local dispatch)', () => {
    const { stellarRequest, source } = configureStellar(
      { log: console, transportFactory: transportMockFactory, sourceGenerator: 'uuid' });
    const requestObj = stellarRequest();
    expect(source).toMatch(/^[0-9a-f\-]+$/);
    expect(requestObj.requestMiddlewares).toHaveLength(1);
    expect(requestObj.fireAndForgetMiddlewares).toHaveLength(1);
  });

  it('set nanoid generation', () => {
    const { source } = configureStellar(
      { log: console, transportFactory: transportMockFactory, sourceGenerator: 'nanoid' });
    expect(source).toMatch(/^[0-9a-zA-Z_~]+$/);
  });

  it('set externalSource generation', () => {
    const { stellarRequest, source } = configureStellar(
      { log: console, transportFactory: transportMockFactory, source: 'external123' });
    const requestObj = stellarRequest();
    expect(source).toBe('external123');
  });

  it('a sourcePrefix should be added if requested', () => {
    const { stellarRequest } = configureStellar({ log: console, transportFactory: transportMockFactory, sourceGenerator: 'uuid', sourcePrefix: 'testies-' });
    const requestObj = stellarRequest();
    requestObj.transport.request.mockReturnValue(Promise.resolve({ text: 'ooo' }));

    expect(requestObj.source).toMatch(/^testies-[0-9a-f\-]+$/)
  });

  it('set browser generation', () => {
    global.window = { localStorage: {} };
    const { source, stellarRequest } = configureStellar({ log: console, transportFactory: transportMockFactory, sourceGenerator: 'browser' });
    const requestObj = stellarRequest();
    expect(source).toMatch(/^browser:[0-9A-Za-z\/\+]+$/);
    global.window = null;
  });

  it('set env generation', () => {
    process.env.STELLAR_SOURCE = '12345ABCDE';
    const { source, stellarRequest } = configureStellar({ log: console, transportFactory: transportMockFactory, sourceGenerator: 'env' });
    const requestObj = stellarRequest();
    expect(source).toBe('12345ABCDE');
  });
});
