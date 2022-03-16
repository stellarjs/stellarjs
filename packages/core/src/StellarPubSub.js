/**
 * Created by arolave on 02/10/2016.
 */
// eslint-disable-next-line lodash/import-scope
import { includes } from 'lodash';

import StellarCore from './StellarCore';

export default class StellarPubSub extends StellarCore {
  constructor(transport, service, options) {
    super(transport, options);
    this.service = service;
  }

  setMiddlewares() {
    const me = this;
    this.publisherMiddlewares = [].concat(this.handlerChain, {
      fn({ headers, body }) {
        return me.transport.publish(headers.channel, { headers, body });
      },
    });
  }

  publish(channel, body, options = {}) {
    const headers = this._getHeaders(options.headers, { type: 'publish', service: this.service, channel });
    return this._executeMiddlewares(this.publisherMiddlewares)({ headers, body });
  }

  subscribe(channel, messageHandler, { responseType } = {}) {
    const subscriberMiddlewares = [].concat(this.handlerChain, {
      fn({ headers, body }) {
        const message = includes(['raw', 'jobData'], responseType) ? { headers, body } : body;
        return messageHandler(message);
      },
    });

    if (this.service) {
      return this.transport.subscribeGroup(this.service, channel, this._executeMiddlewares(subscriberMiddlewares));
    }

    return this.transport.subscribe(channel, this._executeMiddlewares(subscriberMiddlewares));
  }
}
