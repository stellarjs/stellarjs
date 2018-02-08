import Promise from 'bluebird';
import _ from 'lodash';

import { MemoryTransport } from '../src';

let messagings = [];

export function messagingGenerator(source, log) {
  const instance = new MemoryTransport(log);
  messagings = _.concat([ { a: instance, b: instance } ], messagings);
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