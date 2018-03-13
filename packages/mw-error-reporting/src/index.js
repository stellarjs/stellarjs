import get from 'lodash/get';
import includes from 'lodash/includes';
import map from 'lodash/map';
import forEach from 'lodash/forEach';
import Promise from 'bluebird';

function errorReportingMiddleware({ reporters, ignoredErrorTypes }) {
  return function (req, next) {
    return next()
        .catch((err) => {
          if (includes(map(ignoredErrorTypes, 'name'), get(err, 'constructor.name'))) {
            return Promise.reject(err);
          }

          forEach(reporters, item => item(err, req));
          return Promise.reject(err);
        });
  };
}

export default errorReportingMiddleware;
