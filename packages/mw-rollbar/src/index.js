import get from 'lodash/get';
import includes from 'lodash/includes';
import isError from 'lodash/isError';
import map from 'lodash/map';
import Promise from 'bluebird';

function isLocalError(err) {
  const headers = get(err, '__stellarResponse.headers');
  return get(headers, 'errorSource') === get(headers, 'source');
}

function rollbarMiddlewareConfigurer({ rollbar, ignoredErrorTypes } = {}) {
  const rb = rollbar || require('rollbar'); // eslint-disable-line global-require

  /* reimplementation of rollbar.errorHandler() for promise based middleware */
  return function (req, next, options, log) {
    return new Promise((resolve, reject) => {
      next()
              .then(response => resolve(response))
              .catch((err) => {
                function cb(rollbarErr) {
                  if (rollbarErr) {
                    log.warn(`Error reporting to rollbar, ignoring: ${rollbarErr}`);
                  }

                  reject(err);
                }

                if (includes(map(ignoredErrorTypes, 'name'), get(err, 'constructor.name'))) {
                  return reject(err);
                }

                if ((err instanceof Error || isError(err)) && isLocalError(err)) {
                  return rb.handleError(err, req, cb);
                }

                return rb.reportMessage(`Error: ${err}`, 'error', req, cb);
              });
    });
  };
}

export default rollbarMiddlewareConfigurer;
