/**
 * Created by arolave on 29/05/2017.
 */
import Promise from 'bluebird';
import _ from 'lodash';

export function createMockTransport(autoProcess) {
  return {
    queues: {},
    subscribers: {},
    jobCounters: 1,
    processData: {},

    reset(data) {
      this.job = { jobId: this.jobCounter++, data };
      this.queues = {};
      this.subscribers = {};
      this.jobCounter = 1;
    },

    getSubscribers(channel) {
      if (this.subscribers[channel] == null) {
        this.subscribers[channel] = new Set();
      }

      return Promise.resolve(this.subscribers[channel].values());
    },
    registerSubscriber(channel, queueName) {
      if (this.subscribers[channel] == null) {
        this.subscribers[channel] = new Set();
      }

      return Promise.resolve(this.subscribers[channel].add(queueName))
        .then(() => () => this._deregisterSubscriber(channel, queueName));
    },
    
    _deregisterSubscriber(channel, queueName) {
      if (this.subscribers[channel] == null) {
        this.subscribers[channel] = new Set();
      }
      return Promise.resolve(this.subscribers[channel].delete(queueName));
    },

    enqueue(queueName, data) {
      return new Promise((resolve) => {
        this.queues[queueName] = [{ data, jobId: this.jobCounter++, queue: { name: queueName } }];
        resolve(_.last(this.queues[queueName]));
      });
    },

    process(queueName, callback) {
      this.callback = callback;

      if (autoProcess) {
        setTimeout(() => this.triggerJob(this.job));
      }
      return new Promise.resolve();
    },

    triggerJob(job) {
      this.callback(job || this.job);
    }
  };
}

export function mockTransportFactory(log) {
  return createMockTransport();
}
