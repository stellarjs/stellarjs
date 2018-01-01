/**
 * Created by arolave on 14/05/2017.
 */

import Promise from 'bluebird';
import middleware from '../src';

describe('Log Summary middleware', () => {
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
        expect(logMock.info).toBeCalled();
        expect(logMock.error).not.toBeCalled();
        expect(logMock.info.mock.calls[0][0]).toMatch(/stellar request [0-9]+ms/);
        expect(logMock.info.mock.calls[0][1]).toEqual({ req: reqValue, res: { body: resValue.body } });
        return done();
      });
  });


  it('Should log reactive and response', (done) => {
    const reqValue = { headers: { id: 1, type: 'reactive' }, body: 'hi' };
    const resValue = { headers: { id: 2, requestId: 1, type: 'response' }, body: 'bye' };
    const next = () => Promise.resolve(resValue);

    middleware(reqValue, next, undefined, logMock)
          .then((res) => {
            expect(res).toEqual(resValue);
            expect(logMock.info).toBeCalled();
            expect(logMock.error).not.toBeCalled();
            expect(logMock.info.mock.calls[0][0]).toMatch(/stellar reactive [0-9]+ms/);
            expect(logMock.info.mock.calls[0][1]).toEqual({ req: reqValue, res: { body: resValue.body } });
            return done();
          });
  });


  it('Should log publish', (done) => {
    const publishValue = { headers: { id: 1, type: 'publish' }, body: 'hi' };
    const resValue = { headers: { id: 2, requestId: 1, type: 'response' }, body: 'bye' };
    const next = () => Promise.resolve(resValue);

    middleware(publishValue, next, undefined, logMock)
          .then(() => {
            expect(logMock.info).toBeCalled();
            expect(logMock.error).not.toBeCalled();
            expect(logMock.info.mock.calls[0][0]).toMatch(/stellar publish/);
            expect(logMock.info.mock.calls[0][1]).toEqual({ req: publishValue });
            return done();
          });
  });

  it('Should log subscribe', (done) => {
    const subscribeValue = { headers: { id: 1, type: 'publish' }, body: 'hi' };
    const resValue = { headers: { id: 2, requestId: 1, type: 'response' }, body: 'bye' };
    const next = () => Promise.resolve(resValue);

    middleware(subscribeValue, next, undefined, logMock)
          .then(() => {
            expect(logMock.info).toBeCalled();
            expect(logMock.error).not.toBeCalled();
            expect(logMock.info.mock.calls[0][0]).toMatch(/stellar publish/);
            expect(logMock.info.mock.calls[0][1]).toEqual({ req: subscribeValue });
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
        expect(err).toBeInstanceOf(Error);
        expect(err.__stellarResponse).toEqual(errorStellarResponse);
        expect(logMock.info).not.toBeCalled();
        expect(logMock.error).toBeCalled();
        expect(logMock.error.mock.calls[0][0]).toMatch(/stellar request [0-9]+ms/);
        expect(logMock.error.mock.calls[0][1]).toEqual(
          { req: reqValue, errorType: 'Error', errorSource: 'SERVER', res: { body: errorStellarResponse.body } });
        done();
      });
  });
});
