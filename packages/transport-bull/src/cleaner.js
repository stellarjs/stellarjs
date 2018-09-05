
import Queue from 'bull';
import forEach from 'lodash/foreach';
import keys from 'lodash/keys';

import { DEFAULT_INTERVAL } from './intervals';

const cron = `*/${DEFAULT_INTERVAL} * * * *`; // Every X minutes
const repeatableJobOptions = {
  repeat: {
    cron,
  },
  removeOnFail: false,
  removeOnComplete: true,
};

function runSubscriberCleaning(transport, log) {
  const queue = new Queue('stlr:periodicTasks', transport.redis.newConnection());
  const jobs = {
    'stlr:subscribers:cleaner': () => transport._cleanResources(),
    'stlr:queues:remover': () => transport._removeUnusedQueues('stlr:*:req'),
  };

  forEach(keys(jobs), (jobName) => {
    const job = jobs[jobName];
    queue.process(jobName, job);
    queue.add(jobName, { action: 'run' }, repeatableJobOptions);
    log.info(`@${jobName}: job is scheduled to run with CRON expression ${cron}`);
  });
}

// todo function stopCleaner() {
// }

export default runSubscriberCleaning;
