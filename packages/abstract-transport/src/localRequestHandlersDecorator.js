import get from 'lodash/get';
import isFunction from 'lodash/isFunction';

// standardise object to have json data spec
function standardiseObject(obj, standardiseDates) {
  if (obj && standardiseDates) {
    return JSON.parse(JSON.stringify(obj));
  }

  return obj;
}

export default function decorate(Transport, standardiseDates = false) {
  // eslint-disable-next-line better-mutation/no-mutation,no-param-reassign
  Transport.prototype.getLocalHandler = function getLocalHandler(req) {
    const url = get(req, 'headers.queueName');
    return get(this.registries.requestHandlers, url);
  };

  // eslint-disable-next-line better-mutation/no-mutation,no-param-reassign
  Transport.prototype._request = Transport.prototype.request;
  // eslint-disable-next-line better-mutation/no-mutation,no-param-reassign
  Transport.prototype._fireAndForget = Transport.prototype.fireAndForget;

  // eslint-disable-next-line better-mutation/no-mutation,no-param-reassign
  Transport.prototype.request = function request(req, requestTimeout) {
    const localHandler = this.getLocalHandler(req);
    if (localHandler) {
      const res = localHandler(standardiseObject(req, standardiseDates));
      if (isFunction(get(res, 'then'))) {
        return res.then(v => standardiseObject(v, standardiseDates));
      }

      return standardiseObject(res, standardiseDates);
    }

    return this._request(req, requestTimeout);
  };

  // eslint-disable-next-line better-mutation/no-mutation,no-param-reassign
  Transport.prototype.fireAndForget = function fireAndForget(req) {
    const localHandler = this.getLocalHandler(req);
    if (localHandler) {
      localHandler(standardiseObject(req, standardiseDates));
      return;
    }

    this._fireAndForget(req);
  };

  return Transport;
}
