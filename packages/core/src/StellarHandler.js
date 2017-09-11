/**
 * Created by arolave on 25/09/2016.
 */
import forEach from 'lodash/forEach';
import forOwn from 'lodash/forOwn';
import head from 'lodash/head';
import isArray from 'lodash/isArray';
import isFunction from 'lodash/isFunction';
import isPlainObject from 'lodash/isPlainObject';
import lowerCase from 'lodash/lowerCase';
import map from 'lodash/map';
import omit from 'lodash/omit';

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

    if (StellarHandler.isProcessing.has(serviceInbox)) {
      return;
    }

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

  reset() {
    return Promise.all(map(
        StellarHandler.isProcessing,
        (serviceInbox) => {
          this.log.info(`serviceInbox: ${serviceInbox}`);
          return this._stopProcessing(serviceInbox);
        }
      ));
  }

  stopProcessing(url) {
    const serviceInbox = StellarCore.getServiceInbox(url);
    if (!StellarHandler.isProcessing.has(serviceInbox)) {
      return Promise.resolve(true);
    }

    StellarHandler.isProcessing.delete(serviceInbox);
    return this._stopProcessing(serviceInbox);
  }

  _addHandler(url, messageHandler) {
    this.messageHandlers[url] = messageHandler;
    this._startProcessing(url);
    return this;
  }

  _handleLoader(url, method, value) {
    if (isArray(value)) {
      const handler = head(value);
      const middlewares = value.slice(1);
      forEach(middlewares, m => this.use(`${url}:${method}`, m));
      this.handleMethod(url, method, ({ headers, body }) => handler(headers, body));
      return;
    }

    if (isFunction(value)) {
      this.handleMethod(url, method, ({ headers, body }) => value(headers, body));
    }
  }

  load(resource, loaders) {
    forOwn(loaders, (value, method) => {
      if (method === 'middlewares') {
        forEach(value, m => this.use(resource, m));
        return;
      }

      if (isPlainObject(value)) {
        forOwn(value, (loader, action) => {
          const url = action === 'default' ? resource : `${resource}:${action}`;
          this._handleLoader(url, method, loader);
        });
        return;
      }

      this._handleLoader(resource, method, value);
    });
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
      const jobData = job.data;

      const logComplete = (result, e) => {
        const executionTime = Date.now() - startTime;
        if (!e) {
          this.log.info(`@StellarHandler(${jobData.headers.id}) processed in ${executionTime}ms`);
        } else if (e instanceof StellarError) {
          // eslint-disable-next-line max-len
          this.log.warn(`@StellarHandler(${jobData.headers.id}) ${JSON.stringify({ StellarErrors: e.messageKeys(), requestHeaders: jobData.headers })} (${executionTime}ms)`);
        } else {
          // eslint-disable-next-line max-len
          this.log.error(`@StellarHandler(${jobData.headers.id}) ${JSON.stringify({ Error: e.message, requestHeaders: jobData.headers })} (${executionTime}ms)`);
          this.log.error(omit(e, '__stellarResponse'));
        }

        return result;
      };

      const sendResponse = (response, e) =>
        this._enqueue(jobData.headers.respondTo, response)
          .then(() => logComplete(response, e));

      const allMiddlewares = [].concat(this.handlerChain, { fn: jd => Promise.try(() => handler(jd)) });

      return this
        ._executeMiddlewares(allMiddlewares, jobData)
        .then(response => sendResponse(response))
        .catch((e) => {
          if (e.__stellarResponse != null) {
            return sendResponse(e.__stellarResponse, e);
          }

          this.log.error(e, `@StellarHandler ${jobData.headers.id}: Unexpected error`);
          throw e;
        });
    });
  }
}

StellarHandler.isProcessing = new Set();
