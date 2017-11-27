export default class Core {
  constructor(log, generateId, enqueue, process) {
    this.log = log;
    this.generateId = generateId;
    this.enqueue = enqueue;
    this.process = process;
  }

  _getNextId(queueName) {
    return this.generateId(queueName).then(id => `${queueName}:${id}`);
  }

  _enqueue(queueName, payload, queueMessageId) {
    this.log.info(`@QueueTransport.enqueue`, { queueName, payload });
    return this.enqueue(queueName, payload, queueMessageId)
      .catch((e) => {
        this.log.error(e, `@QueueTransport.enqueue`, { queueName, payload });
        throw e;
      });
  }

  _process(inbox, callback) {
    return this.process(inbox, (job) => {
      this.log.info(`@QueueTransport.process`, { inbox, obj: job.data });
      return callback(job);
    });
  }
}
