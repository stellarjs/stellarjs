import { localRequestHandlersDecorator } from '@stellarjs/abstract-transport';

import WebsocketTransport from './WebsocketTransport';

function transportFactory({ log, socket, requestTimeout, sendingOnly = false, optimizeLocalHandlers = false }) {
  const transport = new WebsocketTransport(socket, log, sendingOnly, requestTimeout);
  return optimizeLocalHandlers ? localRequestHandlersDecorator(transport) : transport;
}
transportFactory.type = `websocket`;

export default transportFactory;
