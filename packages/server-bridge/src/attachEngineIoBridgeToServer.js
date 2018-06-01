import Promise from 'bluebird';
import url from 'url';

import assign from 'lodash/assign';
import forEach from 'lodash/forEach';
import get from 'lodash/get';
import last from 'lodash/last';
import pick from 'lodash/pick';
import size from 'lodash/size';

import { WebsocketTransport } from '@stellarjs/transport-socket';

import startSessionFactory from './factories/startSessionFactory';
import handleMessageFactory from './factories/handleMessageFactory';
import reportErrorFactory from './factories/reportErrorFactory';
import getSessionFactory from './factories/getSessionFactory';
import getTxNameFactory from './factories/getTxNameFactory';
import callHandlersSeriallyFactory from './factories/callHandlersSeriallyFactory';
import getConfigWithDefaults from './getConfigWithDefaults';

function assignClientToSession({ log, source, socket, session }) {
  return assign(session, { client: new WebsocketTransport(socket, source, log, true) });
}

export default function attachEngineIoBridgeToServer(originalConfig) {
  const config = getConfigWithDefaults(originalConfig);
  const {
        server,
        log,
        instrumentation,
        newSessionHandlers,
        stellarRequest,
    } = config;

  const reportError = reportErrorFactory(config);
  const startSession = startSessionFactory(config);
  const handleMessage = handleMessageFactory({ stellarRequest, ...config });
  const getSession = getSessionFactory(config);
  const getTxName = getTxNameFactory(config);
  const callHandlersSerially = callHandlersSeriallyFactory(config);

  const _newSessionHandlers = [assignClientToSession].concat(newSessionHandlers);
  function onClose(session) {
    log.error(`${session.logPrefix}: onClose`);
    instrumentation.numOfConnectedClients(Date.now(), size(server.clients));
    forEach(session.reactiveStoppers, (stopper, channel) => {
      if (last(stopper)) {
        last(stopper)();
      } else {
        log.error(`${session.logPrefix}: Unable to find stopper for ${channel}`,
                    { sessionId: session.sessionId, channel });
      }
    });

    const offlineFns = getSession(`${session.socketId}.offlineFns`);
    forEach(offlineFns, fn => fn());

    log.info(`${session.logPrefix}.onclose: Deleting stellar websocket client`, pick(session, ['sessionId']));
    delete session.client; // eslint-disable-line no-param-reassign
  }

  function onMessage(str, session) {
    let command = null;
    try {
      command = JSON.parse(str);
    } catch (e) {
      reportError(e, session, str);
      return;
    }

    instrumentation.startTransaction(getTxName(command.data.headers), session, () => {
      Promise
                .try(() => handleMessage(session, command.data))
                .then(() => instrumentation.done())
                .catch((e) => {
                  instrumentation.done(e);
                  reportError(e, session, command);
                });
    });
  }

  function onConnection(socket) {
    instrumentation.numOfConnectedClients(Date.now(), size(server.clients));
    log.info(`${stellarRequest.source} @StellarBridge: New Connection`);
    const startTime = Date.now();

    const requestUrl = get(socket, 'request.url');
    const parsedUrl = url.parse(requestUrl, true);
    const socketId = socket.id;
    const sessionId = get(parsedUrl, 'query.x-sessionId') || socketId;

    const initialSession = startSession({
      ip: get(socket, 'request.connection.remoteAddress'),
      sessionId,
      socketId,
      logPrefix: `${stellarRequest.source} @StellarBridge(${socketId}, ${sessionId})`,
    });

    socket.on('error', () => log.info(`${initialSession.logPrefix} Error`));

    const initialOnClose = () => onClose(initialSession);
    socket.on('close', initialOnClose);
    callHandlersSerially(_newSessionHandlers, { source: stellarRequest.source, socket, session: initialSession })
            .then((session) => {
              log.info(`${session.logPrefix} Connected`, pick(session, ['sessionId']));

              socket.removeListener('close', initialOnClose);
              socket.on('close', () => onClose(session));
              socket.on('message', str => onMessage(str, session));

              instrumentation.sessionStarted(Date.now() - startTime, session);
              const hiMessage = {
                messageType: 'connected',
                message: 'connected to stellar bridge',
                userId: session.authenticatedUserId,
                sessionId: session.sessionId };
              return socket.send(JSON.stringify(hiMessage));
            })
            .catch((e) => {
              reportError(e, initialSession);
              log.error(e, `${initialSession.logPrefix} Connection error`);
              instrumentation.sessionFailed(Date.now() - startTime);
              const errorMessage = { messageType: 'error', errorType: e.constructor.name, message: e.message, status: 401 };
              socket.send(JSON.stringify(errorMessage));
            });
  }

  server.on('connection', onConnection);
}
