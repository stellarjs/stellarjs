/**
 * Created by arolave on 06/10/2016.
 */
import get from 'lodash/get';
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import { RemoteTransport } from '@stellarjs/transport';

class WebsocketTransport extends RemoteTransport {
  constructor(socket, log, sendingOnly, requestTimeout) {
    super(log, requestTimeout);
    this.sendingOnly = sendingOnly;
    this.subscriptionHandler = new EventEmitter();

    this.socket = new Promise((resolve) => {
      this.socketResolver = resolve;
      this.setSocket(socket);
    });
  }

  setSocket(socket) {
    if (!socket) {
      return;
    }

    if (this.sendingOnly) {
      this.socketResolver(socket);
      return;
    }

    socket.on('message', (str) => {
      this.log.info(`@Stellar.Websocket message received: ${str}`);
      const command = JSON.parse(str);
      const data = get(command, 'data');
      const headers = get(data, 'headers', {});

      if (headers.channel) {
        return this.subscriptionHandler.emit(headers.channel, data);
      } else if (headers.type === 'response') {
        return this._responseHandler(data);
      }
      const requestHandler = this.registries.requestHandlers[headers.queueName];
      if (!requestHandler) {
        throw new Error(`@Stellar.Websocket message failed, no handler for message: ${str}`);
      }

      return requestHandler(data)
          .then(res => this.send(res))
          .catch(err => this.send(err.__stellarResponse));
    });

    setTimeout(() => this.socketResolver(socket), 250);
  }

  onClose() {
    this.socket = new Promise((resolve) => {
      this.socketResolver = resolve;
    });
  }

  registerSubscriber(channel) {
    return () => this.send({ headers: { channel, type: 'stopReactive' } });
  }

  addRequestHandler(url, handler) {
    return this.registerRequestHandler(url, handler);
  }

  subscribe(channel, messageHandler) {
    const unsubscribeFn = this.registerSubscriber(channel);
    return this._subscribe(channel, messageHandler, unsubscribeFn);
  }

  subscribeGroup(groupId, channel, messageHandler) {
    const unsubscribeFn = this.registerSubscriberGroupHandler(groupId, channel, messageHandler);
    return this._subscribe(channel, messageHandler, unsubscribeFn);
  }

  _subscribe(channel, messageHandler, unsubscribeFn) {
    this.subscriptionHandler.on(channel, messageHandler);
    return () => {
      unsubscribeFn();
      this.subscriptionHandler.removeListener(channel, messageHandler);
    };
  }

  publish(channel, message) {
    return this.send(message);
  }

  remoteRequest(req) {
    return this.send(req);
  }

  send(data) {
    // queueName ignored on a socket enqueue as there is only one queue
    return this.socket.then((s) => {
      const command = { data };
      s.send(JSON.stringify(command));
      return command;
    });
  }

  reset() {
    super.reset();
    this.subscriptionHandler.removeAllListeners();
  }
}

WebsocketTransport.START_2016 = new Date(2016, 1, 1).getTime();

export default WebsocketTransport;

