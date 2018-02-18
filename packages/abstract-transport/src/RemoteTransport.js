import Promise from 'bluebird';

import uuid from 'uuid/v1';

import StellarError from '@stellarjs/stellar-error';

import Transport from './Transport';

function stopRequestTimer(requestTimer) {
  if (requestTimer) {
    clearTimeout(requestTimer);
  }
}

export default class RemoteTransport extends Transport {
  constructor(log, requestTimeout) {
    super(log);

    // Request Stuff
    this.defaultRequestTimeout = requestTimeout;
    this.inflightRequests = {};
  }

  generateId() { // eslint-disable-line class-methods-use-this
    return uuid();
  }

  request({ headers = {}, body }, requestTimeout = headers.requestTimeout || this.defaultRequestTimeout) {
    return this
      .remoteRequest({ headers, body })
      .then(() => new Promise((resolve, reject) => {
        const requestTimer = this._startRequestTimer(headers, requestTimeout);
        this.inflightRequests[headers.id] = [resolve, reject, requestTimer]; // eslint-disable-line better-mutation/no-mutation
      }));
  }

  fireAndForget(req) {
    return this.remoteRequest(req);
  }

  remoteRequest(req) { // eslint-disable-line class-methods-use-this, no-unused-vars
    throw new Error('remoteRequest must be implemented');
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

  reset() {
    this.inflightRequests = {};
    return super.reset();
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
}
