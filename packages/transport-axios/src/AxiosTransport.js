import HttpTransport from '@gf-stellarjs/transport-http';

class AxiosTransport extends HttpTransport {
  constructor(axios, source, log, requestTimeout, baseURL) {
    super(source, log);
    this.defaultRequestTimeout = requestTimeout;
    this.axios = axios;
    this.baseURL = baseURL;
  }

  request(req) {
    return this.send(req);
  }

  fireAndForget(req) {
    this.send(req);
  }

  send(request) {
    const { headers } = request;
    const { queueName, requestTimeout } = headers;
    const { url } = this.getHttpMethodAndUrlFromQueueName(queueName);

    return this.axios.post(url, request, {
      timeout: requestTimeout || this.defaultRequestTimeout,
      data: request,
      baseURL: this.baseURL,
    }).then(res => res.data);
  }
}

export default AxiosTransport;

