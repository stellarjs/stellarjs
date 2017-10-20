import get from 'lodash/get';
import flow from 'lodash/fp/flow';
import join from 'lodash/fp/join';
import map from 'lodash/fp/map';
import reverse from 'lodash/fp/reverse';
import { Cookie } from 'tough-cookie';
import XHR, { Request } from 'engine.io-client/lib/transports/polling-xhr';

if (get(process, 'versions.node')) {
  const _onLoad = Request.prototype.onLoad;
  const _request = XHR.prototype.request;

  // eslint-disable-next-line better-mutation/no-mutation
  XHR.prototype.request = function request(opts) {
    const req = _request.call(this, opts);

    // for accessing the transport (which stores the http headers) later
    // eslint-disable-next-line better-mutation/no-mutation
    req.transport = this;

    return req;
  };

  // eslint-disable-next-line better-mutation/no-mutation
  Request.prototype.onLoad = function onLoad() {
    const content = this.xhr.getResponseHeader('Set-Cookie');

    if (content) {
      const cookieHeader = flow([
        map(c => Cookie.parse(c)),
        map(c => c.cookieString()),
        reverse,
        join('; '),
      ])(content);

      if (!this.transport.extraHeaders) {
        this.transport.extraHeaders = {
          Cookie: cookieHeader,
        };
      }
    }
    _onLoad.call(this);
  };
}
