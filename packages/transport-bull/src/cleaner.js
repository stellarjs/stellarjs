
import Queue from 'bull';

import { DEFAULT_INTERVAL } from './intervals';

function runSubscriberCleaning(transport, log) {
  const queue = new Queue('stlr:periodicTasks', transport.redis.newConnection());
  const cron = `*/${DEFAULT_INTERVAL} * * * *`; // Every X minutes
  const repeatableJobOptions = {
    repeat: {
      cron,
    },
    removeOnFail: false,
    removeOnComplete: true,
  };

  const CLEAN_SUBSCRIBERS_JOB_NAME = 'stlr:subscribers:cleaner';
  queue.process(CLEAN_SUBSCRIBERS_JOB_NAME, transport._cleanResources());
  queue.add(CLEAN_SUBSCRIBERS_JOB_NAME, { action: 'run' }, repeatableJobOptions);
  log.info(`@${CLEAN_SUBSCRIBERS_JOB_NAME}: job is scheduled to run with CRON expression ${cron}`);

  const CLEAN_USUSED_QUEUES_JOB_NAME = 'stlr:queues:remover';
  queue.process(CLEAN_USUSED_QUEUES_JOB_NAME, transport._removeUnusedQueues('stlr:*:req'));
  queue.add(CLEAN_USUSED_QUEUES_JOB_NAME, { action: 'run' }, repeatableJobOptions);
  log.info(`@${CLEAN_USUSED_QUEUES_JOB_NAME}: job is scheduled to run with CRON expression ${cron}`);
}

// todo function stopCleaner() {
// }

export default runSubscriberCleaning;
