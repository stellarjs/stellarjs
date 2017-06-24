/**
 * Created by arolave on 25/09/2016.
 */
import assign from 'lodash/assign';
import defaults from 'lodash/defaults';
import get from 'lodash/get';
import includes from 'lodash/includes';
import lowerCase from 'lodash/lowerCase';

import Promise from 'bluebird';

import { StellarError } from './StellarError';
import StellarCore from './StellarCore';
import StellarPubSub from './StellarPubSub';

export default class StellarRequest extends StellarCore {
  constructor(transport, source, log, requestTimeout, pubsub) {
    super(transport, source, log);
    this.requestTimeout = requestTimeout;
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
      this.startResponseHandler();  // TODO if transport supports responses
    }
  }

  startResponseHandler() {
    this.responseInbox = StellarCore.getNodeInbox(this.source);
    this._process(this.responseInbox, (job) => {
      this.log.info(`@StellarRequest: response received for ${get(job, 'data.headers.requestId')}`);
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

  _doQueueRequest(queueName, body = {}, headers = {}, options = {}) {
    const inbox = StellarCore.getServiceInbox(queueName);
    const allMiddlewares = [].concat(this.handlerChain, {
      fn: request => this._enqueue(inbox, request)
        // TODO need to response handling to after _executeMiddlewares
          .then(job => new Promise((resolve, reject) => {
            let requestTimer;
            if (this.requestTimeout && !options.requestOnly) {
              requestTimer = setTimeout(() => {
                if (!this.inflightRequests[headers.id]) {
                  this.log.error(`@StellarRequest ${headers.id}: timeout for missing inflightRequest ${this.requestTimeout}ms`);
                  return;
                }

                this.log.warn(`@StellarRequest ${headers.id}: timeout after ${this.requestTimeout}ms`);
                delete this.inflightRequests[headers.id];
                const error = new StellarError(`Timeout error: No response to job ${headers.id} in ${this.requestTimeout}ms`);
                this._prepareResponse(job.data, error).then(response => reject([error, response]));
              }, this.requestTimeout);
            }

            this.inflightRequests[headers.id] = (responseJob) => {
              if (requestTimer) {
                clearTimeout(requestTimer);
              }

              delete this.inflightRequests[headers.id];

              const responseData = responseJob.data;
              if (get(responseData, 'headers.errorType') === 'StellarError') {
                reject([new StellarError(responseData.body), responseData]);
              } else if (get(responseData, 'headers.errorType')) {
                reject([new Error(get(responseData, 'body.message')), responseData]);
              } else {
                resolve(responseData);
              }
            };
          })),
    });

    return this.sourceSemaphore
      .then(() => this.getNextId(inbox))
      .then(id => assign(headers, { respondTo: this.responseInbox, id, queueName }))
      .then(() => this._executeMiddlewares(allMiddlewares, { headers, body }, options))
      .then(jobData => (includes(['raw', 'jobData'], options.responseType) ? jobData : jobData.body))
      .catch((e) => {
        if (!Array.isArray(e)) { // array is the expected format
          this.log.error(e, `@StellarRequest: Unexpected error`);
          throw e;
        } else if (options.responseType === 'raw') {
          return e[1];
        } else {
          throw e[0];
        }
      });
  }
}

StellarRequest.METHODS = ['GET', 'CREATE', 'UPDATE', 'REMOVE', 'SUBSCRIBE'];
