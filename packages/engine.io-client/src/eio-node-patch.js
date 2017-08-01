import _ from 'lodash';
import { Cookie } from 'tough-cookie';
import XHR, { Request } from 'engine.io-client/lib/transports/polling-xhr';

if (process.versions.node) {
  const onLoad = Request.prototype.onLoad;
  const request = XHR.prototype.request;

  XHR.prototype.request = function (opts) {
    const req = request.call(this, opts);

    req.transport = this;

    return req;
  };

  Request.prototype.onLoad = function () {
    const content = this.xhr.getResponseHeader('Set-Cookie');

    if (content) {
      const cookies = _.map(content, c => Cookie.parse(c));
      const cookiesString = _.map(cookies, c => c.cookieString());
      const cookieHeader = _.join(_.reverse(cookiesString), '; ');
      if (!this.transport.extraHeaders) {
        this.transport.extraHeaders = {
          Cookie: cookieHeader,
        };
      }
    }
    onLoad.call(this);
  };
}
