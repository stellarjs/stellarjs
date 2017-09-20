import Promise from 'bluebird';

import RedisClient from '../src/config-redisclient';

const log = console;

function closeRedis(redisTransport) {
    log.info('afterAll');
    const context = {};

    return Promise
      .delay(1000)
      .then(() => {
          log.info(`afterAll2 ${Date.now()}`);
          return redisTransport.close();
      })
      .then(() => {
          context.redisClient = new RedisClient(log);
          if (context.redisClient.defaultConnection.options.db !== 7) {
              throw new Error(`invalid test db ${context.redisClient.defaultConnection.options.db}, should be 7`);
          }

          log.info('Flush redis!!!');

          return context.redisClient.defaultConnection.keys('*');
      })
      .then((k) => log.info(`keys: ${JSON.stringify(k)}`))
      .then(() => context.redisClient.defaultConnection.flushdb())
      .then(() => context.redisClient.defaultConnection.keys('*'))
      .then((k) => log.info(`keys: ${JSON.stringify(k)}`))
      .delay(500)
      .then(() => context.redisClient.closeAll());
}

export { log, closeRedis };
