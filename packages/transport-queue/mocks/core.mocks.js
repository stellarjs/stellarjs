import _ from 'lodash';
import Promise from 'bluebird';

export default class CoreMock {
  constructor(){
    this.callbacks = {};
  }

  generateIdMock(queueName) {
    return Promise.resolve(1);
  }

  enqueueMock(queueName, payload, queueMessageId) {
    if (_.isNil(queueName)) {
      return Promise.reject(queueMessageId);
    }

    if (this.callbacks[queueName]) {
      this.callbacks[queueName](payload);
    }

    return Promise.resolve(queueMessageId);
  }

  processMock(queueName, callback) {
    this.callbacks[queueName] = callback;
    return Promise.resolve();
  }

  stopProcessingMock(queueName) {
    delete this.callbacks[queueName];
    return Promise.resolve(true);
  }

  triggerProcess(queueName) {
    if (!_.isNil(this.callbacks[queueName])) {
      this.callbacks[queueName](queueName);
    }
  }
}