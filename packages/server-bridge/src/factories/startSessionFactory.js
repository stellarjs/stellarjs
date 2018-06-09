import uuid from 'uuid';
import assign from 'lodash/assign';
import merge from 'lodash/merge';

export default function startSessionFactory({ log, source }) {
  return function startSession(defaultSession) {
    const sessionId = defaultSession.sessionId || uuid();
    const session = {
      source,
      sessionId,
      logPrefix: `${source} @StellarBridge(${sessionId})`,
      headers: { bridges: [source] },
      mergeAttributes(...attrs) {
        return merge(session, ...attrs);
      },
      reactiveStoppers: {},
      offlineFn: undefined,
      registerStopper(channel, stopperPromise, requestId) {
        assign(session.reactiveStoppers,
          {
            [channel]: [requestId, () => {
              log.info(`${session.logPrefix}: stopped subscription`, { channel });
              if (!session.reactiveStoppers[channel]) {
                throw new Error(`ReactiveStopper for channel=${channel} requestId=${requestId} not found`);
              }

              delete session.reactiveStoppers[channel];
              return stopperPromise.then(stopper => stopper());
            }],
          }
                );
      },
      setSessionHeaders(headers) {
        this.headers = assign({}, headers, { bridges: [source] });
      },
      ...defaultSession,
    };

    return session;
  };
}
