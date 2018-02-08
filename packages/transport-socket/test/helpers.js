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

let messagings = [];

export function messagingGenerator(source, log) {
  const socketA = new FakeSocket();
  const socketB = new FakeSocket();
  FakeSocket.connect(socketA, socketB);
  
  messagings = _.concat([{ a: new WebsocketTransport(socketA, log), b: new WebsocketTransport(socketB, log) } ], messagings);
  return _.head(messagings)
}

export async function closeMessaging() {
  await Promise.map(messagings, (messaging) => {
    messaging.a.reset();
    messaging.b.reset();
  });
  messagings = [];
  return;
}