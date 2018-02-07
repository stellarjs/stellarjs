import head from 'lodash/head';

export default class MessagingAdaptor {
  constructor(log) {
    this.log = log;
  }

  publish(channel, payload) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"publish" was called but was not implemented!');
  }

  subscribe(channel, messageHandler) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"subscribe" was called but was not implemented!');
  }

  subscribeGroup(groupId, channel, messageHandler) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"subscribeGroup" was called but was not implemented!');
  }

  request(req, requestTimeout) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"request" was called but was not implemented!');
  }

  fireAndForget(req) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"fireAndForget" was called but was not implemented!');
  }

  addRequestHandler(url, handler) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"addHandler" was called but was not implemented!');
  }

  generateId() { // eslint-disable-line class-methods-use-this
    throw new Error('"generateId" was called but was not implemented!');
  }

  reset() { // eslint-disable-line class-methods-use-this
    throw new Error('"reset" was called but was not implemented!');
  }
}
