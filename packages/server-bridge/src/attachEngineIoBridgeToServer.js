import Promise from 'bluebird';

import forEach from 'lodash/forEach';
import invoke from 'lodash/invoke';
import last from 'lodash/last';
import pick from 'lodash/pick';
import size from 'lodash/size';

import defaultStartSessionFactory from './factories/startSessionFactory';
import defaultHandleMessageFactory from './factories/handleMessageFactory';
import defaultReportErrorFactory from './factories/reportErrorFactory';
import defaultSendResponseFactory from './factories/sendResponseFactory';
import defaultCallHandlersSeriallyFactory from './factories/callHandlersSeriallyFactory';
import getTxName from './getTxName';
import getConfigWithDefaults from './getConfigWithDefaults';

export default function attachEngineIoBridgeToServer(originalConfig) {
  const config = getConfigWithDefaults(originalConfig);
  const {
    server,
    log,
    instrumentation,
    stellarRequest,
    reportErrorFactory = defaultReportErrorFactory,
    startSessionFactory = defaultStartSessionFactory,
    handleMessageFactory = defaultHandleMessageFactory,
    callHandlersSeriallyFactory = defaultCallHandlersSeriallyFactory,
    sendResponseFactory = defaultSendResponseFactory
  } = config;

  const reportError = reportErrorFactory(config);
  const startSession = startSessionFactory(config);
  const callHandlersSerially = callHandlersSeriallyFactory(config);
  const sendResponse = sendResponseFactory(config);
  const handleMessage = handleMessageFactory({ ...config, sendResponse });

  const sessions = {};
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

    delete session.client; // eslint-disable-line no-param-reassign
    delete sessions[session.socketId]; // eslint-disable-line no-param-reassign
    invoke('session.offlineFn', session);

    log.info(`${session.logPrefix}.onclose: Deleting stellar websocket client`, pick(session, ['sessionId']));
  }

  function onMessage(str, session) {
    let command = null;
    try {
      command = JSON.parse(str);
    } catch (e) {
      reportError(e, session, str);
      return;
    }

    const req = command.data;

    instrumentation.startTransaction(getTxName(req.headers), session, () => {
      Promise
        .try(() => handleMessage(session, req))
        .then(() => instrumentation.done())
        .catch((e) => {
          const errorResponse = stellarRequest._prepareResponse(req, e);
          sendResponse(session, req.headers, errorResponse);
          instrumentation.done(e);
          reportError(e, session, command);
        });
    });
  }

  function onConnection(socket) {
    instrumentation.numOfConnectedClients(Date.now(), size(server.clients));
    log.info(`${stellarRequest.source} @StellarBridge: New Connection`);
    const startTime = Date.now();
    const initialSession = startSession(socket);

    socket.on('error', () => log.info(`${initialSession.logPrefix} Error`));

    const initialOnClose = () => onClose(initialSession);
    socket.on('close', initialOnClose);

    callHandlersSerially({ source: stellarRequest.source, socket, session: initialSession })
      .then((session) => {
        sessions[socket.id] = session; // eslint-disable-line better-mutation/no-mutation
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
