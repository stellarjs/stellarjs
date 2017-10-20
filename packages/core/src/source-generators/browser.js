/**
 * Created by arolave on 29/05/2017.
 */
/* global window */
import { getFromInstanceId } from './common';

// see http://stackoverflow.com/questions/6213227/fastest-way-to-convert-a-number-to-radix-64-in-javascript
const Base64 = {

  _Rixits: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/',

  fromNumber(number) {
    if (isNaN(Number(number)) || number === null || number === Number.POSITIVE_INFINITY) {
      throw new Error('The input is not valid');
    }

    if (number < 0) {
      throw new Error(`Can't represent negative numbers now`);
    }

    let rixit = 0; // like 'digit', only in some non-decimal radix
    let residual = Math.floor(number);
    let result = '';
    while (true) { // eslint-disable-line no-constant-condition
      rixit = residual % 64;
      result = this._Rixits.charAt(rixit) + result;
      residual = Math.floor(residual / 64); // eslint-disable-line better-mutation/no-mutation

      if (residual === 0) {
        break;
      }
    }
    return result;
  },
};

export default function run() {
  if (!window.localStorage.browserId) {
    const val = ((Date.now() - new Date(2016, 1, 1).getTime()) * 100000) + Math.floor(Math.random() * 100000);
    window.localStorage.browserId = Base64.fromNumber(val);  // eslint-disable-line better-mutation/no-mutation
  }

  return getFromInstanceId(window.localStorage.browserId, 'browser');
}
