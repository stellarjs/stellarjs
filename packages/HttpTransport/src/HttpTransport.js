import get from 'lodash/get';
import last from 'lodash/last';
import Promise from 'bluebird';
import { EventEmitter } from 'events';

function getRequestId(command) {
  return get(command, 'headers.id');
}

function getQueueName(command) {
  return get(command, 'headers.queueName');
}

class HttpTransport {
  constructor({server, log, sendingOnly}) {
    this.log = log;
    this.sendingOnly = sendingOnly;
    this.server = server;
    this.messageHandler = new EventEmitter();
    this.requestHandler = new EventEmitter();

    this.listenOnServer();
  }

  listenOnServer() {
    console.log(HttpTransport.ENQUEUE_URI)
    this.server.post(HttpTransport.ENQUEUE_URI, (req, res) => {
      const command = get(req, 'body.data');
      this.requestHandler.once(getRequestId(command), (command) => {
        res.send(command);
      });
      this.messageHandler.emit(getQueueName(command), command);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  generateId() {
    return Promise.resolve(`${Date.now() - HttpTransport.START_2016}:${Math.floor(Math.random() * 10000)}`);
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

