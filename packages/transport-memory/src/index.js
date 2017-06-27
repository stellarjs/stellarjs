/**
 * Created by ozsayag on 26/06/2017.
 */
import Promise from 'bluebird';

class MemoryTransport {
  constructor() {
    this.queues = {};
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

    return Promise.resolve(this.queues[queueName].currentId++); //eslint-disable-line
  }

  enqueue(queueName, data) {
    const job = { data };
    setTimeout(() => {
      this.queues[queueName].callback(job);
    });

    return Promise.resolve(job);
  }

  process(queueName, callback) {
    this.setQueue(queueName, callback);

    return Promise.resolve();
  }
}

function memoryTransportFactory() {
  return new MemoryTransport();
}

export { MemoryTransport, memoryTransportFactory };
