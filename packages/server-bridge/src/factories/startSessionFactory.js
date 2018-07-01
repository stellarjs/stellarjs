import assign from 'lodash/assign';
import get from 'lodash/get';
import url from 'url';
import { WebsocketTransport } from '@stellarjs/transport-socket';

export default function startSessionFactory({ log, source }) {
  return function startSession(socket) {
    const requestUrl = get(socket, 'request.url');
    const parsedUrl = url.parse(requestUrl, true);
    const socketId = socket.id;
    const sessionId = get(parsedUrl, 'query.x-sessionId') || socketId;

    const session = {
      source,
      sessionId,
      socketId,
      logPrefix: `${source} @StellarBridge(${sessionId})`,
      ip: get(socket, 'request.connection.remoteAddress'),
      headers: { bridges: [source] },
      reactiveStoppers: {},
      offlineFn: undefined,
      client: new WebsocketTransport(socket, source, log, true),
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
          });
      }
    };

    return session;
  };
}
