/**
 * Created by arolave on 02/10/2016.
 */
import assign from 'lodash/assign';
import forEach from 'lodash/forEach';
import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';

import Promise from 'bluebird';

import uuid from 'uuid/v4';

import StellarCore from './StellarCore';

// TODO make service & source tracing information
export default class StellarPubSub extends StellarCore {
  constructor(transport, source, log, service) {
    super(transport, source, log);
    this.service = service;
    this.messageHandlers = {};
  }

  setSource(source) {
    super.setSource(source);
    this.subscriptionInbox = this.service
            ? `stlr:s:${this.service}:subscriptionInbox`
            : `stlr:n:${this.source}:subscriptionInbox`;
  }

  publish(channel, body, options = {}) {
    const allMiddlewares = [].concat(this.handlerChain, {
      fn: ({ headers }) => this.transport.getSubscribers(channel)
        .each(queueName => this.getNextId(queueName).then((id) => {
          const finalHeaders = assign({ id }, headers);
          return this._enqueue(queueName, { headers: finalHeaders, body });
        })),
    });

    const headers = assign(this._getHeaders(options), { type: 'publish', service: this.service, channel });
    return this._executeMiddlewares(allMiddlewares, { headers, body });
  }

  _addHandler(channel, subscription, messageHandler) {
    if (!this.messageHandlers[channel]) {
      this.messageHandlers[channel] = {};
    }

    this.messageHandlers[channel][subscription] = messageHandler;
  }

  _removeHandler(channel, subscription) {
    delete this.messageHandlers[channel][subscription];
  }

  registerSubscription(channel, messageHandler) {
    const subscription = uuid();
    this._addHandler(channel, subscription, messageHandler);

    return this.sourceSemaphore
            .then(() => this.transport.registerSubscriber(channel, this.subscriptionInbox))
            .then(deregisterSubscriber => () => {
              this._removeHandler(channel, subscription);
              if (isEmpty(this.messageHandlers[channel])) {
                return deregisterSubscriber();
              }
              return Promise.resolve(true);
            });
  }

  _processSubscriptions() {
    if (!this.isProcessingSubscriptions) {
      this.isProcessingSubscriptions = true;
      this.log.info(`@StellarPubSub(${this.subscriptionInbox}): Starting subscriptions`);
      this._process(this.subscriptionInbox, (job) => {
        forEach(this.messageHandlers[job.data.headers.channel], fn => fn(job));
      });
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
        // TODO add separate middleware chain for subscriptions
    return this
            .registerSubscription(channel, (job) => {
                // this.log.info(`messageHandler ${job.jobId}`);
              const message = includes(['raw', 'jobData'], options.responseType) ? job.data : job.data.body;
              return messageHandler(message, channel);
            })
            .then((unsubscribe) => {
              this._processSubscriptions();
              return unsubscribe;
            });
  }
}
