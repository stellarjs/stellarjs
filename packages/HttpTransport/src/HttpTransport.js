/**
 * Created by arolave on 06/10/2016.
 */
import get from 'lodash/get';
import last from 'lodash/last';
import Promise from 'bluebird';
import { EventEmitter } from 'events';

class HttpTransport {
  constructor({server, log, sendingOnly}) {
    this.log = log;
    this.sendingOnly = sendingOnly;
    this.server = server;
    this.messageHandler = new EventEmitter();
    this.requestHandler = new EventEmitter();

    this.listenOnServer();
  }

  addRequestListener() {

  }

  listenOnServer() {
    console.log(HttpTransport.ENQUEUE_URI)
    this.server.post(HttpTransport.ENQUEUE_URI, function (req, res) {
      const command = get(req, 'body.command');
      res.send(200);
    })
  }

  // eslint-disable-next-line class-methods-use-this
  generateId() {
    return Promise.resolve(`${Date.now() - HttpTransport.START_2016}:${Math.floor(Math.random() * 10000)}`);
  }

  enqueue(queueName, obj) {
    // const requestId = obj.data.headers.requestId;
    // return this.socket.then((s) => {
    //   const command = {
    //     queue: { name: queueName }, // TODO remove
    //     jobId: last(obj.headers.id.split(':')),
    //     data: obj,
    //   };
    //   const str = JSON.stringify(command);
    //
    //   s.send(str);
    //   return command;
    // });
  }

  process(queueName, callback) {
    // listeners.push();
    // this.messageHandler.on(queueName, (command) => {
    //   const requestId = get(command, 'data.headers.id');
    //   try {
    //     callback(command);
    //   } catch (e) {
    //     this.log.warn('invalid message sent to stellar websocket transport');
    //   }
    // });
    // return Promise.resolve();
  }
}

HttpTransport.START_2016 = new Date(2016, 1, 1).getTime();
HttpTransport.ENQUEUE_URI = '/stellar/enqueue';

export default HttpTransport;

