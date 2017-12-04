/**
 * Created by arolave on 25/09/2016.
 */
import assign from 'lodash/assign';
import merge from 'lodash/merge';
import get from 'lodash/get';
import head from 'lodash/head';
import includes from 'lodash/includes';
import pick from 'lodash/pick';
import Promise from 'bluebird';

class StellarCore {
  constructor(transport, source, log) {
    this.handlerChain = [];
    this.configure(transport);
    this.log = log;
    this.sourceSemaphore = new Promise((resolve) => {
      this.sourceResolver = resolve;
      return resolve;
    });
    this.setSource(source);
  }

  setSource(source) {
    if (!source) {
      return;
    }

    this.source = source;
    this.sourceResolver(source);
    this.log.info(`@StellarCore.setSource`, { source });
  }

  static getServiceName(queueName) {
    return head(queueName.split(':')); // eslint-disable-line lodash/prefer-lodash-method
  }

  static getServiceInbox(queueName) {
    return `stlr:s:${this.getServiceName(queueName)}:inbox`;
  }

  static getNodeInbox(nodeName) {
    return `stlr:n:${nodeName}:inbox`;
  }

  configure(transport) {
    this.transport = transport;
  }

  use(pattern, fn) {
    this.handlerChain = this.handlerChain.concat([{ pattern, fn }]);
  }

  getNextId(inbox) {
    return this.transport.generateId(inbox).then(id => `${inbox}:${id}`);
  }

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
  _getHeaders(options = {}) {
    return assign(
      {
        timestamp: Date.now(),
        source: this.source,
      },
      options.headers,
      { action: options.action }
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

    return this
      .getNextId(jobData.headers.respondTo)
      .then((id) => {
        const headers = assign(this._getHeaders(), {
          id,
          type: 'response',
          requestId: jobData.headers.id,
          traceId: jobData.headers.traceId,
          queueName: jobData.headers.respondTo,
        });

        return { headers, body: buildBody(headers) };
      });
  }

  _handlerResult(jobData, result) {
    if (get(result, 'headers.type') === 'response' || !includes(['request', 'reactive'], jobData.headers.type)) {
      return result;
    }
    return this._prepareResponse(jobData, result);
  }

  _handlerRejection(jobData, error) {
    if (get(error, '__stellarResponse.source') === this.source || !includes(['request', 'reactive'], jobData.headers.type)) {
      return Promise.reject(error);
    }

    return this._prepareResponse(jobData, error).then((response) => {
      merge(error, { __stellarResponse: response });
      return Promise.reject(error);
    });
  }

  _executeMiddlewares(handlers, jobData, options = {}) {
    function match(url, pattern) {
      return url.match(pattern);
    }
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
      if (handlers[i].pattern === undefined ||
        match(jobData.headers.queueName || jobData.headers.channel, handlers[i].pattern)) {
        return Promise
          .try(() => handlers[i].fn(jobData, next, options))
          .then(result => this._handlerResult(jobData, result))
          .catch(error => this._handlerRejection(jobData, error));
      }

      return next();
    };

    return runMw(0);
  }

  _enqueue(queueName, obj) {
    this.log.info(`@StellarCore.enqueue`, { queueName, obj });
    return this.transport
      .enqueue(queueName, obj)
      .catch((e) => {
        this.log.error(e, `@StellarCore.enqueue`, { queueName, obj });
        throw e;
      });
  }

  _process(inbox, callback) {
    return this.transport.process(inbox, (job) => {
      this.log.info(`@StellarCore.process`, { inbox, obj: job.data });
      return callback(job);
    });
  }

  _stopProcessing(inbox) {
    return this.transport.stopProcessing(inbox);
  }
}

export default StellarCore;
