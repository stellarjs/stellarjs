import Promise from 'bluebird';
import _ from 'lodash';

import { MemoryTransport } from '../src';

let transports = [];

export function transportGenerator(source, log) {
  const instance = new MemoryTransport(log);
  transports = _.concat([ { a: instance, b: instance } ], transports);
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