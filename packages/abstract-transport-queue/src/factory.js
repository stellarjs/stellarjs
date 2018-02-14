import { localRequestHandlersDecorator } from '@stellarjs/abstract-transport';

import assign from 'lodash/assign';

import QueueTransport from './QueueTransport';

export default function configure({ queueSystem, queueSystemFactory }) {
  return function (options) {
    const { source, log, requestTimeout, optimizeLocalHandlers } = options;
    const finalQueue = queueSystem || queueSystemFactory(assign({ log }, options));
    const transport = new QueueTransport(finalQueue, source, log, requestTimeout);
    return optimizeLocalHandlers ? localRequestHandlersDecorator(transport) : transport;
  };
}
