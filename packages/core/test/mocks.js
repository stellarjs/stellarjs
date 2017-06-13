/**
 * Created by arolave on 29/05/2017.
 */
import Promise from 'bluebird';
import _ from 'lodash';

export function createMockTransport(autoProcess) {
  return {
    queues: {},
    subscribers: {},
    jobCounter: 1,
    processData: {},

    reset(data) {
      this.job = { data };
      this.queues = {};
      this.subscribers = {};
      this.jobCounter = 1;
    },

    generateId(queueName) {
      return Promise.resolve(this.jobCounter++);
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
      console.info(`@MockTransport.enqueue queueName=${queueName} callback ${JSON.stringify(data)}`);
      return new Promise((resolve) => {
        this.queues[queueName] = [{ data, jobId: parseInt(_.last(data.headers.id.split(':'))), queue: { name: queueName } }];
        resolve(_.last(this.queues[queueName]));
      });
    },

    process(queueName, callback) {
      console.info(`@MockTransport.process autoProcess=${autoProcess} queueName=${queueName}`);
      this.callback = callback;

      if (autoProcess) {
        setTimeout(() => {
          this.triggerJob(this.job)
        });
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
