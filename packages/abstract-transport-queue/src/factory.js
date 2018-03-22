import { localRequestHandlersDecorator } from '@stellarjs/abstract-transport';

import assign from 'lodash/assign';

import QueueTransport from './QueueTransport';

export default function configure({ queueSystem, queueSystemFactory }) {
  return function (options) {
    const { source, log, requestTimeout, optimizeLocalHandlers, standardiseDates } = options;
    const finalQueue = queueSystem || queueSystemFactory(assign({ log }, options));
    const TransportClazz = optimizeLocalHandlers
      ? localRequestHandlersDecorator(QueueTransport, standardiseDates)
      : QueueTransport;

    return new TransportClazz(finalQueue, source, log, requestTimeout);
  };
}
