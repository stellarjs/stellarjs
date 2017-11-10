import get from 'lodash/get';
import includes from 'lodash/includes';
import isError from 'lodash/isError';
import map from 'lodash/map';
import Promise from 'bluebird';
import rollbar from 'rollbar';
import { StellarError } from '@stellarjs/core';

export function rollbarMiddlewareConfigurer({ ignoredErrorTypes } = {}) {
    /* reimplementation of rollbar.errorHandler() for promise based middleware */
    return function (req, next) {
        return new Promise((resolve, reject) => {
            next()
              .then(response => resolve(response))
              .catch((err) => {
                  function cb(rollbarErr) {
                      if (rollbarErr) {
                          this.log.warn(`Error reporting to rollbar, ignoring: ${rollbarErr}`);
                      }

                      reject(err);
                  }

                  if (includes(map(ignoredErrorTypes, 'name'), get(err, 'constructor.name'))) {
                      return reject(err);
                  }

                  if (err instanceof Error || isError(err)) {
                      return rollbar.handleError(err, req, cb);
                  }

                  return rollbar.reportMessage(`Error: ${err}`, 'error', req, cb);
              });
        });
    }
}

export default rollbarMiddlewareConfigurer();
