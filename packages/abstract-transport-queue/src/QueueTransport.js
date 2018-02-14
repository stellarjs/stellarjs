import { RemoteTransport } from '@stellarjs/abstract-transport';

import Promise from 'bluebird';

import defaultsDeep from 'lodash/defaultsDeep';
import get from 'lodash/get';
import map from 'lodash/map';

import getServiceInbox from './utils/getServiceInbox';

export default class QueueTransport extends RemoteTransport {
  constructor(queueSystem, source, log, requestTimeout) {
    super(log, requestTimeout);
    this.queueSystem = queueSystem;

    // Subscription Stuff
    this.nodeSubscriptionInbox = `stlr:n:${source}:subscriptionInbox`;
    this.inboxes = {};

    // Request (Client) stuff
    this.nodeResponseInbox = `stlr:n:${source}:responseInbox`;
  }

  request({ headers = {}, body }, requestTimeout) {
    return super.request({ headers: defaultsDeep({ respondTo: this.nodeResponseInbox }, headers), body }, requestTimeout);
  }

  addRequestHandler(url, requestHandler) {
    this.registerRequestHandler(url, requestHandler);
    const inbox = getServiceInbox(url);
    this._processInbox(inbox, ({ data }) => this._requestHandler(data));
    return Promise.resolve(true);
  }

  publish(channel, payload) {
    return this.queueSystem // eslint-disable-line lodash/prefer-lodash-method
      .getSubscribers(channel)
      .map(queueName => this.queueSystem.enqueue(queueName, payload));
  }

  subscribe(channel, messageHandler) {
    const removeHandlerFn = this.registerSubscriberHandler(channel, messageHandler);
    return this._subscribe(this.nodeSubscriptionInbox, channel, removeHandlerFn);
  }

  subscribeGroup(groupId, channel, messageHandler) {
    const removeHandlerFn = this.registerSubscriberGroupHandler(groupId, channel, messageHandler);
    const groupInbox = `stlr:s:${groupId}:subscriptionInbox`;
    return this._subscribe(groupInbox, channel, removeHandlerFn, groupId);
  }

  reset() {
    return Promise
      .all(map(this.inboxes, (v, inbox) => this.queueSystem.stopProcessing(inbox)))
      .then(() => {
        this.inboxes = {};
        return super.reset();
      });
  }

  remoteRequest(req) {
    this._processInbox(this.nodeResponseInbox, ({ data }) => this._responseHandler(data));

    const headers = get(req, 'headers', {});
    const inbox = getServiceInbox(headers.queueName);
    return this.queueSystem.enqueue(inbox, req);
  }

  _subscribe(inbox, channel, removeHandlerFn, groupId) {
    this._processInbox(inbox, ({ data }) => this._subscriptionHandler(data, groupId));
    return this.queueSystem.registerSubscriber(channel, inbox)
      .then(deregisterSubscriber => () => {
        const registryIsEmpty = removeHandlerFn();
        if (registryIsEmpty) {
          return deregisterSubscriber();
        }
        return Promise.resolve(true);
      });
  }

  _subscriptionHandler({ headers, body }, subscriptionId) {
    const handlers = this.registries.subscribers[headers.channel];
    if (subscriptionId) {
      return handlers[subscriptionId]({ headers, body });
    }
    return map(handlers, handler => handler({ headers, body }));
  }

  _requestHandler({ headers, body }) {
    const me = this;
    function sendResponse(response) {
      if (!headers.respondTo) {
        return Promise.resolve(true);
      }

      return me.queueSystem.enqueue(headers.respondTo, response);
    }

    const requestHandler = this.registries.requestHandlers[headers.queueName];
    return requestHandler({ headers, body })
      .then(sendResponse)
      .catch(err => sendResponse(err.__stellarResponse));
  }

  _processInbox(inbox, internalHandler) {
    if (this.inboxes[inbox]) {
      return inbox;
    }

    this.inboxes[inbox] = true;
    this.log.info(`@QueueMessagingAdaptor: Processing started`, { inbox });
    this.queueSystem.process(inbox, internalHandler);
    return inbox;
  }
}
