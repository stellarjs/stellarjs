/**
 * Created by arolave on 14/05/2017.
 */

import Promise from 'bluebird';
import rollbar from 'rollbar';
import middleware from '../src';
import { StellarError } from '@stellarjs/core';
import { StellarHandler, StellarRequest } from '@stellarjs/core';
import { MemoryTransport } from '@stellarjs/transport-memory';

describe('Rollbar middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Should only report the first occurence of an error', (done) => {
    const messaging = new MemoryTransport(console);

    const request = new StellarRequest(messaging, 'origin', console);
    const oneHandler = new StellarHandler(messaging, 'testserviceOne', console);
    oneHandler.use('.*', middleware());
    const twoHandler = new StellarHandler(messaging, 'testserviceTwo', console);
    twoHandler.use('.*', middleware());

    oneHandler.get('testserviceOne:resource', ({ body }) => {
      const testserviceRequest = new StellarRequest(messaging, 'testserviceOne', console);
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
          console.log(JSON.stringify(rollbar.handleError.mock.calls));
          expect(rollbar.handleError).toBeCalled();
          expect(rollbar.handleError.mock.calls).toHaveLength(1);
        })
        .then(() => done());
  });

  it('Should pass request w/o queue to the next midddleware ', (done) => {
    const req = {};
    const val = 'noop';
    const next = () => Promise.resolve(val);

    middleware()(req, next)
          .then((res) => {
            expect(res).toEqual(val);
            expect(rollbar.handleError).not.toBeCalled();
            expect(rollbar.handleErrorWithPayloadData).not.toBeCalled();
            expect(rollbar.reportMessage).not.toBeCalled();
            expect(rollbar.reportMessageWithPayloadData).not.toBeCalled();
            done();
          });
  });

  it('Should report to rollbar an error ', (done) => {
    const req = {};
    const val = 'Boohoo';
    const next = () => Promise.resolve(val);

    middleware()(req, () => Promise.reject(new Error('Boohoo')))
          .catch((err) => {
            expect(err.message).toEqual(val);
            expect(rollbar.handleError).toBeCalled();
            expect(rollbar.handleErrorWithPayloadData).not.toBeCalled();
            expect(rollbar.reportMessage).not.toBeCalled();
            expect(rollbar.reportMessageWithPayloadData).not.toBeCalled();
            done();
          });
  });

  it('Should not report to rollbar a StellarError ', (done) => {
    const req = {};
    const val = 'Boohoo';
    const next = () => Promise.resolve(val);

    middleware()(req, () => Promise.reject(new StellarError('Boohoo')))
          .catch((err) => {
            expect(err.message).toEqual(val);
            expect(rollbar.handleError).toBeCalled();
            expect(rollbar.handleErrorWithPayloadData).not.toBeCalled();
            expect(rollbar.reportMessage).not.toBeCalled();
            expect(rollbar.reportMessageWithPayloadData).not.toBeCalled();
            done();
          });
  });

  it('Should not report to rollbar a StellarError ', (done) => {
    const req = {};
    const val = 'Boohoo';
    const next = () => Promise.resolve(val);
    const mw = middleware({ ignoredErrorTypes: [StellarError] });
    mw(req, () => Promise.reject(new StellarError('Boohoo')))
          .catch((err) => {
            expect(err.message).toEqual(val);
            expect(rollbar.handleError).not.toBeCalled();
            expect(rollbar.handleErrorWithPayloadData).not.toBeCalled();
            expect(rollbar.reportMessage).not.toBeCalled();
            expect(rollbar.reportMessageWithPayloadData).not.toBeCalled();
            done();
          });
  });
});
