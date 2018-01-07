import Promise from 'bluebird';
import _ from 'lodash';

import RedisClient from '../src/config-redisclient';

const log = console;

function closeRedis(redises) {
    log.info('closeRedis');
    const context = {};
    const redisTransports =  _.castArray(redises);

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
      .then((k) => log.info(`keys: ${JSON.stringify(k)}`))
      .delay(500)
      .then(() => context.redisClient.closeAll());
}

export { log, closeRedis };
