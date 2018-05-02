import { Transport } from '@stellarjs/abstract-transport';

class HttpTransport extends Transport {
    getHttpMethodAndUrlFromQueueName(queueName) {
        const splitQueueName = queueName.split(':');

        return {
            url: `/${splitQueueName.join('/')}`,
        };
    }
}

export default HttpTransport;
