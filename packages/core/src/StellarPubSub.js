/**
 * Created by arolave on 02/10/2016.
 */
import includes from 'lodash/includes';

import StellarCore from './StellarCore';

export default class StellarPubSub extends StellarCore {
  constructor(messagingAdaptor, source, log, service) {
    super(messagingAdaptor, source, log);
    this.service = service;
  }

  setMiddlewares() {
    const me = this;
    this.publisherMiddlewares = [].concat(this.handlerChain, {
      fn({ headers, body }) {
        return me.messagingAdaptor.publish(headers.channel, { headers, body });
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
      return this.messagingAdaptor.subscribeGroup(this.service, channel, this._executeMiddlewares(subscriberMiddlewares));
    }

    return this.messagingAdaptor.subscribe(channel, this._executeMiddlewares(subscriberMiddlewares));
  }
}
