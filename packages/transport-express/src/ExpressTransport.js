import HttpTransport from '@stellarjs/transport-http';

class ExpressTransport extends HttpTransport {
  constructor(router, source, log) {
    super(source, log);
    this.router = router;
  }

  addRequestHandler(queueName, handler) {
    const { url } = this.getHttpMethodAndUrlFromQueueName(queueName);
    this.router.post(url, (req, res) => {
      handler(req.body)
                .then((result) => { // eslint-disable-line promise/always-return
                  res.json(result);
                })
                .catch((error) => { // eslint-disable-line promise/always-return
                  res.json(error.__stellarResponse);
                });
    });
  }
}

export default ExpressTransport;
