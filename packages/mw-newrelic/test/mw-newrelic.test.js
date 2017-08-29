/**
 * Created by arolave on 14/05/2017.
 */

import Promise from 'bluebird';
import set from 'lodash/set';
import middleware from '../src';

describe('Test NR middleware use cases', () => {

  it('Should pass request w/o queue to the next midddleware ', () => {
    const req = {};
    const val = 'success';
    const next = () => Promise.resolve(val);

    middleware(req, next)
      .then(res => expect(res).toBe(val));
  });

  it('Should pass request with queue to NR and to the next midddleware ', () => {
    const req = {};
    set(req, 'headers.queueName', 'queueName')
    const val = 'success';
    const resolve = () => Promise.resolve(val);

    middleware(req, resolve)
      .then(res => expect(res).toBe(val));
    
    const reject = () => Promise.reject(val);
    middleware(req, reject)
      .catch(res => expect(res).(val));
  });
});