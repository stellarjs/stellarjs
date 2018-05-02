import { Transport } from '@stellarjs/abstract-transport';

const stellarMethodToHttp = {
    get: 'get',
    create: 'put',
    update: 'post',
    remove: 'delete',
};

class HttpTransport extends Transport {
    getHttpMethodAndUrlFromQueueName(queueName) {
        const splitQueueName = queueName.split(':');
        const stellarMethodName = splitQueueName.splice(splitQueueName.length - 1, 1);

        return {
            method: stellarMethodToHttp[stellarMethodName],
            url: `/${splitQueueName.join('/')}`,
        };
    }
}

export default HttpTransport;
