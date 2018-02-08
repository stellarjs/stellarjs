import get from 'lodash/get';
import defaults from 'lodash/defaults';

export default function decorate(messageAdapter) {
  function getLocalHandler(req) {
    const url = get(req, 'headers.queueName');
    return get(messageAdapter.registries.requestHandlers, url);
  }

  function _request(req, requestTimeout) {
    const localHandler = getLocalHandler(req);
    if (localHandler) {
      return localHandler(req);
    }

    return messageAdapter.request(req, requestTimeout);
  }

  function _fireAndForget(req) {
    const localHandler = getLocalHandler(req);
    if (localHandler) {
      localHandler(req);
      return;
    }

    messageAdapter.fireAndForget(req);
  }

  const decorations = { request: _request.bind(messageAdapter), fireAndForget: _fireAndForget.bind(messageAdapter) };
  const result = defaults(decorations, messageAdapter);

  return result;
}
