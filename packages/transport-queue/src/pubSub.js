import forEach from 'lodash/forEach';
import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';
import uuid from 'uuid/v4';
import Core from './core';

export default class PubSub extends Core {
  constructor(log, generateId, enqueue, process, getSubscribers, registerSubscriber) {
    super(log, generateId, enqueue, process);
    this.getSubscribers = getSubscribers;
    this.registerSubscriber = registerSubscriber;
  }

  publish(stellarId, channel, payload) {
    const subscribersQueueNames = this.getSubscribers(channel);
    forEach(subscribersQueueNames, queueName => this._getNextId(queueName)
      .then(queueMessageId => this._enqueue(queueName, payload, queueMessageId)));
    return stellarId;
  }

  subscribeGroup(groupID, channel, messageHandler) { // eslint-disable-line no-unused-vars
    const subscriptionInbox = this._subscriptionInbox(channel);
    return this._registerSubscription(channel, subscriptionInbox, (job) => {
      const message = includes(['raw', 'jobData'], options.responseType) ? job.data : job.data.body; // TODO: ask andres
      return messageHandler(message, channel);
    })
      .then((unsubscribe) => {
        this._processSubscriptions(subscriptionInbox);
        return unsubscribe;
      });
  }

  _subscriptionInbox(channel) {
    if (!this.subscriptionInbox) {
      this.subscriptionInbox = `stlr:s:${channel}:subscriptionInbox`;
    }

    return this.subscriptionInbox;
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

  _registerSubscription(channel, subscriptionInbox, messageHandler) {
    const subscription = uuid();
    this._addHandler(channel, subscription, messageHandler);

    return this.registerSubscriber(channel, subscriptionInbox)
      .then(deregisterSubscriber => () => {
        this._removeHandler(channel, subscription);
        if (isEmpty(this.messageHandlers[channel])) {
          return deregisterSubscriber();
        }
        return Promise.resolve(true);
      });
  }

  _processSubscriptions(subscriptionInbox) {
    if (!this.isProcessingSubscriptions) {
      this.isProcessingSubscriptions = true;
      this.log.info(`@QueueTransport: Starting subscriptions`, { inbox: subscriptionInbox });
      this._process(subscriptionInbox, (job) => {
        forEach(this.messageHandlers[job.data.headers.channel], fn => fn(job));
      });
    }
  }
}
