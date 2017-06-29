import HttpTransport from './HttpTransport';

let instance;
function transportFactory({ log, server, sendingOnly = false }) {
  log.info(`${process.pid}: @HttpTransportFactory returning instance`);
  if (!instance) {
    instance = new HttpTransport({server, log, sendingOnly});
  }
  return instance;
}
transportFactory.type = `httpServer`;

export { transportFactory as default, HttpTransport };
