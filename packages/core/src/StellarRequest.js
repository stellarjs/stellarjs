/**
 * Created by arolave on 25/09/2016.
 */
import assign from 'lodash/assign';
import defaultsDeep from 'lodash/defaultsDeep';
import defaults from 'lodash/defaults';
import get from 'lodash/get';
import includes from 'lodash/includes';
import keys from 'lodash/keys';
import lowerCase from 'lodash/lowerCase';

import Promise from 'bluebird';

import { StellarError } from './StellarError';
import StellarCore from './StellarCore';
import StellarPubSub from './StellarPubSub';

export default class StellarRequest extends StellarCore {
  constructor(transport, source, log, requestTimeout, pubsub) {
    super(transport, source, log);
    this.requestTimeout = 2000; //requestTimeout;
    this.inflightRequests = {};
    if (pubsub) {
      this.pubsub = pubsub;
    } else {
      this.pubsub = new StellarPubSub(transport, source, log);
    }
  }

  setSource(source) {
    super.setSource(source);
    if (this.pubsub) {
      this.pubsub.setSource(source);
    }

    if (source) {
      this.startResponseHandler();  // TODO if transrt supports responses
    }
  }

  startResponseHandler() {
    this.responseInbox = StellarCore.getNodeInbox(this.source);
    this._process(this.responseInbox, (job) => {
      if (!this.inflightRequests[job.data.headers.requestId]) {
        throw new Error(
          `@StellarRequest ${job.data.headers.requestId} inflightRequest entry not found! Only ${
            keys(this.inflightRequests)} exist`);
      }
      this.inflightRequests[job.data.headers.requestId](job);
    }).catch((e) => {
      throw e;
    });
  }

  get(url, body, options) {
    return this.request(url, 'GET', body, options);
  }

  create(url, body, options) {
    return this.request(url, 'CREATE', body, options);
  }

  update(url, body, options) {
    return this.request(url, 'UPDATE', body, options);
  }

  remove(url, id, options) {
    return this.request(url, 'REMOVE', id, options);
  }

  getReactive(url, channel, body, reactiveHandler, options = {}) {
    return {
      results: this._doQueueRequest(`${url}:subscribe`,
                                    body,
                                    assign({ type: 'reactive', channel }, this._getHeaders(options)),
                                    options),
      onStop: this.pubsub.subscribe(channel,
                                    (command, ch) => reactiveHandler(command.body,
                                                                     get(command, 'headers.action'),
                                                                     ch),
                                    defaults({ responseType: 'raw' }, options)),
    };
  }

  request(url, method, body, options = {}) {
    return this._doQueueRequest(`${url}:${lowerCase(method)}`,
                                body,
                                assign({ type: 'request' }, this._getHeaders(options)),
                                options);
  }

  _doQueueRequest(queueName, body = {}, requestHeaders = {}, options = {}) {
    function prepErrorResponse(responseData, error) {
      error.__stellarResponse = responseData; // eslint-disable-line better-mutation/no-mutation, no-param-reassign
      return error;
    }

    const startRequestTimer = (headers, jobData, reject) => {
      const handleRequestTimeout = () => {
        if (!this.inflightRequests[headers.id]) {
          const context = { id: headers.id };
          const message = `@StellarRequest: timeout for missing inflightRequest ${this.requestTimeout}ms`;
          this.log.error(message, context);
          return Promise.reject(`${message} ${JSON.stringify(context)}`);
        }

        this.log.warn(`@StellarRequest: timeout after ${this.requestTimeout}ms`, { id: headers.id });
        delete this.inflightRequests[headers.id];
        const error = new StellarError(`Timeout error: No response to job ${headers.id} in ${this.requestTimeout}ms`);
        return this._prepareResponse(jobData, error)
            .then(responseData => reject(prepErrorResponse(responseData, error)));
      };

      const timeout = options.requestTimeout || this.requestTimeout;
      if (this.requestTimeout && !options.requestOnly) {
        return setTimeout(() => handleRequestTimeout(headers, jobData, reject), timeout);
      }

      return undefined;
    };

    const stopRequestTimer = (requestTimer) => {
      if (requestTimer) {
        clearTimeout(requestTimer);
      }
    };

    const inbox = StellarCore.getServiceInbox(queueName);
    const allMiddlewares = [].concat(this.handlerChain, {
      fn: request => this._enqueue(inbox, request)
        // TODO need to response handling to after _executeMiddlewares
          .then(job => new Promise((resolve, reject) => {
            const headers = request.headers;
            const requestTimer = startRequestTimer(headers, job.data, reject);
            this.inflightRequests[headers.id] = (responseJob) => {
              stopRequestTimer(requestTimer);

              delete this.inflightRequests[headers.id];

              const responseData = responseJob.data;
              if (get(responseData, 'headers.errorType') === 'StellarError') {
                const error = new StellarError(responseData.body);
                reject(prepErrorResponse(responseData, error));
              } else if (get(responseData, 'headers.errorType')) {
                const error = new Error(get(responseData, 'body.message'));
                reject(prepErrorResponse(responseData, error));
              } else {
                resolve(responseData);
              }
            };
          })),
    });

    return this.sourceSemaphore
      .then(() => this.getNextId(inbox))
      .then(id => defaultsDeep({ respondTo: this.responseInbox, id, queueName }, requestHeaders, { traceId: id, requestTimeout: options.requestTimeout }))
      .then(headers => {
        debugger
        return this._executeMiddlewares(allMiddlewares, { headers, body }, options)
      })
      .then(jobData => (includes(['raw', 'jobData'], options.responseType) ? jobData : jobData.body))
      .catch((e) => {
        if (e.__stellarResponse == null) {
          this.log.error(e, `@StellarRequest: Unexpected error`);
        } else if (options.responseType === 'raw') {
          return e.__stellarResponse;
        }

        throw e;
      });
  }
}

StellarRequest.METHODS = ['GET', 'CREATE', 'UPDATE', 'REMOVE', 'SUBSCRIBE'];
