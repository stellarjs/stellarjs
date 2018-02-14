
import RedisExclusiveTask from 'redis-exclusive-task';

import { DEFAULT_INTERVAL } from './intervals';

let subscriberCleanerRunning = false;

function runSubscriberCleaning(transport, log) {
  if (subscriberCleanerRunning) {
    return;
  }

  subscriberCleanerRunning = true; // eslint-disable-line better-mutation/no-mutation
  log.info(`runSubscriberCleaning`);
  RedisExclusiveTask.configure([transport.redis.newConnection()], log);

  RedisExclusiveTask.run(
    'stlr:subscribers:cleaner',
    () => transport._cleanResources(),
    DEFAULT_INTERVAL
  );

  RedisExclusiveTask.run(
    'stlr:queues:remover',
    () => transport._removeUnusedQueues('stlr:*:inbox'),
    DEFAULT_INTERVAL
  );
}

// todo function stopCleaner() {
// }

export default runSubscriberCleaning;
