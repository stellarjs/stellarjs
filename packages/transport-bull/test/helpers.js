import _ from 'lodash';
import Promise from 'bluebird';

import { QueueTransport } from '@stellarjs/transport-queue';

import BullRedisQueueSystem from '../src/BullRedisQueueSystem';
import RedisClient from '../src/config-redisclient';

const log = console;

function closeRedis(redises) {
  log.info('closeRedis');
  const context = {};
  const redisTransports = _.castArray(redises);

  return Promise
    .map(redisTransports, redisTransport => redisTransport.close())
    .then(() => {
      context.redisClient = new RedisClient(log);
      if (context.redisClient.defaultConnection.options.db !== 7) {
        throw new Error(`invalid test db ${context.redisClient.defaultConnection.options.db}, should be 7`);
      }

      return context.redisClient.defaultConnection.keys('*');
    })
    .then(() => context.redisClient.defaultConnection.flushdb())
    .then(() => context.redisClient.defaultConnection.keys('*'))
    .then(k => log.info(`keys: ${JSON.stringify(k)}`))
    .delay(500)
    .then(() => context.redisClient.closeAll());
}

let redisTransports = [];
let transports = [];

function transportGenerator(source, log) {
  redisTransports = _.concat([ new BullRedisQueueSystem(log), new BullRedisQueueSystem(log) ], redisTransports);
  transports = _.concat([ {
    a: new QueueTransport(redisTransports[0], source, log, 1000),
    b: new QueueTransport(redisTransports[1], source, log, 1000)
  } ], transports);
  return _.head(transports);
}

async function closeTransport() {
  await Promise.map(transports, (transport) => {
    transport.a.reset();
    transport.b.reset();
  });
  await closeRedis(redisTransports);
  redisTransports = [];
  transports = [];
  return;
}


export { log, closeRedis, transportGenerator, closeTransport };
