/**
 * Created by arolave on 25/09/2016.
 */
import defaults from 'lodash/defaults';
import get from 'lodash/get';
import includes from 'lodash/includes';
import keys from 'lodash/keys';
import lowerCase from 'lodash/lowerCase';

import Promise from 'bluebird';

import { StellarError } from './StellarError';
import StellarCore from './StellarCore';
import StellarPubSub from './StellarPubSub';

function prepErrorResponse(responseData, error) {
  error.__stellarResponse = responseData; // eslint-disable-line better-mutation/no-mutation, no-param-reassign
  return error;
}

function responseHandler(responseJob, [resolve, reject]) {
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
}

function stopRequestTimer(requestTimer) {
  if (requestTimer) {
    clearTimeout(requestTimer);
  }
}

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

  use(pattern, mw) {
    super.use(pattern, mw);
    this.pubsub.use(pattern, mw);
  }

  handleRequestTimeout(jobData, reject, requestTimeout) {
    const headers = get(jobData, 'headers', {});
    if (!this.inflightRequests[headers.id]) {
      const context = { id: headers.id };
      const message = `@StellarRequest: timeout for missing inflightRequest ${requestTimeout}ms`;
      this.log.error(message, context);
      throw new Error(`${message} ${JSON.stringify(context)}`);
    }

    this.log.warn(`@StellarRequest: timeout after ${requestTimeout}ms`, { id: headers.id });
    delete this.inflightRequests[headers.id];
    const error = new StellarError(`Timeout error: No response to job ${headers.id} in ${requestTimeout}ms`);
    const responseData = this._prepareResponse(jobData, error);
    reject(prepErrorResponse(responseData, error));
  }

  startRequestTimer(jobData, reject, options) {
    const requestTimeout = jobData.headers.requestTimeout || this.requestTimeout;
    if (requestTimeout && !options.requestOnly) {
      return setTimeout(() => this.handleRequestTimeout(jobData, reject, requestTimeout), requestTimeout);
    }

    return undefined;
  }

  setMiddlewares() {
    const me = this;
    this.allMiddlewares = this.handlerChain.concat(
      {
        fn: (request, next, options) => {
          const headers = get(request, 'headers', {});
          const inbox = StellarCore.getServiceInbox(headers.queueName);
          return me
            ._enqueue(inbox, request)
            .then(() => new Promise((resolve, reject) => {
              const requestTimer = me.startRequestTimer(request, reject, options, me.requestTimeout);
              // eslint-disable-next-line better-mutation/no-mutation
              me.inflightRequests[headers.id] = [resolve, reject, requestTimer];
            }));
        },
      });
  }

  startResponseHandler() {
    this.responseInbox = StellarCore.getNodeInbox(this.source);
    this._process(this.responseInbox, (job) => {
      const id = job.data.headers.requestId;
      const promiseFns = this.inflightRequests[id];
      if (!promiseFns) {
        throw new Error(`@StellarRequest ${id} inflightRequest entry not found! Only ${keys(this.inflightRequests)} exist`);
      }

      stopRequestTimer(promiseFns[2]);
      delete this.inflightRequests[id];

      responseHandler(job, promiseFns);
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
                                    { type: 'reactive', channel },
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
                                { type: 'request' },
                                options);
  }

  _doQueueRequest(queueName, body = {}, { type, channel }, options = {}) {
    const inbox = StellarCore.getServiceInbox(queueName);
    const id = this.getNextId(inbox);
    const headers = this._getHeaders(
      options.headers,
      { respondTo: this.responseInbox, id, queueName, type, channel },
      { traceId: id });

    return this._executeMiddlewares(this.allMiddlewares, { headers, body }, options)
      .then(jobData => (includes(['raw', 'jobData'], options.responseType) ? jobData : jobData.body))
      .catch((e) => {
        if (e.__stellarResponse != null && options.responseType === 'raw') {
          return e.__stellarResponse;
        }

        throw e;
      });
  }
}

StellarRequest.METHODS = ['GET', 'CREATE', 'UPDATE', 'REMOVE', 'SUBSCRIBE'];

export { responseHandler };
