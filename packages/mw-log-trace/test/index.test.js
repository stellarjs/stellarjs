/**
 * Created by arolave on 14/05/2017.
 */

import Promise from 'bluebird';
import { mwLogTraceFactory, default as middleware } from '../src';

describe('Log Traces middleware', () => {
  const logMock = {
    info: jest.fn(),
    error: jest.fn(),
  };

  afterEach(() => {
    logMock.info.mockReset();
    logMock.error.mockReset();
  });

  it('Should log request and response', (done) => {
    const reqValue = { headers: { id: 1, type: 'request' }, body: 'hi' };
    const resValue = { headers: { id: 2, requestId: 1, type: 'response' }, body: 'bye' };
    const next = () => Promise.resolve(resValue);

    middleware(reqValue, next, undefined, logMock)
      .then((res) => {
        expect(res).toEqual(resValue);
        expect(logMock.info.mock.calls).toHaveLength(2);
        expect(logMock.error).not.toBeCalled();
        expect(logMock.info.mock.calls[0][0]).toEqual('stellar REQUEST');
        expect(logMock.info.mock.calls[0][1]).toEqual(reqValue);
        expect(logMock.info.mock.calls[1][0]).toMatch(/stellar RESPONSE [0-9]+ms/);
        expect(logMock.info.mock.calls[1][1]).toEqual(resValue);
        return done();
      });
  });

  it('Should log request and error response', (done) => {
    const reqValue = { headers: { id: 1, type: 'request' }, body: 'hi' };
    const errorStellarResponse = { headers: { id: 2, requestId: 1, type: 'response', errorType: 'Error', errorSource: 'SERVER' }, body: 'error' };
    const next = () => {
      const err = new Error('error message ');
      err.__stellarResponse = errorStellarResponse;
      return Promise.reject(err);
    };

    middleware(reqValue, next, undefined, logMock)
          .then((res) => {
            log.info('ahrg');
            fail();
          })
          .catch((err) => {
            expect(logMock.info.mock.calls).toHaveLength(1);
            expect(logMock.error.mock.calls).toHaveLength(1);
            expect(logMock.info.mock.calls[0][0]).toEqual('stellar REQUEST');
            expect(logMock.info.mock.calls[0][1]).toEqual(reqValue);
            expect(logMock.error.mock.calls[0][0]).toMatch(/stellar ERROR [0-9]+ms/);
            expect(logMock.error.mock.calls[0][1]).toEqual(err.__stellarResponse);

            done();
          });
  });

  it('if set to headers should only log request and response headers', (done) => {
    const reqValue = { headers: { id: 1, type: 'request' }, body: 'hi' };
    const resValue = { headers: { id: 2, requestId: 1, type: 'response' }, body: 'bye' };
    const next = () => Promise.resolve(resValue);
    const mwHeaderTraceLogger = mwLogTraceFactory({ logTraceDetail: 'HEADERS' });

    mwHeaderTraceLogger(reqValue, next, undefined, logMock)
          .then((res) => {
            expect(res).toEqual(resValue);
            expect(logMock.info.mock.calls).toHaveLength(2);
            expect(logMock.error).not.toBeCalled();
            expect(logMock.info.mock.calls[0][0]).toEqual('stellar REQUEST');
            expect(logMock.info.mock.calls[0][1]).toEqual(reqValue.headers);
            expect(logMock.info.mock.calls[1][0]).toMatch(/stellar RESPONSE [0-9]+ms/);
            expect(logMock.info.mock.calls[1][1]).toEqual(resValue.headers);
            return done();
          });
  });


  it('if set to off should not log at all', (done) => {
    const reqValue = { headers: { id: 1, type: 'request' }, body: 'hi' };
    const resValue = { headers: { id: 2, requestId: 1, type: 'response' }, body: 'bye' };
    const next = () => Promise.resolve(resValue);
    const mwHeaderTraceLogger = mwLogTraceFactory({ logTraceDetail: 'OFF' });

    mwHeaderTraceLogger(reqValue, next, undefined, logMock)
          .then((res) => {
            expect(res).toEqual(resValue);
            expect(logMock.info).not.toBeCalled();
            expect(logMock.error).not.toBeCalled();
            return done();
          });
  });
});
