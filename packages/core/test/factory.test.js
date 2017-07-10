/**
 * Created by arolave on 29/05/2017.
 */
import Promise from 'bluebird';
import { configureStellar, stellarRequest, stellarHandler, stellarSource, resetCache, setSourceGenerators } from '../src/factory';
import { MockTransport, mockTransportFactory } from './mocks';
import { default as uuid } from '../src/source-generators/uuid';
import { default as amazonEc2 } from '../src/source-generators/amazonEc2';
import { default as browser } from '../src/source-generators/browser';

describe('factory generation', () => {
  beforeEach(() => {
    resetCache();
    setSourceGenerators('uuid', { uuid, amazonEc2, browser });
  });

  it('set externalSource generation', () => {
    configureStellar({ log: console, transportFactory: mockTransportFactory, source: 'external123' });
    const requestObj = stellarRequest();
    expect(requestObj.requestTimeout).toBe(30000);
    expect(stellarSource()).toBe('external123');
  });

  it('set uuid generation', (done) => {
    configureStellar({ log: console, transportFactory: mockTransportFactory, sourceGenerator: 'uuid' });
    Promise.delay(50)
      .then(() => {
        const requestObj = stellarRequest();
        expect(requestObj.requestTimeout).toBe(30000);
        expect(stellarSource()).toMatch(/^[0-9a-f\-]+$/);
        done();
      });
  });

  it('test different sources with uuid generation', (done) => {
    configureStellar({ log: console, transportFactory: () => new MockTransport({}, { inMemory: true }), sourceGenerator: 'uuid' });
    Promise.delay(50)
      .then(() => {
        const handler = stellarHandler();
        handler.create('testservice:resource', () => ({ text: 'ooo'}) );

        const requestObj = stellarRequest();
        expect(requestObj.requestTimeout).toBe(30000);
        expect(stellarSource()).toMatch(/^[0-9a-f\-]+$/);

        const sameObj = stellarRequest();
        expect(sameObj).toBe(requestObj);

        const differentObj = stellarRequest({ sourceOverride: 'override' });
        expect(differentObj.source).toEqual('override');
        expect(differentObj).not.toBe(requestObj);

        return [
          requestObj.create('testservice:resource', { text: 'toot' }),
          differentObj.create('testservice:resource', { text: 'ahoot' })
        ];
      })
      .all()
      .then((responses) => {
        console.info(`response: ${JSON.stringify(responses)}`);
        done();
      });
  });

  it('set browser generation', (done) => {
    global.localStorage = {};
    configureStellar({ log: console, transportFactory: mockTransportFactory, sourceGenerator: 'browser' });
    Promise.delay(50)
      .then(() => {
        const requestObj = stellarRequest();
        expect(requestObj.requestTimeout).toBe(30000);
        expect(stellarSource()).toMatch(/^browser:[0-9A-Za-z\/\+]+$/);
        global.window = null;
        done();
      });
  });

});