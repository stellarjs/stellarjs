import uuid from 'uuid';
import assign from 'lodash/assign';

export default function startSessionFactory({ log, source, sessions }) {
  return function startSession(defaultSession) {
    const sessionId = defaultSession.sessionId || uuid();
    const session = {
      source,
      sessionId,
      reactiveStoppers: {},
      logPrefix: `${source} @StellarBridge(${sessionId})`,
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
      offlineFns: [() => {
        log.info(`${session.logPrefix}: ended session`);
        delete sessions[sessionId]; // eslint-disable-line no-param-reassign
      }],
      setSessionHeaders(headers) {
        this.headers = assign({}, headers, { bridges: [source] });
      },
      ...defaultSession,
    };

    sessions[session.sessionId] = session;  // eslint-disable-line no-param-reassign, better-mutation/no-mutation
    return session;
  };
}
