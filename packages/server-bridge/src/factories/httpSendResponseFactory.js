import isNil from 'lodash/isNil';

export default function httpSendResponseFactory({ log }) {
  return function sendResponse(session, requestHeaders, res) {
    if (isNil(session.client)) {
      log.warn(`Http socket was closed before response could be bridged.`, session.logContext);
      return Promise.reject(new Error('HttpSocket was closed'));
    }

    log.info(`BRIDGE RESPONSE`, { res, ...session.logContext });
    return session.client.send(res);
  };
}
