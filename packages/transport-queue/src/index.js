import assign from 'lodash/assign';
import QueueTransport from './QueueTransport';

export default function configure({ queueSystem, queueSystemFactory }) {
  return function (options) {
    const { source, log, requestTimeout } = options;
    const finalQueue = queueSystem || queueSystemFactory(assign({ log }, options));
    return new QueueTransport(finalQueue, source, log, requestTimeout);
  };
}

export { default as QueueSystem } from './QueueSystem';
export { QueueTransport };
