/**
 * Created by arolave on 25/09/2016.
 */
import assign from 'lodash/assign';
import defaults from 'lodash/defaults';
import get from 'lodash/get';
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
                                    defaults({ responseType: 'jobData' }, options)),
    };
  }

  request(url, method, body, options = {}) {
    return this._doQueueRequest(`${url}:${lowerCase(method)}`,
                                body,
                                assign({ type: 'request' }, this._getHeaders(options)),
                                options);
  }

  _doQueueRequest(queueName, body = {}, headers = {}, options = {}) {
    const allMiddlewares = [].concat(this.handlerChain, {
      fn: (request, next, opts) => {
        const inbox = StellarCore.getServiceInbox(queueName);
        return this._enqueue(inbox, request)
        // TODO need to response handling to after _executeMiddlewares
          .then(job => new Promise((resolve, reject) => {
            const requestId = `${StellarCore.getServiceInbox(queueName)}:${job.jobId}`;
            let requestTimer;
            if (this.requestTimeout && !options.requestOnly) {
              requestTimer = setTimeout(() => {
                if (!this.inflightRequests[requestId]) {
                  return;
                }

                reject(
                  new StellarError(
                    `Timeout error: No response to job ${requestId} in ${this.requestTimeout}ms`)
                );
              }, this.requestTimeout);
            }

            this.inflightRequests[requestId] = (responseJob) => {
              if (requestTimer) {
                clearTimeout(requestTimer);
              }

              delete this.inflightRequests[requestId];
              if (opts.responseType === 'jobData') {
                resolve(responseJob.data);
              } else if (get(responseJob, 'data.headers.errorType') === 'StellarError') {
                reject(new StellarError(responseJob.data.body));
              } else if (get(responseJob, 'data.headers.errorType')) {
                reject(new Error(responseJob.data.body.message));
              } else {
                resolve(responseJob.data.body);
              }
            };
          }));
      },
    });

    return this.sourceSemaphore
      .then(() => this._executeMiddlewares(
        allMiddlewares,
        { headers: assign(headers, { respondTo: this.responseInbox, queueName }), body }, options)
      );
  }
}

StellarRequest.METHODS = ['GET', 'CREATE', 'UPDATE', 'REMOVE', 'SUBSCRIBE'];
