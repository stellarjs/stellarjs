import get from 'lodash/get';
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import express from 'express';
import bodyParser from 'body-parser';

function getRequestId(command) {
  return get(command, 'headers.requestId');
}

class HttpServerTransport {
  constructor({server, log, sendingOnly}) {
    this.log = log;
    this.sendingOnly = sendingOnly;
    this.messageHandler = new EventEmitter();
    this.requestHandler = new EventEmitter();

    this.listenOnServer(server);

    this.currentId = 0;
  }

  generateId() {
    return Promise.resolve(this.currentId++); //eslint-disable-line
  }

  listenOnServer(server) {
    const app = express();
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    server.on('request', app);

    app.post(HttpServerTransport.ENQUEUE_URI, (req, res) => {
      const reqCommand = get(req, 'body');
      this.requestHandler.once(get(reqCommand, 'headers.id'), (resCommand) => {
        res.send(resCommand);
      });
      this.messageHandler.emit('msg', reqCommand);
    });
  }

  enqueue(queueName, command) {
    this.requestHandler.emit(getRequestId(command), command);
    return Promise.resolve(command);
  }

  process(queueName, callback) {
    this.messageHandler.on('msg', (command) => {
      try {
        callback(command);
      } catch (e) {
        this.log.warn(e, 'invalid message sent to stellar websocket transport');
      }
    });
    return Promise.resolve();
  }
}

HttpServerTransport.START_2016 = new Date(2016, 1, 1).getTime();
HttpServerTransport.ENQUEUE_URI = '/stellar/enqueue';

export default HttpServerTransport;

