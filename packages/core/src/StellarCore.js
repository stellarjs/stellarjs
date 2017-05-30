/**
 * Created by arolave on 25/09/2016.
 */
import assign from 'lodash/assign';
import first from 'lodash/first';
import isObject from 'lodash/isObject';

import Promise from 'bluebird';

function stringify(val, log) {
  try {
    if (!val) {
      return '';
    } else if (isObject(val)) {
      return JSON.stringify(val.data || val);
    }
    return val;
  } catch (e) {
    log.error(e);
    return '';
  }
}

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

  static getServiceInbox(queueName) {
    const serviceName = first(queueName.split(':'));
    return `stlr:s:${serviceName}:inbox`;
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

  _executeMiddlewares(handlers, jobData, options) { // eslint-disable-line class-methods-use-this
    function match(url, pattern) {
      return url.match(pattern);
    }
    // this.log.info(`@StellarCore.executeMiddlewares: handlers ${_.size(handlers)}`);

    const runMw = (i) => {
      const next = () => runMw(i + 1);

      if (handlers.length === i) {
        return Promise.reject(new Error('Final Handler should not call next'));
      }

      // this.log.info(`@StellarCore.executeMiddlewares: run ${i} ${stringify(jobData, this.log)}`);
      if (handlers[i].pattern === undefined ||
        match(jobData.headers.queueName || jobData.headers.channel, handlers[i].pattern)) {
        return handlers[i].fn(jobData, next, options);
      }

      return next();
    };

    return runMw(0);
  }

  _enqueue(queueName, obj) {
    this.log.info(`@StellarCore.enqueue ${queueName}: ${stringify(obj, this.log)}`);
    return this.transport
      .enqueue(queueName, obj)
      .catch((e) => {
        this.log.error(`@StellarCore.enqueue error`, e);
        throw e;
      });
  }

  _process(queueName, callback) {
    return this.transport.process(queueName, (job) => {
      this.log.info(`@StellarCore.process ${queueName}: ${job.jobId}: ${stringify(job.data)}`);
      return callback(job);
    });
  }

}

export default StellarCore;
