/**
 * Created by arolave on 14/05/2017.
 */

import Promise from 'bluebird';
import rollbar from 'rollbar';
import middleware from '../src';
import { rollbarMiddlewareConfigurer } from '../src'
import { StellarError } from '@stellarjs/core';

describe('Rollbar middleware', () => {
  beforeEach(() => {
      jest.clearAllMocks();
  });

    it('Should pass request w/o queue to the next midddleware ', (done) => {
        const req = {};
        const val = 'noop';
        const next = () => Promise.resolve(val);

        middleware(req, next)
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

        middleware(req, () => Promise.reject(new Error('Boohoo')))
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

        middleware(req, () => Promise.reject(new StellarError('Boohoo')))
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
        const mw = rollbarMiddlewareConfigurer({ ignoredErrorTypes: [StellarError] });
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
