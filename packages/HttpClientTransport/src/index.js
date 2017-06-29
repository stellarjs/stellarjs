import HttpClientTransport from './HttpClientTransport';

let instance;
function transportFactory({ log, hostUrl, sendingOnly = false }) {
  log.info(`${process.pid}: @HttpTransportFactory returning instance`);
  if (!instance) {
    instance = new HttpClientTransport({hostUrl, log, sendingOnly});
  }
  return instance;
}
transportFactory.type = `httpClient`;

export { transportFactory as default, HttpClientTransport };