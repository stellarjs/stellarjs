import { localRequestHandlersDecorator } from '@stellarjs/transport';

import WebsocketTransport from './WebsocketTransport';

function transportFactory({ log, socket, requestTimeout, sendingOnly = false, optimizeLocalHandlers = true }) {
  const transport = new WebsocketTransport(socket, log, sendingOnly, requestTimeout);
  return optimizeLocalHandlers ? localRequestHandlersDecorator(transport) : transport;
}
transportFactory.type = `websocket`;

export default transportFactory;
