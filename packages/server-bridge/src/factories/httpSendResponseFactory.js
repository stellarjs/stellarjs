import Promise from 'bluebird';
import isUndefined from 'lodash/isUndefined';

export default function httpSendResponseFactory({ log }) {
  return function sendResponse(session, requestHeaders, res) {
    if (isUndefined(session.client)) {
      log.warn(`${session.logPrefix}: Http socket was closed before response could be bridged.`);
      return Promise.reject(new Error('HttpSocket was closed'));
    }

    log.info(`${session.logPrefix} BRIDGE RESPONSE`, { res });
    return session.client.send(res);
  };
}
