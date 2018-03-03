import { localRequestHandlersDecorator } from '@stellarjs/abstract-transport';

import WebsocketTransport from './WebsocketTransport';

function transportFactory({ log, source, socket, requestTimeout, sendingOnly = false, optimizeLocalHandlers = false }) {
  const transport = new WebsocketTransport(socket, source, log, sendingOnly, requestTimeout);
  return optimizeLocalHandlers ? localRequestHandlersDecorator(transport) : transport;
}
transportFactory.type = `websocket`;

export default transportFactory;
