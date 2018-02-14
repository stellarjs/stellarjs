import Promise from 'bluebird';
import _ from 'lodash';
import { EventEmitter } from 'events';

import { WebsocketTransport } from '../src';

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

let transports = [];

export function transportGenerator(source, log) {
  const socketA = new FakeSocket();
  const socketB = new FakeSocket();
  FakeSocket.connect(socketA, socketB);
  
  transports = _.concat([{ a: new WebsocketTransport(socketA, log), b: new WebsocketTransport(socketB, log) } ], transports);
  return _.head(transports)
}

export async function closeTransport() {
  await Promise.map(transports, (transport) => {
    transport.a.reset();
    transport.b.reset();
  });
  transports = [];
  return;
}