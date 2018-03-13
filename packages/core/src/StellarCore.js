/**
 * Created by arolave on 25/09/2016.
 */
import Promise from 'bluebird';

import assign from 'lodash/assign';
import merge from 'lodash/merge';
import get from 'lodash/get';
import includes from 'lodash/includes';
import pick from 'lodash/pick';

import getUri from './utils/getUri';
import match from './utils/match';

class StellarCore {
  constructor(transport, source = transport.source, log = transport.log) {
    this.handlerChain = [];
    this.transport = transport;
    this.log = log;
    this.setSource(source);
  }

  setSource(source) {
    if (!source) {
      return;
    }

    this.source = source;
    this.setMiddlewares();
  }

  use(pattern, fn) {
    this.handlerChain = this.handlerChain.concat([{ pattern, fn }]);
    this.setMiddlewares();
  }

  setMiddlewares() {} // eslint-disable-line class-methods-use-this

  /**
   * headers: {
     *      action: action to execute at the URL
     *      channel: the channel that the message is sent on (for pub sub only)
     *      queueName: the queue name that the message is put onto
     *      requestId: the job id of the source request (for responses only)
     *      service: the source app/service
     *      source: source node
     *      timestamp: ms since UTC epoch (int)
     *      type: stellar message exchange pattern: reactive|stopReactive|request|publish
     * }
   * @param options
   * @private
   */
  _getHeaders(headers, overrides) {
    const id = this.transport.generateId();
    return assign(
      {
        timestamp: Date.now(),
        source: this.source,
        traceId: id,
      },
      headers,
      overrides,
      { id } // id must be the generated value
    );
  }

  _prepareResponse(jobData, val) {
    const buildBody = (headers) => {
      if (val instanceof Error) {
        if (!val.__stellarResponse) {
          assign(headers, { errorType: val.constructor.name, errorSource: this.source });
        }

        return pick(val, ['errors', 'message']);
      }

      return val;
    };

    const headers = this._getHeaders({
      type: 'response',
      requestId: jobData.headers.id,
      traceId: jobData.headers.traceId,
      queueName: jobData.headers.respondTo,
    });

    return { headers, body: buildBody(headers) };
  }

  _handlerResult(jobData, result) {
    if (get(result, 'headers.type') === 'response'
      || !includes(['request', 'reactive'], jobData.headers.type)// ) {
      || !jobData.headers.queueName) {
      return result;
    }
    return this._prepareResponse(jobData, result);
  }

  _handlerRejection(jobData, error) {
    if (get(error, '__stellarResponse.headers.source') === this.source
      || !includes(['request', 'reactive'], jobData.headers.type)// ) {
      || !jobData.headers.queueName) {
      throw error;
    }

    const response = this._prepareResponse(jobData, error);
    merge(error, { __stellarResponse: response });
    throw error;
  }

  _executeMiddlewares(handlers) {
    return (jobData, options = {}) => {
      // this.log.info(`@StellarCore.executeMiddlewares: handlers ${_.size(handlers)}`);

      const runMw = (i) => {
        function next() {
          return runMw(i + 1);
        }

        if (handlers.length === i) {
          this.log.error(`@StellarCore: Final Handler should not call next`, { jobData });
          return Promise.reject(new Error('Final Handler should not call next'));
        }

          // this.log.info(`@StellarCore.executeMiddlewares: run ${i}}`);
        if (match(getUri(jobData.headers), handlers[i].pattern)) {
          return Promise
                .try(() => handlers[i].fn(jobData, next, options, this.log))
                .then(result => this._handlerResult(jobData, result))
                .catch(error => this._handlerRejection(jobData, error));
        }

        return next();
      };

      return runMw(0);
    };
  }
}

export default StellarCore;
