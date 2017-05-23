/**
 * Created by arolave on 25/09/2016.
 */
import assign from 'lodash/assign';
import lowerCase from 'lodash/lowerCase';
import pick from 'lodash/pick';

import Promise from 'bluebird';

import { StellarError } from './StellarError';
import StellarCore from './StellarCore';

export default class StellarHandler extends StellarCore {
  constructor(transport, nodeName, log) {
    super(transport, nodeName, log);
    this.messageHandlers = {};
  }

  _startProcessing(url) {
    const serviceInbox = StellarCore.getServiceInbox(url);
    if (!StellarHandler.isProcessing.has(serviceInbox)) {
      StellarHandler.isProcessing.add(serviceInbox);
      this.log.info(`@StellarHandler(${serviceInbox}): Starting processing`);
      this._process(serviceInbox, (job) => {
        const handler = this.messageHandlers[job.data.headers.queueName];
        if (!handler) {
          this.log.error(
            `No handler for ${job.data.headers.queueName} endpoint registered on this microservice, 
though it processes the ${serviceInbox} queue`);
          throw new Error(`No handler for ${job.data.headers.queueName}`);
        }

        return this.messageHandlers[job.data.headers.queueName](job);
      });
    }
  }

  _addHandler(url, messageHandler) {
    this.messageHandlers[url] = messageHandler;
    this._startProcessing(url);
  }

  get(url, handler) {
    return this.handleMethod(url, 'GET', handler);
  }

  create(url, handler) {
    return this.handleMethod(url, 'CREATE', handler);
  }

  update(url, handler) {
    return this.handleMethod(url, 'UPDATE', handler);
  }

  remove(url, handler) {
    return this.handleMethod(url, 'REMOVE', handler);
  }

  handleMethod(url, method, handler) {
    return this.handleRequest(`${url}:${lowerCase(method)}`, handler);
  }

  handleRequest(url, handler) {
    this.log.info(`@StellarHandler adding handler for ${url}`);

    return this._addHandler(url, (job) => {
      const startTime = Date.now();

      const prepareResponse = (val) => {
        const convertError = e => pick(e, ['errors', 'message']);

        this.log.info(`@StellarHandler marshalling response for ${job.jobId}`);
        const headers = assign(this._getHeaders(), { type: 'response', requestId: job.jobId });
        let body = val;

        if (val instanceof Error) {
          assign(headers, { errorType: val.constructor.name });
          body = convertError(val);
        }

        return { headers, body };
      };

      const logComplete = (result, e) => {
        const executionTime = Date.now() - startTime;
        if (!e) {
          this.log.info(`${url} processed in ${executionTime}ms`);
        } else if (e instanceof StellarError) {
          this.log.warn(`${url} stellarErrors ${JSON.stringify(e.messageKeys())} (${executionTime}ms)`);
        } else {
          this.log.error(`${url} Error (${executionTime}ms)`, e);
        }

        return result;
      };

      const sendResponse = (jobData, response, e) =>
        this._enqueue(jobData.headers.respondTo, response)
          .then(() => logComplete(response, e));

      const allMiddlewares = [].concat(this.handlerChain, {
        fn: jobData => Promise
          .try(() => handler(jobData))
          .then(result => prepareResponse(result))
          .catch((error) => {
            const response = prepareResponse(error);
            return Promise.reject([error, response]);
          }),
      });

      return this
        ._executeMiddlewares(allMiddlewares, job.data)
        .then(response => sendResponse(job.data, response))
        .catch(([e, response]) => sendResponse(job.data, response, e));
    });
  }
}

StellarHandler.isProcessing = new Set();
