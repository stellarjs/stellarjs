/**
 * Created by arolave on 14/05/2017.
 */

import Promise from 'bluebird';
import StellarError from '@gf-stellarjs/stellar-error';
import { StellarHandler, StellarRequest } from '@gf-stellarjs/core';
import { MemoryTransport } from '@gf-stellarjs/transport-memory';
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
    oneHandler.use(/.*/, middleware({ reporters: [reporterMock] }));
    const twoHandler = new StellarHandler(transport, 'otherSource');
    twoHandler.use(/.*/, middleware({ reporters: [reporterMock] }));

    oneHandler.get('testserviceOne:resource', ({ body }) => {
      const testserviceRequest = new StellarRequest(transport);
      return testserviceRequest
        .get('testserviceTwo:resource')
        .catch(e => e)
        .delay(200)
        .then((e) => {
          expect(reporterMock).not.toBeCalled();
          Promise.reject(e);
        });
    });

    twoHandler.get('testserviceTwo:resource', ({ body }) => {
      throw new Error('errored');
    });

    request.get('testserviceOne:resource')
      .catch(e => console.info('received expected error'))
      .then(() => {
        expect(reporterMock).toBeCalled();
      })
      .then(() => done());
  });

  it('Should not report in a & b sources, since not local error', (done) => {
    const transport = new MemoryTransport('origin', console);
    const reporterMock = jest.fn();
    const request = new StellarRequest(transport);
    const oneHandler = new StellarHandler(transport, 'aSource');
    oneHandler.use(/.*/, middleware({ reporters: [reporterMock] }));
    const twoHandler = new StellarHandler(transport, 'bSource');
    twoHandler.use(/.*/, middleware({ reporters: [reporterMock] }));
    const erroringHandler = new StellarHandler(transport, 'cSource');
    erroringHandler.use(/.*/, middleware({ reporters: [reporterMock] }));

    oneHandler.get('testserviceOne:resource', () => {
      const testserviceRequest = new StellarRequest(transport);
      return testserviceRequest
        .get('testserviceTwo:resource')
        .catch(e => e)
        .delay(200)
        .then(e => Promise.reject(e));
    });

    twoHandler.get('testserviceTwo:resource', () => {
      const testserviceRequest = new StellarRequest(transport);
      return testserviceRequest
        .get('testserviceThree:resource')
        .catch(e => e)
        .delay(200)
        .then(e => Promise.reject(e));
    });

    erroringHandler.get('testserviceThree:resource', () => {
      throw new Error('its broke');
    });

    request.get('testserviceOne:resource')
      .catch(e => console.info('received expected error'))
      .then(() => {
        expect(reporterMock).toBeCalled();
      })
      .then(() => done());
  });

  it('Should report, since is local error', (done) => {
    const transport = new MemoryTransport('origin', console);
    const reporterMock = jest.fn();
    const request = new StellarRequest(transport);
    const oneHandler = new StellarHandler(transport, 'leSource');
    oneHandler.use(/.*/, middleware({ reporters: [reporterMock] }));
    const twoHandler = new StellarHandler(transport, 'leSource');
    twoHandler.use(/.*/, middleware({ reporters: [reporterMock] }));
    const erroringHandler = new StellarHandler(transport, 'leSource');
    erroringHandler.use(/.*/, middleware({ reporters: [reporterMock] }));

    oneHandler.get('testserviceOne:resource', () => {
      const testserviceRequest = new StellarRequest(transport);
      return testserviceRequest
        .get('testserviceTwo:resource')
        .catch(e => e)
        .delay(200)
        .then(e => Promise.reject(e));
    });

    twoHandler.get('testserviceTwo:resource', () => {
      const testserviceRequest = new StellarRequest(transport);
      return testserviceRequest
        .get('testserviceThree:resource')
        .catch(e => e)
        .delay(200)
        .then(e => Promise.reject(e));
    });

    erroringHandler.get('testserviceThree:resource', () => {
      throw new Error('an error');
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

  it('Should report to rollbar an error ', (done) => {
    const req = {};
    const val = 'Boohoo';
    const reporterMock = jest.fn();

    middleware({ reporters: [reporterMock] })(req, () => Promise.reject(new Error('Boohoo')))
      .catch((err) => {
        expect(err.message).toEqual(val);
        expect(reporterMock).toBeCalled();
        done();
      });
  });

  it('Should not report a StellarError ', (done) => {
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
