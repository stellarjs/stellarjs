import ITransport from '@stellarjs/transport-interface';
import PubSub from './pubSub';

export default class QueueTransport extends ITransport {
  constructor(log) {
    super(log);
    this.messageHandlers = {};
    this.isProcessingSubscriptions = false;
    this.pubSub = new PubSub(log, this.generateId, this.enqueue, this.process, this.getSubscribers, this.registerSubscriber);
  }

  supportedFeatures() { // eslint-disable-line class-methods-use-this
    return {
      publish: true,
      subscribe: false,
      subscribeGroup: true,
      request: true,
      fireAndForget: true,
      addHandler: true,
    };
  }

  publish(stellarId, channel, payload) {
    return this.pubSub.publish(stellarId, channel, payload);
  }

  subscribe(channel, messageHandler) { // eslint-disable-line class-methods-use-this
    super.subscribe(channel, messageHandler);
  }

  subscribeGroup(groupID, channel, messageHandler) {
    return this.pubSub.subscribeGroup(groupID, channel, messageHandler);
  }

  request(url, payload, requestTimeout) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"request" was called but was not implemented!');
  }

  fireAndForget(url, payload) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"fireAndForget" was called but was not implemented!');
  }

  addHandler(url, handler) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"addHandler" was called but was not implemented!');
  }

  generateId(queueName) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"generateId" was called but was not implemented!');
  }

  enqueue(channel, payload, queueMessageId) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"enqueue" was called but was not implemented!');
  }

  process(queueName, callback) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"queueName" was called but was not implemented!');
  }

  getSubscribers(channel) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"getSubscribers" was called but was not implemented!');
  }

  registerSubscriber(channel, queueName) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"registerSubscriber" was called but was not implemented!');
  }
}
