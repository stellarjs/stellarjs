import HttpTransport from '@stellarjs/transport-http';

class AxiosTransport extends HttpTransport {
    constructor(axios, source, log, requestTimeout, baseUrl) {
        super(source, log);
        this.defaultRequestTimeout = requestTimeout;
        this.axios = axios;
        this.baseUrl = baseUrl;
    }

    request(req) {
        return this.send(req);
    }

    fireAndForget(req) {
        this.send(req)
            .then(() => {});
    }

    send(request) {
        const { headers } = request;
        const { queueName, requestTimeout } = headers;
        const { method, url } = this.getHttpMethodAndUrlFromQueueName(queueName);

        return this.axios[method](url, {
            timeout: requestTimeout || this.defaultRequestTimeout,
            data: request,
            baseUrl: this.baseUrl,
        });
    }
}

export default AxiosTransport;

