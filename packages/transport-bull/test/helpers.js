import Promise from 'bluebird';

import transportFactory from '../src';
import RedisClient from '../src/config-redisclient';
import { StellarPubSub } from '@stellarjs/core';

const log = console;

function closeRedis() {
  log.info('@closeRedis');
  const redisClient = new RedisClient(log);
  if (redisClient.defaultConnection.options.db !== 7) {
    throw new Error(`invalid test db ${redisClient.defaultConnection.options.db}, should be 7`);
  }

  return redisClient.defaultConnection.keys('*')
    .then(() => redisClient.defaultConnection.flushdb())
    .then(() => redisClient.defaultConnection.keys('*'))
    .then(k => log.info(`@closeRedis keys=${JSON.stringify(k)}`))
    .delay(500)
    .then(() => redisClient.closeAll());
}

function factory(config) {
  return transportFactory(config, true);
}

function subscriber(source, channel, app) {
  const transport = factory({ log: console, source, app, requestTimeout: 1000 });
  const stellarSub = new StellarPubSub(transport, app);
  return new Promise((resolve) => stellarSub.subscribe(channel, resolve));
}

async function onClose(transports) {
  return closeRedis(transports)
}

export { log, closeRedis, factory, onClose, subscriber };
