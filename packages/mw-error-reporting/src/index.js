import get from 'lodash/get';
import includes from 'lodash/includes';
import isError from 'lodash/isError';
import map from 'lodash/map';
import Promise from 'bluebird';

function errorReportingMiddleware({ rollbar, newrelic, ignoredErrorTypes }) {
  const rb = rollbar || require('rollbar'); // eslint-disable-line global-require
  const nr = newrelic || require('newrelic'); // eslint-disable-line global-require

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

          const modifiedError = (isError(err) ? err : `Error: ${err}`);
          nr.noticeError(modifiedError);
          return rb.error(modifiedError, req, cb);
        });
    });
  };
}

export default errorReportingMiddleware;
