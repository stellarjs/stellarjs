/**
 * Created by arolave on 29/05/2017.
 */
import Promise from 'bluebird';
import preconfigure from '../src/factory';
import { messagingMockFactory } from './mocks';
import { default as uuid } from '../src/source-generators/uuid';
import { default as browser } from '../src/source-generators/browser';
import { default as env } from '../src/source-generators/env';

describe('factory generation', () => {
  let configureStellar;
  beforeEach(() => {
    configureStellar = preconfigure({ defaultSourceGenerator: 'uuid', sourceGenerators: { uuid, browser, env } });
  });

  it('set externalSource generation', () => {
    const { stellarRequest, source } = configureStellar(
      { log: console, messagingAdaptorFactory: messagingMockFactory, source: 'external123' });
    const requestObj = stellarRequest();
    expect(source).toBe('external123');
  });

  it('set uuid generation', (done) => {
    const { stellarRequest, source } = configureStellar(
      { log: console, messagingAdaptorFactory: messagingMockFactory, sourceGenerator: 'uuid' });
    Promise.delay(50)
      .then(() => {
        const requestObj = stellarRequest();
        requestObj.messagingAdaptor.request.mockReturnValue({ text: 'ooo' });
        expect(source).toMatch(/^[0-9a-f\-]+$/);
        done();
      });
  });

  it('a stellarRequests with same source should fail', (done) => {
    let requestObj;
    const { stellarRequest } = configureStellar(
        { log: console, messagingAdaptorFactory: messagingMockFactory, sourceGenerator: 'uuid' });
    Promise.delay(50)
        .then(() => {
          requestObj = stellarRequest();

          const newRequestObj = stellarRequest();
          fail('shouldnt get this far');
        })
        .catch((e) => {
          expect(requestObj.source).toMatch(/^[0-9a-f\-]+$/);
        }).then(() => done());
  });

  it('a stellarRequests with differed sources should succeed', (done) => {
    const { stellarRequest } = configureStellar({ log: console, messagingAdaptorFactory: messagingMockFactory, sourceGenerator: 'uuid' });
    Promise.delay(50)
      .then(() => {
        const requestObj = stellarRequest();
        requestObj.messagingAdaptor.request.mockReturnValue(Promise.resolve({ text: 'ooo' }));

        expect(requestObj.source).toMatch(/^[0-9a-f\-]+$/);

        const differentObj = stellarRequest({ sourceOverride: 'override' });
        expect(differentObj.source).toEqual('override');
        expect(differentObj).not.toBe(requestObj);

        return [
          requestObj.create('testservice:resource', { text: 'toot' }),
          differentObj.create('testservice:resource', { text: 'ahoot' }),
        ];
      })
      .all()
      .then((responses) => {
        expect(responses).toEqual([{ text: 'ooo' }, { text: 'ooo' }]);
      })
      .then(done);
  });

  it('set browser generation', (done) => {
    global.localStorage = {};
    const { source, stellarRequest } = configureStellar({ log: console, messagingAdaptorFactory: messagingMockFactory, sourceGenerator: 'browser' });
    Promise.delay(50)
      .then(() => {
        const requestObj = stellarRequest();
        expect(source).toMatch(/^browser:[0-9A-Za-z\/\+]+$/);
        global.window = null;
        done();
      });
  });

  it('set env generation', (done) => {
    global.localStorage = {};
    process.env.STELLAR_SOURCE = '12345ABCDE';
    const { source, stellarRequest } = configureStellar({ log: console, messagingAdaptorFactory: messagingMockFactory, sourceGenerator: 'env' });
    Promise.delay(50)
      .then(() => {
        const requestObj = stellarRequest();
        expect(source).toBe('12345ABCDE');
        global.window = null;
        done();
      });
  });
});
