import HttpServerTransport from './HttpServerTransport';

let instance;
function transportFactory({ log, server, sendingOnly = false }) {
  log.info(`${process.pid}: @HttpTransportFactory returning instance`);
  if (!instance) {
    instance = new HttpServerTransport({server, log, sendingOnly});
  }
  return instance;
}
transportFactory.type = `httpServer`;

export { transportFactory as default, HttpServerTransport };
