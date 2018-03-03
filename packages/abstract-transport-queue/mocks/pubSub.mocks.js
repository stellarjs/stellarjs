import _ from 'lodash';
import Promise from 'bluebird';

export default class PubSubMock {
  constructor() {
    this.subscribers = {};
  }

  _deregisterSubscriber(channel, queueName) {
    if (_.isNil(this.subscribers[channel])) {
      this.subscribers[channel] = new Set();
    }
    return Promise.resolve(this.subscribers[channel].delete(queueName));
  }

  registerSubscriberMock(channel, queueName) {
    if (_.isNil(this.subscribers[channel])) {
      this.subscribers[channel] = [];
    }

    this.subscribers[channel].push(queueName);

    return Promise.resolve().then(() => () => _deregisterSubscriber(channel, queueName));
  }

  getSubscribersMock(channel) {
    if (_.isNil(this.subscribers[channel])) {
      this.subscribers[channel] = [];
    }

    return Promise.resolve(this.subscribers[channel]);
  }
}


