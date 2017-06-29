import HttpClientTransport from './HttpClientTransport';
import request from 'request';

let instance;
function transportFactory({ log, hostUrl, sendingOnly = false, port }) {
  log.info(`${process.pid}: @HttpTransportFactory returning instance`);
  if (!instance) {
    instance = new HttpClientTransport({hostUrl, log, sendingOnly, port});
  }
  return instance;
}
transportFactory.type = `httpClient`;

export { transportFactory as default, HttpClientTransport };
