import { localRequestHandlersDecorator } from '@stellarjs/abstract-transport';

import WebsocketTransport from './WebsocketTransport';

function transportFactory(
  {
    log,
    source,
    socket,
    requestTimeout,
    sendingOnly = false,
    optimizeLocalHandlers = false,
    standardiseDates = false,
  }) {
  const TransportClazz = optimizeLocalHandlers
    ? localRequestHandlersDecorator(WebsocketTransport, standardiseDates)
    : WebsocketTransport;
  return new TransportClazz(socket, source, log, sendingOnly, requestTimeout);
}
transportFactory.type = `websocket`;

export default transportFactory;
