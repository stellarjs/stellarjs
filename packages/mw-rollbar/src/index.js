import isError from 'lodash/isError';
import Promise from 'bluebird';
import rollbar from 'rollbar';
import { StellarError } from '@stellarjs/core';

/* reimplementation of rollbar.errorHandler() for promise based middleware */
export default function (req, next) {
  return new Promise((resolve, reject) => {
    next()
      .then(response => resolve(response))
      .catch((err) => {
        function cb(rollbarErr) {
          if (rollbarErr) {
            rollbar.error(`Error reporting to rollbar, ignoring: ${rollbarErr}`);
          }

          reject(err);
        }

        if (!err || err instanceof StellarError) {
          return reject(err);
        }

        if (err instanceof Error || isError(err)) {
          return rollbar.handleError(err, req, cb);
        }

        return rollbar.reportMessage(`Error: ${err}`, 'error', req, cb);
      });
  });
}
