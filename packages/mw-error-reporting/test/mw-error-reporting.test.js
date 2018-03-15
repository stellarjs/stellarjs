/**
 * Created by arolave on 14/05/2017.
 */

import Promise from 'bluebird';
import StellarError from '@stellarjs/stellar-error';
import middleware from '../src';

describe('Error Reporting middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Should pass request w/o queue to the next midddleware ', (done) => {
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
    // const next = () => Promise.resolve(val);
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
