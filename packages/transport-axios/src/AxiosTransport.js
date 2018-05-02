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
        this.send(req);
    }

    async send(request) {
        const { headers } = request;
        const { queueName, requestTimeout } = headers;
        const { url } = this.getHttpMethodAndUrlFromQueueName(queueName);

        const res = await this.axios.post(url, request, {
            timeout: requestTimeout || this.defaultRequestTimeout,
            data: request,
            baseUrl: this.baseUrl,
        });
        debugger
        return res;
    }
}

export default AxiosTransport;

