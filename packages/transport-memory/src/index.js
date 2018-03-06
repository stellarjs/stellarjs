/**
 * Created by ozsayag on 26/06/2017.
 */
import uuid from 'uuid/v1';
import values from 'lodash/values';
import isFunction from 'lodash/isFunction';

import { Transport } from '@stellarjs/abstract-transport';
import { EventEmitter } from 'events';

class MemoryTransport extends Transport {
  constructor(source, log, standardiseDates = false) {
    super(source, log);
    this.subscriptionHandler = new EventEmitter();
    this.standardiseDates = standardiseDates;
  }

// standardise object to have json data spec
  standardiseObject(obj) {
    if (this.standardiseDates) {
      return JSON.parse(JSON.stringify(obj));
    }

    return obj;
  }

  generateId() { // eslint-disable-line class-methods-use-this
    return uuid();
  }

  publish(channel, payload) { // eslint-disable-line class-methods-use-this, no-unused-vars
    this.subscriptionHandler.emit(channel, this.standardiseObject(payload));
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
      const res = localHandler(this.standardiseObject(req));
      if (isFunction(res.then)) {
          return res.then(this.standardiseObject.bind(this));
      }
      return this.standardiseObject(res);
    } catch (e) {
      return e.__stellarResponse ? this.standardiseObject(e.__stellarResponse) : e;
    }
  }

  fireAndForget(req) { // eslint-disable-line class-methods-use-this, no-unused-vars
    const localHandler = this.getLocalHandler(req);
    try {
      localHandler(this.standardiseObject(req));
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
function memoryTransportFactory({ source, log, standardiseDates }) {
  if (!instance) {
    instance = new MemoryTransport(source, log, standardiseDates); // eslint-disable-line better-mutation/no-mutation
  }

  return instance;
}

export { MemoryTransport, memoryTransportFactory as default };
