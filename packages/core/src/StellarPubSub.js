/**
 * Created by arolave on 02/10/2016.
 */
import assign from 'lodash/assign';
import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';

import Promise from 'bluebird';

import uuid from 'uuid/v4';

import StellarCore from './StellarCore';

export default class StellarPubSub extends StellarCore {
  constructor(transport, source, log, service) {
    super(transport, source, log);
    this.service = service;
    this.subscriberRegistry = {};
    this.setInbox();
  }

  setInbox() {
    this.subscriptionInbox = this.service
        ? `stlr:s:${this.service}:subscriptionInbox`
        : `stlr:n:${this.source}:subscriptionInbox`;
  }

  setSource(source) {
    super.setSource(source);
    this.setInbox();
  }

  setMiddlewares() {
    const me = this;
    this.publisherMiddlewares = [].concat(this.handlerChain, {
      fn: ({ headers, body }) => me.transport.getSubscribers(headers.channel)
            .each((queueName) => {
              const id = me.getNextId(queueName);
              const finalHeaders = assign({ id }, headers);
              return this._enqueue(queueName, { headers: finalHeaders, body });
            }),
    });
    this.subscriberMiddlewares = [].concat(me.handlerChain, {
      fn: ({ headers, body }) => {
        const subscriptions = me.subscriberRegistry[headers.channel];
        return map(subscriptions, ({ messageHandler, responseType }) => {
          const message = includes(['raw', 'jobData'], responseType) ? { headers, body } : body;
          return messageHandler(message);
        });
      },
    });
  }

  publish(channel, body, options = {}) {
    const headers = this._getHeaders(options.headers, { type: 'publish', service: this.service, channel });
    return this._executeMiddlewares(this.publisherMiddlewares, { headers, body });
  }

  _addHandler(channel, subscription, messageHandler, { responseType }) {
    if (!this.subscriberRegistry[channel]) {
      this.subscriberRegistry[channel] = {};
    }

    this.subscriberRegistry[channel][subscription] = { messageHandler, responseType };
  }

  _removeHandler(channel, subscription) {
    delete this.subscriberRegistry[channel][subscription];
  }

  registerSubscription(channel, messageHandler, options) {
    const subscription = uuid();
    this._addHandler(channel, subscription, messageHandler, options);

    return this.transport
      .registerSubscriber(channel, this.subscriptionInbox)
      .then(deregisterSubscriber => () => {
        this._removeHandler(channel, subscription);
        if (isEmpty(this.subscriberRegistry[channel])) {
          return deregisterSubscriber();
        }
        return Promise.resolve(true);
      });
  }

  _processSubscriptions() {
    if (!this.isProcessingSubscriptions) {
      this.isProcessingSubscriptions = true;
      this.log.info(`@StellarPubSub: Starting subscriptions`, { inbox: this.subscriptionInbox });
      this._process(this.subscriptionInbox, job => this._executeMiddlewares(this.subscriberMiddlewares, job.data));
    }
  }

  reset() {
    if (!this.isProcessingSubscriptions || !this.subscriptionInbox) {
      return Promise.resolve(true);
    }

    this.isProcessingSubscriptions = false;
    return this._stopProcessing(this.subscriptionInbox);
  }

  subscribe(channel, messageHandler, options = {}) {
    return this
      .registerSubscription(channel, messageHandler, options)
      .then((unsubscribe) => {
        this._processSubscriptions();
        return unsubscribe;
      });
  }
}
