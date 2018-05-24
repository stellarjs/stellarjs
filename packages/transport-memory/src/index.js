/**
 * Created by ozsayag on 26/06/2017.
 */
import uuid from 'uuid/v1';
import values from 'lodash/values';
import isFunction from 'lodash/isFunction';

import { standardizeObjectFactory } from '@stellarjs/core';
import { Transport } from '@stellarjs/abstract-transport';
import { EventEmitter } from 'events';

class MemoryTransport extends Transport {
  constructor(source, log, stringifyDates = false) {
    super(source, log);
    this.subscriptionHandler = new EventEmitter();
    this.standardizeObject = standardizeObjectFactory({ stringifyDates });
  }

  generateId() { // eslint-disable-line class-methods-use-this
    return uuid();
  }

  publish(channel, payload) { // eslint-disable-line class-methods-use-this, no-unused-vars
    this.subscriptionHandler.emit(channel, this.standardizeObject(payload));
  }

  subscribe(channel, messageHandler) {
    const deregisterFn = this.registerSubscriberHandler(channel, messageHandler);
    return this._subscribe(channel, messageHandler, deregisterFn);
  }

  subscribeGroup(groupId, channel, messageHandler) {
    const deregisterFn = this.registerSubscriberGroupHandler(groupId, channel, messageHandler);
    return this._subscribe(channel, messageHandler, deregisterFn);
  }

  request(req) {
    const localHandler = this.getLocalHandler(req);
    try {
      const res = localHandler(this.standardizeObject(req));
      if (isFunction(res.then)) {
        return res.then(this.standardizeObject.bind(this));
      }
      return this.standardizeObject(res);
    } catch (e) {
      return e.__stellarResponse ? this.standardizeObject(e.__stellarResponse) : e;
    }
  }

  fireAndForget(req) { // eslint-disable-line class-methods-use-this, no-unused-vars
    const localHandler = this.getLocalHandler(req);
    try {
      localHandler(this.standardizeObject(req));
    } catch (e) {
      this.log.warn(`fireAndForget failed`, req);
    }
  }

  addRequestHandler(url, handler) {
    this.registerRequestHandler(url, handler);
  }

  _subscribe(channel, messageHandler, deregisterFn) {
    this.subscriptionHandler.on(channel, messageHandler);
    return () => {
      deregisterFn();
      this.subscriptionHandler.removeListener(channel, messageHandler);
    };
  }

  getSubscribers(channel) {
    const subscribers = this.registries.subscribers[channel];
    return values(subscribers);
  }

  reset() {
    this.subscriptionHandler.removeAllListeners();
    super.reset();
  }
}

let instance;
function memoryTransportFactory({ source, log, stringifyDates }) {
  if (!instance) {
    instance = new MemoryTransport(source, log, stringifyDates); // eslint-disable-line better-mutation/no-mutation
  }

  return instance;
}

export { MemoryTransport, memoryTransportFactory as default };
