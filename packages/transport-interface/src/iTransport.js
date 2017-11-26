export default class ITransport {
  constructor(log) {
    this.log = log;
  }

  supportedFeatures() { // eslint-disable-line class-methods-use-this
    return {
      publish: false,
      subscribe: false,
      subscribeGroup: false,
      request: false,
      fireAndForget: false,
      addHandler: false,
    };
  }

  publish(channel, payload) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"publish" was called but was not implemented!');
  }

  subscribe(channel, messageHandler) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"subscribe" was called but was not implemented!');
  }

  subscribeGroup(groupID, channel, messageHandler) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('"subscribeGroup" was called but was not implemented!');
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
}
