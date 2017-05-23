/**
 * Created by arolave on 05/10/2016.
 */
/* eslint-disable */
/* global window */

import { StellarRequest, logger } from '@stellarjs/core';
import WebsocketTransport from './WebsocketTransport';

const requestTimeout = 30000; // TODO set from env variable or options obj

// setup the log
let log = null;
function configureStellar(clientLog) {
    log = logger(clientLog);
}
configureStellar(console);

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

        let rixit; // like 'digit', only in some non-decimal radix
        let residual = Math.floor(number);
        let result = '';
        while (true) {
            rixit = residual % 64;
            result = this._Rixits.charAt(rixit) + result;
            residual = Math.floor(residual / 64);

            if (residual === 0) {
                break;
            }
        }
        return result;
    },
};

if (!window.localStorage.browserId) {
    const val = ((Date.now() - new Date(2016, 1, 1).getTime()) * 100000) + Math.floor(Math.random() * 100000);
    window.localStorage.browserId = Base64.fromNumber(val);
}

const stellarRequest = socket => new StellarRequest(
    new WebsocketTransport(socket, log),
    `browser:${window.localStorage.browserId}`,
    log,
    requestTimeout
);

export { stellarRequest, configureStellar, WebsocketTransport };
