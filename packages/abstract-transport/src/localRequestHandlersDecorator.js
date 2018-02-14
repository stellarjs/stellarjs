import get from 'lodash/get';
import defaults from 'lodash/defaults';

export default function decorate(transport) {
  function getLocalHandler(req) {
    const url = get(req, 'headers.queueName');
    return get(transport.registries.requestHandlers, url);
  }

  function _request(req, requestTimeout) {
    const localHandler = getLocalHandler(req);
    if (localHandler) {
      return localHandler(req);
    }

    return transport.request(req, requestTimeout);
  }

  function _fireAndForget(req) {
    const localHandler = getLocalHandler(req);
    if (localHandler) {
      localHandler(req);
      return;
    }

    transport.fireAndForget(req);
  }

  const decorations = { request: _request.bind(transport), fireAndForget: _fireAndForget.bind(transport) };
  const result = defaults(decorations, transport);

  return result;
}
