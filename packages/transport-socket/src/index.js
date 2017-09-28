/**
 * Created by arolave on 05/10/2016.
 */
import WebsocketTransport from './WebsocketTransport';

function transportFactory({ log, socket, sendingOnly = false }) {
  log.info(`${process.pid}: @WebsocketTransportFactory returning instance`);

  return new WebsocketTransport(socket, log, sendingOnly);
}
transportFactory.type = `websocket`;

export { transportFactory as default, WebsocketTransport };
