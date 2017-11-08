import _ from 'lodash';

// eslint-disable-next-line better-mutation/no-mutation
module.exports = function instrumentRedisTransport(shim, messageBrokerModule) {
    shim.setLibrary('stellarjs');

    shim.recordProduce(messageBrokerModule.RedisTransport.prototype, 'enqueue', (_shim, fn, name, args) => {
        const queueName = args[0];
        const obj = (args.length > 1) ? args[1] : {};

        // The message headers must be pulled to enable cross-application tracing.
        // const headers = options ? options.headers : {};
        const headers = _.get(obj, 'headers');
        const body = _.get(obj, 'body');

        // misc key/value parameters can be recorded as a part of the trace segment
        return {
            callback: _shim.LAST,
            destinationName: _.get(headers, 'queueName', queueName),
            destinationType: _shim.QUEUE,
            headers,
            parameters: body,
        };
    });

    shim.recordSubscribedConsume(messageBrokerModule.RedisTransport.prototype, 'process', {
        consumer: shim.LAST,
        messageHandler(_shim, consumer, name, args) {
            const job = args[0];
            const headers = _.get(job, 'data.headers', {});
            const queueName = _.get(headers, 'queueName', job.queue.name);

            return {
                destinationName: queueName,
                destinationType: _shim.QUEUE,
                headers,
            };
        },
    });
};
