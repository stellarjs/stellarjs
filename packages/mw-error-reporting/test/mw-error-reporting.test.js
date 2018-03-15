/**
 * Created by arolave on 14/05/2017.
 */

import Promise from 'bluebird';
import StellarError from '@stellarjs/stellar-error';
import { StellarHandler, StellarRequest } from '@stellarjs/core';
import { MemoryTransport } from '@stellarjs/transport-memory';
import middleware from '../src';

describe('Error Reporting middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Should only report the first occurence of an error', (done) => {
    const transport = new MemoryTransport('origin', console);
    const reporterMock = jest.fn();
    const request = new StellarRequest(transport);
    const oneHandler = new StellarHandler(transport);
    oneHandler.use('.*', middleware({ reporters: [reporterMock] }));
    const twoHandler = new StellarHandler(transport, 'otherSource');
    twoHandler.use('.*', middleware({ reporters: [reporterMock] }));

    oneHandler.get('testserviceOne:resource', ({ body }) => {
      const testserviceRequest = new StellarRequest(transport);
      return testserviceRequest
        .get('testserviceTwo:resource')
        .catch(e => e)
        .delay(200)
        .then(e => Promise.reject(e));
    });

    twoHandler.get('testserviceTwo:resource', ({ body }) => {
      throw new Error('its broke');
    });

    request.get('testserviceOne:resource')
      .catch(e => console.info('received expected error'))
      .then(() => {
        expect(reporterMock).toBeCalled();
      })
      .then(() => done());
  });

  it('Should pass request w/o queue to the next middleware ', (done) => {
    const req = {};
    const val = 'noop';
    const next = () => Promise.resolve(val);
    const reporterMock = jest.fn();

    middleware({ reporters: [reporterMock] })(req, next)
          .then((res) => {
            expect(res).toEqual(val);
            expect(reporterMock).not.toBeCalled();
            return done();
          });
  });

  it('Should not report to rollbar a StellarError ', (done) => {
    const req = {};
    const val = 'Boohoo';
    const reporterMock = jest.fn();
    const mw = middleware({ reporters: [reporterMock], ignoredErrorTypes: [StellarError] });

    mw(req, () => Promise.reject(new StellarError('Boohoo')))
          .catch((err) => {
            expect(err.message).toEqual(val);
            expect(reporterMock).not.toBeCalled();
            return done();
          });
  });
});
