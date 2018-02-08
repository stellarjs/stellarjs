import Promise from 'bluebird';

import defaultsDeep from 'lodash/defaultsDeep';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';
import set from 'lodash/set';
import unset from 'lodash/unset';

import uuid from 'uuid/v1';

import { MessagingAdaptor, StellarError } from '@stellarjs/core';

import getServiceInbox from './utils/getServiceInbox';

function stopRequestTimer(requestTimer) {
  if (requestTimer) {
    clearTimeout(requestTimer);
  }
}

export default class QueueMessagingAdaptor extends MessagingAdaptor {
  constructor(transport, source, log, requestTimeout) {
    super(log);
    this.transport = transport;

    // Subscription Stuff
    this.nodeSubscriptionInbox = `stlr:n:${source}:subscriptionInbox`;
    this.inboxes = {};
    this.subscriberRegistry = {};

    // Request (Client) stuff
    this.nodeResponseInbox = `stlr:n:${source}:responseInbox`;
    this.defaultRequestTimeout = requestTimeout;
    this.inflightRequests = {};

    // Request Handling (Server) Stuff
    this.requestHandlerRegistry = {};
  }

  request({ headers = {}, body }, requestTimeout = headers.requestTimeout || this.defaultRequestTimeout) {
    return this
      ._enqueueRequest({ headers: defaultsDeep({ respondTo: this.nodeResponseInbox }, headers), body })
      .then(() => new Promise((resolve, reject) => {
        const requestTimer = this._startRequestTimer(headers, requestTimeout);
        this.inflightRequests[headers.id] = [resolve, reject, requestTimer]; // eslint-disable-line better-mutation/no-mutation
      }));
  }

  fireAndForget(req) {
    return this._enqueueRequest(req);
  }

  addRequestHandler(url, requestHandler) {
    const inbox = getServiceInbox(url);
    const fullUri = `${inbox}.${url}`;
    if (get(this.requestHandlerRegistry, fullUri)) {
      throw new Error(`Cannot addRequestHandler more that once per url. "${fullUri}" has already added`);
    }

    set(this.requestHandlerRegistry, fullUri, requestHandler);
    this._processInbox(inbox, ({ data }) => this._requestHandler(inbox, data));
    return Promise.resolve(true);
  }

  generateId() { // eslint-disable-line class-methods-use-this
    return uuid();
  }

  publish(channel, payload) {
    return this.transport // eslint-disable-line lodash/prefer-lodash-method
      .getSubscribers(channel)
      .map(queueName => this.transport.enqueue(queueName, payload));
  }

  subscribe(channel, messageHandler) {
    return this._subscribe(this.nodeSubscriptionInbox, channel, messageHandler);
  }

  subscribeGroup(groupId, channel, messageHandler) {
    const groupInbox = `stlr:s:${groupId}:subscriptionInbox`;
    const fullUri = `${groupInbox}.${channel}`;
    if (get(this.subscriberRegistry, fullUri)) {
      throw new Error(`Cannot subscribe more that once per url. "${fullUri}" is already subscribed to`);
    }
    return this._subscribe(groupInbox, channel, messageHandler);
  }

  reset() {
    return Promise
      .all(map(this.inboxes, (v, inbox) => this.transport.stopProcessing(inbox)))
      .then((res) => {
        this.inboxes = {};
        this.subscriberRegistry = {};
        this.inflightRequests = {};
        this.requestHandlerRegistry = {};
        return res;
      });
  }

  _enqueueRequest(req) {
    this._processInbox(this.nodeResponseInbox, ({ data }) => this._responseHandler(data));

    const headers = get(req, 'headers', {});
    const inbox = getServiceInbox(headers.queueName);
    return this.transport.enqueue(inbox, req);
  }

  _subscribe(inbox, channel, messageHandler) {
    const subscriptionId = uuid();

    const fullUri = `${inbox}.${channel}.${subscriptionId}`;
    set(this.subscriberRegistry, fullUri, messageHandler);

    this._processInbox(inbox, ({ data }) => this._subscriptionHandler(inbox, data));
    return this.transport.registerSubscriber(channel, inbox)
      .then(deregisterSubscriber => () => {
        unset(this.subscriberRegistry, fullUri);
        if (isEmpty(this.subscriberRegistry[channel])) {
          return deregisterSubscriber();
        }
        return Promise.resolve(true);
      });
  }

  _handleRequestTimeout(headers, requestTimeout) {
    if (!this.inflightRequests[headers.id]) {
      const context = { id: headers.id };
      const message = `@QueueMessagingAdaptor: timeout for missing inflightRequest ${requestTimeout}ms`;
      this.log.error(message, context);
      throw new Error(`${message} ${JSON.stringify(context)}`);
    }

    const reject = this.inflightRequests[headers.id][1];
    delete this.inflightRequests[headers.id];
    this.log.warn(`@QueueMessagingAdaptor: timeout after ${requestTimeout}ms`, { id: headers.id });
    reject(new StellarError(`Timeout error: No response to job ${headers.id} in ${requestTimeout}ms`));
  }

  _startRequestTimer(headers, requestTimeout) {
    if (!requestTimeout) {
      return undefined;
    }

    return setTimeout(() => this._handleRequestTimeout(headers, requestTimeout), requestTimeout);
  }

  _responseHandler({ headers, body }) {
    const id = headers.requestId;
    const inflightVars = this.inflightRequests[id];
    if (!inflightVars) {
      return;
    }

    delete this.inflightRequests[id];
    stopRequestTimer(inflightVars[2]);
    inflightVars[0]({ headers, body });
  }

  _subscriptionHandler(inbox, { headers, body }) {
    const handlers = this.subscriberRegistry[inbox][headers.channel];
    return map(handlers, handler => handler({ headers, body }));
  }

  _requestHandler(inbox, { headers, body }) {
    const me = this;
    function sendResponse(response) {
      if (!headers.respondTo) {
        return Promise.resolve(true);
      }

      return me.transport.enqueue(headers.respondTo, response);
    }

    const requestHandler = this.requestHandlerRegistry[inbox][headers.queueName];
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
    this.transport.process(inbox, internalHandler);
    return inbox;
  }
}
