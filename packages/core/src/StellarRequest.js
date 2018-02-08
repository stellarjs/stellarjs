/**
 * Created by arolave on 25/09/2016.
 */
import defaults from 'lodash/defaults';
import get from 'lodash/get';
import includes from 'lodash/includes';
import lowerCase from 'lodash/lowerCase';

import { StellarError } from './StellarError';
import StellarCore from './StellarCore';
import StellarPubSub from './StellarPubSub';

function prepErrorResponse(responseData, error) {
  error.__stellarResponse = responseData; // eslint-disable-line better-mutation/no-mutation, no-param-reassign
  return error;
}

function responseHandler(responseData) {
  if (get(responseData, 'headers.errorType') === 'StellarError') {
    const error = new StellarError(responseData.body);
    throw prepErrorResponse(responseData, error);
  } else if (get(responseData, 'headers.errorType')) {
    const error = new Error(get(responseData, 'body.message'));
    throw prepErrorResponse(responseData, error);
  } else {
    return responseData;
  }
}

export default class StellarRequest extends StellarCore {
  constructor(messagingAdaptor, source, log, pubsub) {
    super(messagingAdaptor, source, log);
    if (pubsub) {
      this.pubsub = pubsub;
    } else {
      this.pubsub = new StellarPubSub(messagingAdaptor, source, log);
    }
  }

  setSource(source) {
    super.setSource(source);
    if (this.pubsub) {
      this.pubsub.setSource(source);
    }
  }

  use(pattern, mw) {
    super.use(pattern, mw);
    this.pubsub.use(pattern, mw);
  }

  setMiddlewares() {
    const me = this;
    this.requestMiddlewares = this.handlerChain.concat(
      {
        fn(req) {
          return me.messagingAdaptor
            .request(req)
            .catch(error => me._prepareResponse(req, error))
            .then(res => responseHandler(res));
        },
      });

    this.fireAndForgetMiddlewares = this.handlerChain.concat(
      {
        fn(request) {
          return me.messagingAdaptor.fireAndForget(request);
        },
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
    const headers = this._getHeaders(options.headers, { queueName, type, channel });

    if (options.requestOnly) {
      return this._executeMiddlewares(this.fireAndForgetMiddlewares)({ headers, body }, options);
    }

    return this._executeMiddlewares(this.requestMiddlewares)({ headers, body }, options)
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
