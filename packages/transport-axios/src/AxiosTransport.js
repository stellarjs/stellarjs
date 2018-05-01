import _ from 'lodash';
import { Transport } from '@stellarjs/abstract-transport';

const stellarMethodToHttp = {
    get: 'get',
    create: 'put',
    update: 'post',
    remove: 'delete',
};

class AxiosTransport extends Transport {
  constructor(axios, source, log, requestTimeout, baseUrl) {
    super(source, log);
    this.defaultRequestTimeout = requestTimeout;
    this.axios = axios;
    this.baseUrl = baseUrl;
  }

  request(req) {
    return this.send(req);
  }

  getAxiosMethodFromStellarMethodName(queueName) {
      const methodName = stellarMethodToHttp[_.last(_.split(queueName, ':'))];
      return (...args) => this.axios[methodName](...args);
  }

  stellarQueueNameToHttpUrl(queueName) {
      const pathArray = _.split(queueName, ':');
      return `/${_(pathArray).slice(0, pathArray.length - 1).join('/')}`;
  }

  send(request) {
      const { headers } = request;
      const { queueName, requestTimeout } = headers;
      const requestMethod = this.getAxiosMethodFromStellarMethodName(queueName);
      const url = this.stellarQueueNameToHttpUrl(queueName);

      return requestMethod(url, {
          timeout: requestTimeout || this.defaultRequestTimeout,
          data: request,
          baseUrl: this.baseUrl,
      });
  }
}

AxiosTransport.START_2016 = new Date(2016, 1, 1).getTime();

export default AxiosTransport;

