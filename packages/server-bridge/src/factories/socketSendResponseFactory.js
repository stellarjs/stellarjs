import Promise from 'bluebird';
import isUndefined from 'lodash/isUndefined';
import defaults from 'lodash/defaults';

export default function socketSendResponseFactory({ log }) {
  return function sendResponse(session, requestHeaders, res) {
    if (isUndefined(session.client)) {
      log.warn(`${session.logPrefix}: Socket was closed before response could be bridged.`);
      return Promise.reject(new Error('Socket was closed'));
    }

    const queueName = requestHeaders.respondTo;
    const headers = defaults({ requestId: requestHeaders.id, queueName }, res.headers);
    const obj = { headers, body: res.body };
    log.info(`${session.logPrefix} BRIDGE RESPONSE`, { queueName, obj });
    return session.client.send(obj);
  };
}
