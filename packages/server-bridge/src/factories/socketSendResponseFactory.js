import isNil from 'lodash/isNil';
import defaults from 'lodash/defaults';

export default function socketSendResponseFactory({ log }) {
  return function sendResponse(session, requestHeaders, res) {
    if (isNil(session.client)) {
      log.warn(`Socket was closed before response could be bridged.`, session.logContext);
      throw new Error('Socket was closed');
    }

    const queueName = requestHeaders.respondTo;
    const headers = defaults({ requestId: requestHeaders.id, queueName }, res.headers);
    const obj = { headers, body: res.body };
    log.info(`BRIDGE RESPONSE`, { queueName, obj, ...session.logContext });
    return session.client.send(obj);
  };
}
