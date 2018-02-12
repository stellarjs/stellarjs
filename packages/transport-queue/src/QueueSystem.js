export default class QueueSystem {
  constructor(log) {
    this.log = log;
  }

  enqueue(name, payload) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"enqueue" was called but was not implemented!');
  }

  process(name, callback) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"process" was called but was not implemented!');
  }

  stopProcessing(name) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"stopProcessing" was called but was not implemented!');
  }

  getSubscribers(name) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"getSubscribers" was called but was not implemented!');
  }

  registerSubscriber(channel, name) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"registerSubscriber" was called but was not implemented!');
  }
}
