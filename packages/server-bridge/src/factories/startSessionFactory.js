import assign from 'lodash/assign';
import get from 'lodash/get';
import url from 'url';

export default function startSessionFactory({ log, source }) {
  return function startSession(req, baseSession) {
    const { defaultSessionId } = baseSession;
    const requestUrl = get(req, 'url');
    const parsedUrl = url.parse(requestUrl, true);
    const sessionId = get(parsedUrl, 'query.x-sessionId') || defaultSessionId;

    const session = {
      startTime: Date.now(),
      source,
      sessionId,
      logPrefix: `${source} @StellarBridge(${sessionId})`,
      ip: get(req, 'headers.x-forwarded-for') || get(req, 'connection.remoteAddress'),
      headers: { bridges: [source] },
      reactiveStoppers: {},
      offlineFn: undefined,
      registerStopper(channel, stopperPromise, requestId) {
        assign(session.reactiveStoppers,
          {
            [channel]: [requestId, () => {
              log.info(`stopped subscription`, { channel, ...session.logPrefix });
              if (!session.reactiveStoppers[channel]) {
                throw new Error(`ReactiveStopper for channel=${channel} requestId=${requestId} not found`);
              }

              delete session.reactiveStoppers[channel];
              return stopperPromise.then(stopper => stopper());
            }],
          });
      },
      ...baseSession,
    };

    return session;
  };
}
