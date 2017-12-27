/**
 * Created by ozsayag on 26/06/2017.
 */
import Promise from 'bluebird';

// standardise object to have json data spec
function standardiseObject(obj) {
  return obj;
}

class MemoryTransport {
  constructor() {
    this.queues = {};
    this.subscribers = {};
  }

  setQueue(name, callback) {
    if (!this.queues[name]) {
      this.queues[name] = { currentId: 0 };
    }

    if (callback) {
      this.queues[name].callback = callback;
    }
  }

  generateId(queueName) {
    this.setQueue(queueName);
    this.queues[queueName].currentId += 1;
    return `${queueName}:${this.queues[queueName].currentId}`;
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
    const job = { data };
    this.queues[queueName].callback(standardiseObject(job));

    return Promise.resolve(job);
  }

  process(queueName, callback) {
    this.setQueue(queueName, callback);

    return Promise.resolve();
  }

  stopProcessing(queueName) {
    delete this.queues[queueName];
    return Promise.resolve(true);
  }
}

function memoryTransportFactory() {
  return new MemoryTransport();
}

export { MemoryTransport, memoryTransportFactory };
