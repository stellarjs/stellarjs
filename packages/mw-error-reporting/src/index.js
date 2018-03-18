import get from 'lodash/get';
import includes from 'lodash/includes';
import map from 'lodash/map';
import Promise from 'bluebird';

function isLocalError(err) {
  const headers = get(err, '__stellarResponse.headers');
  return get(headers, 'errorSource') === get(headers, 'source');
}

function errorReportingMiddleware({ reporters, ignoredErrorTypes }) {
  return function (req, next, options, log) {
    return next()
        .catch((err) => {
          if (includes(map(ignoredErrorTypes, 'name'), get(err, 'constructor.name')) || !isLocalError(err)) {
            return Promise.reject(err);
          }

            // eslint-disable-next-line lodash/prefer-lodash-method
          Promise.map(reporters, reporter => reporter(err, req))
            .catch((e) => {
              log.error(e);
            });

          return Promise.reject(err);
        });
  };
}

export default errorReportingMiddleware;
