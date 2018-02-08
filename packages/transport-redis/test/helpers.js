import _ from 'lodash';
import Promise from 'bluebird';

import { QueueMessagingAdaptor } from '@stellarjs/messaging-queue';

import RedisTransport from '../src/RedisTransport';
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
let messagings = [];

function messagingGenerator(source, log) {
  redisTransports = _.concat([ new RedisTransport(log), new RedisTransport(log) ], redisTransports);
  messagings = _.concat([ {
    a: new QueueMessagingAdaptor(redisTransports[0], source, log, 1000),
    b: new QueueMessagingAdaptor(redisTransports[1], source, log, 1000)
  } ], messagings);
  return _.head(messagings);
}

async function closeMessaging() {
  await Promise.map(messagings, (messaging) => {
    messaging.a.reset();
    messaging.b.reset();
  });
  await closeRedis(redisTransports);
  redisTransports = [];
  messagings = [];
  return;
}


export { log, closeRedis, messagingGenerator, closeMessaging };
