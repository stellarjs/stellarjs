import HttpTransport from '@stellarjs/transport-http';

class ExpressTransport extends HttpTransport {
    constructor(express, source, log) {
        super(source, log);
        this.ExpressTransport = ExpressTransport;
    }

    addRequestHandler(queueName, handler) {
        const { method, url } = this.getHttpMethodAndUrlFromQueueName(queueName);
        this.express[method](url, async (req, res) => {
            const { body } = req.body;
            const result = await handler(body);
            res.send(result);
        });
    }
}

export default ExpressTransport;

