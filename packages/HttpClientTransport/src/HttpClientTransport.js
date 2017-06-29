import get from 'lodash/get';
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import express from 'express';
import bodyParser from 'body-parser';

function getRequestId(command) {
  return get(command, 'headers.requestId');
}

function getQueueName(command) {
  return get(command, 'headers.queueName');
}

class HttpClientTransport {
  constructor({hostUrl, log, sendingOnly}) {
    this.log = log;
    this.sendingOnly = sendingOnly;
    this.messageHandler = new EventEmitter();
    this.requestHandler = new EventEmitter();
    this.hostUrl = hostUrl;
  }

  enqueue(queueName, command) {
    this.requestHandler.emit(getRequestId(command), command);
    return Promise.resolve();
  }

  process(queueName, callback) {
    this.messageHandler.on(queueName, (command) => {
      callback(command);
    });
    return Promise.resolve();
  }
}

HttpClientTransport.START_2016 = new Date(2016, 1, 1).getTime();
HttpClientTransport.ENQUEUE_URI = '/stellar/enqueue';

export default HttpClientTransport;

