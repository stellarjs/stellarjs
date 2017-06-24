/**
 * Created by arolave on 25/09/2016.
 */
import assign from 'lodash/assign';
import first from 'lodash/first';
import get from 'lodash/get';
import includes from 'lodash/includes';
import pick from 'lodash/pick';
import Promise from 'bluebird';
import stringify from 'safe-json-stringify';

class StellarCore {
  constructor(transport, source, log) {
    this.handlerChain = [];
    this.configure(transport);
    this.log = log;
    this.sourceSemaphore = new Promise(resolve => (this.sourceResolver = resolve));
    this.setSource(source);
  }

  setSource(source) {
    if (!source) {
      return;
    }

    this.source = source;
    this.sourceResolver(source);
    this.log.info(`Restarting Stellar Obj: ${source}`);
  }

  static getServiceName(queueName) {
    return first(queueName.split(':'));
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
    this.handlerChain.push({ pattern, fn });
  }

  flush() {
    if (this.transport.flush) {
      this.transport.flush();
    }
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
    return this
      .getNextId(jobData.headers.respondTo)
      .then((id) => {
        const convertError = e => pick(e, ['errors', 'message']);

        const headers = assign(this._getHeaders(), {
          id,
          type: 'response',
          requestId: jobData.headers.id,
          queueName: jobData.headers.respondTo,
        });
        let body = val;

        if (val instanceof Error) {
          assign(headers, { errorType: val.constructor.name });
          body = convertError(val);
        }

        return { headers, body };
      });
  }

  _handlerResult(jobData, result) {
    if (get(result, 'headers.type') === 'response' || !includes(['request', 'reactive'], jobData.headers.type)) {
      return result;
    }
    return this._prepareResponse(jobData, result);
  }

  _handlerRejection(jobData, error) {
    if (Array.isArray(error) || !includes(['request', 'reactive'], jobData.headers.type)) {
      return Promise.reject(error);
    }
    return this._prepareResponse(jobData, error).then(response => Promise.reject([error, response]));
  }

  _executeMiddlewares(handlers, jobData, options = {}) { // eslint-disable-line class-methods-use-this
    function match(url, pattern) {
      return url.match(pattern);
    }
    // this.log.info(`@StellarCore.executeMiddlewares: handlers ${_.size(handlers)}`);

    const runMw = (i) => {
      const next = () => runMw(i + 1);

      if (handlers.length === i) {
        this.log.error(`@StellarCore ${jobData}: Final Handler should not call next`);
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
    this.log.info(`@StellarCore.enqueue ${queueName}: ${stringify(obj)}`);
    return this.transport
      .enqueue(queueName, obj)
      .catch((e) => {
        this.log.error(e, `@StellarCore.enqueue error`);
        throw e;
      });
  }

  _process(inbox, callback) {
    return this.transport.process(inbox, (job) => {
      this.log.info(`@StellarCore.process ${job.data.headers.id}: ${stringify(job.data)}`);
      return callback(job);
    });
  }

}

export default StellarCore;
