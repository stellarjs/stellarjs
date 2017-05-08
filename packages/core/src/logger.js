/**
 * Created by arolave on 23/12/2016.
 */
const size = require('lodash/size');

let enableLogging = true;

function initLogger() {
    enableLogging = size(process.env.STELLAR_DEBUG_LOGS)
        ? process.env.STELLAR_DEBUG_LOGS !== 'false'
        : process.env.NODE_ENV === 'development';
}

const loggerHandler = {
    get: (target, propKey) => {
        const origMethod = target[propKey];
        return function (...args) { // eslint-ignore-line func-names
            if (enableLogging) {
                return origMethod.apply(target, args);
            }

            return true;
        };
    },
};

initLogger();

function logger(log) {
    return global.Proxy ? new Proxy(log, loggerHandler) : log;
}

module.exports = { logger, initLogger };
