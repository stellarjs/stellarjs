/**
 * Created by arolave on 06/10/2016.
 */
import get from 'lodash/get';
import Promise from 'bluebird';
import { EventEmitter } from 'events';

class WebsocketTransport {
  constructor(socket, log, sendingOnly) {
    this.log = log;
    this.sendingOnly = sendingOnly;
    this.messageHandler = new EventEmitter();

    this.socket = new Promise((resolve, reject) => {
      this.socketResolver = resolve;
      this.socketRejecter = reject;
      this.setSocket(socket);
    });
  }

  setSocket(socket) {
    if (!socket) {
      return;
    }

    if (!this.sendingOnly) {
      socket.on('message', (str) => {
        // this.log.info(`@Stellar.Websocket message received: ${str}`);
        const command = JSON.parse(str);
        if (get(command, 'data.headers.queueName')) {
          this.messageHandler.emit(command.data.headers.queueName, command);
        }
      });
    }

    setTimeout(() => this.socketResolver(socket), 250);
  }

  onClose() {
    this.socket = new Promise((resolve, reject) => {
      this.socketResolver = resolve;
      this.socketRejecter = reject;
    });
  }

  getSubscribers(channel) { // eslint-disable-line no-unused-vars,class-methods-use-this
    return Promise.resolve();
  }

  registerSubscriber(channel, queueName) {
    return Promise.resolve(() => this._deregisterSubscriber(channel, queueName));
  }

  _deregisterSubscriber(channel, queueName) {
    return this.enqueue(queueName, { headers: { channel, type: 'stopReactive' } });
  }

  // eslint-disable-next-line class-methods-use-this
  generateId() {
    return Promise.resolve(`${Date.now() - WebsocketTransport.START_2016}:${Math.floor(Math.random() * 10000)}`);
  }

  enqueue(queueName, data) {
    // queueName ignored on a socket enqueue as there is only one queue
    return this.socket.then((s) => {
      const command = { data };
      s.send(JSON.stringify(command));
      return command;
    });
  }

  process(queueName, callback) {
    this.log.log('trace', `@WebsocketTransport: Registering inbox`, { queueName });
    this.messageHandler.on(queueName, (command) => {
      try {
        callback(command);
      } catch (e) {
        this.log.warn(e, 'invalid message sent to stellar websocket transport', { queueName, obj: command });
      }
    });
    return Promise.resolve();
  }

  stopProcessing(queueName) {
    this.log.info(`@WebsocketTransport: Stopping inbox`, { queueName });
    return this.messageHandler.removeAllListeners(queueName);
  }
}

WebsocketTransport.START_2016 = new Date(2016, 1, 1).getTime();

export default WebsocketTransport;

