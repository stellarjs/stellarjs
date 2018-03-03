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
  constructor(source, log, requestTimeout) {
    super(source, log);

    // Request Stuff
    this.defaultRequestTimeout = requestTimeout;
    this.inflightRequests = {};
  }

  generateId() { // eslint-disable-line class-methods-use-this
    return uuid();
  }

  request({ headers = {}, body }, requestTimeout = headers.requestTimeout || this.defaultRequestTimeout) {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line better-mutation/no-mutation
      this.inflightRequests[headers.id] = [resolve, reject, this._startRequestTimer(headers, requestTimeout)];
      return this.remoteRequest({ headers, body });
    });
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
      const message = `@RemoteTransport: MISSING inflightRequest handler for TIMEOUT after ${requestTimeout}ms.`;
      this.log.error(message, context);
      throw new Error(`${message} ${JSON.stringify(context)}`);
    }

    const reject = this.inflightRequests[headers.id][1];
    delete this.inflightRequests[headers.id];
    const message = `@RemoteTransport: TIMEOUT after ${requestTimeout}ms`;
    this.log.warn(message, { id: headers.id });
    reject(new StellarError(`${message}. requestId=${headers.id}`));
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
      this.log.error(`@RemoteTransport: MISSING inflightRequest handler for response`, { id: headers.id });
      return;
    }

    delete this.inflightRequests[id];
    stopRequestTimer(inflightVars[2]);
    inflightVars[0]({ headers, body });
  }
}
