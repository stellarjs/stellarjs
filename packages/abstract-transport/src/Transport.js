import fromPairs from 'lodash/fromPairs';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';
import set from 'lodash/set';
import split from 'lodash/split';

import uuid from 'uuid/v1';

function unset([k, ...vs], obj) {
  const isDeleteK = isEmpty(vs) || unset(vs, obj[k]);

  if (isDeleteK) {
    delete obj[k]; // eslint-disable-line no-param-reassign
    return isEmpty(obj);
  }

  return isDeleteK;
}

export default class Transport {
  constructor(source, log) {
    this.source = source;
    this.log = log;
    this.registries = {
      requestHandlers: {},
      subscribers: {},
    };
  }

  _registerHandler(registry, url, handler) {
    if (get(this.registries[registry], url)) {
      throw new Error(`Cannot have more that once per url in registries.${registry}. "${url}" has already added`);
    }

    set(this.registries[registry], url, handler);

    return () => {
      const keys = split(url, '.');
      return unset(keys, this.registries[registry]);
    };
  }

  registerSubscriberGroupHandler(groupId, channel, handler) {
    return this._registerHandler('subscribers', `${channel}.${groupId}`, handler);
  }

  registerSubscriberHandler(channel, handler) {
    const subscriberId = uuid();
    return this._registerHandler('subscribers', `${channel}.${subscriberId}`, handler);
  }

  registerRequestHandler(url, handler) {
    return this._registerHandler('requestHandlers', url, handler);
  }

  getLocalHandler(req) {
    const url = get(req, 'headers.queueName');
    return get(this.registries.requestHandlers, url);
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

  generateId() {
      return uuid();
  }

  reset() {
    this.registries = fromPairs(
      map(this.registries, (v, k) => [k, {}])
    );
  }
}
