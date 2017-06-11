/**
 * Created by arolave on 05/10/2016.
 */
import WebsocketTransport from './WebsocketTransport';

let instance;
function transportFactory({ log, socket, sendingOnly = false }) {
  log.info(`${process.pid}: @WebsocketTransportFactory returning instance`);
  if (!instance) {
    instance = new WebsocketTransport(socket, log, sendingOnly);
  }
  return instance;
}
transportFactory.type = `websocket`;

export { transportFactory as default, WebsocketTransport };
