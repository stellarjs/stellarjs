/**
 * Created by arolave on 14/05/2017.
 */

import Promise from 'bluebird';
import set from 'lodash/set';
import newrelic from 'newrelic';
import middleware from '../src';

describe('New Relic middleware', () => {
  it('Should pass request w/o queue to the next midddleware ', (done) => {
    const req = {};
    const val = 'noop';
    const next = () => Promise.resolve(val);

    middleware(req, next)
      .then((res) => {
        expect(res).toEqual(val);
        expect(newrelic.addCustomParameters).not.toBeCalled();
        expect(newrelic.startWebTransaction).not.toBeCalled();
        expect(newrelic.endTransaction).not.toBeCalled();
        expect(newrelic.noticeError).not.toBeCalled();
        done();
      });
  });

  it('Should pass request with queue to NR and to the next midddleware (success)', (done) => {
    const req = {};
    set(req, 'headers.queueName', 'queueName');
    const val = 'success';
    const resolve = () => Promise.resolve(val);

    middleware(req, resolve)
      .then((res) => {
        expect(res).toEqual(val);
        expect(newrelic.addCustomParameters).toBeCalled();
        expect(newrelic.startWebTransaction).toBeCalled();
        expect(newrelic.endTransaction).toBeCalled();
        expect(newrelic.noticeError).not.toBeCalled();
        done();
      });
  });

  it('Should pass request with queue to NR and to the next midddleware (failure)', (done) => {
    const req = {};
    set(req, 'headers.queueName', 'queueName');
    const val = 'reject';
    const reject = () => Promise.reject(val);
    middleware(req, reject)
      .catch((res) => {
        expect(res).toEqual(val);
        expect(newrelic.addCustomParameters).toBeCalled();
        expect(newrelic.startWebTransaction).toBeCalled();
        expect(newrelic.endTransaction).toBeCalled();
        expect(newrelic.noticeError).toBeCalled();
        done();
      });
  });
});
