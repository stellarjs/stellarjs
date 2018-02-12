import get from 'lodash/get';

export default function instrumentBullRedisQueueSystem(shim, messageBrokerModule) {
  shim.setLibrary('stellarjs');

  shim.recordProduce(messageBrokerModule.BullRedisQueueSystem.prototype, 'enqueue', (_shim, fn, name, args) => {
    const queueName = args[0];
    const obj = (args.length > 1) ? args[1] : {};

        // The message headers must be pulled to enable cross-application tracing.
        // const headers = options ? options.headers : {};
    const headers = get(obj, 'headers');
    const body = get(obj, 'body');

        // misc key/value parameters can be recorded as a part of the trace segment
    return {
      callback: _shim.LAST,
      destinationName: get(headers, 'queueName', queueName),
      destinationType: _shim.QUEUE,
      headers,
      parameters: body,
    };
  });

  shim.recordSubscribedConsume(messageBrokerModule.BullRedisQueueSystem.prototype, 'process', {
    consumer: shim.LAST,
    messageHandler(_shim, consumer, name, args) {
      const job = args[0];
      const headers = get(job, 'data.headers', {});
      const queueName = get(headers, 'queueName', job.queue.name);

      return {
        destinationName: queueName,
        destinationType: _shim.QUEUE,
        headers,
      };
    },
  });
}
