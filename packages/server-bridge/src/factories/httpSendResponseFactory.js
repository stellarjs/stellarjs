import Promise from 'bluebird';
import isUndefined from 'lodash/isUndefined';

export default function httpSendResponseFactory({ log }) {
  return function sendResponse(session, requestHeaders, res) {
    if (isUndefined(session.client)) {
      log.warn(`Http socket was closed before response could be bridged.`, session.logPrefix);
      return Promise.reject(new Error('HttpSocket was closed'));
    }

    log.info(`BRIDGE RESPONSE`, { res, ...session.logPrefix });
    return session.client.send(res);
  };
}
