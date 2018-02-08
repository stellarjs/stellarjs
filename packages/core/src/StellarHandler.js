/**
 * Created by arolave on 25/09/2016.
 */
import lowerCase from 'lodash/lowerCase';

import StellarCore from './StellarCore';

export default class StellarHandler extends StellarCore {
  get(url, handler) {
    return this.handleMethod(url, 'GET', handler);
  }

  create(url, handler) {
    return this.handleMethod(url, 'CREATE', handler);
  }

  update(url, handler) {
    return this.handleMethod(url, 'UPDATE', handler);
  }

  remove(url, handler) {
    return this.handleMethod(url, 'REMOVE', handler);
  }

  handleMethod(url, method, handler) {
    return this.handleRequest(`${url}:${lowerCase(method)}`, handler);
  }

  handleRequest(url, handler) {
    this.allMiddlewares = this.handlerChain.concat({
      fn({ headers, body }) {
        return handler({ headers, body });
      },
    });

    return this.messagingAdaptor.addRequestHandler(url, this._executeMiddlewares(this.allMiddlewares));
  }
}
