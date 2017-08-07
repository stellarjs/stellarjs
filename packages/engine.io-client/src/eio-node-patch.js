import { get, chain } from 'lodash';
import { Cookie } from 'tough-cookie';
import XHR, { Request } from 'engine.io-client/lib/transports/polling-xhr';

if (get(process, 'versions.node')) {
  const _onLoad = Request.prototype.onLoad;
  const _request = XHR.prototype.request;

  XHR.prototype.request = function request(opts) {
    const req = _request.call(this, opts);

    // for accessing the transport (which stores the http headers) later
    req.transport = this;

    return req;
  };

  Request.prototype.onLoad = function onLoad() {
    const content = this.xhr.getResponseHeader('Set-Cookie');

    if (content) {
      const cookieHeader = chain(content)
          .map(c => Cookie.parse(c))
          .map(c => c.cookieString())
          .reverse()
          .join('; ')
          .value();

      if (!this.transport.extraHeaders) {
        this.transport.extraHeaders = {
          Cookie: cookieHeader,
        };
      }
    }
    _onLoad.call(this);
  };
}
