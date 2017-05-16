const Promise = require('bluebird');
const rollbar = require('rollbar');
const logger = require('rollbar/lib/logger');
const StellarError = require('@stellarjs/core');

/* reimplementation of rollbar.errorHandler() for promise based middleware */
function mw(req, next) {
    return new Promise((resolve, reject) => {
        next()
            .then(response => resolve(response))
            .catch(([err, response]) => {
                const cb = (rollbarErr) => {
                    if (rollbarErr) {
                        logger.error(`Error reporting to rollbar, ignoring: ${rollbarErr}`);
                    }

                    reject([err, response]);
                };

                if (!err || err instanceof StellarError) {
                    return reject([err, response]);
                }

                if (err instanceof Error) {
                    return rollbar.handleError(err, req, cb);
                }

                return rollbar.reportMessage(`Error: ${err}`, 'error', req, cb);
            });
    });
}

module.exports = mw;
