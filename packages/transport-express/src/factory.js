import ExpressTransport from './ExpressTransport';

function transportFactory(
  {
    log,
    source,
    express,
  }) {
  return new ExpressTransport(express, source, log, requestTimeout);
}
transportFactory.type = `express`;

export default transportFactory;
