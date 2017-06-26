/**
 * Created by arolave on 29/05/2017.
 */
import Promise from 'bluebird';
import { mockTransportFactory } from '@stellarjs/mocks';
import { configureStellar, stellarRequest, stellarSource, resetCache, setSourceGenerators } from '../src/factory';
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
      })
      .catch((e) => done(e))
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
      })
      .catch((e) => done(e))
  });

});