import WebsocketTransport from './WebsocketTransport';

function transportFactory(
  {
    log,
    source,
    socket,
    requestTimeout,
    sendingOnly = false,
  }) {
  return new WebsocketTransport(socket, source, log, sendingOnly, requestTimeout);
}
transportFactory.type = `websocket`;

export default transportFactory;
