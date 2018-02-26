import _ from 'lodash';
import { EventEmitter } from 'events';

import transportFactory from '../src';

class FakeSocket {
  constructor() {
    this.emitter = new EventEmitter();
  }
  
  static connect(a, b) {
    a.setSink(b);
    b.setSink(a);
  }
  
  setSink(sink) {
    this.sink = sink;
  }

  on(channel, handler) {
    this.emitter.on(channel, handler);
  }

  send(message) {
    this.sink.emitter.emit('message', message);
  }
}

let app1Sockets = [];
let app2Sockets = [];

export function factory(config) {
  if (config.app === 'app1') {
    app1Sockets.push(new FakeSocket());
    return transportFactory(_.assign({socket: _.last(app1Sockets)}, config));

  } else {
    app2Sockets.push(new FakeSocket());

    _.forEach(app1Sockets, (app1Socket) => {
      FakeSocket.connect(app1Socket, _.last(app2Sockets));
    });

    return transportFactory(_.assign({socket: _.last(app2Sockets)}, config));
  }
}

export const onClose = _.noop;