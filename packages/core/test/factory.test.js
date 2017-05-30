/**
 * Created by arolave on 29/05/2017.
 */
import { expect } from 'chai'; // eslint-disable-line
import chai from 'chai';  // eslint-disable-line
import chaiAsPromised from 'chai-as-promised'; // eslint-disable-line
import Promise from 'bluebird';
import { configureStellar, stellarRequest, stellarSource, resetCache, setSourceGenerators } from '../src/factory';
import { mockTransportFactory } from './mocks';
import { default as uuid } from '../src/source-generators/uuid';
import { default as amazonEc2 } from '../src/source-generators/amazonEc2';
import { default as browser } from '../src/source-generators/browser';

chai.use(chaiAsPromised);
chai.should();

describe('factory generation', () => {
  beforeEach(() => {
    resetCache();
    setSourceGenerators('uuid', { uuid, amazonEc2, browser });
  });

  it('set externalSource generation', () => {
    configureStellar({ log: console, source: 'external123' });
    const requestObj = stellarRequest(mockTransportFactory);
    expect(requestObj.requestTimeout).to.equal(30000);
    expect(stellarSource()).to.equal('external123');
  });

  it('set uuid generation', (done) => {
    configureStellar({ log: console, sourceGenerator: 'uuid' });
    const requestObj = stellarRequest(mockTransportFactory);
    Promise.delay(50)
      .then(() => {
        expect(requestObj.requestTimeout).to.equal(30000);
        expect(stellarSource()).to.match(/^[0-9a-f\-]+$/);
        done();
      })
      .catch((e) => done(e))
  });

  it('set browser generation', (done) => {
    global.window = { localStorage: {} };
    configureStellar({ log: console, sourceGenerator: 'browser' });
    const requestObj = stellarRequest(mockTransportFactory);
    Promise.delay(50)
      .then(() => {
        expect(requestObj.requestTimeout).to.equal(30000);
        expect(stellarSource()).to.match(/^browser:[0-9A-Za-z\/\+]+$/);
        global.window = null;
        done();
      })
      .catch((e) => done(e))
  });

});