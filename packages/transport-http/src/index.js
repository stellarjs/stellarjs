import { Transport } from '@gf-stellarjs/abstract-transport';

class HttpTransport extends Transport {
  getHttpMethodAndUrlFromQueueName(queueName) { // eslint-disable-line class-methods-use-this
    const splitQueueName = queueName.split(':'); // eslint-disable-line lodash/prefer-lodash-method

    return {
      url: `/${splitQueueName.join('/')}`,
    };
  }
}

export default HttpTransport;
