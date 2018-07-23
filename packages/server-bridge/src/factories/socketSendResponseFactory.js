import isUndefined from 'lodash/isUndefined';
import defaults from 'lodash/defaults';

export default function socketSendResponseFactory({ log }) {
  return function sendResponse(session, requestHeaders, res) {
    if (isUndefined(session.client)) {
      log.warn(`Socket was closed before response could be bridged.`, session.logPrefix);
      throw new Error('Socket was closed');
    }

    const queueName = requestHeaders.respondTo;
    const headers = defaults({ requestId: requestHeaders.id, queueName }, res.headers);
    const obj = { headers, body: res.body };
    log.info(`BRIDGE RESPONSE`, { queueName, obj, ...session.logPrefix });
    return session.client.send(obj);
  };
}
