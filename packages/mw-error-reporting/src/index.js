import get from 'lodash/get';
import includes from 'lodash/includes';
import map from 'lodash/map';
import Promise from 'bluebird';

function errorReportingMiddleware({ reporters, ignoredErrorTypes }) {
  return function (req, next, log) {
    return next()
        .catch((err) => {
          if (includes(map(ignoredErrorTypes, 'name'), get(err, 'constructor.name'))) {
            return Promise.reject(err);
          }

          try {
            Promise.map(reporters, reporter => reporter(err, req)); // eslint-disable-line
          } catch (e) {
            log.error(e);
          }
          return Promise.reject(err);
        });
  };
}

export default errorReportingMiddleware;
