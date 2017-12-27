/**
 * Created by arolave on 29/05/2017.
 */
import Promise from 'bluebird';
import _ from 'lodash';
import StellarCore from '../src/StellarCore';

class MockTransport {
  constructor(data = {}, { autoProcess = false, inMemory = false } = {}) {
    this.queues = {};
    this.subscribers = {};
    this.jobCounter = 1;
    this.autoProcess = autoProcess;
    this.inMemory = inMemory;
    this.job = { data };
    this.callbacks = {};
  }

  generateId(inbox) {
    const count = this.jobCounter++;
    return `${inbox}:${count}`;
  }

  getSubscribers(channel) {
    if (this.subscribers[channel] == null) {
      this.subscribers[channel] = new Set();
    }

    return Promise.resolve(this.subscribers[channel].values());
  }
  registerSubscriber(channel, queueName) {
    if (this.subscribers[channel] == null) {
      this.subscribers[channel] = new Set();
    }

    return Promise.resolve(this.subscribers[channel].add(queueName))
      .then(() => () => this._deregisterSubscriber(channel, queueName));
  }

  _deregisterSubscriber(channel, queueName) {
    if (this.subscribers[channel] == null) {
      this.subscribers[channel] = new Set();
    }
    return Promise.resolve(this.subscribers[channel].delete(queueName));
  }

  enqueue(queueName, data) {
    console.info(`@MockTransport.enqueue queueName=${queueName} callback ${JSON.stringify(data)}`);
    return new Promise((resolve) => {
      if (!this.queues[queueName]) {
        this.queues[queueName] = [];
      }
      this.queues[queueName].push({ data });
      
      if (this.inMemory) {
        console.info(queueName);
        console.info(_.keys(this.callbacks));
        this.callbacks[queueName]({ data });
      }
      resolve(_.last(this.queues[queueName]));
    });
  }

  process(queueName, callback) {
    console.info(`@MockTransport.process autoProcess=${this.autoProcess} queueName=${queueName}`);
    this.callbacks[queueName] = callback;

    if (this.autoProcess) {
      setTimeout(() => {
        this.triggerJob(this.job)
      });
    }
    return new Promise.resolve();
  }

  stopProcessing(queueName) {
    delete this.callbacks[queueName];
    return Promise.resolve(true);
  }

  getNextId(inbox) {
    return this.generateId(inbox);
  }

  triggerJob(job) {
    const id = this.getNextId(StellarCore.getNodeInbox('testservice'));
    _.set(job, 'data.headers.id', id);
    console.info(`triggerJob ${JSON.stringify(job)}`);
    _(this.callbacks).values().first()(job);
  }
}

function mockTransportFactory(options = {}) {
  return new MockTransport(options);
}

export { MockTransport, mockTransportFactory };
