import get from 'lodash/get';
import isFunction from 'lodash/isFunction';
import standardizeObjectFactory from './utils/standardizeObject';

export default function mwLocalDispatchFactory({ stringifyDates = true } = {}) {
  const standardizeObject = standardizeObjectFactory({ stringifyDates });

  function doLocalCall(req, transport, next, responseHandler) {
    const localHandler = transport.getLocalHandler(req);
    if (localHandler) {
      const res = localHandler(standardizeObject(req));
      return responseHandler ? responseHandler(res) : undefined;
    }

    return next();
  }

  return function mwLocalDispatch(req, next, options, log, transport) {
    switch (req.headers.type) {
      case 'fireAndForget':
        return doLocalCall(req, transport, next);
      case 'request':
      case 'reactive':
        return doLocalCall(req, transport, next, (res) => {
          if (isFunction(get(res, 'then'))) {
            return res.then(standardizeObject);
          }

          return standardizeObject(res);
        });
      default:
        return next();
    }
  };
}
