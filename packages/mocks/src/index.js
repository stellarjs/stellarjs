/**
 * Created by arolave on 29/05/2017.
 */
import Promise from 'bluebird';
import _ from 'lodash';

class MockTransport {
  constructor(data = {}, autoProcess = false) {
    this.queues = {};
    this.subscribers = {};
    this.jobCounter = 1;
    this.autoProcess = autoProcess;
    this.job = { data };
  }

  generateId() {
    const promise = Promise.resolve(this.jobCounter);
    this.jobCounter = this.jobCounter + 1;
    return promise;
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
      this.queues[queueName] = [{ data }];
      resolve(_.last(this.queues[queueName]));
    });
  }

  process(queueName, callback) {
    console.info(`@MockTransport.process autoProcess=${this.autoProcess} queueName=${queueName}`);
    this.callback = callback;

    if (this.autoProcess) {
      setTimeout(() => {
        this.triggerJob(this.job);
      });
    }
    return Promise.resolve();
  }

  getNextId(inbox) {
    return this.generateId(inbox).then(id => `${inbox}:${id}`);
  }

  triggerJob(job) {
    this.getNextId(`stlr:n:testservice:inbox`)
            .then((id) => {
              _.set(job, 'data.headers.id', id);
              console.info(`triggerJob ${JSON.stringify(job)}`);
              this.callback(job);
            });
  }
}

function mockTransportFactory() {
  return new MockTransport();
}

export { MockTransport, mockTransportFactory };
