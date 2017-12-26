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
    this.log.info(`@StellarHandler: Starting processing`, { inbox: serviceInbox });
    this._process(serviceInbox, (job) => {
      const jobData = job.data;

      const logComplete = (result, e) => {
        if (!e) {
          return result;
        } else if (e instanceof StellarError) {
          // eslint-disable-next-line max-len
          this.log.warn(`@StellarHandler error`, { requestId: jobData.headers.id, errorMessageKeys: e.messageKeys() });
        } else {
          this.log.error(omit(e, '__stellarResponse'));
          // eslint-disable-next-line max-len
          this.log.error(`@StellarHandler error`, { requestId: jobData.headers.id, errorMessage: e.message });
        }

        return result;
      };

      const sendResponse = (response, e) =>
            this._enqueue(jobData.headers.respondTo, response)
              .then(() => logComplete(response, e));

      return this
            ._executeMiddlewares(this.allMiddlewares, jobData)
            .then(response => sendResponse(response))
            .catch((e) => {
              if (e.__stellarResponse != null) {
                return sendResponse(e.__stellarResponse, e);
              }

              this.log.error(e, `@StellarHandler Unexpected error`, { requestId: jobData.headers.id });
              throw e;
            });
    });
  }

  reset() {
    const processingArray = Array.from(StellarHandler.isProcessing);
    StellarHandler.isProcessing.clear();
    return Promise.all(map(
      processingArray,
      serviceInbox => this._stopProcessing(serviceInbox)
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

  setMiddlewares() {
    const me = this;
    this.allMiddlewares = this.handlerChain.concat({ fn({ headers, body }) {
      const handler = me.messageHandlers[headers.queueName];
      if (!handler) {
        const serviceInbox = StellarCore.getServiceInbox(headers.queueName);

        me.log.error(
              `No handler for ${headers.queueName} endpoint registered on this microservice, though it processes the ${
serviceInbox} queue`, { inbox: serviceInbox });
        throw new Error(`No handler for ${headers.queueName}`);
      }

      return handler({ headers, body });
    } });
  }

  handleRequest(url, handler) {
    this.messageHandlers[url] = handler;
    this._startProcessing(url);
    return this;
  }
}

StellarHandler.isProcessing = new Set();
