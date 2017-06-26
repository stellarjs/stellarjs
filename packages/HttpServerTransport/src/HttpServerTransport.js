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

class HttpTransport {
  constructor({server, log, sendingOnly}) {
    this.log = log;
    this.sendingOnly = sendingOnly;
    this.messageHandler = new EventEmitter();
    this.requestHandler = new EventEmitter();

    this.listenOnServer(server);
  }

  listenOnServer(server) {
    const app = express();
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    server.on('request', app);

    app.post(HttpTransport.ENQUEUE_URI, (req, res) => {
      const command = get(req, 'body.data');
      this.requestHandler.once(get(command, 'headers.id'), (command) => {
        res.send(command);
      });
      this.messageHandler.emit(getQueueName(command), command);
    });
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

HttpTransport.START_2016 = new Date(2016, 1, 1).getTime();
HttpTransport.ENQUEUE_URI = '/stellar/enqueue';

export default HttpTransport;

