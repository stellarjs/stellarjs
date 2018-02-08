import assign from 'lodash/assign';
import QueueMessagingAdaptor from './QueueMessagingAdaptor';
import RemoteRequestAdaptor from './RemoteRequestMessagingAdaptor';

export default function queueMessagingFactoryConfig({ transport, transportFactory }) {
  return function (options) {
    const { source, log, requestTimeout } = options;
    const finalTransport = transport || transportFactory(assign({ log }, options));
    return new QueueMessagingAdaptor(finalTransport, source, log, requestTimeout);
  };
}

export { QueueMessagingAdaptor, RemoteRequestAdaptor };
export { default as QueueTransport } from './QueueTransport';
