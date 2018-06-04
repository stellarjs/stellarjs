import ExpressTransport from './ExpressTransport';

function transportFactory(
    {
        log,
        source,
        router,
    }) {
  return new ExpressTransport(router, source, log);
}
transportFactory.type = `express`;

export default transportFactory;
